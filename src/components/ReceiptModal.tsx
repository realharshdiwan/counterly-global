import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  MessageCircle, 
  Phone,
  QrCode,
  Barcode,
  Layers,
  FileText,
  Edit3,
  Building2
} from 'lucide-react';
import QRCode from 'qrcode';
import { type Bill, type ShopConfig } from '../types';
import { db } from '../db/db';
import { generateEscPosReceipt, bluetoothPrinter, numberToWords } from '../lib/printer';
import { generateWhatsAppReceiptText, openWhatsAppReceipt } from '../lib/whatsapp';
import { encodeCode128 } from '../lib/barcode';

export type PaperSize = '80mm' | '58mm' | 'a4';
export type QrDisplayType = 'auto' | 'upi' | 'everify' | 'none';

interface ReceiptModalProps {
  bill: Bill;
  config: ShopConfig | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ bill: initialBill, config, onClose }) => {
  const [activeBill, setActiveBill] = useState<Bill>(initialBill);
  const bill = activeBill;

  const [paperSize, setPaperSize] = useState<PaperSize>(() => {
    // If it's a B2B Institutional bill, automatically default to formal A4 Sheet!
    if (initialBill.bill_type === 'b2b') return 'a4';
    const saved = localStorage.getItem('receipt_paper_size') as PaperSize;
    if (saved === '80mm' || saved === '58mm' || saved === 'a4') return saved;
    return config?.printer_width === 32 ? '58mm' : '80mm';
  });

  // Buyer editing modal state
  const [isEditingBuyer, setIsEditingBuyer] = useState(false);
  const [editBuyerName, setEditBuyerName] = useState(bill.customer_name || bill.school_name || '');
  const [editBuyerGstin, setEditBuyerGstin] = useState(bill.customer_gstin || '');
  const [editBuyerAddress, setEditBuyerAddress] = useState(bill.customer_address || '');
  const [editPoNumber, setEditPoNumber] = useState(bill.po_number || '');
  const [isSavingBuyer, setIsSavingBuyer] = useState(false);

  const handleSaveBuyerDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBuyer(true);
    try {
      const updatedFields: Partial<Bill> = {
        customer_name: editBuyerName.trim(),
        customer_gstin: editBuyerGstin.trim().toUpperCase() || undefined,
        customer_address: editBuyerAddress.trim() || undefined,
        po_number: editPoNumber.trim() || undefined,
        bill_type: 'b2b',
      };

      await db.bills.update(activeBill.id, updatedFields);
      setActiveBill(prev => ({
        ...prev,
        ...updatedFields,
      }));
      setIsEditingBuyer(false);
    } catch (err) {
      console.error('Failed to update buyer details:', err);
    } finally {
      setIsSavingBuyer(false);
    }
  };

  const [qrMode, setQrMode] = useState<QrDisplayType>(() => {
    const saved = localStorage.getItem('receipt_qr_mode') as QrDisplayType;
    if (saved === 'auto' || saved === 'upi' || saved === 'everify' || saved === 'none') {
      return saved;
    }
    return 'auto'; // smart default: UPI Pay if unpaid, E-Verify if paid
  });

  // Effective QR mode based on bill payment state
  const effectiveQr = useMemo<'upi' | 'everify' | 'none'>(() => {
    if (qrMode === 'none') return 'none';
    if (qrMode === 'upi') return 'upi';
    if (qrMode === 'everify') return 'everify';
    // 'auto' mode:
    return bill.is_paid ? 'everify' : 'upi';
  }, [qrMode, bill.is_paid]);

  const [showReturnBarcode, setShowReturnBarcode] = useState<boolean>(() => {
    return localStorage.getItem('receipt_show_return_barcode') !== 'false';
  });

  const [a4FitPage, setA4FitPage] = useState(false);
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('');
  const [eVerifyQrDataUrl, setEVerifyQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [printingBle, setPrintingBle] = useState(false);
  const [bleStatusMsg, setBleStatusMsg] = useState<string | null>(null);
  const [whatsappPhone, setWhatsappPhone] = useState(bill.customer_phone || '');

  const shopName = config?.legal_name || 'SARASWATI GARMENTS';
  const shopTagline = config?.shop_tagline || 'School Uniforms & Retail Garments';
  const shopAddress = config?.shop_address || 'Market Complex, Station Road';
  const shopPhone = config?.shop_phone || '+91 98765 43210';
  const shopGstin = config?.gstin || '';
  const isComposition = config?.gst_scheme !== 'regular' && config?.gst_scheme !== 'none';

  const dateObj = new Date(bill.created_at);
  const formattedDate = dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Persist paper size change
  const handlePaperSizeChange = (sz: PaperSize) => {
    setPaperSize(sz);
    localStorage.setItem('receipt_paper_size', sz);
  };

  const cycleQrMode = () => {
    const modes: QrDisplayType[] = ['auto', 'upi', 'everify', 'none'];
    const nextIdx = (modes.indexOf(qrMode) + 1) % modes.length;
    const nextMode = modes[nextIdx];
    setQrMode(nextMode);
    localStorage.setItem('receipt_qr_mode', nextMode);
  };

  const handleToggleBarcode = () => {
    const nextVal = !showReturnBarcode;
    setShowReturnBarcode(nextVal);
    localStorage.setItem('receipt_show_return_barcode', String(nextVal));
  };

  // Generate Dynamic UPI Payment QR Code
  useEffect(() => {
    if (effectiveQr !== 'upi') return;
    const payeeVpa = config?.upi_id || 'merchant@upi';
    const payeeName = config?.legal_name || 'SARASWATI GARMENTS';
    const upiUri = `upi://pay?pa=${encodeURIComponent(payeeVpa)}&pn=${encodeURIComponent(payeeName)}&am=${bill.total}&tn=${encodeURIComponent('Bill ' + bill.bill_number)}&cu=INR`;

    QRCode.toDataURL(upiUri, {
      width: paperSize === '58mm' ? 140 : 180,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then(url => setUpiQrDataUrl(url))
      .catch(err => console.error('Failed to generate UPI QR:', err));
  }, [bill.bill_number, bill.total, config?.upi_id, config?.legal_name, effectiveQr, paperSize]);

  // Generate E-Receipt Verification QR Code
  useEffect(() => {
    if (effectiveQr !== 'everify') return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const verifyUrl = `${origin}/?verify=${encodeURIComponent(bill.bill_number)}`;

    QRCode.toDataURL(verifyUrl, {
      width: paperSize === '58mm' ? 120 : 160,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then(url => setEVerifyQrDataUrl(url))
      .catch(err => console.error('Failed to generate verification QR:', err));
  }, [bill.bill_number, effectiveQr, paperSize]);

  // Compute Code 128 Barcode for return & exchange
  const barcodeData = useMemo(() => {
    return encodeCode128(bill.bill_number);
  }, [bill.bill_number]);

  // Browser Print Trigger with dynamic @page rule
  const handleBrowserPrint = () => {
    const styleId = 'dynamic-print-paper-size';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    if (paperSize === '58mm') {
      styleEl.textContent = `@page { size: auto; margin: 0mm; } html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; }`;
    } else if (paperSize === '80mm') {
      styleEl.textContent = `@page { size: auto; margin: 0mm; } html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; }`;
    } else {
      styleEl.textContent = `@page { size: A4 portrait; margin: 5mm 6mm; } html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; }`;
    }

    setTimeout(() => {
      window.print();
    }, 50);
  };

  // Bluetooth Thermal Print Trigger
  const handleBluetoothPrint = async () => {
    if (!config) return;
    setPrintingBle(true);
    setBleStatusMsg(null);

    try {
      if (!bluetoothPrinter.isConnected()) {
        setBleStatusMsg('Connecting to Bluetooth printer...');
        await bluetoothPrinter.connect();
      }

      setBleStatusMsg('Sending receipt bytes...');
      // If 58mm selected, override to 32 columns. If 80mm or A4, use 48 columns
      const targetColumns = paperSize === '58mm' ? 32 : 48;
      const escPosData = generateEscPosReceipt(bill, config, targetColumns);
      await bluetoothPrinter.printData(escPosData);
      setBleStatusMsg('Printed successfully!');
      setTimeout(() => setBleStatusMsg(null), 3000);
    } catch (err: unknown) {
      console.error('BLE Print error:', err);
      setBleStatusMsg((err as Error)?.message || 'Failed to connect/print');
    } finally {
      setPrintingBle(false);
    }
  };

  // WhatsApp Share receipt link with complete itemized bill
  const handleWhatsAppShare = () => {
    const text = generateWhatsAppReceiptText(bill, config);
    openWhatsAppReceipt(whatsappPhone || bill.customer_phone || '', text);
  };

  // Copy plain text receipt to clipboard
  const handleCopyReceipt = () => {
    const itemsText = bill.items
      .map(it => {
        const schTag = it.school_code ? `[${it.school_code}] ` : '';
        const sz = it.size_label ? ` (${it.size_label})` : '';
        return `• ${schTag}${it.product_name}${sz} x${it.qty} = Rs.${it.subtotal}`;
      })
      .join('\n');

    const text = `${shopName}\nBill No: ${bill.bill_number}\nDate: ${formattedDate} ${formattedTime}\nSchool: ${bill.school_name}\n\n${itemsText}\n\nTotal: Rs.${bill.total}\nPayment: ${bill.payment_method.toUpperCase()}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto print:block print:overflow-visible">
      <div 
        className={`bg-white rounded-2xl w-full shadow-2xl border border-[#E5E5E7] overflow-hidden my-auto animate-in zoom-in-95 transition-all duration-200 print:border-none print:shadow-none print:p-0 print:m-0 print:static print:w-full print:max-w-none print:overflow-visible ${
          paperSize === 'a4' ? 'max-w-4xl xl:max-w-5xl' : paperSize === '80mm' ? 'max-w-lg' : 'max-w-md'
        }`}
      >
        {/* Modal Top Bar */}
        <div className="p-3.5 sm:p-4 bg-[#F5F5F7] border-b border-[#E5E5E7] flex flex-wrap items-center justify-between gap-2.5 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-[#1D1D1F]">
              Receipt #{bill.bill_number}
            </span>
            <span className="text-[11px] font-semibold text-[#1D1D1F] bg-white border border-[#E5E5E7] px-2 py-0.5 rounded-md">
              {bill.is_paid ? 'Paid' : 'Unpaid'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Bluetooth Thermal Print Trigger */}
            <button
              type="button"
              onClick={handleBluetoothPrint}
              disabled={printingBle}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E5E5E7] hover:bg-[#E5E5E7] text-[#1D1D1F] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Print via Bluetooth thermal printer"
            >
              <Printer className="w-3.5 h-3.5 text-[#1D1D1F]" />
              <span className="hidden sm:inline">{printingBle ? 'Printing...' : 'BLE Thermal'}</span>
            </button>

            {/* Copy Plain Text Receipt */}
            <button
              type="button"
              onClick={handleCopyReceipt}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E5E5E7] hover:bg-[#E5E5E7] text-[#1D1D1F] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Copy receipt text to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#86868B]" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-[#86868B] hover:text-[#1D1D1F] p-1.5 rounded-lg hover:bg-[#E5E5E7] transition-colors cursor-pointer ml-1"
              title="Close receipt modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Size & Feature Switcher Toolbar */}
        <div className="px-4 py-2.5 bg-white border-b border-[#E5E5E7] flex flex-wrap items-center justify-between gap-2.5 text-xs print:hidden">
          {/* Paper Size Switcher: 80 mm, 58 mm, A4 */}
          <div className="flex items-center gap-1 bg-[#F5F5F7] p-1 rounded-xl border border-[#E5E5E7]">
            <button
              type="button"
              onClick={() => handlePaperSizeChange('80mm')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                paperSize === '80mm'
                  ? 'bg-[#1D1D1F] text-white shadow-xs'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
              title="80mm 3-inch standard POS thermal roll"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>80 mm</span>
            </button>

            <button
              type="button"
              onClick={() => handlePaperSizeChange('58mm')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                paperSize === '58mm'
                  ? 'bg-[#1D1D1F] text-white shadow-xs'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
              title="58mm 2-inch compact mini thermal roll"
            >
              <Printer className="w-3 h-3" />
              <span>58 mm</span>
            </button>

            <button
              type="button"
              onClick={() => handlePaperSizeChange('a4')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                paperSize === 'a4'
                  ? 'bg-[#1D1D1F] text-white shadow-xs'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
              title="Full A4 sheet tax invoice / bulk school supply bill"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>A4 Sheet</span>
            </button>
          </div>

          {/* Toggles: QR Code Mode & Scannable Return Barcode */}
          <div className="flex items-center gap-2">
            {/* Dynamic QR Mode Switcher: Auto / UPI Pay / E-Verify / Off */}
            <button
              type="button"
              onClick={cycleQrMode}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                qrMode !== 'none'
                  ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                  : 'bg-[#F5F5F7] text-[#86868B] border-[#E5E5E7] hover:text-[#1D1D1F]'
              }`}
              title="Click to switch QR code: Auto (UPI if unpaid, E-Verify if paid) / UPI Pay / E-Verify / Off"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>
                {qrMode === 'auto'
                  ? `QR: Auto (${bill.is_paid ? 'E-Verify' : 'UPI Pay'})`
                  : qrMode === 'upi'
                  ? `QR: UPI Pay (₹${bill.total})`
                  : qrMode === 'everify'
                  ? 'QR: E-Verify'
                  : 'QR: Off'}
              </span>
            </button>

            {/* Return Barcode Toggle */}
            <button
              type="button"
              onClick={handleToggleBarcode}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                showReturnBarcode
                  ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                  : 'bg-[#F5F5F7] text-[#86868B] border-[#E5E5E7] hover:text-[#1D1D1F]'
              }`}
              title="Toggle scannable barcode for size exchanges and returns"
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Barcode {showReturnBarcode ? 'ON' : 'OFF'}</span>
            </button>

            {/* A4 Fit Page Toggle (only for A4) */}
            {paperSize === 'a4' && (
              <button
                type="button"
                onClick={() => setA4FitPage(!a4FitPage)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  a4FitPage
                    ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                    : 'bg-[#F5F5F7] text-[#86868B] border-[#E5E5E7] hover:text-[#1D1D1F]'
                }`}
                title="Fit full A4 invoice to screen without scrolling"
              >
                <span>Fit Screen {a4FitPage ? 'ON' : 'OFF'}</span>
              </button>
            )}
          </div>
        </div>

        {/* PRINTABLE RECEIPT CONTENT CONTAINER */}
        <div className={`p-3 sm:p-5 md:p-6 bg-[#F5F5F7] flex flex-col items-center overflow-y-auto transition-all print:p-0 print:m-0 print:max-h-none print:h-auto print:overflow-visible print:bg-white print:block print:w-full ${
          paperSize === 'a4' ? 'max-h-[85vh]' : 'max-h-[78vh]'
        }`}>
          {/* ============================================================== */}
          {/* CASE 1 & 2: THERMAL RECEIPT (80mm OR 58mm) */}
          {/* ============================================================== */}
          {(paperSize === '80mm' || paperSize === '58mm') && (
            <div
              id="printable-receipt"
              className={`bg-white rounded-xl border border-dashed border-[#E5E5E7] shadow-xs font-mono text-[#1D1D1F] mx-auto transition-all print:border-none print:shadow-none print:p-0 print:m-0 print:overflow-visible print:h-auto ${
                paperSize === '58mm'
                  ? 'w-[235px] max-w-[235px] p-3 text-[10px] print-size-58mm'
                  : 'w-[320px] max-w-[320px] p-5 text-xs print-size-80mm'
              }`}
            >
              {/* Shop Header */}
              <div className="text-center pb-2.5 border-b border-dashed border-slate-300">
                <div className={`font-black tracking-tight text-black ${paperSize === '58mm' ? 'text-sm' : 'text-base'}`}>
                  {shopName}
                </div>
                <div className={`text-slate-600 mt-0.5 ${paperSize === '58mm' ? 'text-[9px]' : 'text-[11px]'}`}>
                  {shopTagline}
                </div>
                <div className={`text-slate-500 mt-0.5 leading-tight ${paperSize === '58mm' ? 'text-[8.5px]' : 'text-[10px]'}`}>
                  {shopAddress}
                </div>
                <div className={`text-slate-600 mt-0.5 ${paperSize === '58mm' ? 'text-[9px]' : 'text-[10px]'}`}>
                  Ph: {shopPhone}
                </div>
                {shopGstin && (
                  <div className={`text-slate-700 font-bold mt-0.5 ${paperSize === '58mm' ? 'text-[9px]' : 'text-[10px]'}`}>
                    GSTIN: {shopGstin}
                  </div>
                )}

                <div className="mt-2 pt-1.5 border-t border-dotted border-slate-300">
                  <div className={`font-extrabold uppercase tracking-wider text-slate-900 ${paperSize === '58mm' ? 'text-[10px]' : 'text-[11px]'}`}>
                    {config?.gst_scheme === 'regular' ? 'TAX INVOICE' : config?.gst_scheme === 'none' ? 'RETAIL CASH MEMO' : 'BILL OF SUPPLY'}
                  </div>
                  {isComposition && (
                    <div className={`text-slate-500 italic mt-0.5 leading-tight ${paperSize === '58mm' ? 'text-[8px]' : 'text-[9px]'}`}>
                      (Composition taxable person, not eligible to collect tax on supplies)
                    </div>
                  )}
                </div>
              </div>

              {/* Bill Meta */}
              <div className={`py-2 border-b border-dashed border-slate-300 space-y-0.5 ${paperSize === '58mm' ? 'text-[9px]' : 'text-[11px]'}`}>
                <div className="flex justify-between">
                  <span>Bill No:</span>
                  <span className="font-bold text-black">{bill.bill_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{formattedDate} {formattedTime}</span>
                </div>
                {bill.school_name && !bill.school_name.includes('Counter Sale') && !bill.school_name.includes('General Retail') && bill.school_id !== 'sch_general' && (
                  <div className="flex justify-between">
                    <span>{config?.store_type === 'uniform' ? 'School:' : 'Catalog:'}</span>
                    <span className="font-bold text-black text-right max-w-[190px] break-words">{bill.school_name}</span>
                  </div>
                )}
                {(bill.customer_name || bill.customer_phone) && (
                  <div className="flex justify-between">
                    <span>Cust:</span>
                    <span className="break-words max-w-[190px] text-right font-medium">
                      {[bill.customer_name, bill.customer_phone].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                )}
                {bill.billed_by_name && (
                  <div className="flex justify-between text-slate-500">
                    <span>Cashier:</span>
                    <span className="font-semibold text-slate-700">{bill.billed_by_name}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className={`py-2 border-b border-dashed border-slate-300 ${paperSize === '58mm' ? 'text-[9.5px]' : 'text-[11px]'}`}>
                <div className="flex justify-between font-bold pb-1 text-slate-700">
                  <span>Item / Size</span>
                  <span>Qty × Rate = Amt</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {bill.items.map(item => (
                    <div key={item.id} className="flex flex-col">
                      <div className="flex justify-between font-bold text-black">
                        <span className="break-words pr-1 leading-snug">
                          {item.school_code ? `[${item.school_code}] ` : ''}{item.product_name}
                        </span>
                        <span className="shrink-0 font-mono">₹{item.subtotal.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 pl-1 text-[9px]">
                        <span>Sz: {item.size_label || 'Free'}</span>
                        <span>{item.qty} × ₹{item.unit_price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className={`py-2 border-b border-dashed border-slate-300 space-y-1 ${paperSize === '58mm' ? 'text-[9.5px]' : 'text-[11px]'}`}>
                <div className="flex justify-between text-slate-600">
                  <span>Total Items:</span>
                  <span className="font-semibold">{bill.items.length} items ({bill.items.reduce((s, it) => s + it.qty, 0)} pcs)</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{(bill.subtotal || bill.total).toLocaleString('en-IN')}</span>
                </div>
                {bill.discount_amount > 0 && (
                  <div className="flex justify-between text-emerald-800 font-semibold">
                    <span>Discount:</span>
                    <span>-₹{bill.discount_amount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className={`flex justify-between font-black pt-1 border-t border-dotted border-slate-400 text-black ${paperSize === '58mm' ? 'text-xs' : 'text-sm'}`}>
                  <span>Grand Total:</span>
                  <span>₹{bill.total.toLocaleString('en-IN')}</span>
                </div>
                <div className={`text-slate-600 mt-1 leading-tight ${paperSize === '58mm' ? 'text-[8px]' : 'text-[9.5px]'}`}>
                  Words: <span className="italic font-normal">{numberToWords(bill.total)}</span>
                </div>
              </div>

              {/* Payment Info */}
              <div className={`py-1.5 text-slate-600 space-y-0.5 ${paperSize === '58mm' ? 'text-[8.5px]' : 'text-[10px]'}`}>
                <div className="flex justify-between">
                  <span>Payment:</span>
                  <span className="font-extrabold uppercase text-black">{bill.payment_method}</span>
                </div>
                {bill.payment_details && bill.payment_method === 'split' && (
                  <div className="pl-1 space-y-0.5 text-[8.5px] text-slate-500">
                    {Number(bill.payment_details.cash || 0) > 0 && <div>Cash: ₹{bill.payment_details.cash}</div>}
                    {Number(bill.payment_details.upi || 0) > 0 && <div>UPI: ₹{bill.payment_details.upi}</div>}
                    {Number(bill.payment_details.card || 0) > 0 && <div>Card: ₹{bill.payment_details.card}</div>}
                    {Number(bill.payment_details.credit || 0) > 0 && <div>Khata: ₹{bill.payment_details.credit}</div>}
                  </div>
                )}
              </div>

              {/* Scannable Barcode for Returns & Exchange */}
              {showReturnBarcode && (
                <div className="pt-2 pb-1 border-t border-dashed border-slate-300 text-center flex flex-col items-center">
                  <div className="text-[8px] font-bold text-slate-700 uppercase tracking-widest mb-1">
                    Return & Exchange Barcode
                  </div>
                  <div className="w-full px-2 flex justify-center">
                    <svg
                      className={`w-full ${paperSize === '58mm' ? 'h-6' : 'h-8'}`}
                      viewBox={`0 0 ${barcodeData.totalWidth} 12`}
                      preserveAspectRatio="none"
                    >
                      {barcodeData.pattern.split('').map((bit, idx) => (
                        bit === '1' ? (
                          <rect key={idx} x={idx} y={0} width={1} height={12} fill="#000000" />
                        ) : null
                      ))}
                    </svg>
                  </div>
                  <div className="text-[9px] font-bold font-mono tracking-widest text-black mt-0.5">
                    * {bill.bill_number} *
                  </div>
                  <div className="text-[7.5px] text-slate-500 mt-0.5 leading-tight">
                    Scan at counter for instant exchange/return within 7 days
                  </div>
                </div>
              )}

              {/* Dynamic UPI Payment QR Code */}
              {effectiveQr === 'upi' && upiQrDataUrl && (
                <div className="pt-2 pb-1 border-t border-dashed border-slate-300 text-center flex flex-col items-center">
                  <div className={`font-black uppercase tracking-wider text-slate-900 ${paperSize === '58mm' ? 'text-[8.5px]' : 'text-[9.5px]'}`}>
                    Scan & Pay via UPI
                  </div>
                  <div className={`text-slate-500 font-semibold ${paperSize === '58mm' ? 'text-[7.5px]' : 'text-[8.5px]'}`}>
                    GPay · PhonePe · Paytm · BHIM
                  </div>
                  <div className="p-1 bg-white border border-slate-300 rounded-md my-1 shadow-2xs">
                    <img
                      src={upiQrDataUrl}
                      alt="UPI Payment QR"
                      className={paperSize === '58mm' ? 'w-24 h-24' : 'w-28 h-28'}
                    />
                  </div>
                  <div className={`font-mono font-black text-black ${paperSize === '58mm' ? 'text-[9px]' : 'text-[10px]'}`}>
                    Amount: ₹{bill.total.toLocaleString('en-IN')}
                  </div>
                  <div className={`text-slate-500 font-mono ${paperSize === '58mm' ? 'text-[7.5px]' : 'text-[8px]'}`}>
                    UPI: {config?.upi_id || 'merchant@upi'}
                  </div>
                </div>
              )}

              {/* E-Receipt Verification QR Code */}
              {effectiveQr === 'everify' && eVerifyQrDataUrl && (
                <div className="pt-2 pb-1 border-t border-dashed border-slate-300 text-center flex flex-col items-center">
                  <div className="text-[8px] font-extrabold uppercase tracking-wider text-slate-800 mb-1">
                    Scan to Verify Genuine E-Receipt
                  </div>
                  <img
                    src={eVerifyQrDataUrl}
                    alt="E-Receipt Verification QR"
                    className={`border border-slate-200 rounded-md p-0.5 bg-white ${
                      paperSize === '58mm' ? 'w-20 h-20' : 'w-24 h-24'
                    }`}
                  />
                  <div className="text-[7.5px] text-slate-500 font-mono mt-0.5">
                    Auth ID: {bill.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
              )}

              {/* Footer Note */}
              <div className="pt-2 text-center text-[9px] text-slate-500 border-t border-dashed border-slate-300 space-y-0.5">
                <p className="font-bold text-slate-700">Thank you for shopping with us!</p>
                <p className="text-[8px] leading-tight">Original bill & intact barcode tags required for exchange within 7 days.</p>
                <div className="text-[7.5px] text-slate-400 font-mono pt-1 select-none">
                  *** COMPLETE BILL • ALL ITEMS INCLUDED ***
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CASE 3: OFFICIAL A4 TAX INVOICE / B2B BULK SUPPLY BILL */}
          {/* ============================================================== */}
          {paperSize === 'a4' && (
            <div
              id="printable-receipt"
              className={`bg-white rounded-xl border border-[#E5E5E7] shadow-xs text-xs text-[#1D1D1F] w-full p-6 sm:p-8 font-sans print-size-a4 space-y-4 print:border-none print:shadow-none print:p-0 print:m-0 print:overflow-visible print:h-auto print:scale-100 ${
                a4FitPage ? 'scale-[0.80] sm:scale-[0.86] origin-top transition-transform' : ''
              }`}
            >
              {/* Formal Header: Seller on Left, Invoice Metadata on Right */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b-2 border-black">
                <div className="space-y-1 max-w-sm">
                  <h1 className="text-xl font-black tracking-tight text-black uppercase">
                    {shopName}
                  </h1>
                  <p className="text-xs font-semibold text-slate-700">{shopTagline}</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{shopAddress}</p>
                  <div className="text-[11px] text-slate-700 flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5 font-medium">
                    <span>Ph: {shopPhone}</span>
                    {config?.upi_id && <span>UPI: {config.upi_id}</span>}
                  </div>
                  {shopGstin && (
                    <div className="text-xs font-black text-black pt-0.5">
                      GSTIN: <span className="font-mono">{shopGstin}</span>
                    </div>
                  )}
                  {config?.state_name && (
                    <div className="text-[10px] text-slate-500">
                      State: {config.state_name} ({config.state_code || '08'})
                    </div>
                  )}
                </div>

                <div className="sm:text-right space-y-1">
                  <div className="inline-block px-3 py-1 bg-black text-white font-black text-xs uppercase tracking-widest rounded">
                    {config?.gst_scheme === 'regular' ? 'TAX INVOICE' : config?.gst_scheme === 'none' ? 'RETAIL CASH MEMO' : 'BILL OF SUPPLY'}
                  </div>
                  {isComposition && (
                    <p className="text-[9px] text-slate-500 italic max-w-xs sm:ml-auto leading-tight mt-1">
                      (Composition taxable person, not eligible to collect tax on supplies)
                    </p>
                  )}
                  <div className="pt-2 text-xs space-y-0.5">
                    <p><span className="text-slate-500">Invoice No:</span> <strong className="font-mono text-black">{bill.bill_number}</strong></p>
                    <p><span className="text-slate-500">Invoice Date:</span> <strong>{formattedDate}</strong></p>
                    <p><span className="text-slate-500">Time:</span> <span>{formattedTime}</span></p>
                    <p><span className="text-slate-500">Payment:</span> <strong className="uppercase">{bill.payment_method}</strong> ({bill.is_paid ? 'PAID' : 'PENDING'})</p>
                    <p><span className="text-slate-500">Reverse Charge:</span> <span>No</span></p>
                  </div>
                </div>
              </div>

              {/* B2B / Buyer Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Billed To (Buyer / Institution / School)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingBuyer(true)}
                      className="text-[10px] font-bold text-[#0071E3] hover:underline flex items-center gap-1 cursor-pointer print:hidden"
                      title="Edit Buyer / School Name, GSTIN, Address, or P.O. Number"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{bill.customer_gstin || bill.po_number || bill.customer_address ? 'Edit Buyer' : '+ Add Buyer Details'}</span>
                    </button>
                  </div>
                  <div className="font-bold text-sm text-black">
                    {bill.customer_name || bill.school_name || 'Retail Customer'}
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    {bill.schools && bill.schools.length > 1 ? `Associated Schools: ${bill.schools.join(', ')}` : `School: ${bill.school_name}`}
                  </div>
                  {bill.customer_phone && (
                    <div className="text-slate-600">Contact: {bill.customer_phone}</div>
                  )}
                  {bill.customer_address && (
                    <div className="text-slate-600 mt-0.5">{bill.customer_address}</div>
                  )}
                </div>

                <div className="sm:text-right space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
                    Supply & Tax Credentials
                  </span>
                  <div>
                    <span className="text-slate-500">Buyer GSTIN / UIN: </span>
                    <strong className="font-mono">{bill.customer_gstin || 'Unregistered / B2C'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Place of Supply: </span>
                    <strong>{config?.state_name || 'State Intra-Supply'}</strong>
                  </div>
                  {bill.po_number && (
                    <div>
                      <span className="text-slate-500">P.O. / Work Order Ref: </span>
                      <strong className="font-mono">{bill.po_number}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Itemized Table */}
              <div className="border border-[#E5E5E7] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1D1D1F] text-white text-[11px] font-bold">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-2 text-center">HSN</th>
                      <th className="py-2.5 px-2 text-center">Size</th>
                      <th className="py-2.5 px-2 text-center">Qty</th>
                      <th className="py-2.5 px-2 text-right">Unit Rate</th>
                      <th className="py-2.5 px-2 text-right">Disc</th>
                      <th className="py-2.5 px-3 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E7] bg-white">
                    {bill.items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-black">
                          {item.school_code ? <span className="text-[10px] bg-slate-100 border border-slate-200 px-1 py-0.5 rounded mr-1.5 font-bold">[{item.school_code}]</span> : null}
                          {item.product_name}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-500 text-[11px]">
                          {item.hsn || '6203'}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-700">
                          {item.size_label || 'Free'}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-black font-mono">
                          {item.qty}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono">
                          ₹{item.unit_price}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                          {item.discount_amount > 0 ? `₹${item.discount_amount}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-black font-mono">
                          ₹{item.subtotal.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Words Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                      Total Amount Chargeable (in words)
                    </span>
                    <p className="font-bold text-black text-xs italic">
                      {numberToWords(bill.total)}
                    </p>
                  </div>

                  {/* Bank Details Box for Institutional NEFT / RTGS payments */}
                  <div className="p-3 rounded-xl bg-white border border-[#E5E5E7] text-[11px] space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                      Bank Settlement Details (NEFT / RTGS / Cheque)
                    </span>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      <div><span className="text-slate-500">Bank:</span> <strong className="text-black">{config?.bank_name || 'State Bank of India'}</strong></div>
                      <div><span className="text-slate-500">A/C No:</span> <strong className="font-mono text-black">{config?.bank_account_no || '389201948291'}</strong></div>
                      <div><span className="text-slate-500">IFSC:</span> <strong className="font-mono text-black">{config?.bank_ifsc || 'SBIN0001234'}</strong></div>
                      <div><span className="text-slate-500">Branch:</span> <span>{config?.bank_branch || 'Main Branch'}</span></div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Items / Quantity:</span>
                    <span className="font-bold">{bill.items.length} items ({bill.items.reduce((s, it) => s + it.qty, 0)} pcs)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-mono font-semibold">₹{(bill.subtotal || bill.total).toLocaleString('en-IN')}</span>
                  </div>
                  {bill.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-800 font-semibold">
                      <span>Discount ({bill.discount_type === 'percent' ? '%' : 'Flat'}):</span>
                      <span className="font-mono">-₹{bill.discount_amount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {config?.gst_scheme === 'regular' ? (
                    <div className="flex justify-between text-slate-600 border-t border-slate-300 pt-1">
                      <span>GST (Included / Applied):</span>
                      <span className="font-mono font-semibold">₹{Math.round(bill.total * 0.05).toLocaleString('en-IN')}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between items-center text-base font-black text-black pt-2 border-t-2 border-black">
                    <span>Grand Total:</span>
                    <span className="font-mono text-lg">₹{bill.total.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Barcode & Signatures Bottom Grid */}
              <div className="pt-4 border-t border-[#E5E5E7] grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                {/* Return Barcode */}
                {showReturnBarcode && (
                  <div className="text-center sm:text-left flex flex-col items-center sm:items-start">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Return & Exchange Barcode
                    </span>
                    <svg
                      className="w-48 h-8"
                      viewBox={`0 0 ${barcodeData.totalWidth} 12`}
                      preserveAspectRatio="none"
                    >
                      {barcodeData.pattern.split('').map((bit, idx) => (
                        bit === '1' ? (
                          <rect key={idx} x={idx} y={0} width={1} height={12} fill="#000000" />
                        ) : null
                      ))}
                    </svg>
                    <span className="text-[10px] font-mono font-bold tracking-widest mt-0.5">
                      * {bill.bill_number} *
                    </span>
                  </div>
                )}

                {/* Dynamic UPI Payment QR Code */}
                {effectiveQr === 'upi' && upiQrDataUrl && (
                  <div className="flex items-center gap-2.5 p-2 rounded-xl border border-[#E5E5E7] bg-white">
                    <img
                      src={upiQrDataUrl}
                      alt="UPI Payment QR"
                      className="w-16 h-16 border border-slate-200 rounded p-0.5 bg-white shrink-0"
                    />
                    <div className="text-[9px] text-slate-600 leading-tight space-y-0.5">
                      <strong className="block text-black text-[10px]">Instant UPI Payment</strong>
                      <div>Total: <strong className="font-mono text-black">₹{bill.total.toLocaleString('en-IN')}</strong></div>
                      <div className="text-slate-500 font-mono text-[8px]">UPI: {config?.upi_id || 'merchant@upi'}</div>
                      <div className="text-[7.5px] text-slate-400">Scan via GPay / PhonePe / Paytm</div>
                    </div>
                  </div>
                )}

                {/* E-Receipt Verification QR Code */}
                {effectiveQr === 'everify' && eVerifyQrDataUrl && (
                  <div className="flex items-center gap-2 justify-center">
                    <img
                      src={eVerifyQrDataUrl}
                      alt="Verification QR"
                      className="w-16 h-16 border border-slate-200 rounded p-0.5 bg-white shrink-0"
                    />
                    <div className="text-[9px] text-slate-500 leading-tight">
                      <strong className="block text-black text-[10px]">E-Receipt Verification</strong>
                      Scan with mobile phone to verify authenticated record on portal.
                    </div>
                  </div>
                )}

                {/* Authorized Signatory */}
                <div className="text-center sm:text-right space-y-8 sm:ml-auto">
                  <div className="text-xs font-bold text-slate-800">
                    For {shopName}
                  </div>
                  <div className="border-t border-slate-400 pt-1 text-[11px] font-semibold text-slate-600">
                    Authorized Signatory
                  </div>
                </div>
              </div>

              {/* Legal Terms & Conditions */}
              <div className="pt-3 border-t border-slate-200 text-[9.5px] text-slate-500 space-y-0.5">
                <p className="font-bold text-slate-700">Terms & Conditions:</p>
                <p>1. Goods once sold can be exchanged within 7 days against original invoice and intact tags.</p>
                <p>2. No exchange or credit on altered, stitched, or washed garments.</p>
                <p>3. Subject to local state jurisdiction. This is a computer generated document.</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions Bar (Retained and Enhanced) */}
        <div className="p-4 bg-white border-t border-[#E5E5E7] space-y-3 print:hidden">
          {/* WhatsApp Quick Dispatch */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Phone className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={whatsappPhone}
                onChange={e => setWhatsappPhone(e.target.value)}
                placeholder="Customer WhatsApp No"
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-[#F5F5F7] focus:outline-none text-[#1D1D1F]"
              />
            </div>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="h-9 px-3.5 rounded-xl bg-[#1D1D1F] hover:bg-[#333336] text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
              title="Send complete itemized bill via WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          </div>

          {/* Print Slip Action */}
          <div>
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="w-full py-3.5 px-5 rounded-xl bg-[#1D1D1F] hover:bg-[#333336] active:scale-[0.99] text-white text-sm font-extrabold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md"
              title="Print Slip"
            >
              <Printer className="w-4 h-4" />
              <span>Print Slip</span>
            </button>
          </div>

          {bleStatusMsg && (
            <p className="text-center text-[11px] font-bold text-emerald-800 bg-emerald-50 py-1 rounded-lg">
              {bleStatusMsg}
            </p>
          )}
        </div>

        {/* Edit Buyer Details Modal */}
        {isEditingBuyer && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-[#E5E5E7] p-5 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-[#E5E5E7] pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#1D1D1F]" />
                  <h3 className="font-bold text-sm text-[#1D1D1F]">
                    Edit Buyer / Institutional Details
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingBuyer(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveBuyerDetails} className="space-y-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Buyer / School / Entity Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editBuyerName}
                    onChange={e => setEditBuyerName(e.target.value)}
                    placeholder="e.g. St. Xavier's High School"
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-300 font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Buyer GSTIN / UIN
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      value={editBuyerGstin}
                      onChange={e => setEditBuyerGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 08AAAAA0000A1Z5"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-300 font-mono font-bold text-black focus:outline-none focus:ring-1 focus:ring-black uppercase"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      P.O. / Work Order Ref
                    </label>
                    <input
                      type="text"
                      value={editPoNumber}
                      onChange={e => setEditPoNumber(e.target.value)}
                      placeholder="e.g. PO-2026-081"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-300 font-mono font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Billing Address
                  </label>
                  <textarea
                    rows={2}
                    value={editBuyerAddress}
                    onChange={e => setEditBuyerAddress(e.target.value)}
                    placeholder="e.g. Institutional Area, Sector 4, Mansarovar"
                    className="w-full p-2 rounded-lg border border-slate-300 font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E5E7]">
                  <button
                    type="button"
                    onClick={() => setIsEditingBuyer(false)}
                    className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingBuyer}
                    className="px-4 py-1.5 rounded-lg bg-[#1D1D1F] hover:bg-black text-white font-bold cursor-pointer shadow-xs"
                  >
                    {isSavingBuyer ? 'Saving...' : 'Save & Update Bill'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
