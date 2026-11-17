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
  FileText,
  Edit3,
  Building2,
} from 'lucide-react';
import QRCode from 'qrcode';
import { type Bill, type ShopConfig } from '../types';
import { db } from '../db/db';
import {
  formatDateShort,
  formatMoney,
  formatTimeShort,
  getCurrencyCode,
  getCurrencySymbol,
  getPaymentMethodLabel,
  getTaxSummaryLabel,
} from '../lib/locale';
import { generateEscPosReceipt, bluetoothPrinter, numberToWords } from '../lib/printer';
import { generateWhatsAppReceiptText, openWhatsAppReceipt } from '../lib/whatsapp';
import { encodeCode128 } from '../lib/barcode';

export type PaperSize = '80mm' | '58mm' | 'a4';
export type QrDisplayType = 'auto' | 'upi' | 'none';

interface ReceiptModalProps {
  bill: Bill;
  config: ShopConfig | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  bill: initialBill,
  config,
  onClose,
}) => {
  const [activeBill, setActiveBill] = useState<Bill>(initialBill);
  const bill = activeBill;

  const [paperSize, setPaperSize] = useState<PaperSize>(() => {
    if (initialBill.bill_type === 'b2b') return 'a4';
    const saved = localStorage.getItem('receipt_paper_size') as PaperSize;
    if (saved === '80mm' || saved === '58mm' || saved === 'a4') return saved;
    return config?.printer_width === 32 ? '58mm' : '80mm';
  });

  const [isEditingBuyer, setIsEditingBuyer] = useState(false);
  const [editBuyerName, setEditBuyerName] = useState(bill.customer_name || '');
  const [editBuyerGstin, setEditBuyerGstin] = useState(bill.customer_gstin || '');
  const [editBuyerAddress, setEditBuyerAddress] = useState(bill.customer_address || '');
  const [editPoNumber, setEditPoNumber] = useState(bill.po_number || '');
  const [isSavingBuyer, setIsSavingBuyer] = useState(false);

  const [qrMode, setQrMode] = useState<QrDisplayType>(() => {
    const saved = localStorage.getItem('receipt_qr_mode') as QrDisplayType;
    if (saved === 'auto' || saved === 'upi' || saved === 'none') return saved;
    return 'auto';
  });

  const effectiveQr = useMemo<'upi' | 'none'>(() => {
    if (qrMode === 'none') return 'none';
    if (!config?.upi_id) return 'none';
    if (qrMode === 'upi') return 'upi';
    return bill.is_paid ? 'none' : 'upi';
  }, [qrMode, bill.is_paid, config?.upi_id]);

  const [showReturnBarcode, setShowReturnBarcode] = useState<boolean>(() => {
    return localStorage.getItem('receipt_show_return_barcode') !== 'false';
  });

  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [printingBle, setPrintingBle] = useState(false);
  const [bleStatusMsg, setBleStatusMsg] = useState<string | null>(null);
  const [whatsappPhone, setWhatsappPhone] = useState(bill.customer_phone || '');

  const shopName = config?.legal_name || 'SIKKADESK RETAIL';
  const shopTagline = config?.shop_tagline || '';
  const shopAddress = config?.shop_address || '';
  const shopPhone = config?.shop_phone || '';
  const shopTaxId = config?.gstin || '';

  const formattedDate = formatDateShort(bill.created_at, config);
  const formattedTime = formatTimeShort(bill.created_at, config);

  const handlePaperSizeChange = (sz: PaperSize) => {
    setPaperSize(sz);
    localStorage.setItem('receipt_paper_size', sz);
  };

  const cycleQrMode = () => {
    const modes: QrDisplayType[] = ['auto', 'upi', 'none'];
    const nextMode = modes[(modes.indexOf(qrMode) + 1) % modes.length];
    setQrMode(nextMode);
    localStorage.setItem('receipt_qr_mode', nextMode);
  };

  const handleToggleBarcode = () => {
    const nextVal = !showReturnBarcode;
    setShowReturnBarcode(nextVal);
    localStorage.setItem('receipt_show_return_barcode', String(nextVal));
  };

  useEffect(() => {
    if (effectiveQr !== 'upi' || !config?.upi_id) {
      setUpiQrDataUrl('');
      return;
    }
    const upiUri = `upi://pay?pa=${encodeURIComponent(config.upi_id)}&pn=${encodeURIComponent(
      shopName
    )}&am=${bill.total}&tn=${encodeURIComponent(
      'Receipt ' + bill.bill_number
    )}&cu=${getCurrencyCode(config)}`;

    QRCode.toDataURL(upiUri, {
      width: paperSize === '58mm' ? 140 : 180,
      margin: 1,
    })
      .then(setUpiQrDataUrl)
      .catch(() => setUpiQrDataUrl(''));
  }, [bill.bill_number, bill.total, config, shopName, effectiveQr, paperSize]);

  const barcodeData = useMemo(() => encodeCode128(bill.bill_number), [bill.bill_number]);

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
      setActiveBill(prev => ({ ...prev, ...updatedFields }));
      setIsEditingBuyer(false);
    } finally {
      setIsSavingBuyer(false);
    }
  };

  const handleBrowserPrint = () => {
    const styleId = 'dynamic-print-paper-size';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent =
      paperSize === 'a4'
        ? `@page { size: A4 portrait; margin: 6mm; }`
        : `@page { size: auto; margin: 0mm; }`;
    setTimeout(() => window.print(), 50);
  };

  const handleBluetoothPrint = async () => {
    if (!config) return;
    setPrintingBle(true);
    setBleStatusMsg(null);
    try {
      if (!bluetoothPrinter.isConnected()) {
        setBleStatusMsg('Connecting to Bluetooth printer...');
        await bluetoothPrinter.connect();
      }
      const cols = paperSize === '58mm' ? 32 : 48;
      await bluetoothPrinter.printData(generateEscPosReceipt(bill, config, cols));
      setBleStatusMsg('Printed successfully');
      setTimeout(() => setBleStatusMsg(null), 2500);
    } catch (err: unknown) {
      setBleStatusMsg((err as Error)?.message || 'Failed to print');
    } finally {
      setPrintingBle(false);
    }
  };

  const handleWhatsAppShare = () => {
    const text = generateWhatsAppReceiptText(bill, config);
    openWhatsAppReceipt(whatsappPhone || bill.customer_phone || '', text);
  };

  const handleCopyReceipt = () => {
    const text = generateWhatsAppReceiptText(bill, config).replace(/\*/g, '').replace(/_/g, '');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const termsText =
    config?.terms_conditions || '7-day exchange with original receipt and intact tags.';
  const isTaxInvoice = config?.tax_type !== 'none' && Number(config?.tax_rate || 0) > 0;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:block">
      <div
        className={`bg-white dark:bg-zinc-900 rounded-2xl w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden my-auto print:border-none print:shadow-none print:w-full print:max-w-none ${
          paperSize === 'a4' ? 'max-w-4xl' : paperSize === '80mm' ? 'max-w-lg' : 'max-w-md'
        }`}
      >
        {/* Top Bar */}
        <div className="p-3.5 sm:p-4 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-zinc-950 dark:text-zinc-50 font-mono">
              {bill.bill_number}
            </span>
            <span className="text-zinc-500">· {bill.is_paid ? 'Paid' : 'Credit Due'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBluetoothPrint}
              disabled={printingBle}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{printingBle ? 'Printing...' : 'BLE Print'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyReceipt}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Size & Options */}
        <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs print:hidden">
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
            {(['80mm', '58mm', 'a4'] as PaperSize[]).map(sz => (
              <button
                key={sz}
                type="button"
                onClick={() => handlePaperSizeChange(sz)}
                className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                  paperSize === sz
                    ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                    : 'text-zinc-500'
                }`}
              >
                {sz === 'a4' ? 'A4 Invoice' : sz}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {config?.upi_id && (
              <button
                type="button"
                onClick={cycleQrMode}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR: {qrMode}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleBarcode}
              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                showReturnBarcode
                  ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                  : 'border-zinc-200 dark:border-zinc-800 text-zinc-500'
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Barcode</span>
            </button>
          </div>
        </div>

        {/* Printable Document Body (Always crisp white paper style for authentic print fidelity) */}
        <div className="p-4 sm:p-6 bg-zinc-100 dark:bg-zinc-950 flex justify-center overflow-y-auto max-h-[65vh] print:p-0 print:bg-white print:max-h-none print:overflow-visible">
          {paperSize !== 'a4' ? (
            <div
              id="printable-receipt"
              className={`bg-white text-zinc-950 rounded-xl border border-dashed border-zinc-300 font-mono mx-auto print:border-none print:p-0 ${
                paperSize === '58mm' ? 'w-[240px] p-3 text-[10px]' : 'w-[320px] p-5 text-xs'
              }`}
            >
              <div className="text-center pb-2.5 border-b border-dashed border-zinc-300 space-y-0.5">
                <div className="font-bold text-sm uppercase">{shopName}</div>
                {shopTagline && <div className="text-[10px] text-zinc-600">{shopTagline}</div>}
                {shopAddress && <div className="text-[10px] text-zinc-500">{shopAddress}</div>}
                {shopPhone && <div className="text-[10px] text-zinc-600">Tel: {shopPhone}</div>}
                {shopTaxId && (
                  <div className="text-[10px] font-semibold">
                    {config?.tax_label || 'Tax'} ID: {shopTaxId}
                  </div>
                )}
                <div className="pt-1.5 font-bold uppercase text-[11px]">
                  {isTaxInvoice ? `${config?.tax_label || 'Tax'} Receipt` : 'Sales Receipt'}
                </div>
              </div>

              <div className="py-2 border-b border-dashed border-zinc-300 space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>Receipt:</span>
                  <span className="font-bold">{bill.bill_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>
                    {formattedDate} {formattedTime}
                  </span>
                </div>
                {(bill.customer_name || bill.customer_phone) && (
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="font-medium text-right">
                      {[bill.customer_name, bill.customer_phone].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                )}
                {bill.billed_by_name && (
                  <div className="flex justify-between text-zinc-500">
                    <span>Staff:</span>
                    <span>{bill.billed_by_name}</span>
                  </div>
                )}
              </div>

              <div className="py-2 border-b border-dashed border-zinc-300 space-y-1.5 text-[10px]">
                {bill.items.map(item => {
                  const variant = [item.size_label, item.color_label].filter(Boolean).join(' · ');
                  return (
                    <div key={item.id}>
                      <div className="flex justify-between font-bold">
                        <span>{item.product_name}</span>
                        <span className="tabular-nums">{formatMoney(item.subtotal, config)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-500 text-[9px]">
                        <span>{variant || 'Standard'}</span>
                        <span className="tabular-nums">
                          {item.qty} × {formatMoney(item.unit_price, config)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="py-2 border-b border-dashed border-zinc-300 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatMoney(bill.subtotal || bill.total, config)}</span>
                </div>
                {bill.discount_amount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount</span>
                    <span className="tabular-nums">-{formatMoney(bill.discount_amount, config)}</span>
                  </div>
                )}
                {bill.tax_amount && bill.tax_amount > 0 ? (
                  <div className="flex justify-between text-zinc-600">
                    <span>{bill.tax_label || config?.tax_label || 'Tax'}</span>
                    <span className="tabular-nums">{formatMoney(bill.tax_amount, config)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-dotted border-zinc-400">
                  <span>TOTAL</span>
                  <span className="tabular-nums">{formatMoney(bill.total, config)}</span>
                </div>
                {(bill.store_credit_used || 0) > 0 && (
                  <>
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Store Credit Used</span>
                      <span className="tabular-nums">-{formatMoney(bill.store_credit_used || 0, config)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>NET TENDERED</span>
                      <span className="tabular-nums">
                        {formatMoney(Math.max(0, bill.total - (bill.store_credit_used || 0)), config)}
                      </span>
                    </div>
                  </>
                )}
                {(bill.refunded_amount || 0) > 0 && (
                  <>
                    <div className="flex justify-between text-amber-700 font-semibold">
                      <span>Refunded</span>
                      <span className="tabular-nums">-{formatMoney(bill.refunded_amount || 0, config)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>NET PAID</span>
                      <span className="tabular-nums">
                        {formatMoney(Math.max(0, bill.total - (bill.refunded_amount || 0)), config)}
                      </span>
                    </div>
                  </>
                )}
                <div className="text-[9px] text-zinc-500 italic">
                  {numberToWords(Math.max(0, bill.total - (bill.refunded_amount || 0)), config)}
                </div>
              </div>

              <div className="py-1.5 text-[10px] flex justify-between">
                <span>Payment:</span>
                <span className="font-bold">
                  {getPaymentMethodLabel(bill.payment_method, config)} ({bill.is_paid ? 'PAID' : 'DUE'})
                </span>
              </div>

              {showReturnBarcode && (
                <div className="pt-2 pb-1 border-t border-dashed border-zinc-300 text-center">
                  <svg
                    className="w-full h-7"
                    viewBox={`0 0 ${barcodeData.totalWidth} 12`}
                    preserveAspectRatio="none"
                  >
                    {barcodeData.pattern
                      .split('')
                      .map((bit, i) =>
                        bit === '1' ? <rect key={i} x={i} y={0} width={1} height={12} fill="#000" /> : null
                      )}
                  </svg>
                  <div className="text-[9px] font-bold tracking-widest mt-0.5">{bill.bill_number}</div>
                </div>
              )}

              {effectiveQr === 'upi' && upiQrDataUrl && (
                <div className="pt-2 border-t border-dashed border-zinc-300 text-center">
                  <img src={upiQrDataUrl} alt="Pay QR" className="w-24 h-24 mx-auto" />
                  <div className="text-[9px] font-bold mt-1">
                    Pay {formatMoney(bill.total, config)}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-dashed border-zinc-300 text-center text-[9px] text-zinc-500 space-y-0.5">
                <p className="font-semibold text-zinc-700">Thank you for shopping with us!</p>
                <p>{termsText}</p>
              </div>
            </div>
          ) : (
            <div
              id="printable-receipt"
              className="bg-white text-zinc-950 rounded-xl border border-zinc-200 w-full p-6 sm:p-8 space-y-5 text-xs print:border-none print:p-0"
            >
              <div className="flex flex-col sm:flex-row justify-between gap-4 pb-4 border-b-2 border-zinc-950">
                <div className="space-y-1">
                  <h1 className="text-xl font-bold uppercase">{shopName}</h1>
                  {shopTagline && <p className="text-zinc-600">{shopTagline}</p>}
                  {shopAddress && <p className="text-zinc-500">{shopAddress}</p>}
                  {shopPhone && <p className="text-zinc-600">Tel: {shopPhone}</p>}
                  {shopTaxId && (
                    <p className="font-semibold font-mono">
                      {config?.tax_label || 'Tax'} ID: {shopTaxId}
                    </p>
                  )}
                </div>

                <div className="sm:text-right space-y-1">
                  <div className="inline-block px-3 py-1 bg-zinc-950 text-white font-bold uppercase tracking-wider rounded">
                    {isTaxInvoice ? `${config?.tax_label || 'Tax'} Invoice` : 'Sales Invoice'}
                  </div>
                  <div className="pt-2 space-y-0.5">
                    <p>
                      <span className="text-zinc-500">Invoice #:</span>{' '}
                      <strong className="font-mono">{bill.bill_number}</strong>
                    </p>
                    <p>
                      <span className="text-zinc-500">Date:</span> {formattedDate} {formattedTime}
                    </p>
                    <p>
                      <span className="text-zinc-500">Status:</span>{' '}
                      <strong>
                        {getPaymentMethodLabel(bill.payment_method, config)} ({bill.is_paid ? 'PAID' : 'DUE'})
                      </strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 block">Billed To</span>
                  <div className="font-bold text-sm mt-0.5">{bill.customer_name || 'Walk-in Customer'}</div>
                  {bill.customer_phone && <div className="text-zinc-600">{bill.customer_phone}</div>}
                  {bill.customer_address && <div className="text-zinc-600">{bill.customer_address}</div>}
                  {bill.customer_gstin && (
                    <div className="font-mono text-[11px] mt-0.5">Tax ID: {bill.customer_gstin}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingBuyer(true)}
                  className="text-xs font-semibold text-zinc-700 hover:underline flex items-center gap-1 cursor-pointer print:hidden"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Buyer</span>
                </button>
              </div>

              <table className="w-full text-left border border-zinc-200 rounded-xl overflow-hidden">
                <thead className="bg-zinc-950 text-white text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3">Variant</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                    <th className="py-2.5 px-3 text-right">Amount ({getCurrencySymbol(config)})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {bill.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-3 font-mono text-zinc-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold">{item.product_name}</td>
                      <td className="py-2.5 px-3 text-zinc-600">
                        {[item.size_label, item.color_label].filter(Boolean).join(' · ') || 'Standard'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{item.qty}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {formatMoney(item.unit_price, config)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                        {formatMoney(item.subtotal, config)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-zinc-500">Amount in Words</div>
                  <div className="font-semibold italic">{numberToWords(bill.total, config)}</div>
                  <div className="text-[11px] text-zinc-500 pt-2">{termsText}</div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Subtotal</span>
                    <span className="font-mono tabular-nums">{formatMoney(bill.subtotal || bill.total, config)}</span>
                  </div>
                  {bill.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Discount</span>
                      <span className="font-mono tabular-nums">-{formatMoney(bill.discount_amount, config)}</span>
                    </div>
                  )}
                  {bill.tax_amount && bill.tax_amount > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">{getTaxSummaryLabel(config)}</span>
                      <span className="font-mono tabular-nums">{formatMoney(bill.tax_amount, config)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-base font-bold pt-2 border-t-2 border-zinc-950">
                    <span>Total</span>
                    <span className="font-mono tabular-nums">{formatMoney(bill.total, config)}</span>
                  </div>
                  {(bill.store_credit_used || 0) > 0 && (
                    <>
                      <div className="flex justify-between text-emerald-700 font-semibold">
                        <span>Store Credit Applied</span>
                        <span className="font-mono tabular-nums">
                          -{formatMoney(bill.store_credit_used || 0, config)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-zinc-950">
                        <span>Net Tendered</span>
                        <span className="font-mono tabular-nums">
                          {formatMoney(Math.max(0, bill.total - (bill.store_credit_used || 0)), config)}
                        </span>
                      </div>
                    </>
                  )}
                  {(bill.refunded_amount || 0) > 0 && (
                    <>
                      <div className="flex justify-between text-amber-700 font-semibold">
                        <span>Refunded</span>
                        <span className="font-mono tabular-nums">
                          -{formatMoney(bill.refunded_amount || 0, config)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-zinc-950">
                        <span>Net Paid</span>
                        <span className="font-mono tabular-nums">
                          {formatMoney(Math.max(0, bill.total - (bill.refunded_amount || 0)), config)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3 print:hidden">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Phone className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={whatsappPhone}
                onChange={e => setWhatsappPhone(e.target.value)}
                placeholder="Customer WhatsApp phone..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 font-semibold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleBrowserPrint}
            className="w-full py-2.5 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>

          {bleStatusMsg && (
            <p className="text-center text-xs text-zinc-500 font-medium">{bleStatusMsg}</p>
          )}
        </div>
      </div>

      {/* Edit Buyer Modal */}
      {isEditingBuyer && (
        <div className="fixed inset-0 z-60 bg-zinc-950/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveBuyerDetails}
            className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-5 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Building2 className="w-4 h-4" />
                <span>Buyer Invoice Details</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingBuyer(false)}
                className="p-1 text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={editBuyerName}
              onChange={e => setEditBuyerName(e.target.value)}
              placeholder="Buyer / Company Name"
              className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={editBuyerGstin}
                onChange={e => setEditBuyerGstin(e.target.value.toUpperCase())}
                placeholder="Tax ID / VAT / GSTIN"
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono"
              />
              <input
                type="text"
                value={editPoNumber}
                onChange={e => setEditPoNumber(e.target.value)}
                placeholder="PO Reference"
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono"
              />
            </div>
            <textarea
              rows={2}
              value={editBuyerAddress}
              onChange={e => setEditBuyerAddress(e.target.value)}
              placeholder="Billing Address"
              className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 resize-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingBuyer(false)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingBuyer}
                className="px-4 py-1.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold cursor-pointer"
              >
                {isSavingBuyer ? 'Saving...' : 'Save Buyer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
