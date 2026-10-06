import React, { useState, useEffect, useMemo } from 'react';
import { 
  ReceiptText, 
  Search, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  Download, 
  Phone, 
  Calendar, 
  RotateCcw, 
  AlertCircle,
  ShieldAlert,
  UserCheck,
  X,
  FileSpreadsheet,
  ArrowRightLeft
} from 'lucide-react';
import { db } from '../db/db';
import { type Bill, type ProductStock, type ShopConfig } from '../types';
import { useAuth } from '../context/AuthContext';
import { ManagerOverrideModal } from './ManagerOverrideModal';
import { DayCloseReportModal } from './DayCloseReportModal';
import { ExchangeReturnModal } from './ExchangeReturnModal';
import { GstCompositionReportModal } from './GstCompositionReportModal';

interface BillsHistoryProps {
  onOpenReceipt: (bill: Bill) => void;
}

export const BillsHistory: React.FC<BillsHistoryProps> = ({ onOpenReceipt }) => {
  const { currentUser, canVoidBills } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unpaid' | 'voided'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // In-App Void Confirmation Modal & Manager Override
  const [billToVoid, setBillToVoid] = useState<Bill | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [isManagerOverrideOpen, setIsManagerOverrideOpen] = useState(false);

  // Day Close & Exchange modals
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
      if (configs.length > 0) {
        setShopConfig(configs[0]);
      }
    } catch (err) {
      console.error('Failed to load bills:', err);
    }
  };

  useEffect(() => {
    loadBills();
  }, []);

  // Filtered bills
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      if (selectedFilter === 'unpaid' && b.is_paid) return false;
      if (selectedFilter === 'voided' && b.status !== 'voided') return false;
      if (selectedFilter === 'all' && b.status === 'voided') return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          b.bill_number.toLowerCase().includes(q) ||
          (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
          (b.customer_phone && b.customer_phone.includes(q)) ||
          b.school_name.toLowerCase().includes(q) ||
          (b.billed_by_name && b.billed_by_name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [bills, selectedFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const active = bills.filter(b => b.status !== 'voided');
    const totalRev = active.reduce((acc, b) => acc + (b.total || 0), 0);
    const unpaidCredit = active
      .filter(b => !b.is_paid)
      .reduce((acc, b) => acc + (b.total || 0), 0);
    const totalBills = active.length;

    return { totalRev, unpaidCredit, totalBills };
  }, [bills]);

  // Settle Credit Bill (Mark Paid)
  const handleSettleCredit = async (bill: Bill) => {
    try {
      const nowIso = new Date().toISOString();
      await db.bills.update(bill.id, {
        is_paid: true,
        paid_at: nowIso,
      });
      await loadBills();
      showToast(`Bill ${bill.bill_number} marked as Paid!`);
    } catch (err) {
      console.error('Error settling bill:', err);
      showToast('Error updating payment status');
    }
  };

  // Initiate Void Flow
  const handleInitiateVoid = (bill: Bill) => {
    setBillToVoid(bill);
    if (!canVoidBills()) {
      // Cashier role: prompt manager authorization PIN first
      setIsManagerOverrideOpen(true);
    } else {
      setIsVoidModalOpen(true);
    }
  };

  // Execute Void Bill with stock restoration (No window.confirm)
  const executeVoidBill = async () => {
    if (!billToVoid) return;

    try {
      const nowIso = new Date().toISOString();
      await db.bills.update(billToVoid.id, {
        status: 'voided',
        voided_at: nowIso,
        void_reason: `Voided at counter by ${currentUser?.name || 'Staff'}`,
      });

      // Restore stock for all items
      for (const item of billToVoid.items) {
        const stockKey = `${item.product_id}_${item.size_id || 'free'}`;
        const existingStock = await db.stocks.get(stockKey);
        const currentQty = existingStock ? existingStock.quantity : 0;
        const newQty = currentQty + item.qty;

        if (existingStock) {
          await db.stocks.update(existingStock.id, { quantity: newQty });
        }

        await db.inventory_movements.add({
          id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          product_id: item.product_id,
          product_name: item.product_name,
          size_label: item.size_label || 'Free',
          type: 'return',
          qty: item.qty,
          previous_stock: currentQty,
          new_stock: newQty,
          notes: `Stock restored from Voided Bill ${billToVoid.bill_number}`,
          created_at: nowIso,
          reference_bill_id: billToVoid.id,
        });
      }

      await loadBills();
      setIsVoidModalOpen(false);
      setBillToVoid(null);
      showToast(`Bill ${billToVoid.bill_number} voided & stock restored`);
    } catch (err) {
      console.error('Error voiding bill:', err);
      showToast('Error voiding bill');
    }
  };

  // Export Sales to CSV
  const handleExportCSV = () => {
    if (bills.length === 0) {
      showToast('No bills to export');
      return;
    }

    const headers = ['Bill Number', 'Date', 'School', 'Customer', 'Phone', 'Total (INR)', 'Payment Mode', 'Billed By', 'Status'];
    const rows = bills.map(b => [
      b.bill_number,
      new Date(b.created_at).toLocaleString('en-IN'),
      `"${b.school_name || ''}"`,
      `"${b.customer_name || ''}"`,
      b.customer_phone || '',
      b.total,
      b.payment_method,
      `"${b.billed_by_name || ''}"`,
      b.status === 'voided' ? 'VOIDED' : b.is_paid ? 'PAID' : 'PENDING',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Nandalaya_Bills_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Sales CSV exported!');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1D1D1F] text-white px-5 py-2 rounded-xl shadow-lg border border-[#333336] font-semibold text-xs animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Top Header & Metrics Card */}
      <div className="bg-white rounded-2xl border border-[#E5E5E7] p-5 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E5E7]">
          <div>
            <div className="flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-[#1D1D1F]" />
              <h1 className="font-bold text-xl text-[#1D1D1F]">Sales &amp; Invoices Register</h1>
            </div>
            <p className="text-xs text-[#86868B] mt-0.5">
              Review transaction history, reprint thermal slips, WhatsApp receipts, and settle credit bills
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* DAY-CLOSE Z-REPORT BUTTON */}
            <button
              onClick={() => setIsDayCloseOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1D1D1F] text-white rounded-xl text-xs font-semibold hover:bg-black transition-all shadow-xs cursor-pointer"
              title="Generate Day-Close Z-Report & Cash Drawer Tally"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Day-Close (Z-Report)</span>
            </button>

            {/* GST RETURN / SALES SUMMARY HELPER */}
            <button
              onClick={() => setIsGstModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-semibold hover:bg-[#E5E5E7] transition-all shadow-2xs cursor-pointer"
              title={
                shopConfig?.gst_scheme === 'regular'
                  ? 'GSTR-1 & GSTR-3B Sales & Tax Return Helper'
                  : shopConfig?.gst_scheme === 'none'
                  ? 'Periodic Sales & Turnover Summary'
                  : 'GST CMP-08 Quarterly Composition Statement'
              }
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#1D1D1F]" />
              <span>
                {shopConfig?.gst_scheme === 'regular'
                  ? 'GST (GSTR)'
                  : shopConfig?.gst_scheme === 'none'
                  ? 'Sales Summary'
                  : 'GST (CMP-08)'}
              </span>
            </button>

            {/* SIZE EXCHANGE DESK */}
            <button
              onClick={() => {
                setExchangeBillTarget(null);
                setIsExchangeOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-semibold hover:bg-[#E5E5E7] transition-all shadow-2xs cursor-pointer"
              title="Process garment size exchange & stock swap"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-[#1D1D1F]" />
              <span>Size Exchange</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-semibold hover:bg-[#E5E5E7] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#86868B]" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Sales Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
            <div className="text-[10px] uppercase font-semibold text-[#86868B]">Total Completed Revenue</div>
            <div className="text-xl font-bold text-[#1D1D1F] mt-0.5">
              ₹{metrics.totalRev.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
            <div className="text-[10px] uppercase font-semibold text-[#86868B]">Total Invoices Generated</div>
            <div className="text-xl font-bold text-[#1D1D1F] mt-0.5">
              {metrics.totalBills} Bills
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
            <div className="text-[10px] uppercase font-semibold text-amber-900">Pending Credit (Udhar)</div>
            <div className="text-xl font-bold text-amber-800 mt-0.5">
              ₹{metrics.unpaidCredit.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-[#E5E5E7]">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border cursor-pointer ${
                selectedFilter === 'all'
                  ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                  : 'bg-[#F5F5F7] text-[#86868B] border-[#E5E5E7] hover:text-[#1D1D1F]'
              }`}
            >
              Completed ({bills.filter(b => b.status !== 'voided').length})
            </button>

            <button
              onClick={() => setSelectedFilter('unpaid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border cursor-pointer ${
                selectedFilter === 'unpaid'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-[#F5F5F7] text-amber-800 border-[#E5E5E7] hover:bg-amber-50'
              }`}
            >
              Pending Credit ({bills.filter(b => !b.is_paid && b.status !== 'voided').length})
            </button>

            <button
              onClick={() => setSelectedFilter('voided')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border cursor-pointer ${
                selectedFilter === 'voided'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-[#F5F5F7] text-red-800 border-[#E5E5E7] hover:bg-red-50'
              }`}
            >
              Voided ({bills.filter(b => b.status === 'voided').length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search bill no, customer, cashier..."
              className="w-full h-8 pl-8 pr-3 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
            />
          </div>
        </div>
      </div>

      {/* BILLS TABLE */}
      <div className="bg-white rounded-2xl border border-[#E5E5E7] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F5F7] text-[#1D1D1F] font-bold uppercase border-b border-[#E5E5E7]">
              <tr>
                <th className="py-3 px-4">Bill No</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">School</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Payment &amp; Staff</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E7]">
              {filteredBills.map(bill => {
                const dateStr = new Date(bill.created_at).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const isVoided = bill.status === 'voided';

                return (
                  <tr key={bill.id} className={`hover:bg-[#F5F5F7]/60 transition-colors ${isVoided ? 'opacity-50 bg-[#F5F5F7]' : ''}`}>
                    <td className="py-3 px-4 font-bold text-[#1D1D1F]">
                      {bill.bill_number}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#86868B]">
                      {dateStr}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#1D1D1F]">
                      {bill.schools && bill.schools.length > 1 ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-block text-[10px] font-bold bg-[#F5F5F7] text-[#1D1D1F] px-1.5 py-0.5 rounded border border-[#E5E5E7] w-fit">
                            Multi-School ({bill.schools.length})
                          </span>
                          <span className="text-xs truncate max-w-[200px]" title={bill.school_name}>
                            {bill.school_name}
                          </span>
                        </div>
                      ) : (
                        <span>{bill.school_name}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#1D1D1F]">
                      {bill.customer_name || bill.customer_phone ? (
                        <div>
                          <span>{bill.customer_name || 'Customer'}</span>
                          {bill.customer_phone && (
                            <span className="block text-[11px] font-normal text-[#86868B]">
                              {bill.customer_phone}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#86868B]">Walk-in</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#86868B]">
                      {bill.items.length} items
                    </td>
                    <td className="py-3 px-4 font-bold text-sm text-[#1D1D1F]">
                      ₹{bill.total.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        {isVoided ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                            VOIDED
                          </span>
                        ) : !bill.is_paid ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Credit Pending
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F5F5F7] border border-[#E5E5E7] text-[#1D1D1F] capitalize">
                            {bill.payment_method} · Paid
                          </span>
                        )}
                        {bill.billed_by_name && (
                          <div className="text-[10px] text-[#86868B] font-medium mt-0.5">
                            Billed by: {bill.billed_by_name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View/Print Receipt */}
                        <button
                          onClick={() => onOpenReceipt(bill)}
                          className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#E5E5E7] text-[#1D1D1F] font-semibold text-xs border border-[#E5E5E7] transition-colors cursor-pointer"
                          title="Print / View Receipt"
                        >
                          Receipt
                        </button>

                        {/* Size Exchange button */}
                        {!isVoided && (
                          <button
                            onClick={() => {
                              setExchangeBillTarget(bill);
                              setIsExchangeOpen(true);
                            }}
                            className="px-2 py-1 rounded-lg bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] font-semibold text-xs border border-[#E5E5E7] transition-colors cursor-pointer"
                            title="Exchange Size for this Bill"
                          >
                            Exchange
                          </button>
                        )}

                        {/* Settle button if unpaid */}
                        {!bill.is_paid && !isVoided && (
                          <button
                            onClick={() => handleSettleCredit(bill)}
                            className="px-2 py-1 rounded-lg bg-[#1D1D1F] hover:bg-black text-white font-semibold text-xs transition-colors cursor-pointer"
                            title="Mark Paid"
                          >
                            Mark Paid
                          </button>
                        )}

                        {/* Void button with power distribution check */}
                        {!isVoided && (
                          <button
                            onClick={() => handleInitiateVoid(bill)}
                            className="p-1 text-[#86868B] hover:text-red-600 transition-colors cursor-pointer"
                            title="Void Bill (Manager PIN required for Cashiers)"
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
                  <td colSpan={8} className="py-8 text-center text-xs text-[#86868B]">
                    No bills found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* In-App Void Confirmation Modal (No window.confirm) */}
      {isVoidModalOpen && billToVoid && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-200 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                <XCircle className="w-6 h-6" />
              </div>
              <button
                onClick={() => {
                  setIsVoidModalOpen(false);
                  setBillToVoid(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="font-extrabold text-lg text-[#1D1D1F]">
                Void Bill #{billToVoid.bill_number}?
              </h3>
              <p className="text-xs text-[#86868B] mt-1.5">
                Total Amount: <strong className="text-[#1D1D1F]">₹{billToVoid.total}</strong> ({billToVoid.items.length} items).
                Voiding will automatically restore all {billToVoid.items.length} items back to stock.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsVoidModalOpen(false);
                  setBillToVoid(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-[#E5E5E7] text-xs font-bold text-[#86868B] hover:bg-[#F5F5F7] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeVoidBill}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold shadow-sm flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Yes, Void Bill</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Override Authorization Modal for Cashier Void Requests */}
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
        actionTitle="Shift Lead Confirmation: Void Bill"
        actionDescription={`Enter 6-digit Shift Lead or Store Admin PIN to confirm voiding Bill #${billToVoid?.bill_number}.`}
      />

      {/* Day-Close Z-Report & Cash Drawer Tally Modal */}
      <DayCloseReportModal
        isOpen={isDayCloseOpen}
        onClose={() => setIsDayCloseOpen(false)}
      />

      {/* Garment Size Exchange Desk Modal */}
      <ExchangeReturnModal
        isOpen={isExchangeOpen}
        onClose={() => {
          setIsExchangeOpen(false);
          setExchangeBillTarget(null);
        }}
        preselectedBill={exchangeBillTarget}
        onComplete={async () => {
          await loadBills();
        }}
      />

      {/* GST CMP-08 Quarterly Composition Statement Modal */}
      <GstCompositionReportModal
        isOpen={isGstModalOpen}
        onClose={() => setIsGstModalOpen(false)}
        config={shopConfig}
      />
    </div>
  );
};
