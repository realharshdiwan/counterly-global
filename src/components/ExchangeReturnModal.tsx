import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Search,
  ArrowRightLeft,
  CheckCircle2,
  X,
  Printer,
  QrCode,
  Maximize2,
  Minus,
  Plus,
} from 'lucide-react';
import QRCode from 'qrcode';
import { db } from '../db/db';
import {
  type Bill,
  type BillItem,
  type BillReturnItem,
  type BillReturnRecord,
  type ProductVariant,
  type ShopConfig,
  type PaymentMethod,
  type CustomerCreditEntry,
} from '../types';
import {
  formatDateShort,
  formatMoney,
  formatPrintMoney,
  getCurrencyCode,
  getPaymentMethodLabel,
} from '../lib/locale';
import { bluetoothPrinter } from '../lib/printer';
import { useAuth } from '../context/AuthContext';

interface ExchangeReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  preselectedBill?: Bill | null;
}

type DeskMode = 'return' | 'swap';
type StandaloneRefundMethod = 'cash' | 'card' | 'store_credit';

export const ExchangeReturnModal: React.FC<ExchangeReturnModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  preselectedBill,
}) => {
  const { currentUser } = useAuth();
  const [deskMode, setDeskMode] = useState<DeskMode>('return');
  const [bills, setBills] = useState<Bill[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(preselectedBill || null);

  // Variant Swap state
  const [selectedItemToReturn, setSelectedItemToReturn] = useState<BillItem | null>(null);
  const [targetVariantId, setTargetVariantId] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMethod>('cash');
  const [swapRefundMethod, setSwapRefundMethod] = useState<'cash' | 'store_credit'>('cash');

  // Standalone Return & Partial Refund state
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState('');
  const [standaloneRefundMethod, setStandaloneRefundMethod] = useState<StandaloneRefundMethod>('cash');

  const [isProcessing, setIsProcessing] = useState(false);

  const [exchangeCompleted, setExchangeCompleted] = useState<{
    exchangeNo: string;
    date: string;
    originalBillNo: string;
    returnedLabel: string;
    returnedPrice: number;
    issuedLabel: string;
    issuedPrice: number;
    productName: string;
    difference: number;
    paymentMode: PaymentMethod;
    refundMethod: 'cash' | 'store_credit';
    cashier: string;
  } | null>(null);

  const [returnCompleted, setReturnCompleted] = useState<{
    returnRecord: BillReturnRecord;
    originalBillNo: string;
    customerName: string;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [exchangeUpiQr, setExchangeUpiQr] = useState<string>('');
  const [showStandeeQr, setShowStandeeQr] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  useEffect(() => {
    if (!isOpen) return;
    setExchangeCompleted(null);
    setReturnCompleted(null);
    setReturnReason('');
    Promise.all([
      db.bills.reverse().sortBy('created_at'),
      db.variants.toArray(),
      db.shop_config.toArray(),
    ])
      .then(([allBills, varList, cfgList]) => {
        setBills(allBills.filter(b => b.status !== 'voided'));
        setVariants(varList);
        if (cfgList.length > 0) setShopConfig(cfgList[0]);
      })
      .catch(err => console.error('Failed to load return/exchange data:', err));
  }, [isOpen]);

  useEffect(() => {
    if (preselectedBill) {
      setSelectedBill(preselectedBill);
      setSelectedItemToReturn(preselectedBill.items[0] || null);
      setTargetVariantId('');
      setReturnQuantities({});
    }
  }, [preselectedBill]);

  // Remaining returnable quantities per bill item
  const alreadyReturnedByItemId = useMemo(() => {
    const map = new Map<string, number>();
    if (!selectedBill?.return_records) return map;
    for (const rec of selectedBill.return_records) {
      for (const ri of rec.items) {
        map.set(ri.bill_item_id, (map.get(ri.bill_item_id) || 0) + ri.qty);
      }
    }
    return map;
  }, [selectedBill]);

  // Estimate refundable amount per single unit of a BillItem (net of bill discount + exclusive tax if applicable)
  const unitRefundLookup = useMemo(() => {
    const map = new Map<string, number>();
    if (!selectedBill) return map;
    const billSub =
      selectedBill.subtotal ||
      selectedBill.items.reduce((s, it) => s + (it.subtotal || it.unit_price * it.qty), 0) ||
      1;
    const discountedSub = Math.max(0, billSub - (selectedBill.discount_amount || 0));
    const discountRatio = billSub > 0 ? discountedSub / billSub : 1;
    const billHasExclusiveTax = (selectedBill.total || 0) > discountedSub + 0.01;

    for (const item of selectedBill.items) {
      const qty = Math.max(1, item.qty);
      const lineSub = item.subtotal || item.unit_price * qty;
      const perUnitNet = (lineSub / qty) * discountRatio;
      let perUnitTax = 0;
      if (billHasExclusiveTax) {
        if (typeof item.tax_amount === 'number' && item.tax_amount > 0) {
          perUnitTax = item.tax_amount / qty;
        } else if (discountedSub > 0) {
          perUnitTax = (((selectedBill.tax_amount || 0) * ((lineSub * discountRatio) / discountedSub)) / qty);
        }
      }
      map.set(item.id, Math.round((perUnitNet + perUnitTax) * 100) / 100);
    }
    return map;
  }, [selectedBill]);

  const maxBillRefundRemaining = useMemo(() => {
    if (!selectedBill) return 0;
    return Math.max(0, Math.round(((selectedBill.total || 0) - (selectedBill.refunded_amount || 0)) * 100) / 100);
  }, [selectedBill]);

  const selectedReturnSummary = useMemo(() => {
    if (!selectedBill) return { totalQty: 0, refundTotal: 0, lines: [] as BillReturnItem[] };
    let rawSum = 0;
    let totalQty = 0;
    const lines: BillReturnItem[] = [];

    for (const item of selectedBill.items) {
      const qtyToReturn = returnQuantities[item.id] || 0;
      if (qtyToReturn <= 0) continue;
      const perUnit = unitRefundLookup.get(item.id) ?? item.unit_price;
      const lineRefund = Math.round(perUnit * qtyToReturn * 100) / 100;
      rawSum += lineRefund;
      totalQty += qtyToReturn;
      lines.push({
        bill_item_id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product_name,
        size_label: item.size_label,
        color_label: item.color_label,
        qty: qtyToReturn,
        unit_price: perUnit,
        refund_amount: lineRefund,
      });
    }

    const cappedTotal = Math.min(maxBillRefundRemaining, Math.round(rawSum * 100) / 100);
    return { totalQty, refundTotal: cappedTotal, lines };
  }, [selectedBill, returnQuantities, unitRefundLookup, maxBillRefundRemaining]);

  // Swap computations
  const replacementVariants = useMemo(() => {
    if (!selectedItemToReturn) return [];
    return variants.filter(v => v.product_id === selectedItemToReturn.product_id);
  }, [selectedItemToReturn, variants]);

  useEffect(() => {
    if (replacementVariants.length > 0 && !targetVariantId) {
      const next =
        replacementVariants.find(
          v => v.id !== selectedItemToReturn?.variant_id && v.stock_qty > 0
        ) || replacementVariants[0];
      setTargetVariantId(next.id);
    }
  }, [replacementVariants, selectedItemToReturn, targetVariantId]);

  const targetVariant = useMemo(
    () => replacementVariants.find(v => v.id === targetVariantId) || null,
    [replacementVariants, targetVariantId]
  );

  const returnCredit = selectedItemToReturn ? selectedItemToReturn.unit_price : 0;
  const targetPrice = targetVariant ? targetVariant.price : returnCredit;
  const priceDifference = Math.round((targetPrice - returnCredit) * 100) / 100;

  useEffect(() => {
    if (deskMode === 'swap' && priceDifference > 0 && paymentMode === 'upi' && shopConfig?.upi_id) {
      const uri = `upi://pay?pa=${encodeURIComponent(
        shopConfig.upi_id
      )}&pn=${encodeURIComponent(
        shopConfig.legal_name || 'SIKKADESK RETAIL'
      )}&am=${priceDifference}&cu=${getCurrencyCode(shopConfig)}`;
      QRCode.toDataURL(uri, { width: 220, margin: 1 })
        .then(setExchangeUpiQr)
        .catch(() => setExchangeUpiQr(''));
    } else {
      setExchangeUpiQr('');
    }
  }, [deskMode, priceDifference, paymentMode, shopConfig]);

  if (!isOpen) return null;

  const searchedBills = bills
    .filter(b => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        b.bill_number.toLowerCase().includes(q) ||
        (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
        (b.customer_phone && b.customer_phone.includes(q))
      );
    })
    .slice(0, 6);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    const clean = val.trim().toLowerCase();
    if (!clean) return;
    const exact = bills.find(b => b.bill_number.toLowerCase() === clean);
    if (exact) {
      setSelectedBill(exact);
      setSelectedItemToReturn(exact.items[0] || null);
      setTargetVariantId('');
      setReturnQuantities({});
    }
  };

  const adjustReturnQty = (item: BillItem, delta: number) => {
    const already = alreadyReturnedByItemId.get(item.id) || 0;
    const maxRemaining = Math.max(0, item.qty - already);
    setReturnQuantities(prev => {
      const cur = prev[item.id] || 0;
      const next = Math.max(0, Math.min(maxRemaining, cur + delta));
      return { ...prev, [item.id]: next };
    });
  };

  const selectAllRemainingForReturn = () => {
    if (!selectedBill) return;
    const nextMap: Record<string, number> = {};
    for (const item of selectedBill.items) {
      const already = alreadyReturnedByItemId.get(item.id) || 0;
      const remaining = Math.max(0, item.qty - already);
      if (remaining > 0) nextMap[item.id] = remaining;
    }
    setReturnQuantities(nextMap);
  };

  const upsertCustomerStoreCredit = async (
    bill: Bill,
    creditAmt: number,
    noteText: string,
    nowIso: string
  ) => {
    if (creditAmt <= 0) return;
    const allCust = await db.customers.toArray();
    const cleanPh = (bill.customer_phone || '').replace(/\D/g, '');
    const cleanNm = (bill.customer_name || '').trim().toLowerCase();
    const matched =
      (cleanPh.length >= 6
        ? allCust.find(c => c.phone.replace(/\D/g, '') === cleanPh)
        : undefined) ||
      (cleanNm ? allCust.find(c => c.name.trim().toLowerCase() === cleanNm) : undefined);

    const creditEntry: CustomerCreditEntry = {
      id: `cred_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      amount: creditAmt,
      type: 'refund',
      note: noteText,
      created_at: nowIso,
      bill_number: bill.bill_number,
    };

    if (matched) {
      await db.customers.update(matched.id, {
        store_credit_balance:
          Math.round(((matched.store_credit_balance || 0) + creditAmt) * 100) / 100,
        credit_transactions: [creditEntry, ...(matched.credit_transactions || [])],
        last_visit_at: nowIso,
      });
    } else {
      await db.customers.add({
        id: `cust_${Date.now()}`,
        name: bill.customer_name || 'Return Customer',
        phone: bill.customer_phone || 'N/A',
        store_credit_balance: creditAmt,
        credit_transactions: [creditEntry],
        last_visit_at: nowIso,
      });
    }
  };

  const handleExecuteReturnRefund = async () => {
    if (!selectedBill || selectedReturnSummary.lines.length === 0) {
      showToast('Select at least 1 unit to return');
      return;
    }
    setIsProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      const existingReturns = await db.inventory_movements.where('type').equals('return').count();
      const returnNo = `RET-${String(1001 + existingReturns).padStart(4, '0')}`;

      // 1. Restore stock for each returned item & record inventory movements
      for (const line of selectedReturnSummary.lines) {
        const varId = line.variant_id;
        if (varId) {
          const v = await db.variants.get(varId);
          if (v) {
            const prevQty = v.stock_qty;
            const nextQty = prevQty + line.qty;
            await db.variants.update(v.id, { stock_qty: nextQty });
            await db.inventory_movements.add({
              id: `mov_ret_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              product_id: line.product_id,
              variant_id: v.id,
              product_name: line.product_name,
              size_label: [line.size_label, line.color_label].filter(Boolean).join(' · ') || 'Standard',
              type: 'return',
              qty: line.qty,
              previous_stock: prevQty,
              new_stock: nextQty,
              notes: `Return ${returnNo} (${selectedBill.bill_number})${returnReason ? ': ' + returnReason.trim() : ''}`,
              created_at: nowIso,
              reference_bill_id: selectedBill.id,
            });
          }
        }
      }

      // 2. Append BillReturnRecord onto the bill & update refunded_amount
      const newRecord: BillReturnRecord = {
        id: `ret_${Date.now()}`,
        return_number: returnNo,
        created_at: nowIso,
        items: selectedReturnSummary.lines,
        refund_amount: selectedReturnSummary.refundTotal,
        refund_method: standaloneRefundMethod,
        reason: returnReason.trim() || undefined,
        processed_by: currentUser?.name || 'Counter Staff',
      };

      const updatedRecords = [...(selectedBill.return_records || []), newRecord];
      const updatedRefundedAmount = Math.min(
        selectedBill.total || 0,
        Math.round(((selectedBill.refunded_amount || 0) + selectedReturnSummary.refundTotal) * 100) / 100
      );

      await db.bills.update(selectedBill.id, {
        return_records: updatedRecords,
        refunded_amount: updatedRefundedAmount,
      });

      // 3. Apply store credit if chosen
      if (standaloneRefundMethod === 'store_credit') {
        await upsertCustomerStoreCredit(
          selectedBill,
          selectedReturnSummary.refundTotal,
          `Return credit ${returnNo} from ${selectedBill.bill_number}`,
          nowIso
        );
      }

      setReturnCompleted({
        returnRecord: newRecord,
        originalBillNo: selectedBill.bill_number,
        customerName: selectedBill.customer_name || 'Walk-in Customer',
      });

      if (onComplete) onComplete();
    } catch (err) {
      console.error('Return/refund failed:', err);
      showToast('Failed to process return');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteExchange = async () => {
    if (!selectedBill || !selectedItemToReturn || !targetVariant) {
      showToast('Select the returned item and replacement variant');
      return;
    }

    setIsProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      const existingReturns = await db.inventory_movements.where('type').equals('return').count();
      const exchangeNo = `EXC-${String(1001 + existingReturns).padStart(4, '0')}`;

      // 1. Restore stock for returned variant
      const returnVarId = selectedItemToReturn.variant_id || selectedItemToReturn.size_id;
      if (returnVarId) {
        const retVar = await db.variants.get(returnVarId);
        if (retVar) {
          const prevQty = retVar.stock_qty;
          const nextQty = prevQty + 1;
          await db.variants.update(retVar.id, { stock_qty: nextQty });
          await db.inventory_movements.add({
            id: `mov_ret_${Date.now()}`,
            product_id: selectedItemToReturn.product_id,
            variant_id: retVar.id,
            product_name: selectedItemToReturn.product_name,
            size_label: [selectedItemToReturn.size_label, selectedItemToReturn.color_label]
              .filter(Boolean)
              .join(' · '),
            type: 'return',
            qty: 1,
            previous_stock: prevQty,
            new_stock: nextQty,
            notes: `Exchange return from ${selectedBill.bill_number}`,
            created_at: nowIso,
            reference_bill_id: selectedBill.id,
          });
        }
      }

      // 2. Deduct stock for issued variant
      const issPrev = targetVariant.stock_qty;
      const issNext = Math.max(0, issPrev - 1);
      await db.variants.update(targetVariant.id, { stock_qty: issNext });
      await db.inventory_movements.add({
        id: `mov_iss_${Date.now()}_2`,
        product_id: selectedItemToReturn.product_id,
        variant_id: targetVariant.id,
        product_name: selectedItemToReturn.product_name,
        size_label: `${targetVariant.size_label} · ${targetVariant.color_label}`,
        type: 'sale',
        qty: -1,
        previous_stock: issPrev,
        new_stock: issNext,
        notes: `Exchange issued for ${selectedBill.bill_number}`,
        created_at: nowIso,
        reference_bill_id: selectedBill.id,
      });

      await db.bills.update(selectedBill.id, { status: 'exchanged' });

      // 3. Apply store credit when difference < 0 and swapRefundMethod === 'store_credit'
      if (priceDifference < 0 && swapRefundMethod === 'store_credit') {
        const creditAmt = Math.round(Math.abs(priceDifference) * 100) / 100;
        await upsertCustomerStoreCredit(
          selectedBill,
          creditAmt,
          `Exchange balance from ${selectedBill.bill_number} (${exchangeNo})`,
          nowIso
        );
      }

      setExchangeCompleted({
        exchangeNo,
        date: nowIso,
        originalBillNo: selectedBill.bill_number,
        productName: selectedItemToReturn.product_name,
        returnedLabel:
          [selectedItemToReturn.size_label, selectedItemToReturn.color_label]
            .filter(Boolean)
            .join(' · ') || 'Standard',
        returnedPrice: returnCredit,
        issuedLabel: `${targetVariant.size_label} · ${targetVariant.color_label}`,
        issuedPrice: targetPrice,
        difference: priceDifference,
        paymentMode,
        refundMethod: swapRefundMethod,
        cashier: currentUser?.name || 'Counter Staff',
      });

      if (onComplete) onComplete();
    } catch (err) {
      console.error('Exchange failed:', err);
      showToast('Failed to process exchange');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintExchange = async () => {
    if (!exchangeCompleted) return;
    const shopName = shopConfig?.legal_name || 'SIKKADESK RETAIL';

    try {
      if (bluetoothPrinter.isConnected()) {
        const text = `\x1B@\x1Ba\x01\x1BE\x01${shopName}\x1BE\x00\nEXCHANGE SLIP\nRef: ${
          exchangeCompleted.exchangeNo
        }\nOriginal: ${exchangeCompleted.originalBillNo}\nDate: ${formatDateShort(
          exchangeCompleted.date,
          shopConfig
        )}\n--------------------------------\n\x1Ba\x00RETURNED:\n${
          exchangeCompleted.productName
        } (${exchangeCompleted.returnedLabel})\nCredit: ${formatPrintMoney(
          exchangeCompleted.returnedPrice,
          shopConfig
        )}\n\nISSUED:\n${exchangeCompleted.productName} (${
          exchangeCompleted.issuedLabel
        })\nPrice: ${formatPrintMoney(
          exchangeCompleted.issuedPrice,
          shopConfig
        )}\n--------------------------------\n\x1BE\x01DIFFERENCE: ${formatPrintMoney(
          exchangeCompleted.difference,
          shopConfig
        )}\x1BE\x00\nStaff: ${exchangeCompleted.cashier}\n\n\n\x1DV\x42\x00`;
        await bluetoothPrinter.printData(new TextEncoder().encode(text));
        showToast('Printed exchange slip');
      } else {
        window.print();
      }
    } catch {
      showToast('Printer unavailable');
    }
  };

  const handlePrintRefundSlip = async () => {
    if (!returnCompleted) return;
    const shopName = shopConfig?.legal_name || 'SIKKADESK RETAIL';
    const rec = returnCompleted.returnRecord;
    const methodLabel =
      rec.refund_method === 'store_credit'
        ? 'STORE CREDIT'
        : rec.refund_method === 'card'
        ? 'CARD REVERSAL'
        : 'CASH REFUND';

    try {
      if (bluetoothPrinter.isConnected()) {
        const linesText = rec.items
          .map(
            it =>
              `${it.product_name} (${[it.size_label, it.color_label].filter(Boolean).join('/') || 'Std'}) x${it.qty}  ${formatPrintMoney(it.refund_amount, shopConfig)}`
          )
          .join('\n');
        const text = `\x1B@\x1Ba\x01\x1BE\x01${shopName}\x1BE\x00\nRETURN & REFUND SLIP\nRef: ${
          rec.return_number
        }\nOriginal: ${returnCompleted.originalBillNo}\nDate: ${formatDateShort(
          rec.created_at,
          shopConfig
        )}\n--------------------------------\n\x1Ba\x00${linesText}\n--------------------------------\n\x1BE\x01REFUND (${methodLabel}): ${formatPrintMoney(
          rec.refund_amount,
          shopConfig
        )}\x1BE\x00\n${rec.reason ? `Reason: ${rec.reason}\n` : ''}Staff: ${
          rec.processed_by || 'Staff'
        }\n\n\n\x1DV\x42\x00`;
        await bluetoothPrinter.printData(new TextEncoder().encode(text));
        showToast('Printed refund slip');
      } else {
        window.print();
      }
    } catch {
      showToast('Printer unavailable');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[90vh] flex flex-col my-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-zinc-950 dark:text-zinc-50">
                Returns, Refunds &amp; Variant Swaps
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Issue partial refunds, credit store accounts, or swap item size &amp; color
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-950 dark:hover:text-white p-1.5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle */}
        {!exchangeCompleted && !returnCompleted && (
          <div className="pt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setDeskMode('return')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  deskMode === 'return'
                    ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                Return &amp; Refund
              </button>
              <button
                type="button"
                onClick={() => setDeskMode('swap')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  deskMode === 'swap'
                    ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                Variant Swap
              </button>
            </div>

            {selectedBill && (selectedBill.refunded_amount || 0) > 0 && (
              <span className="text-[11px] font-mono tabular-nums text-amber-600 dark:text-amber-400 font-semibold">
                Previously refunded: {formatMoney(selectedBill.refunded_amount || 0, shopConfig)}
              </span>
            )}
          </div>
        )}

        {toastMessage && (
          <div className="mt-3 p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 rounded-xl text-xs font-semibold text-center">
            {toastMessage}
          </div>
        )}

        {returnCompleted ? (
          <div className="py-6 space-y-4 text-center overflow-y-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                Return &amp; Refund Recorded
              </h3>
              <p className="text-xs text-zinc-500 mt-1 font-mono">
                {returnCompleted.returnRecord.return_number} · Original {returnCompleted.originalBillNo}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-left text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between text-zinc-500 pb-1 border-b border-zinc-200 dark:border-zinc-800">
                <span>Customer</span>
                <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                  {returnCompleted.customerName}
                </span>
              </div>
              {returnCompleted.returnRecord.items.map(it => (
                <div key={it.bill_item_id} className="flex justify-between gap-2">
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {it.product_name} ({[it.size_label, it.color_label].filter(Boolean).join(' · ') || 'Std'}) × {it.qty}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-zinc-950 dark:text-zinc-50">
                    {formatMoney(it.refund_amount, shopConfig)}
                  </span>
                </div>
              ))}
              {returnCompleted.returnRecord.reason && (
                <div className="text-[11px] text-zinc-500 pt-1">
                  Reason: {returnCompleted.returnRecord.reason}
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800 font-bold">
                <span>
                  {returnCompleted.returnRecord.refund_method === 'store_credit'
                    ? 'Added to Store Credit'
                    : returnCompleted.returnRecord.refund_method === 'card'
                    ? 'Card Reversal'
                    : 'Cash Refund'}
                </span>
                <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatMoney(returnCompleted.returnRecord.refund_amount, shopConfig)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrintRefundSlip}
                className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Refund Slip</span>
              </button>
            </div>
          </div>
        ) : exchangeCompleted ? (
          <div className="py-6 space-y-4 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                Exchange Completed
              </h3>
              <p className="text-xs text-zinc-500 mt-1 font-mono">{exchangeCompleted.exchangeNo}</p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-left text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between">
                <span className="text-zinc-500">Returned</span>
                <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                  {exchangeCompleted.productName} ({exchangeCompleted.returnedLabel})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Issued</span>
                <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                  {exchangeCompleted.productName} ({exchangeCompleted.issuedLabel})
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800 font-bold">
                <span>Difference</span>
                <span className="font-mono tabular-nums">
                  {exchangeCompleted.difference === 0
                    ? `${formatMoney(0, shopConfig)} (Even Swap)`
                    : exchangeCompleted.difference > 0
                    ? `+${formatMoney(exchangeCompleted.difference, shopConfig)} Collect`
                    : `-${formatMoney(Math.abs(exchangeCompleted.difference), shopConfig)} ${
                        exchangeCompleted.refundMethod === 'store_credit'
                          ? 'Added to Store Credit'
                          : 'Cash Refund'
                      }`}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrintExchange}
                className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Exchange Slip</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {!selectedBill ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    placeholder="Scan receipt barcode or search receipt #, customer name, or phone..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  {searchedBills.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedBill(b);
                        setSelectedItemToReturn(b.items[0] || null);
                        setTargetVariantId('');
                        setReturnQuantities({});
                      }}
                      className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-950 dark:hover:border-zinc-400 bg-white dark:bg-zinc-950 flex items-center justify-between text-left text-xs cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-zinc-950 dark:text-zinc-50">
                          {b.bill_number}
                          {(b.refunded_amount || 0) > 0 && (
                            <span className="ml-2 text-[11px] font-normal text-amber-600 dark:text-amber-400">
                              · Refunded {formatMoney(b.refunded_amount || 0, shopConfig)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          {formatDateShort(b.created_at, shopConfig)} · {b.customer_name || 'Walk-in'} ({b.items.length} line{b.items.length === 1 ? '' : 's'})
                        </div>
                      </div>
                      <span className="font-mono font-bold tabular-nums text-zinc-950 dark:text-zinc-50">
                        {formatMoney(b.total, shopConfig)}
                      </span>
                    </button>
                  ))}
                  {searchedBills.length === 0 && (
                    <div className="py-8 text-center text-xs text-zinc-500">No matching receipts found.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-zinc-500">Receipt: </span>
                    <strong className="font-mono text-zinc-950 dark:text-zinc-50">{selectedBill.bill_number}</strong>
                    <span className="text-zinc-500 ml-2">
                      · {selectedBill.customer_name || 'Walk-in Customer'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBill(null);
                      setSelectedItemToReturn(null);
                      setTargetVariantId('');
                      setReturnQuantities({});
                    }}
                    className="text-xs font-semibold underline cursor-pointer"
                  >
                    Change Receipt
                  </button>
                </div>

                {deskMode === 'return' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        1. Select Item Quantities to Return
                      </span>
                      <button
                        type="button"
                        onClick={selectAllRemainingForReturn}
                        className="text-[11px] font-semibold underline text-zinc-600 dark:text-zinc-300 cursor-pointer"
                      >
                        Return All Remaining
                      </button>
                    </div>

                    <div className="space-y-2">
                      {selectedBill.items.map(item => {
                        const already = alreadyReturnedByItemId.get(item.id) || 0;
                        const remaining = Math.max(0, item.qty - already);
                        const qtyPicked = returnQuantities[item.id] || 0;
                        const unitRefund = unitRefundLookup.get(item.id) ?? item.unit_price;

                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                              qtyPicked > 0
                                ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-950'
                                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                            } ${remaining === 0 ? 'opacity-50' : ''}`}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-zinc-950 dark:text-zinc-50 truncate">
                                {item.product_name}
                              </div>
                              <div className="text-[11px] text-zinc-500">
                                {[item.size_label, item.color_label].filter(Boolean).join(' · ') || 'Standard'} · Sold {item.qty}
                                {already > 0 ? ` · Returned ${already}` : ''} · {formatMoney(unitRefund, shopConfig)}/unit
                              </div>
                            </div>

                            {remaining === 0 ? (
                              <span className="text-[11px] font-medium text-zinc-400 shrink-0">
                                Fully Returned
                              </span>
                            ) : (
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => adjustReturnQty(item, -1)}
                                  disabled={qtyPicked <= 0}
                                  className="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center disabled:opacity-30 cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-7 text-center font-mono font-bold tabular-nums text-zinc-950 dark:text-zinc-50">
                                  {qtyPicked}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => adjustReturnQty(item, 1)}
                                  disabled={qtyPicked >= remaining}
                                  className="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center disabled:opacity-30 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          2. Refund Method
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setStandaloneRefundMethod('cash')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                              standaloneRefundMethod === 'cash'
                                ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                                : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                            }`}
                          >
                            Cash Refund
                          </button>
                          <button
                            type="button"
                            onClick={() => setStandaloneRefundMethod('card')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                              standaloneRefundMethod === 'card'
                                ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                                : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                            }`}
                          >
                            Card Reversal
                          </button>
                          <button
                            type="button"
                            onClick={() => setStandaloneRefundMethod('store_credit')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                              standaloneRefundMethod === 'store_credit'
                                ? 'bg-emerald-700 text-white border-transparent'
                                : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                            }`}
                          >
                            Add to Store Credit
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                          Return Reason (Optional)
                        </label>
                        <input
                          type="text"
                          value={returnReason}
                          onChange={e => setReturnReason(e.target.value)}
                          placeholder="e.g., Fit didn't work, gift return, minor defect..."
                          className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs"
                        />
                      </div>

                      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                        <span className="text-zinc-500">
                          Refund Total ({selectedReturnSummary.totalQty} unit
                          {selectedReturnSummary.totalQty === 1 ? '' : 's'})
                        </span>
                        <span className="font-mono text-base font-bold tabular-nums text-zinc-950 dark:text-zinc-50">
                          {formatMoney(selectedReturnSummary.refundTotal, shopConfig)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                        1. Item to Swap
                      </div>
                      <div className="space-y-2">
                        {selectedBill.items.map(item => {
                          const active = selectedItemToReturn?.id === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setSelectedItemToReturn(item);
                                setTargetVariantId('');
                              }}
                              className={`w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs cursor-pointer ${
                                active
                                  ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-950'
                                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                              }`}
                            >
                              <div>
                                <div className="font-semibold text-zinc-950 dark:text-zinc-50">{item.product_name}</div>
                                <div className="text-[11px] text-zinc-500">
                                  {[item.size_label, item.color_label].filter(Boolean).join(' · ') || 'Standard'} · Qty {item.qty}
                                </div>
                              </div>
                              <span className="font-mono font-bold tabular-nums">
                                {formatMoney(item.unit_price, shopConfig)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {selectedItemToReturn && (
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                        <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          2. Replacement Variant
                        </div>
                        {replacementVariants.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {replacementVariants.map(v => {
                              const active = targetVariantId === v.id;
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => setTargetVariantId(v.id)}
                                  className={`p-2.5 rounded-xl border text-left text-xs cursor-pointer ${
                                    active
                                      ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                                      : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800'
                                  }`}
                                >
                                  <div className="font-semibold">
                                    {v.size_label} · {v.color_label}
                                  </div>
                                  <div className="text-[11px] font-mono opacity-80 tabular-nums mt-0.5">
                                    {formatMoney(v.price, shopConfig)} · {v.stock_qty} in stock
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-500">No replacement variants found for this item.</p>
                        )}

                        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                          <span className="text-zinc-500">Net Price Difference</span>
                          <span className="font-mono font-bold tabular-nums text-zinc-950 dark:text-zinc-50">
                            {priceDifference === 0
                              ? `${formatMoney(0, shopConfig)} (Even Swap)`
                              : priceDifference > 0
                              ? `+${formatMoney(priceDifference, shopConfig)} Collect`
                              : `-${formatMoney(Math.abs(priceDifference), shopConfig)} Refund`}
                          </span>
                        </div>

                        {priceDifference < 0 && (
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="text-xs text-zinc-500">Refund Settlement</span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSwapRefundMethod('cash')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border ${
                                  swapRefundMethod === 'cash'
                                    ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                                    : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                                }`}
                              >
                                Cash Refund
                              </button>
                              <button
                                type="button"
                                onClick={() => setSwapRefundMethod('store_credit')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border ${
                                  swapRefundMethod === 'store_credit'
                                    ? 'bg-emerald-700 text-white border-transparent'
                                    : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                                }`}
                              >
                                Add to Store Credit
                              </button>
                            </div>
                          </div>
                        )}

                        {priceDifference > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-zinc-500">Difference Payment Method</span>
                              <div className="flex gap-1.5">
                                {(['cash', 'card', 'upi'] as PaymentMethod[]).map(pm => (
                                  <button
                                    key={pm}
                                    type="button"
                                    onClick={() => setPaymentMode(pm)}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border ${
                                      paymentMode === pm
                                        ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                                        : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                                    }`}
                                  >
                                    {getPaymentMethodLabel(pm, shopConfig)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {exchangeUpiQr && (
                              <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <img src={exchangeUpiQr} alt="Exchange QR" className="w-16 h-16 rounded-lg bg-white p-1" />
                                  <div className="text-xs">
                                    <div className="font-semibold flex items-center gap-1">
                                      <QrCode className="w-3.5 h-3.5" />
                                      <span>Pay {formatMoney(priceDifference, shopConfig)}</span>
                                    </div>
                                    <div className="font-mono text-[11px] text-zinc-500">{shopConfig?.upi_id}</div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowStandeeQr(true)}
                                  className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer"
                                >
                                  <Maximize2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {!exchangeCompleted && !returnCompleted && (
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            {deskMode === 'return' && selectedBill && (
              <button
                type="button"
                onClick={handleExecuteReturnRefund}
                disabled={isProcessing || selectedReturnSummary.totalQty === 0}
                className="px-5 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {isProcessing
                    ? 'Processing...'
                    : `Issue Refund (${formatMoney(selectedReturnSummary.refundTotal, shopConfig)})`}
                </span>
              </button>
            )}
            {deskMode === 'swap' && selectedBill && selectedItemToReturn && targetVariant && (
              <button
                type="button"
                onClick={handleExecuteExchange}
                disabled={isProcessing}
                className="px-5 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Processing...' : 'Complete Exchange'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {showStandeeQr && exchangeUpiQr && (
        <div className="fixed inset-0 z-60 bg-zinc-950/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 border border-zinc-200 dark:border-zinc-800">
            <img src={exchangeUpiQr} alt="QR" className="w-52 h-52 mx-auto rounded-xl bg-white p-2" />
            <div className="text-2xl font-bold font-mono tabular-nums">
              {formatMoney(priceDifference, shopConfig)}
            </div>
            <button
              type="button"
              onClick={() => setShowStandeeQr(false)}
              className="w-full py-2.5 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
