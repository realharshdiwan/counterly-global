import React, { useState, useEffect, useMemo } from 'react';
import {
  ReceiptText,
  Search,
  XCircle,
  Download,
  X,
  FileSpreadsheet,
  ArrowRightLeft,
  TrendingUp,
  Users,
} from 'lucide-react';
import { db } from '../db/db';
import { type Bill, type ShopConfig, type CustomerProfile } from '../types';
import {
  formatDateShort,
  formatMoney,
  formatTimeShort,
  getCurrencyCode,
  getPaymentMethodLabel,
} from '../lib/locale';
import { useAuth } from '../context/AuthContext';
import { ManagerOverrideModal } from './ManagerOverrideModal';
import { DayCloseReportModal } from './DayCloseReportModal';
import { ExchangeReturnModal } from './ExchangeReturnModal';
import { GstCompositionReportModal } from './GstCompositionReportModal';
import { RetailAnalyticsView } from './RetailAnalyticsView';
import { CustomerCrmView } from './CustomerCrmView';

interface BillsHistoryProps {
  onOpenReceipt: (bill: Bill) => void;
  onNavigateToRegister?: (customer?: CustomerProfile) => void;
}

export const BillsHistory: React.FC<BillsHistoryProps> = ({
  onOpenReceipt,
  onNavigateToRegister,
}) => {
  const { currentUser, canVoidBills } = useAuth();
  const [subView, setSubView] = useState<'ledger' | 'analytics' | 'customers'>('ledger');
  const [bills, setBills] = useState<Bill[]>([]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unpaid' | 'voided'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [billToVoid, setBillToVoid] = useState<Bill | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [isManagerOverrideOpen, setIsManagerOverrideOpen] = useState(false);

  const [isDayCloseOpen, setIsDayCloseOpen] = useState(false);
  const [isExchangeOpen, setIsExchangeOpen] = useState(false);
  const [isGstModalOpen, setIsGstModalOpen] = useState(false);
  const [exchangeBillTarget, setExchangeBillTarget] = useState<Bill | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const loadBills = async () => {
    try {
      const [allBills, configs] = await Promise.all([
        db.bills.reverse().sortBy('created_at'),
        db.shop_config.toArray(),
      ]);
      setBills(allBills);
      if (configs.length > 0) setShopConfig(configs[0]);
    } catch (err) {
      console.error('Failed to load bills:', err);
    }
  };

  useEffect(() => {
    loadBills();
  }, []);

  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      if (selectedFilter === 'unpaid' && (b.is_paid || b.status === 'voided')) return false;
      if (selectedFilter === 'voided' && b.status !== 'voided') return false;
      if (selectedFilter === 'all' && b.status === 'voided') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          b.bill_number.toLowerCase().includes(q) ||
          (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
          (b.customer_phone && b.customer_phone.includes(q)) ||
          (b.school_name && b.school_name.toLowerCase().includes(q)) ||
          (b.billed_by_name && b.billed_by_name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [bills, selectedFilter, searchQuery]);

  const metrics = useMemo(() => {
    const active = bills.filter(b => b.status !== 'voided');
    const totalRev = active.reduce(
      (acc, b) => acc + Math.max(0, (b.total || 0) - (b.refunded_amount || 0)),
      0
    );
    const unpaidCredit = active
      .filter(b => !b.is_paid)
      .reduce((acc, b) => acc + Math.max(0, (b.total || 0) - (b.refunded_amount || 0)), 0);
    return { totalRev, unpaidCredit, totalBills: active.length };
  }, [bills]);

  const handleSettleCredit = async (bill: Bill) => {
    try {
      await db.bills.update(bill.id, {
        is_paid: true,
        paid_at: new Date().toISOString(),
      });
      await loadBills();
      showToast(`Invoice ${bill.bill_number} marked as paid`);
    } catch {
      showToast('Failed to update payment status');
    }
  };

  const handleInitiateVoid = (bill: Bill) => {
    setBillToVoid(bill);
    if (!canVoidBills()) {
      setIsManagerOverrideOpen(true);
    } else {
      setIsVoidModalOpen(true);
    }
  };

  const executeVoidBill = async () => {
    if (!billToVoid) return;
    try {
      const nowIso = new Date().toISOString();
      await db.bills.update(billToVoid.id, {
        status: 'voided',
        voided_at: nowIso,
        void_reason: `Voided by ${currentUser?.name || 'Staff'}`,
      });

      for (const item of billToVoid.items) {
        if (item.variant_id) {
          const variant = await db.variants.get(item.variant_id);
          if (variant) {
            const prevQty = variant.stock_qty;
            const nextQty = prevQty + item.qty;
            await db.variants.update(variant.id, { stock_qty: nextQty });
            await db.inventory_movements.add({
              id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              product_id: item.product_id,
              variant_id: variant.id,
              product_name: item.product_name,
              size_label: [item.size_label, item.color_label].filter(Boolean).join(' · ') || 'Standard',
              type: 'return',
              qty: item.qty,
              previous_stock: prevQty,
              new_stock: nextQty,
              notes: `Voided invoice ${billToVoid.bill_number}`,
              created_at: nowIso,
              reference_bill_id: billToVoid.id,
            });
          }
        }
      }

      await loadBills();
      setIsVoidModalOpen(false);
      setBillToVoid(null);
      showToast(`Invoice ${billToVoid.bill_number} voided and stock restored`);
    } catch {
      showToast('Error voiding invoice');
    }
  };

  const handleExportCSV = () => {
    if (bills.length === 0) {
      showToast('No invoices to export');
      return;
    }

    const currCode = getCurrencyCode(shopConfig);
    const headers = [
      'Invoice Number',
      'Date',
      'Customer',
      'Phone',
      `Net Total (${currCode})`,
      `Refunded (${currCode})`,
      'Payment Method',
      'Staff',
      'Status',
    ];
    const rows = bills.map(b => [
      b.bill_number,
      `${formatDateShort(b.created_at, shopConfig)} ${formatTimeShort(b.created_at, shopConfig)}`,
      `"${(b.customer_name || 'Walk-in').replace(/"/g, '""')}"`,
      b.customer_phone || '',
      Math.max(0, (b.total || 0) - (b.refunded_amount || 0)),
      b.refunded_amount || 0,
      getPaymentMethodLabel(b.payment_method, shopConfig),
      `"${(b.billed_by_name || '').replace(/"/g, '""')}"`,
      b.status === 'voided'
        ? 'VOIDED'
        : (b.refunded_amount || 0) > 0
        ? 'PARTIAL/REFUNDED'
        : b.is_paid
        ? 'PAID'
        : 'CREDIT DUE',
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SikkaDesk_Invoices_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Invoices CSV exported');
  };

  const showGstReport = shopConfig?.tax_label === 'GST';
  const canViewMargins = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 px-4 py-2 rounded-lg shadow-lg text-xs font-semibold">
          {toastMessage}
        </div>
      )}

      {/* Segmented Workspace Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setSubView('ledger')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              subView === 'ledger'
                ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            <ReceiptText className="w-3.5 h-3.5" />
            <span>Invoice Ledger</span>
          </button>

          {canViewMargins && (
            <button
              type="button"
              onClick={() => setSubView('analytics')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                subView === 'analytics'
                  ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Analytics &amp; Margins</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSubView('customers')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              subView === 'customers'
                ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Customers &amp; Credit</span>
          </button>
        </div>
      </div>

      {subView === 'analytics' && canViewMargins ? (
        <RetailAnalyticsView
          onNavigateToRegister={onNavigateToRegister ? () => onNavigateToRegister() : undefined}
        />
      ) : subView === 'customers' ? (
        <CustomerCrmView
          onOpenReceipt={onOpenReceipt}
          onBillCustomer={onNavigateToRegister}
        />
      ) : (
        <>
          {/* Top Header & KPI Strip */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <ReceiptText className="w-5 h-5 text-zinc-950 dark:text-zinc-50" />
                  <h1 className="font-bold text-lg text-zinc-950 dark:text-zinc-50 tracking-tight">
                    Invoices &amp; Sales History
                  </h1>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Review receipts, process exchanges, settle store credit, and run Day-Close Z-Reports
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDayCloseOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Day-Close Z-Report</span>
            </button>

            {showGstReport && (
              <button
                type="button"
                onClick={() => setIsGstModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>GST Report</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setExchangeBillTarget(null);
                setIsExchangeOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Returns</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] font-medium text-zinc-500">Completed Sales</div>
            <div className="text-xl font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50 mt-0.5">
              {formatMoney(metrics.totalRev, shopConfig)}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] font-medium text-zinc-500">Invoices Issued</div>
            <div className="text-xl font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50 mt-0.5">
              {metrics.totalBills}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] font-medium text-zinc-500">Credit / Balance Due</div>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
              {formatMoney(metrics.unpaidCredit, shopConfig)}
            </div>
          </div>
        </div>

        {/* Filter & Search Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 w-fit">
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                selectedFilter === 'all'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                  : 'text-zinc-500'
              }`}
            >
              Completed ({bills.filter(b => b.status !== 'voided').length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('unpaid')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                selectedFilter === 'unpaid'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                  : 'text-zinc-500'
              }`}
            >
              Credit Due ({bills.filter(b => !b.is_paid && b.status !== 'voided').length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('voided')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                selectedFilter === 'voided'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                  : 'text-zinc-500'
              }`}
            >
              Voided ({bills.filter(b => b.status === 'voided').length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search receipt #, customer, or staff..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-950 dark:text-zinc-50 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4 font-medium">Receipt #</th>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Customer</th>
                <th className="py-3 px-4 font-medium">Items</th>
                <th className="py-3 px-4 font-medium text-right">Total</th>
                <th className="py-3 px-4 font-medium">Payment &amp; Staff</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredBills.map(bill => {
                const isVoided = bill.status === 'voided';
                const totalUnits = bill.items.reduce((acc, it) => acc + it.qty, 0);

                return (
                  <tr
                    key={bill.id}
                    className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 ${
                      isVoided ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-zinc-950 dark:text-zinc-50">
                      {bill.bill_number}
                    </td>
                    <td className="py-3 px-4 text-zinc-500 tabular-nums whitespace-nowrap">
                      {formatDateShort(bill.created_at, shopConfig)} ·{' '}
                      {formatTimeShort(bill.created_at, shopConfig)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {bill.customer_name || 'Walk-in'}
                      </div>
                      {(bill.customer_phone || (bill.school_name && bill.school_name !== 'Walk-in Retail')) && (
                        <div className="text-[11px] text-zinc-500">
                          {[bill.customer_phone, bill.school_name !== 'Walk-in Retail' ? bill.school_name : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300 tabular-nums">
                      {totalUnits} unit{totalUnits === 1 ? '' : 's'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-zinc-950 dark:text-zinc-50">
                      <div>{formatMoney(Math.max(0, (bill.total || 0) - (bill.refunded_amount || 0)), shopConfig)}</div>
                      {(bill.refunded_amount || 0) > 0 && (
                        <div className="text-[11px] font-normal text-amber-600 dark:text-amber-400">
                          · Refunded -{formatMoney(bill.refunded_amount || 0, shopConfig)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div
                        className={`font-medium ${
                          isVoided
                            ? 'text-rose-600 dark:text-rose-400'
                            : !bill.is_paid
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                        {isVoided
                          ? 'Voided'
                          : !bill.is_paid
                          ? 'Credit Due'
                          : `${getPaymentMethodLabel(bill.payment_method, shopConfig)} · Paid`}
                      </div>
                      {bill.billed_by_name && (
                        <div className="text-[11px] text-zinc-500">{bill.billed_by_name}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenReceipt(bill)}
                          className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold cursor-pointer"
                        >
                          Receipt
                        </button>
                        {!isVoided && (
                          <button
                            type="button"
                            onClick={() => {
                              setExchangeBillTarget(bill);
                              setIsExchangeOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold cursor-pointer"
                          >
                            Returns
                          </button>
                        )}
                        {!bill.is_paid && !isVoided && (
                          <button
                            type="button"
                            onClick={() => handleSettleCredit(bill)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold cursor-pointer"
                          >
                            Mark Paid
                          </button>
                        )}
                        {!isVoided && (
                          <button
                            type="button"
                            onClick={() => handleInitiateVoid(bill)}
                            className="p-1 text-zinc-400 hover:text-rose-600 cursor-pointer"
                            title="Void invoice"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredBills.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-zinc-500">
                    No matching invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Void Confirmation Modal */}
      {isVoidModalOpen && billToVoid && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-950 dark:text-zinc-50">
                Void Invoice #{billToVoid.bill_number}?
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsVoidModalOpen(false);
                  setBillToVoid(null);
                }}
                className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Total:{' '}
              <strong className="font-mono text-zinc-950 dark:text-zinc-50">
                {formatMoney(billToVoid.total, shopConfig)}
              </strong>
              . Voiding restores all item stock back to inventory.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsVoidModalOpen(false);
                  setBillToVoid(null);
                }}
                className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeVoidBill}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                Void Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      <ManagerOverrideModal
        isOpen={isManagerOverrideOpen}
        onClose={() => {
          setIsManagerOverrideOpen(false);
          setBillToVoid(null);
        }}
        onAuthorized={() => {
          setIsManagerOverrideOpen(false);
          setIsVoidModalOpen(true);
        }}
        actionTitle="Shift Lead Confirmation: Void Invoice"
        actionDescription={`Enter 6-digit Shift Lead or Admin PIN to void #${billToVoid?.bill_number}.`}
      />

      <DayCloseReportModal
        isOpen={isDayCloseOpen}
        onClose={() => setIsDayCloseOpen(false)}
      />

      <ExchangeReturnModal
        isOpen={isExchangeOpen}
        onClose={() => {
          setIsExchangeOpen(false);
          setExchangeBillTarget(null);
        }}
        preselectedBill={exchangeBillTarget}
        onComplete={loadBills}
      />

      {showGstReport && (
        <GstCompositionReportModal
          isOpen={isGstModalOpen}
          onClose={() => setIsGstModalOpen(false)}
          config={shopConfig}
        />
      )}
    </div>
  );
};
