import React, { useState, useEffect } from 'react';
import {
  Scissors,
  Printer,
  Share2,
  X,
  Search,
  QrCode,
  Maximize2,
} from 'lucide-react';
import QRCode from 'qrcode';
import { db } from '../db/db';
import {
  type AdvanceOrderJob,
  type AdvanceOrderStatus,
  type School,
  type ShopConfig,
  type PaymentMethod,
} from '../types';
import { bluetoothPrinter } from '../lib/printer';
import { formatMoney, formatDateShort, getCurrencySymbol, getCurrencyCode } from '../lib/locale';

interface AdvanceAlterationModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools: School[];
  initialPhone?: string;
  initialCustomerName?: string;
  onOrderUpdated?: () => void;
}

export const AdvanceAlterationModal: React.FC<AdvanceAlterationModalProps> = ({
  isOpen,
  onClose,
  schools,
  initialPhone = '',
  initialCustomerName = '',
  onOrderUpdated,
}) => {
  const [orders, setOrders] = useState<AdvanceOrderJob[]>([]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdvanceOrderStatus>('all');

  // Create Form State
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerPhone, setCustomerPhone] = useState(initialPhone);
  const [referenceNote, setReferenceNote] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState(schools[0]?.id || '');

  // Job items
  const [productName, setProductName] = useState('');
  const [sizeLabel, setSizeLabel] = useState('');
  const [qty] = useState('1');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [alterationNotes, setAlterationNotes] = useState('');
  const [advancePaid, setAdvancePaid] = useState('0');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<PaymentMethod>('cash');
  const [advanceUpiQr, setAdvanceUpiQr] = useState<string>('');
  const [showStandeeQr, setShowStandeeQr] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setCustomerPhone(initialPhone);
      setCustomerName(initialCustomerName);
    }
  }, [isOpen, initialPhone, initialCustomerName]);

  const loadData = async () => {
    try {
      const [allOrders, configs] = await Promise.all([
        db.advance_orders.reverse().sortBy('created_at'),
        db.shop_config.toArray(),
      ]);
      setOrders(allOrders);
      if (configs.length > 0) setShopConfig(configs[0]);
    } catch (err) {
      console.error('Failed to load alteration orders:', err);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const currentSchool = schools.find((s) => s.id === selectedSchoolId);
  const totalAmount = (parseFloat(estimatedPrice) || 0) * (parseInt(qty, 10) || 1);
  const advanceAmount = parseFloat(advancePaid) || 0;
  const balanceDue = Math.max(0, totalAmount - advanceAmount);
  const currSymbol = getCurrencySymbol(shopConfig);
  const currCode = getCurrencyCode(shopConfig);

  // Generate dynamic UPI QR whenever payment is UPI and store UPI ID is configured
  useEffect(() => {
    if (advanceAmount > 0 && advancePaymentMethod === 'upi' && shopConfig?.upi_id) {
      const upiVpa = shopConfig.upi_id;
      const payeeName = encodeURIComponent(shopConfig.legal_name || 'SikkaDesk Store');
      const upiString = `upi://pay?pa=${upiVpa}&pn=${payeeName}&am=${advanceAmount}&cu=INR&tn=Alteration+Deposit`;

      QRCode.toDataURL(upiString, { width: 260, margin: 1 })
        .then((url) => setAdvanceUpiQr(url))
        .catch((err) => console.error('Failed to generate advance UPI QR:', err));
    } else {
      setAdvanceUpiQr('');
    }
  }, [advanceAmount, advancePaymentMethod, shopConfig]);

  if (!isOpen) return null;

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone.trim() || !productName.trim()) {
      showToast('Please enter customer phone and item description');
      return;
    }

    setIsSubmitting(true);
    try {
      const existingJobsCount = await db.advance_orders.count();
      const year = new Date().getFullYear();
      const tokenNumber = `ALT-${year}-${String(1001 + existingJobsCount).padStart(4, '0')}`;
      const nowIso = new Date().toISOString();

      const newOrder: AdvanceOrderJob = {
        id: `adv_${Date.now()}`,
        token_number: tokenNumber,
        order_type: 'alteration',
        customer_name: customerName.trim() || 'Customer',
        customer_phone: customerPhone.trim(),
        student_name: referenceNote.trim(),
        school_id: selectedSchoolId,
        school_name: currentSchool?.name || '',
        items: [
          {
            id: `item_${Date.now()}`,
            product_name: productName.trim(),
            size_label: sizeLabel.trim() || 'Standard',
            qty: parseInt(qty, 10) || 1,
            estimated_price: parseFloat(estimatedPrice) || 0,
            alteration_notes: alterationNotes.trim(),
          },
        ],
        total_amount: totalAmount,
        advance_paid: advanceAmount,
        balance_due: balanceDue,
        advance_payment_method: advancePaymentMethod,
        status: 'received',
        expected_delivery_date: deliveryDate,
        created_at: nowIso,
      };

      await db.advance_orders.add(newOrder);
      await loadData();
      setActiveTab('list');
      setProductName('');
      setSizeLabel('');
      setEstimatedPrice('');
      setAlterationNotes('');
      setAdvancePaid('0');
      setReferenceNote('');
      showToast(`Ticket #${tokenNumber} created`);
      if (onOrderUpdated) onOrderUpdated();
    } catch (err) {
      console.error('Failed to create alteration order:', err);
      showToast('Error creating ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: AdvanceOrderStatus) => {
    try {
      const updates: Partial<AdvanceOrderJob> = { status: newStatus };
      if (newStatus === 'ready_for_pickup') {
        updates.ready_at = new Date().toISOString();
      } else if (newStatus === 'delivered') {
        updates.delivered_at = new Date().toISOString();
      }

      await db.advance_orders.update(orderId, updates);
      await loadData();
      showToast(`Status updated to ${newStatus.replace(/_/g, ' ')}`);
      if (onOrderUpdated) onOrderUpdated();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleSendWhatsAppReady = (order: AdvanceOrderJob) => {
    const shopName = shopConfig?.legal_name || 'SikkaDesk Store';
    const itemsSummary = order.items.map((i) => `${i.product_name} (${i.size_label})`).join(', ');
    const msg = `*ORDER READY FOR PICKUP*\nHello ${order.customer_name},\nYour tailoring / alteration order *#${order.token_number}* (${order.student_name ? order.student_name + ' - ' : ''}${itemsSummary}) is now *READY FOR PICKUP* at ${shopName}.\n\n• *Balance Due:* ${formatMoney(order.balance_due, shopConfig)}\n• *Address:* ${shopConfig?.shop_address || 'Store Counter'}\n\nPlease show Ticket *#${order.token_number}* at pickup.`;

    const cleanPhone = order.customer_phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handlePrintToken = async (order: AdvanceOrderJob) => {
    const shopName = shopConfig?.legal_name || 'SIKKADESK STORE';
    const dateFormatted = formatDateShort(order.created_at, shopConfig);
    const deliveryFormatted = formatDateShort(order.expected_delivery_date, shopConfig);

    try {
      if (bluetoothPrinter.isConnected()) {
        const text = `\x1B@\x1Ba\x01\x1BE\x01${shopName}\x1BE\x00\nALTERATION & PICKUP TICKET\nTicket: \x1BE\x01#${order.token_number}\x1BE\x00\nDate: ${dateFormatted}\n--------------------------------\n\x1Ba\x00Customer: ${order.customer_name}\nPhone: ${order.customer_phone}\n${order.student_name ? `Ref: ${order.student_name}\n` : ''}${order.school_name ? `Account: ${order.school_name}\n` : ''}--------------------------------\nITEMS & SPECS:\n${order.items.map((i) => `- ${i.product_name} (${i.size_label}) x${i.qty}\n  Note: ${i.alteration_notes || 'Standard'}`).join('\n')}\n--------------------------------\nTotal Estimate: ${currCode} ${order.total_amount.toFixed(2)}\nDeposit Paid: ${currCode} ${order.advance_paid.toFixed(2)} (${order.advance_payment_method.toUpperCase()})\n\x1BE\x01BALANCE DUE: ${currCode} ${order.balance_due.toFixed(2)}\x1BE\x00\nTarget Pickup: ${deliveryFormatted}\n--------------------------------\nPlease bring this ticket for pickup\n\n\n\x1DV\x42\x00`;
        const data = new TextEncoder().encode(text);
        await bluetoothPrinter.printData(data);
        showToast('Ticket printed on Thermal Printer');
      } else {
        window.print();
        showToast('Print dialog opened');
      }
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Failed to print ticket');
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.token_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.includes(q) ||
      (o.student_name && o.student_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-3xl w-full p-6 sm:p-7 shadow-xl border border-[#E5E5E7] dark:border-zinc-800 max-h-[92vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E7] dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-[#1D1D1F] dark:text-zinc-100">
                Tailoring &amp; Alterations Desk
              </h2>
              <p className="text-xs text-[#86868B] dark:text-zinc-400">
                Track custom fitting, hemming jobs, deposits, ticket slips, and pickup notices
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#F5F5F7] dark:bg-zinc-800 p-1 rounded-xl border border-[#E5E5E7] dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'list'
                    ? 'bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                    : 'text-[#86868B] dark:text-zinc-400 hover:text-[#1D1D1F] dark:hover:text-zinc-200'
                }`}
              >
                Jobs ({orders.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'create'
                    ? 'bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                    : 'text-[#86868B] dark:text-zinc-400 hover:text-[#1D1D1F] dark:hover:text-zinc-200'
                }`}
              >
                + New Job
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white p-1.5 rounded-xl hover:bg-[#F5F5F7] dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {toastMessage && (
          <div className="mt-3 p-2.5 bg-[#F5F5F7] dark:bg-zinc-800 text-[#1D1D1F] dark:text-zinc-100 border border-[#E5E5E7] dark:border-zinc-700 rounded-xl text-xs font-bold text-center">
            {toastMessage}
          </div>
        )}

        {activeTab === 'list' ? (
          <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ticket, customer, or phone..."
                  className="w-full h-8 pl-9 pr-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-700 text-xs font-bold bg-[#F5F5F7] dark:bg-zinc-800 text-[#1D1D1F] dark:text-white"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto text-xs">
                {(['all', 'received', 'in_progress', 'ready_for_pickup', 'delivered'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg font-bold capitalize border cursor-pointer ${
                      statusFilter === st
                        ? 'bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                        : 'bg-white dark:bg-zinc-800 text-[#86868B] dark:text-zinc-400 border-[#E5E5E7] dark:border-zinc-700'
                    }`}
                  >
                    {st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-[#E5E5E7] dark:border-zinc-800 hover:border-[#1D1D1F] dark:hover:border-zinc-600 transition-all space-y-2.5 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E5E7] dark:border-zinc-800 pb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-black text-sm text-[#1D1D1F] dark:text-zinc-100 bg-[#F5F5F7] dark:bg-zinc-800 px-2 py-0.5 rounded-lg border border-[#E5E5E7] dark:border-zinc-700">
                        #{order.token_number}
                      </span>
                      <span className="font-extrabold text-xs text-[#1D1D1F] dark:text-zinc-100">
                        {order.customer_name} {order.student_name ? `(${order.student_name})` : ''}
                      </span>
                      <span className="text-[11px] text-[#86868B] dark:text-zinc-400">
                        · {order.customer_phone}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold capitalize ${
                          order.status === 'delivered'
                            ? 'bg-[#F5F5F7] dark:bg-zinc-800 text-[#86868B] dark:text-zinc-400'
                            : order.status === 'ready_for_pickup'
                            ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400'
                            : order.status === 'in_progress'
                            ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-400'
                            : 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400'
                        }`}
                      >
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between bg-[#F5F5F7] dark:bg-zinc-900 p-2 rounded-xl border border-[#E5E5E7]/60 dark:border-zinc-800"
                      >
                        <div>
                          <span className="font-bold text-[#1D1D1F] dark:text-zinc-100">
                            {item.product_name} ({item.size_label})
                          </span>
                          {item.alteration_notes && (
                            <span className="block text-[11px] text-[#515154] dark:text-zinc-400 font-medium mt-0.5">
                              Specs: {item.alteration_notes}
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-[#1D1D1F] dark:text-zinc-100 tabular-nums">
                          {formatMoney(item.estimated_price * item.qty, shopConfig)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[#86868B] dark:text-zinc-400">
                        Deposit: <strong className="text-[#1D1D1F] dark:text-zinc-200">{formatMoney(order.advance_paid, shopConfig)}</strong>
                      </span>
                      <span className="font-extrabold text-[#1D1D1F] dark:text-zinc-100">
                        Balance Due: {formatMoney(order.balance_due, shopConfig)}
                      </span>
                      <span className="text-[11px] text-[#86868B] dark:text-zinc-400">
                        Target: {formatDateShort(order.expected_delivery_date, shopConfig)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {order.status === 'received' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, 'in_progress')}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900 text-xs font-bold hover:bg-blue-100 cursor-pointer"
                        >
                          Mark In Progress
                        </button>
                      )}

                      {order.status === 'in_progress' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, 'ready_for_pickup')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                        >
                          Mark Ready
                        </button>
                      )}

                      {order.status === 'ready_for_pickup' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppReady(order)}
                            className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] dark:bg-zinc-800 text-[#1D1D1F] dark:text-zinc-100 border border-[#E5E5E7] dark:border-zinc-700 text-xs font-bold hover:bg-[#E5E5E7] dark:hover:bg-zinc-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>WhatsApp Ready</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(order.id, 'delivered')}
                            className="px-2.5 py-1 rounded-lg bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-extrabold hover:bg-[#333336] dark:hover:bg-white cursor-pointer"
                          >
                            Mark Delivered
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => handlePrintToken(order)}
                        className="p-1.5 rounded-lg border border-[#E5E5E7] dark:border-zinc-700 hover:bg-[#F5F5F7] dark:hover:bg-zinc-800 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                        title="Print Ticket Slip"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredOrders.length === 0 && (
                <div className="py-12 text-center text-xs text-[#86868B] dark:text-zinc-400">
                  No tailoring or alteration jobs match your filters.
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-[#F5F5F7] dark:bg-zinc-800/60 border border-[#E5E5E7] dark:border-zinc-800">
              <div>
                <label className="text-xs font-bold text-[#1D1D1F] dark:text-zinc-200 block mb-1">
                  Customer Phone *
                </label>
                <input
                  type="text"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-700 text-xs font-bold bg-white dark:bg-zinc-900 text-[#1D1D1F] dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1D1D1F] dark:text-zinc-200 block mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Ananya Sharma"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-700 text-xs font-bold bg-white dark:bg-zinc-900 text-[#1D1D1F] dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1D1D1F] dark:text-zinc-200 block mb-1">
                  Reference / Tag Note (Optional)
                </label>
                <input
                  type="text"
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  placeholder="e.g. Rack #4, Monogram tag"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-700 text-xs font-bold bg-white dark:bg-zinc-900 text-[#1D1D1F] dark:text-white"
                />
              </div>

              {schools.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-[#1D1D1F] dark:text-zinc-200 block mb-1">
                    Account / Organization (Optional)
                  </label>
                  <select
                    value={selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-700 text-xs font-bold bg-white dark:bg-zinc-900 text-[#1D1D1F] dark:text-white"
                  >
                    <option value="">General Walk-in</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        [{s.code}] {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-[#E5E5E7] dark:border-zinc-800 space-y-3 shadow-2xs">
              <span className="text-xs font-extrabold text-[#1D1D1F] dark:text-zinc-100 uppercase tracking-wider block">
                Job &amp; Alteration Specifications
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-[#86868B] dark:text-zinc-400 block mb-1">
                    Item / Garment *
                  </label>
                  <input
                    type="text"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Tailored Wool Trousers / Blazer"
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-700 text-xs font-bold bg-white dark:bg-zinc-900 text-[#1D1D1F] dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#86868B] dark:text-zinc-400 block mb-1">
                    Size / Variant
                  </label>
                  <input
                    type="text"
                    value={sizeLabel}
                    onChange={(e) => setSizeLabel(e.target.value)}
                    placeholder="e.g. M / 32"
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-700 text-xs font-bold bg-white dark:bg-zinc-900 text-[#1D1D1F] dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#86868B] dark:text-zinc-400 block mb-1">
                  Tailoring / Alteration Notes *
                </label>
                <textarea
                  rows={2}
                  required
                  value={alterationNotes}
                  onChange={(e) => setAlterationNotes(e.target.value)}
                  placeholder="e.g. Hem inseam to 30 inches, taper sleeves by 0.5 in"
                  className="w-full p-2.5 rounded-xl border border-[#E5E5E7] dark:border-zinc-700 text-xs font-semibold bg-white dark:bg-zinc-900 text-[#1D1D1F] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#86868B] dark:text-zinc-400 block mb-1">
                    Total Estimate ({currSymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={estimatedPrice}
                    onChange={(e) => setEstimatedPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-700 text-xs font-bold bg-white dark:bg-zinc-900 text-[#1D1D1F] dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#86868B] dark:text-zinc-400 block mb-1">
                    Deposit Received ({currSymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={advancePaid}
                    onChange={(e) => setAdvancePaid(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-700 text-xs font-bold bg-white dark:bg-zinc-900 text-[#1D1D1F] dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#86868B] dark:text-zinc-400 block mb-1">
                    Target Pickup Date
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-700 text-xs font-bold bg-white dark:bg-zinc-900 text-[#1D1D1F] dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-[#86868B] dark:text-zinc-400">
                  Deposit Payment Mode:
                </span>
                <div className="flex items-center gap-1.5">
                  {(['cash', 'card', ...(shopConfig?.upi_id ? ['upi'] : [])] as PaymentMethod[]).map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setAdvancePaymentMethod(pm)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold uppercase border transition-all cursor-pointer ${
                        advancePaymentMethod === pm
                          ? 'bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent shadow-2xs'
                          : 'bg-[#F5F5F7] dark:bg-zinc-800 text-[#1D1D1F] dark:text-zinc-300 border-[#E5E5E7] dark:border-zinc-700'
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>

              {advancePaymentMethod === 'upi' && advanceAmount > 0 && advanceUpiQr && (
                <div className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-zinc-900 border border-[#E5E5E7] dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-white border border-[#E5E5E7] rounded-xl">
                      <img src={advanceUpiQr} alt="Advance UPI QR" className="w-20 h-20 object-contain" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[#1D1D1F] dark:text-zinc-100 font-extrabold text-xs">
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Dynamic Deposit QR</span>
                      </div>
                      <div className="text-sm font-black text-[#1D1D1F] dark:text-zinc-100">
                        Amount: {formatMoney(advanceAmount, shopConfig)}
                      </div>
                      <div className="text-[10px] font-mono text-[#86868B] dark:text-zinc-400">
                        UPI: {shopConfig?.upi_id}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowStandeeQr(true)}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-[#F5F5F7] text-[#1D1D1F] dark:text-zinc-100 text-xs font-bold border border-[#E5E5E7] dark:border-zinc-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Fullscreen QR</span>
                  </button>
                </div>
              )}

              <div className="p-3 rounded-xl bg-[#F5F5F7] dark:bg-zinc-900 border border-[#E5E5E7] dark:border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-[#86868B] dark:text-zinc-400">Balance Due on Pickup:</span>
                <span className="text-sm font-extrabold text-[#1D1D1F] dark:text-zinc-100 tabular-nums">
                  {formatMoney(balanceDue, shopConfig)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 rounded-xl border border-[#E5E5E7] dark:border-zinc-700 text-xs font-bold text-[#86868B] dark:text-zinc-400 hover:bg-[#F5F5F7] dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-extrabold hover:bg-[#333336] dark:hover:bg-white shadow-xs cursor-pointer"
              >
                {isSubmitting ? 'Creating Job...' : 'Save Job Ticket'}
              </button>
            </div>
          </form>
        )}
      </div>

      {showStandeeQr && advanceUpiQr && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl space-y-4 border border-[#E5E5E7] dark:border-zinc-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-[#1D1D1F] dark:text-zinc-100 tracking-wider">
                {shopConfig?.legal_name || 'SikkaDesk Store'}
              </span>
              <button
                type="button"
                onClick={() => setShowStandeeQr(false)}
                className="text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="font-extrabold text-base text-[#1D1D1F] dark:text-zinc-100">
              Scan &amp; Pay Deposit
            </h3>

            <div className="p-3 bg-white border-2 border-dashed border-[#E5E5E7] rounded-2xl flex justify-center">
              <img src={advanceUpiQr} alt="UPI QR Standee" className="w-56 h-56 object-contain" />
            </div>

            <div className="p-3 rounded-2xl bg-[#F5F5F7] dark:bg-zinc-800 border border-[#E5E5E7] dark:border-zinc-700">
              <div className="text-xs text-[#86868B] dark:text-zinc-400">Deposit Amount</div>
              <div className="text-3xl font-mono font-black text-[#1D1D1F] dark:text-zinc-100">
                {formatMoney(advanceAmount, shopConfig)}
              </div>
              <div className="text-[11px] font-mono text-[#86868B] dark:text-zinc-400 mt-1">
                UPI: {shopConfig?.upi_id}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowStandeeQr(false)}
              className="w-full py-2.5 rounded-xl bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 font-extrabold text-xs hover:bg-[#333336] dark:hover:bg-white cursor-pointer"
            >
              Done / Return to Counter
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
