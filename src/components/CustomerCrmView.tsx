import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  X,
  Check,
  CreditCard,
  ReceiptText,
  ShoppingBag,
} from 'lucide-react';
import { db } from '../db/db';
import {
  type CustomerProfile,
  type CustomerCreditEntry,
  type Bill,
  type ShopConfig,
} from '../types';
import { formatDateShort, formatMoney, getCurrencySymbol } from '../lib/locale';

interface CustomerCrmViewProps {
  onOpenReceipt: (bill: Bill) => void;
  onBillCustomer?: (customer: CustomerProfile) => void;
}

interface EnrichedCustomer extends CustomerProfile {
  visitCount: number;
  lifetimeSpend: number;
  unpaidTotal: number;
  unpaidBills: Bill[];
  recentBills: Bill[];
}

export const CustomerCrmView: React.FC<CustomerCrmViewProps> = ({
  onOpenReceipt,
  onBillCustomer,
}) => {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'credit' | 'unpaid' | 'repeat'>('all');

  // Add / Edit Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerProfile | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formOpeningCredit, setFormOpeningCredit] = useState('');

  // Customer Detail Drawer / Modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [creditAdjustAmt, setCreditAdjustAmt] = useState('');
  const [creditAdjustType, setCreditAdjustType] = useState<'issue' | 'redeem'>('issue');
  const [creditAdjustNote, setCreditAdjustNote] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(prev => (prev === msg ? null : prev)), 2500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cList, bList, cfgList] = await Promise.all([
        db.customers.toArray(),
        db.bills.reverse().sortBy('created_at'),
        db.shop_config.toArray(),
      ]);
      setCustomers(cList);
      setBills(bList.filter(b => b.status !== 'voided'));
      if (cfgList.length > 0) setShopConfig(cfgList[0]);
    } catch (err) {
      console.error('Failed to load CRM data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const enrichedCustomers = useMemo<EnrichedCustomer[]>(() => {
    return customers
      .map(c => {
        const cleanPhone = c.phone.replace(/\D/g, '');
        const matchingBills = bills.filter(b => {
          const bPhone = (b.customer_phone || '').replace(/\D/g, '');
          if (cleanPhone && bPhone && cleanPhone === bPhone) return true;
          if (!cleanPhone && b.customer_name && c.name) {
            return b.customer_name.trim().toLowerCase() === c.name.trim().toLowerCase();
          }
          return false;
        });

        const lifetimeSpend = matchingBills.reduce((s, b) => s + (b.total || 0), 0);
        const unpaidBills = matchingBills.filter(b => !b.is_paid);
        const unpaidTotal = unpaidBills.reduce((s, b) => s + (b.total || 0), 0);

        return {
          ...c,
          visitCount: matchingBills.length,
          lifetimeSpend,
          unpaidTotal,
          unpaidBills,
          recentBills: matchingBills,
        };
      })
      .sort((a, b) => new Date(b.last_visit_at).getTime() - new Date(a.last_visit_at).getTime());
  }, [customers, bills]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedCustomers.filter(c => {
      if (filterMode === 'credit' && (c.store_credit_balance || 0) <= 0) return false;
      if (filterMode === 'unpaid' && c.unpaidTotal <= 0) return false;
      if (filterMode === 'repeat' && c.visitCount < 2) return false;

      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    });
  }, [enrichedCustomers, filterMode, searchQuery]);

  const summary = useMemo(() => {
    const totalCreditLiability = enrichedCustomers.reduce(
      (s, c) => s + (c.store_credit_balance || 0),
      0
    );
    const totalReceivables = enrichedCustomers.reduce((s, c) => s + c.unpaidTotal, 0);
    const repeatCount = enrichedCustomers.filter(c => c.visitCount >= 2).length;
    return {
      totalCustomers: enrichedCustomers.length,
      totalCreditLiability,
      totalReceivables,
      repeatCount,
    };
  }, [enrichedCustomers]);

  const selectedCustomer = useMemo(
    () => enrichedCustomers.find(c => c.id === selectedCustomerId) || null,
    [enrichedCustomers, selectedCustomerId]
  );

  const openAddModal = (existing?: CustomerProfile) => {
    if (existing) {
      setEditingCustomer(existing);
      setFormName(existing.name);
      setFormPhone(existing.phone);
      setFormEmail(existing.email || '');
      setFormNotes(existing.fit_notes || '');
      setFormOpeningCredit('');
    } else {
      setEditingCustomer(null);
      setFormName('');
      setFormPhone('');
      setFormEmail('');
      setFormNotes('');
      setFormOpeningCredit('');
    }
    setIsAddModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      showToast('Customer name and phone are required');
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      if (editingCustomer) {
        await db.customers.update(editingCustomer.id, {
          name: formName.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim() || undefined,
          fit_notes: formNotes.trim() || undefined,
        });
        showToast('Customer profile updated');
      } else {
        const openingCredit = Math.max(0, parseFloat(formOpeningCredit) || 0);
        const txList: CustomerCreditEntry[] =
          openingCredit > 0
            ? [
                {
                  id: `cred_${Date.now()}`,
                  amount: openingCredit,
                  type: 'issue',
                  note: 'Opening Store Credit',
                  created_at: nowIso,
                },
              ]
            : [];

        await db.customers.add({
          id: `cust_${Date.now()}`,
          name: formName.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim() || undefined,
          fit_notes: formNotes.trim() || undefined,
          store_credit_balance: openingCredit,
          credit_transactions: txList,
          last_visit_at: nowIso,
        });
        showToast('Customer added to directory');
      }
      setIsAddModalOpen(false);
      await loadData();
    } catch {
      showToast('Failed to save customer');
    }
  };

  const handleAdjustStoreCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amt = Math.round((parseFloat(creditAdjustAmt) || 0) * 100) / 100;
    if (amt <= 0) {
      showToast('Enter a valid amount');
      return;
    }

    const currentBal = selectedCustomer.store_credit_balance || 0;
    if (creditAdjustType === 'redeem' && amt > currentBal) {
      showToast('Deduction exceeds available store credit');
      return;
    }

    const nextBal =
      creditAdjustType === 'issue'
        ? Math.round((currentBal + amt) * 100) / 100
        : Math.round((currentBal - amt) * 100) / 100;

    const entry: CustomerCreditEntry = {
      id: `cred_${Date.now()}`,
      amount: amt,
      type: creditAdjustType,
      note: creditAdjustNote.trim() || (creditAdjustType === 'issue' ? 'Manual credit issued' : 'Manual credit adjustment'),
      created_at: new Date().toISOString(),
    };

    const existingTx = selectedCustomer.credit_transactions || [];
    await db.customers.update(selectedCustomer.id, {
      store_credit_balance: nextBal,
      credit_transactions: [entry, ...existingTx],
    });

    setCreditAdjustAmt('');
    setCreditAdjustNote('');
    await loadData();
    showToast(`Store credit updated (${formatMoney(nextBal, shopConfig)})`);
  };

  const handleSettleUnpaidBill = async (bill: Bill) => {
    await db.bills.update(bill.id, {
      is_paid: true,
      paid_at: new Date().toISOString(),
    });
    await loadData();
    showToast(`Invoice ${bill.bill_number} marked as paid`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse" />
        <div className="h-64 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 px-4 py-2 rounded-lg shadow-lg text-xs font-semibold">
          {toastMessage}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-1">
          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Total Customers
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50">
            {summary.totalCustomers}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
            {summary.repeatCount} repeat shoppers
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-1">
          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Active Store Credit
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatMoney(summary.totalCreditLiability, shopConfig)}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Redeemable at Register
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-1">
          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Open Unpaid Tabs
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {formatMoney(summary.totalReceivables, shopConfig)}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Customer receivables
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Directory Action
            </div>
            <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-50 mt-0.5">
              Add Customer Profile
            </div>
          </div>
          <button
            type="button"
            onClick={() => openAddModal()}
            className="h-9 px-3.5 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700 overflow-x-auto">
          {(
            [
              { id: 'all', label: `All (${enrichedCustomers.length})` },
              { id: 'credit', label: 'With Store Credit' },
              { id: 'unpaid', label: 'Unpaid Tabs' },
              { id: 'repeat', label: 'Repeat Buyers' },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                filterMode === tab.id
                  ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search customer name, phone, or email..."
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-950 dark:text-zinc-50"
          />
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Users className="w-8 h-8 text-zinc-400 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {customers.length === 0 ? 'No customers recorded yet' : 'No customers match your filter'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              Customers are saved automatically when phone numbers are entered at checkout, or you can create a profile directly.
            </p>
            <button
              type="button"
              onClick={() => openAddModal()}
              className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
            >
              Add First Customer
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                  <th className="py-2.5 px-5 font-medium">Customer</th>
                  <th className="py-2.5 px-4 font-medium">Last Visit</th>
                  <th className="py-2.5 px-4 font-medium text-right">Visits</th>
                  <th className="py-2.5 px-4 font-medium text-right">Lifetime Spend</th>
                  <th className="py-2.5 px-4 font-medium text-right">Store Credit</th>
                  <th className="py-2.5 px-4 font-medium text-right">Unpaid Tab</th>
                  <th className="py-2.5 px-5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredCustomers.map(cust => (
                  <tr
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-950/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-5">
                      <div className="font-semibold text-zinc-950 dark:text-zinc-50">{cust.name}</div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        {cust.phone}
                        {cust.email ? ` · ${cust.email}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                      {formatDateShort(cust.last_visit_at, shopConfig)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{cust.visitCount}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
                      {formatMoney(cust.lifetimeSpend, shopConfig)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {(cust.store_credit_balance || 0) > 0 ? (
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatMoney(cust.store_credit_balance || 0, shopConfig)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {cust.unpaidTotal > 0 ? (
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {formatMoney(cust.unpaidTotal, shopConfig)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedCustomerId(cust.id);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                {editingCustomer ? 'Edit Customer Profile' : 'New Customer Profile'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Ananya Sharma"
                  className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="ananya@example.in"
                    className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                  />
                </div>
              </div>

              {!editingCustomer && (
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                    Opening Store Credit ({getCurrencySymbol(shopConfig)})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formOpeningCredit}
                    onChange={e => setFormOpeningCredit(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-mono tabular-nums"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                  Fit, Size &amp; Style Notes
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="e.g. Prefers Medium tops, 32x30 tailored hem, Navy/Black tones"
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingCustomer ? 'Save Changes' : 'Create Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[90vh] flex flex-col my-auto space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                  {selectedCustomer.name}
                </h3>
                <p className="text-xs text-zinc-500 font-mono">
                  {selectedCustomer.phone}
                  {selectedCustomer.email ? ` · ${selectedCustomer.email}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAddModal(selectedCustomer)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Edit Info
                </button>
                {onBillCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      onBillCustomer(selectedCustomer);
                      setSelectedCustomerId(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Bill in Register</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId(null)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Metrics Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] text-zinc-500">Lifetime Spend</div>
                  <div className="text-lg font-bold font-mono tabular-nums">
                    {formatMoney(selectedCustomer.lifetimeSpend, shopConfig)}
                  </div>
                  <div className="text-[11px] text-zinc-500">{selectedCustomer.visitCount} orders</div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] text-zinc-500">Store Credit</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatMoney(selectedCustomer.store_credit_balance || 0, shopConfig)}
                  </div>
                  <div className="text-[11px] text-zinc-500">Available balance</div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] text-zinc-500">Unpaid Credit Tab</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                    {formatMoney(selectedCustomer.unpaidTotal, shopConfig)}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {selectedCustomer.unpaidBills.length} open bill(s)
                  </div>
                </div>
              </div>

              {selectedCustomer.fit_notes && (
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Fit &amp; Style Notes: </span>
                  <span className="text-zinc-600 dark:text-zinc-400">{selectedCustomer.fit_notes}</span>
                </div>
              )}

              {/* Adjust Store Credit Form */}
              <form
                onSubmit={handleAdjustStoreCredit}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-950 dark:text-zinc-50">
                    <CreditCard className="w-4 h-4 text-zinc-400" />
                    <span>Manage Store Credit</span>
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCreditAdjustType('issue')}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                        creditAdjustType === 'issue'
                          ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                          : 'text-zinc-500'
                      }`}
                    >
                      + Issue Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreditAdjustType('redeem')}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                        creditAdjustType === 'redeem'
                          ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                          : 'text-zinc-500'
                      }`}
                    >
                      - Deduct
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={creditAdjustAmt}
                    onChange={e => setCreditAdjustAmt(e.target.value)}
                    placeholder={`Amount (${getCurrencySymbol(shopConfig)})`}
                    className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-mono tabular-nums"
                  />
                  <input
                    type="text"
                    value={creditAdjustNote}
                    onChange={e => setCreditAdjustNote(e.target.value)}
                    placeholder="Reason (e.g. Gift credit, exchange)"
                    className="sm:col-span-2 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
                  >
                    {creditAdjustType === 'issue' ? 'Add Store Credit' : 'Deduct Store Credit'}
                  </button>
                </div>
              </form>

              {/* Purchase & Invoice History */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <ReceiptText className="w-3.5 h-3.5" />
                  <span>Invoice History ({selectedCustomer.recentBills.length})</span>
                </h4>
                {selectedCustomer.recentBills.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                    No invoices linked to this customer yet.
                  </p>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden text-xs">
                    {selectedCustomer.recentBills.map(bill => (
                      <div
                        key={bill.id}
                        className="p-3 flex items-center justify-between gap-3 bg-white dark:bg-zinc-950"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-zinc-950 dark:text-zinc-50">
                              {bill.bill_number}
                            </span>
                            <span className="text-[11px] text-zinc-500">
                              · {formatDateShort(bill.created_at, shopConfig)}
                            </span>
                            {!bill.is_paid && (
                              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                · Unpaid
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                            {bill.items
                              .map(i => `${i.product_name} (${i.size_label || 'Std'}) ×${i.qty}`)
                              .join(', ')}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold tabular-nums">
                            {formatMoney(bill.total, shopConfig)}
                          </span>
                          {!bill.is_paid && (
                            <button
                              type="button"
                              onClick={() => handleSettleUnpaidBill(bill)}
                              className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Mark Paid
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenReceipt(bill)}
                            className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold cursor-pointer"
                          >
                            Receipt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Store Credit Activity Log */}
              {(selectedCustomer.credit_transactions || []).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Store Credit Activity
                  </h4>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden text-xs">
                    {(selectedCustomer.credit_transactions || []).map(tx => (
                      <div
                        key={tx.id}
                        className="p-2.5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950"
                      >
                        <div>
                          <span className="font-medium text-zinc-950 dark:text-zinc-50">{tx.note}</span>
                          <span className="text-[11px] text-zinc-500 block font-mono">
                            {formatDateShort(tx.created_at, shopConfig)}
                            {tx.bill_number ? ` · ${tx.bill_number}` : ''}
                          </span>
                        </div>
                        <span
                          className={`font-mono font-bold tabular-nums ${
                            tx.type === 'redeem'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {tx.type === 'redeem' ? '-' : '+'}
                          {formatMoney(tx.amount, shopConfig)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
