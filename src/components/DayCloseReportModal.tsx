import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Share2,
  CheckCircle2,
  X,
  Calendar,
  Users,
  Plus,
  Trash2,
  Download,
  AlertTriangle,
  Archive,
  Wallet,
} from 'lucide-react';
import { db } from '../db/db';
import {
  type Bill,
  type CashDrawerEntry,
  type ShiftCloseRecord,
  type ShopConfig,
} from '../types';
import {
  formatDateShort,
  formatMoney,
  formatPrintMoney,
  formatTimeShort,
  getCurrencySymbol,
  getPaymentMethodLabel,
} from '../lib/locale';
import {
  downloadEmergencySafetyBackup,
  getBackupReminderStatus,
} from '../lib/licensing';
import { bluetoothPrinter } from '../lib/printer';
import { useAuth } from '../context/AuthContext';

interface DayCloseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DayCloseTab = 'close' | 'drops' | 'history';

export const DayCloseReportModal: React.FC<DayCloseReportModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, users } = useAuth();
  const [activeTab, setActiveTab] = useState<DayCloseTab>('close');
  const [bills, setBills] = useState<Bill[]>([]);
  const [drawerEntries, setDrawerEntries] = useState<CashDrawerEntry[]>([]);
  const [shiftCloses, setShiftCloses] = useState<ShiftCloseRecord[]>([]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');

  const [openingFloat, setOpeningFloat] = useState<string>('0');
  const [countedCashInput, setCountedCashInput] = useState<string>('');
  const [shiftNotes, setShiftNotes] = useState<string>('');
  const [isSavingShift, setIsSavingShift] = useState(false);

  // Cash drop / paid out form
  const [dropType, setDropType] = useState<CashDrawerEntry['type']>('safe_drop');
  const [dropAmount, setDropAmount] = useState<string>('');
  const [dropReason, setDropReason] = useState<string>('');
  const [isSavingDrop, setIsSavingDrop] = useState(false);

  const [backupStatus, setBackupStatus] = useState(() => getBackupReminderStatus());
  const [isExportingBackup, setIsExportingBackup] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2600);
  };

  const loadData = async () => {
    try {
      const [allBills, allEntries, allCloses, configs] = await Promise.all([
        db.bills.toArray(),
        db.cash_drawer_entries.toArray(),
        db.shift_closes.toArray(),
        db.shop_config.toArray(),
      ]);
      setBills(allBills);
      setDrawerEntries(
        allEntries.sort((a, b) => b.created_at.localeCompare(a.created_at))
      );
      setShiftCloses(
        allCloses.sort((a, b) => b.closed_at.localeCompare(a.closed_at))
      );
      if (configs.length > 0) setShopConfig(configs[0]);
      setBackupStatus(getBackupReminderStatus());
    } catch (err) {
      console.error('Failed to load day-close data:', err);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen, selectedDate]);

  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      if (b.created_at.slice(0, 10) !== selectedDate) return false;
      if (b.status === 'voided') return false;
      if (selectedStaffId !== 'all' && b.billed_by_id !== selectedStaffId) return false;
      return true;
    });
  }, [bills, selectedDate, selectedStaffId]);

  const filteredDrawerEntries = useMemo(() => {
    return drawerEntries.filter(entry => {
      if (entry.created_at.slice(0, 10) !== selectedDate) return false;
      if (selectedStaffId !== 'all' && entry.staff_id && entry.staff_id !== selectedStaffId) {
        return false;
      }
      return true;
    });
  }, [drawerEntries, selectedDate, selectedStaffId]);

  const summary = useMemo(() => {
    let totalGross = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalBilled = 0;
    let cashTotal = 0;
    let digitalTotal = 0;
    let cardTotal = 0;
    let creditTotal = 0;
    let storeCreditUsed = 0;
    let totalItems = 0;

    for (const b of filteredBills) {
      totalGross += b.subtotal || b.total;
      totalDiscount += b.discount_amount || 0;
      totalTax += b.tax_amount || 0;
      totalBilled += b.total;
      totalItems += b.items.reduce((acc, it) => acc + it.qty, 0);
      storeCreditUsed += b.store_credit_used || 0;

      if (b.payment_method === 'split' && b.payment_details) {
        cashTotal += b.payment_details.cash || 0;
        digitalTotal += (b.payment_details.upi || 0) + (b.payment_details.wallet || 0);
        cardTotal += b.payment_details.card || 0;
        creditTotal += b.payment_details.credit || 0;
      } else {
        const netTendered = Math.max(0, b.total - (b.store_credit_used || 0));
        if (b.payment_method === 'cash') cashTotal += netTendered;
        else if (b.payment_method === 'upi' || b.payment_method === 'wallet') digitalTotal += netTendered;
        else if (b.payment_method === 'card') cardTotal += netTendered;
        else if (b.payment_method === 'credit') creditTotal += netTendered;
      }
    }

    // Track refunds processed on selectedDate across all non-voided bills
    let cashRefunds = 0;
    let cardRefunds = 0;
    let storeCreditRefunds = 0;
    let refundsTotal = 0;

    for (const b of bills) {
      if (b.status === 'voided' || !b.return_records) continue;
      for (const rec of b.return_records) {
        if (rec.created_at.slice(0, 10) !== selectedDate) continue;
        refundsTotal += rec.refund_amount || 0;
        if (rec.refund_method === 'cash') cashRefunds += rec.refund_amount || 0;
        else if (rec.refund_method === 'card') cardRefunds += rec.refund_amount || 0;
        else if (rec.refund_method === 'store_credit') storeCreditRefunds += rec.refund_amount || 0;
      }
    }

    let floatInTotal = 0;
    let safeDropTotal = 0;
    let paidOutTotal = 0;
    for (const entry of filteredDrawerEntries) {
      if (entry.type === 'float_in') floatInTotal += entry.amount;
      else if (entry.type === 'safe_drop') safeDropTotal += entry.amount;
      else if (entry.type === 'paid_out') paidOutTotal += entry.amount;
    }

    const totalNet = Math.max(0, Math.round((totalBilled - refundsTotal) * 100) / 100);

    return {
      billsCount: filteredBills.length,
      totalGross,
      totalDiscount,
      totalTax,
      totalBilled,
      refundsTotal,
      cashRefunds,
      cardRefunds,
      storeCreditRefunds,
      storeCreditUsed,
      totalNet,
      cashTotal,
      digitalTotal,
      cardTotal,
      creditTotal,
      totalItems,
      floatInTotal,
      safeDropTotal,
      paidOutTotal,
    };
  }, [filteredBills, bills, filteredDrawerEntries, selectedDate]);

  const floatVal = parseFloat(openingFloat) || 0;
  const expectedTotalCashInDrawer =
    Math.round(
      (floatVal +
        summary.cashTotal +
        summary.floatInTotal -
        summary.safeDropTotal -
        summary.paidOutTotal -
        summary.cashRefunds) *
        100
    ) / 100;
  const countedCashVal = parseFloat(countedCashInput);
  const hasCountedCash = countedCashInput.trim() !== '' && !isNaN(countedCashVal);
  const cashDifference = hasCountedCash
    ? Math.round((countedCashVal - expectedTotalCashInDrawer) * 100) / 100
    : 0;

  if (!isOpen) return null;

  const handleAddDrawerEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.round((parseFloat(dropAmount) || 0) * 100) / 100;
    if (amt <= 0) {
      showToast('Enter a valid amount greater than 0');
      return;
    }
    setIsSavingDrop(true);
    try {
      const entry: CashDrawerEntry = {
        id: `cd_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        type: dropType,
        amount: amt,
        reason:
          dropReason.trim() ||
          (dropType === 'float_in'
            ? 'Drawer cash float added'
            : dropType === 'safe_drop'
            ? 'Safe cash drop'
            : 'Petty cash paid out'),
        staff_id: currentUser?.id,
        staff_name: currentUser?.name || 'Counter Staff',
        created_at: `${selectedDate}T${new Date().toISOString().slice(11)}`,
      };
      await db.cash_drawer_entries.add(entry);
      setDropAmount('');
      setDropReason('');
      await loadData();
      showToast('Drawer entry recorded');
    } catch {
      showToast('Failed to save drawer entry');
    } finally {
      setIsSavingDrop(false);
    }
  };

  const handleDeleteDrawerEntry = async (id: string) => {
    await db.cash_drawer_entries.delete(id);
    await loadData();
    showToast('Drawer entry removed');
  };

  const handleSaveZReport = async () => {
    setIsSavingShift(true);
    try {
      const nowIso = new Date().toISOString();
      const countedFinal = hasCountedCash ? countedCashVal : expectedTotalCashInDrawer;
      const varianceFinal = Math.round((countedFinal - expectedTotalCashInDrawer) * 100) / 100;
      const record: ShiftCloseRecord = {
        id: `zrep_${Date.now()}`,
        date: selectedDate,
        closed_at: nowIso,
        closed_by: currentUser?.name || 'Store Staff',
        bills_count: summary.billsCount,
        gross_sales: summary.totalBilled,
        refunds_total: summary.refundsTotal,
        store_credit_used: summary.storeCreditUsed,
        net_sales: summary.totalNet,
        cash_sales: summary.cashTotal,
        card_sales: summary.cardTotal,
        digital_sales: summary.digitalTotal,
        credit_sales: summary.creditTotal,
        float_in_total: summary.floatInTotal,
        safe_drop_total: summary.safeDropTotal,
        paid_out_total: summary.paidOutTotal,
        cash_refunds: summary.cashRefunds,
        opening_float: floatVal,
        expected_cash: expectedTotalCashInDrawer,
        counted_cash: countedFinal,
        variance: varianceFinal,
        notes: shiftNotes.trim() || undefined,
      };
      await db.shift_closes.add(record);
      setShiftNotes('');
      await loadData();
      showToast('Shift Z-Report saved to archive');
    } catch {
      showToast('Failed to save Z-Report');
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleDownloadBackup = async () => {
    setIsExportingBackup(true);
    try {
      await downloadEmergencySafetyBackup();
      setBackupStatus(getBackupReminderStatus());
      showToast('Full store JSON backup downloaded');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const printZReportObject = async (rec: {
    date: string;
    closed_by: string;
    bills_count: number;
    total_items?: number;
    gross_sales: number;
    refunds_total: number;
    net_sales: number;
    cash_sales: number;
    card_sales: number;
    digital_sales: number;
    credit_sales: number;
    float_in_total: number;
    safe_drop_total: number;
    paid_out_total: number;
    cash_refunds: number;
    opening_float: number;
    expected_cash: number;
    counted_cash: number;
    variance: number;
  }) => {
    setIsPrinting(true);
    const shopName = shopConfig?.legal_name || 'SIKKADESK RETAIL';
    const dateFormatted = formatDateShort(rec.date, shopConfig);

    try {
      if (bluetoothPrinter.isConnected()) {
        const text = `\x1B@\x1Ba\x01\x1BE\x01${shopName}\x1BE\x00\nDAY-CLOSE Z-REPORT\nDate: ${dateFormatted}\n--------------------------------\n\x1Ba\x00Receipts: ${
          rec.bills_count
        }\nGross Billed: ${formatPrintMoney(rec.gross_sales, shopConfig)}\nRefunds: -${formatPrintMoney(
          rec.refunds_total,
          shopConfig
        )}\n\x1BE\x01NET SALES: ${formatPrintMoney(
          rec.net_sales,
          shopConfig
        )}\x1BE\x00\n--------------------------------\nCash Sales: ${formatPrintMoney(
          rec.cash_sales,
          shopConfig
        )}\nCard Sales: ${formatPrintMoney(
          rec.card_sales,
          shopConfig
        )}\n${getPaymentMethodLabel('upi', shopConfig)}: ${formatPrintMoney(
          rec.digital_sales,
          shopConfig
        )}\nCredit Due: ${formatPrintMoney(
          rec.credit_sales,
          shopConfig
        )}\n--------------------------------\nOpening Float: ${formatPrintMoney(
          rec.opening_float,
          shopConfig
        )}\nFloat In (+): ${formatPrintMoney(
          rec.float_in_total,
          shopConfig
        )}\nSafe Drops (-): ${formatPrintMoney(
          rec.safe_drop_total,
          shopConfig
        )}\nPaid Out (-): ${formatPrintMoney(
          rec.paid_out_total,
          shopConfig
        )}\nCash Refunds (-): ${formatPrintMoney(
          rec.cash_refunds,
          shopConfig
        )}\nExpected Cash: ${formatPrintMoney(
          rec.expected_cash,
          shopConfig
        )}\nCounted Cash: ${formatPrintMoney(
          rec.counted_cash,
          shopConfig
        )}\nVariance: ${formatPrintMoney(rec.variance, shopConfig)}\nStaff: ${
          rec.closed_by
        }\n\n\n\x1DV\x42\x00`;
        await bluetoothPrinter.printData(new TextEncoder().encode(text));
        showToast('Z-Report sent to Bluetooth printer');
      } else {
        window.print();
      }
    } catch {
      showToast('Failed to print report');
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintCurrentZReport = () =>
    printZReportObject({
      date: selectedDate,
      closed_by: currentUser?.name || 'Staff',
      bills_count: summary.billsCount,
      total_items: summary.totalItems,
      gross_sales: summary.totalBilled,
      refunds_total: summary.refundsTotal,
      net_sales: summary.totalNet,
      cash_sales: summary.cashTotal,
      card_sales: summary.cardTotal,
      digital_sales: summary.digitalTotal,
      credit_sales: summary.creditTotal,
      float_in_total: summary.floatInTotal,
      safe_drop_total: summary.safeDropTotal,
      paid_out_total: summary.paidOutTotal,
      cash_refunds: summary.cashRefunds,
      opening_float: floatVal,
      expected_cash: expectedTotalCashInDrawer,
      counted_cash: hasCountedCash ? countedCashVal : expectedTotalCashInDrawer,
      variance: cashDifference,
    });

  const handleShareWhatsApp = (rec?: ShiftCloseRecord) => {
    const shopName = shopConfig?.legal_name || 'SIKKADESK RETAIL';
    const dStr = rec ? rec.date : selectedDate;
    const msg = `*DAY-CLOSE Z-REPORT*\nStore: ${shopName}\nDate: ${dStr}\n\n• Receipts: ${
      rec ? rec.bills_count : summary.billsCount
    }\n• Net Revenue: *${formatMoney(
      rec ? rec.net_sales : summary.totalNet,
      shopConfig
    )}*\n• Refunds: -${formatMoney(
      rec ? rec.refunds_total : summary.refundsTotal,
      shopConfig
    )}\n\n• Cash: ${formatMoney(rec ? rec.cash_sales : summary.cashTotal, shopConfig)}\n• Card: ${formatMoney(
      rec ? rec.card_sales : summary.cardTotal,
      shopConfig
    )}\n• Digital: ${formatMoney(rec ? rec.digital_sales : summary.digitalTotal, shopConfig)}\n• Safe Drops: -${formatMoney(
      rec ? rec.safe_drop_total : summary.safeDropTotal,
      shopConfig
    )}\n\n• Expected Cash: ${formatMoney(
      rec ? rec.expected_cash : expectedTotalCashInDrawer,
      shopConfig
    )}\n• Variance: ${formatMoney(rec ? rec.variance : cashDifference, shopConfig)}\n\nPrepared by: ${
      rec ? rec.closed_by : currentUser?.name || 'Staff'
    }`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[92vh] flex flex-col my-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-zinc-950 dark:text-zinc-50">
                Day-Close Z-Report &amp; Cash Drawer
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Reconcile cash drops, refunds, drawer totals, and save historical shift Z-Reports
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

        {/* 3-Tab Switcher */}
        <div className="pt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab('close')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'close'
                  ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Close Shift</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('drops')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'drops'
                  ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Cash Drops ({filteredDrawerEntries.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'history'
                  ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Saved Z-Reports ({shiftCloses.length})</span>
            </button>
          </div>
        </div>

        {toastMessage && (
          <div className="mt-3 p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs font-semibold text-center">
            {toastMessage}
          </div>
        )}

        {activeTab !== 'history' && (
          <div className="flex flex-wrap items-center gap-3 mt-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-zinc-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-500" />
              <select
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
              >
                <option value="all">All Counter Staff</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {activeTab === 'close' && (
            <>
              {/* Automated Daily Backup Reminder */}
              {backupStatus.isOverdue && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <div className="font-semibold">Daily Local Backup Reminder</div>
                      <div className="text-[11px] opacity-90">
                        {backupStatus.lastBackupAt
                          ? `Last store backup was ${backupStatus.hoursSince}h ago. Download a fresh snapshot after closing your shift.`
                          : 'No local JSON backup downloaded yet. Store data lives in this browser — export a safety copy daily.'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    disabled={isExportingBackup}
                    className="px-3.5 py-2 rounded-lg bg-amber-900 dark:bg-amber-400 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isExportingBackup ? 'Exporting...' : 'Download Backup (.json)'}</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] font-medium text-zinc-500">Net Revenue</div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-0.5">
                    {formatMoney(summary.totalNet, shopConfig)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] font-medium text-zinc-500">Receipts</div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-0.5">{summary.billsCount}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] font-medium text-zinc-500">Refunds Issued</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                    {formatMoney(summary.refundsTotal, shopConfig)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] font-medium text-zinc-500">Store Credit Used</div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-0.5">
                    {formatMoney(summary.storeCreditUsed, shopConfig)}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Tender Breakdown
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-zinc-500">Cash Collected</div>
                    <div className="font-bold font-mono tabular-nums text-sm mt-0.5">
                      {formatMoney(summary.cashTotal, shopConfig)}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Card</div>
                    <div className="font-bold font-mono tabular-nums text-sm mt-0.5">
                      {formatMoney(summary.cardTotal, shopConfig)}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500">{getPaymentMethodLabel('upi', shopConfig)}</div>
                    <div className="font-bold font-mono tabular-nums text-sm mt-0.5">
                      {formatMoney(summary.digitalTotal, shopConfig)}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Credit / Due</div>
                    <div className="font-bold font-mono tabular-nums text-sm mt-0.5">
                      {formatMoney(summary.creditTotal, shopConfig)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Cash Drawer Reconciliation
                    </h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5 font-mono tabular-nums">
                      Float +{formatMoney(floatVal + summary.floatInTotal, shopConfig)} · Drops -
                      {formatMoney(summary.safeDropTotal, shopConfig)} · Paid Out -
                      {formatMoney(summary.paidOutTotal, shopConfig)} · Cash Refunds -
                      {formatMoney(summary.cashRefunds, shopConfig)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-zinc-500 block">Expected Cash</span>
                    <span className="text-sm font-bold font-mono tabular-nums">
                      {formatMoney(expectedTotalCashInDrawer, shopConfig)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 block mb-1">
                      Opening Till Float ({getCurrencySymbol(shopConfig)})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={openingFloat}
                      onChange={e => setOpeningFloat(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 block mb-1">
                      Counted Cash in Drawer ({getCurrencySymbol(shopConfig)})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={countedCashInput}
                      onChange={e => setCountedCashInput(e.target.value)}
                      placeholder={String(expectedTotalCashInDrawer)}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono tabular-nums"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  value={shiftNotes}
                  onChange={e => setShiftNotes(e.target.value)}
                  placeholder="Optional shift closing note (e.g., evening register count verified)..."
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
                />

                {hasCountedCash && (
                  <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-semibold">
                        Counted: <span className="font-mono tabular-nums">{formatMoney(countedCashVal, shopConfig)}</span>
                      </span>
                    </div>
                    <div
                      className={`font-bold font-mono tabular-nums ${
                        cashDifference === 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : cashDifference > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {cashDifference === 0
                        ? 'Balanced (Exact)'
                        : cashDifference > 0
                        ? `Over +${formatMoney(cashDifference, shopConfig)}`
                        : `Short -${formatMoney(Math.abs(cashDifference), shopConfig)}`}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'drops' && (
            <div className="space-y-4">
              <form
                onSubmit={handleAddDrawerEntry}
                className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs"
              >
                <div className="font-semibold text-zinc-950 dark:text-zinc-50">
                  Log Drawer Adjustment ({selectedDate})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDropType('float_in')}
                    className={`py-2 px-3 rounded-lg border font-semibold cursor-pointer ${
                      dropType === 'float_in'
                        ? 'bg-emerald-700 text-white border-transparent'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    Float In (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDropType('safe_drop')}
                    className={`py-2 px-3 rounded-lg border font-semibold cursor-pointer ${
                      dropType === 'safe_drop'
                        ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    Safe Drop (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDropType('paid_out')}
                    className={`py-2 px-3 rounded-lg border font-semibold cursor-pointer ${
                      dropType === 'paid_out'
                        ? 'bg-amber-700 text-white border-transparent'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    Paid Out (-)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={dropAmount}
                    onChange={e => setDropAmount(e.target.value)}
                    placeholder={`Amount (${getCurrencySymbol(shopConfig)})`}
                    className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono tabular-nums"
                  />
                  <input
                    type="text"
                    value={dropReason}
                    onChange={e => setDropReason(e.target.value)}
                    placeholder="Reason (e.g., Bank drop, courier fee)"
                    className="sm:col-span-2 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingDrop}
                    className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isSavingDrop ? 'Saving...' : 'Add Drawer Entry'}</span>
                  </button>
                </div>
              </form>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                {filteredDrawerEntries.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500">
                    No cash drops, floats, or paid-outs logged on {selectedDate}.
                  </div>
                ) : (
                  filteredDrawerEntries.map(entry => {
                    const isAdd = entry.type === 'float_in';
                    const typeLabel =
                      entry.type === 'float_in'
                        ? 'Float In'
                        : entry.type === 'safe_drop'
                        ? 'Safe Drop'
                        : 'Paid Out';
                    return (
                      <div key={entry.id} className="p-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-zinc-950 dark:text-zinc-50">
                            {typeLabel} · {entry.reason}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {formatTimeShort(entry.created_at, shopConfig)} · {entry.staff_name || 'Staff'}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`font-mono font-bold tabular-nums ${
                              isAdd
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-zinc-950 dark:text-zinc-50'
                            }`}
                          >
                            {isAdd ? '+' : '-'}
                            {formatMoney(entry.amount, shopConfig)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteDrawerEntry(entry.id)}
                            className="p-1 text-zinc-400 hover:text-rose-600 cursor-pointer"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3 text-xs">
              {shiftCloses.length === 0 ? (
                <div className="py-10 text-center text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  No saved Z-Reports yet. Close a shift from the &ldquo;Close Shift&rdquo; tab to archive it here.
                </div>
              ) : (
                shiftCloses.map(rec => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-zinc-950 dark:text-zinc-50">
                          {rec.date} · {rec.bills_count} receipts
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          Closed {formatTimeShort(rec.closed_at, shopConfig)} by {rec.closed_by}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleShareWhatsApp(rec)}
                          className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-semibold cursor-pointer"
                        >
                          Share
                        </button>
                        <button
                          type="button"
                          onClick={() => printZReportObject(rec)}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold cursor-pointer"
                        >
                          Print
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 font-mono tabular-nums">
                      <div>
                        <span className="text-[10px] text-zinc-500 block font-sans">Net Sales</span>
                        <span className="font-bold">{formatMoney(rec.net_sales, shopConfig)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block font-sans">Expected Cash</span>
                        <span className="font-bold">{formatMoney(rec.expected_cash, shopConfig)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block font-sans">Counted Cash</span>
                        <span className="font-bold">{formatMoney(rec.counted_cash, shopConfig)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block font-sans">Variance</span>
                        <span
                          className={`font-bold ${
                            rec.variance === 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : rec.variance > 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {rec.variance >= 0 ? '+' : ''}
                          {formatMoney(rec.variance, shopConfig)}
                        </span>
                      </div>
                    </div>
                    {rec.notes && <p className="text-[11px] text-zinc-500">Note: {rec.notes}</p>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
          {activeTab === 'close' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleShareWhatsApp()}
                className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
              <button
                type="button"
                onClick={handlePrintCurrentZReport}
                disabled={isPrinting}
                className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Z-Report</span>
              </button>
              <button
                type="button"
                onClick={handleSaveZReport}
                disabled={isSavingShift}
                className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSavingShift ? 'Saving...' : 'Save & Finalize Z-Report'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
