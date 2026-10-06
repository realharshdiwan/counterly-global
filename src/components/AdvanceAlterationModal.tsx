import React, { useState, useEffect, useMemo } from 'react';
import { 
  Scissors, 
  Printer, 
  Share2, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Calendar, 
  Phone, 
  User, 
  Clock, 
  Plus, 
  Search,
  School as SchoolIcon,
  PackageCheck,
  RotateCcw,
  QrCode,
  Maximize2
} from 'lucide-react';
import QRCode from 'qrcode';
import { db } from '../db/db';
import { 
  type AdvanceOrderJob, 
  type AdvanceOrderStatus, 
  type AdvanceOrderItem, 
  type School, 
  type ShopConfig, 
  type PaymentMethod 
} from '../types';
import { bluetoothPrinter } from '../lib/printer';
import { useAuth } from '../context/AuthContext';

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
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<AdvanceOrderJob[]>([]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdvanceOrderStatus>('all');

  // Create Form State
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerPhone, setCustomerPhone] = useState(initialPhone);
  const [studentName, setStudentName] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState(schools[0]?.id || '');
  const [orderType, setOrderType] = useState<'alteration' | 'advance_booking' | 'custom_tailoring'>('alteration');
  
  // Job items
  const [productName, setProductName] = useState('School Pant / Trousers');
  const [sizeLabel, setSizeLabel] = useState('28');
  const [qty, setQty] = useState('1');
  const [estimatedPrice, setEstimatedPrice] = useState('340');
  const [alterationNotes, setAlterationNotes] = useState('Hem length shorten by 2 inches');
  const [advancePaid, setAdvancePaid] = useState('100');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<PaymentMethod>('cash');
  const [advanceUpiQr, setAdvanceUpiQr] = useState<string>('');
  const [showStandeeQr, setShowStandeeQr] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2); // default 2 days later
    return d.toISOString().slice(0, 10);
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [allOrders, configs] = await Promise.all([
        db.advance_orders.reverse().sortBy('created_at'),
        db.shop_config.toArray(),
      ]);
      setOrders(allOrders);
      if (configs.length > 0) setShopConfig(configs[0]);
    } catch (err) {
      console.error('Failed to load advance orders:', err);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const currentSchool = schools.find(s => s.id === selectedSchoolId);
  const totalAmount = (parseFloat(estimatedPrice) || 0) * (parseInt(qty, 10) || 1);
  const advanceAmount = parseFloat(advancePaid) || 0;
  const balanceDue = Math.max(0, totalAmount - advanceAmount);

  // Generate dynamic UPI QR whenever payment is UPI and advance > 0
  useEffect(() => {
    if (advanceAmount > 0 && advancePaymentMethod === 'upi') {
      const upiVpa = shopConfig?.upi_id || '9876543210@upi';
      const payeeName = encodeURIComponent(shopConfig?.legal_name || 'SARASWATI GARMENTS');
      const upiString = `upi://pay?pa=${upiVpa}&pn=${payeeName}&am=${advanceAmount}&cu=INR&tn=Advance+Order+Deposit`;
      
      QRCode.toDataURL(upiString, { width: 260, margin: 1 })
        .then(url => setAdvanceUpiQr(url))
        .catch(err => console.error('Failed to generate advance UPI QR:', err));
    } else {
      setAdvanceUpiQr('');
    }
  }, [advanceAmount, advancePaymentMethod, shopConfig]);

  if (!isOpen) return null;

  // Handle Save New Job
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone || !productName) {
      showToast('Please fill required phone and garment details');
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate true sequential token number (e.g. ALT-2026-1001)
      const existingJobsCount = await db.advance_orders.count();
      const tokenNumber = `ALT-2026-${String(1001 + existingJobsCount).padStart(4, '0')}`;
      const nowIso = new Date().toISOString();

      const newOrder: AdvanceOrderJob = {
        id: `adv_${Date.now()}`,
        token_number: tokenNumber,
        order_type: orderType,
        customer_name: customerName || 'Customer',
        customer_phone: customerPhone,
        student_name: studentName,
        school_id: selectedSchoolId,
        school_name: currentSchool?.name || '',
        items: [
          {
            id: `item_${Date.now()}`,
            product_name: productName,
            size_label: sizeLabel,
            qty: parseInt(qty, 10) || 1,
            estimated_price: parseFloat(estimatedPrice) || 0,
            alteration_notes: alterationNotes,
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
      showToast(`Order #${tokenNumber} created successfully!`);
      if (onOrderUpdated) onOrderUpdated();
    } catch (err) {
      console.error('Failed to create advance order:', err);
      showToast('Error creating order');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Status
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

  // WhatsApp Pickup Reminder to Parent
  const handleSendWhatsAppReady = (order: AdvanceOrderJob) => {
    const shopName = shopConfig?.legal_name || 'Saraswati Garments';
    const msg = `*UNIFORM READY FOR PICKUP*\nDear ${order.customer_name},\nYour uniform tailoring / order *#${order.token_number}* (${order.student_name ? order.student_name + ' - ' : ''}${order.items.map(i => i.product_name + ' ' + i.size_label).join(', ')}) is now *READY FOR PICKUP* at ${shopName}!\n\n• *Balance Due: Rs.${order.balance_due}*\n• *Location:* Main Market\n• *Store Hours:* 10:00 AM - 9:00 PM\n\nPlease show Token *#${order.token_number}* at the billing counter.`;
    
    const cleanPhone = order.customer_phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Thermal Print Token Slip
  const handlePrintToken = async (order: AdvanceOrderJob) => {
    const shopName = shopConfig?.legal_name || 'SARASWATI GARMENTS';
    const dateFormatted = new Date(order.created_at).toLocaleDateString('en-IN');
    const deliveryFormatted = new Date(order.expected_delivery_date).toLocaleDateString('en-IN');

    try {
      if (bluetoothPrinter.isConnected()) {
        const text = `\x1B@\x1Ba\x01\x1BE\x01${shopName}\x1BE\x00\nALTERATION & PICKUP TOKEN\nToken: \x1BE\x01#${order.token_number}\x1BE\x00\nDate: ${dateFormatted}\n--------------------------------\n\x1Ba\x00Customer: ${order.customer_name}\nPhone: ${order.customer_phone}\nStudent: ${order.student_name || 'N/A'}\nSchool: ${order.school_name || 'N/A'}\n--------------------------------\nITEMS & ALTERATION SPECS:\n${order.items.map(i => `- ${i.product_name} (${i.size_label}) x${i.qty}\n  Note: ${i.alteration_notes || 'Standard'}`).join('\n')}\n--------------------------------\nTotal Amount: Rs.${order.total_amount}\nAdvance Received: Rs.${order.advance_paid} (${order.advance_payment_method.toUpperCase()})\n\x1BE\x01BALANCE DUE: Rs.${order.balance_due}\x1BE\x00\nReady Date: ${deliveryFormatted}\n--------------------------------\nPlease bring this token for pickup\n\n\n\x1DV\x42\x00`;
        const data = new TextEncoder().encode(text);
        await bluetoothPrinter.printData(data);
        showToast('Token printed on Thermal Printer!');
      } else {
        window.print();
        showToast('Print dialog opened');
      }
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Failed to print token');
    }
  };

  const filteredOrders = orders.filter(o => {
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-7 shadow-xl border border-[#E5E5E7] animate-in fade-in-50 max-h-[92vh] flex flex-col my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E7]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-[#1D1D1F]">Advance Orders &amp; Alteration Desk</h2>
              <p className="text-xs text-[#86868B]">
                Track tailoring, pant hemming, advance bookings, token slips, and pickup reminders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#F5F5F7] p-1 rounded-xl border border-[#E5E5E7]">
              <button
                onClick={() => setActiveTab('list')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'list'
                    ? 'bg-[#1D1D1F] text-white shadow-xs'
                    : 'text-[#1D1D1F] hover:text-[#1D1D1F]'
                }`}
              >
                Jobs ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'create'
                    ? 'bg-[#1D1D1F] text-white shadow-xs'
                    : 'text-[#1D1D1F] hover:text-[#1D1D1F]'
                }`}
              >
                + New Job
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-[#86868B] hover:text-[#1D1D1F] p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {toastMessage && (
          <div className="mt-3 p-2.5 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-bold text-center">
            {toastMessage}
          </div>
        )}

        {/* TAB 1: LIST / TRACKER */}
        {activeTab === 'list' ? (
          <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
            {/* Filter controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search Token (ALT-1042) or Phone..."
                  className="w-full h-8 pl-9 pr-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-[#F5F5F7] text-[#1D1D1F]"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto text-xs">
                {(['all', 'received', 'in_progress', 'ready_for_pickup', 'delivered'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg font-bold capitalize border cursor-pointer ${
                      statusFilter === st
                        ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                        : 'bg-white text-[#86868B] border-[#E5E5E7]'
                    }`}
                  >
                    {st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders Cards List */}
            <div className="space-y-2.5">
              {filteredOrders.map(order => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-white border border-[#E5E5E7] hover:border-[#1D1D1F] transition-all space-y-2.5 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E5E7] pb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-black text-sm text-[#1D1D1F] bg-[#F5F5F7] px-2 py-0.5 rounded-lg border border-[#E5E5E7]">
                        #{order.token_number}
                      </span>
                      <span className="font-extrabold text-xs text-[#1D1D1F]">
                        {order.customer_name} {order.student_name ? `(${order.student_name})` : ''}
                      </span>
                      <span className="text-[11px] text-[#86868B]">
                        · {order.customer_phone}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold capitalize ${
                        order.status === 'delivered'
                          ? 'bg-[#F5F5F7] text-[#86868B]'
                          : order.status === 'ready_for_pickup'
                          ? 'bg-emerald-100 text-emerald-800'
                          : order.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Items and alteration specs */}
                  <div className="text-xs space-y-1">
                    {order.items.map(item => (
                      <div key={item.id} className="flex justify-between bg-[#F5F5F7] p-2 rounded-xl">
                        <div>
                          <span className="font-bold text-[#1D1D1F]">{item.product_name} ({item.size_label})</span>
                          {item.alteration_notes && (
                            <span className="block text-[11px] text-[#1D1D1F] font-medium mt-0.5">
                              Alteration: {item.alteration_notes}
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-[#1D1D1F]">₹{item.estimated_price * item.qty}</span>
                      </div>
                    ))}
                  </div>

                  {/* Financial Balance and Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-[#86868B]">
                        Advance: <strong>₹{order.advance_paid}</strong>
                      </span>
                      <span className="font-extrabold text-[#1D1D1F]">
                        Balance Due: ₹{order.balance_due}
                      </span>
                      <span className="text-[11px] text-[#86868B]">
                        Target: {new Date(order.expected_delivery_date).toLocaleDateString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {order.status === 'received' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'in_progress')}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold hover:bg-blue-100 cursor-pointer"
                        >
                          Mark In Progress
                        </button>
                      )}

                      {order.status === 'in_progress' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'ready_for_pickup')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                        >
                          Mark Ready
                        </button>
                      )}

                      {order.status === 'ready_for_pickup' && (
                        <>
                          <button
                            onClick={() => handleSendWhatsAppReady(order)}
                            className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] text-xs font-bold hover:bg-[#E5E5E7] flex items-center gap-1 cursor-pointer"
                            title="Send Ready for Pickup WhatsApp reminder"
                          >
                            <Share2 className="w-3.5 h-3.5 text-[#1D1D1F]" />
                            <span>WhatsApp Ready</span>
                          </button>

                          <button
                            onClick={() => handleUpdateStatus(order.id, 'delivered')}
                            className="px-2.5 py-1 rounded-lg bg-[#1D1D1F] text-white text-xs font-extrabold hover:bg-[#333336] cursor-pointer"
                          >
                            Mark Delivered
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handlePrintToken(order)}
                        className="p-1.5 rounded-lg border border-[#E5E5E7] hover:bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                        title="Print Token Slip"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredOrders.length === 0 && (
                <div className="py-12 text-center text-xs text-[#86868B]">
                  No alteration or advance jobs match your filters.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TAB 2: CREATE NEW ADVANCE / ALTERATION ORDER */
          <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-[#F5F5F7] border border-[#E5E5E7]">
              <div>
                <label className="text-xs font-bold text-[#1D1D1F] block mb-1">Parent Phone Number *</label>
                <input
                  type="text"
                  required
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="+91 98765..."
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1D1D1F] block mb-1">Parent / Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="e.g. Ramesh Sharma"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1D1D1F] block mb-1">Student Name (Optional)</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder="e.g. Aryan Sharma"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1D1D1F] block mb-1">Target School</label>
                <select
                  value={selectedSchoolId}
                  onChange={e => setSelectedSchoolId(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F]"
                >
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Garment details */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5E5E7] space-y-3 shadow-2xs">
              <span className="text-xs font-extrabold text-[#1D1D1F] uppercase tracking-wider block">
                Job &amp; Alteration Specifications:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-[#86868B] block mb-1">Garment Item</label>
                  <input
                    type="text"
                    required
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    placeholder="e.g. School Pant / Winter Blazer"
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#86868B] block mb-1">Size</label>
                  <input
                    type="text"
                    value={sizeLabel}
                    onChange={e => setSizeLabel(e.target.value)}
                    placeholder="e.g. 28 / 30"
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#86868B] block mb-1">
                  Specific Alteration Instructions *
                </label>
                <textarea
                  rows={2}
                  required
                  value={alterationNotes}
                  onChange={e => setAlterationNotes(e.target.value)}
                  placeholder="e.g. Hem length shorten by 2 inches, fix waist elastic, name embroidery 'Aarav'"
                  className="w-full p-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold bg-white text-[#1D1D1F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#86868B] block mb-1">Total Estimated (₹)</label>
                  <input
                    type="number"
                    value={estimatedPrice}
                    onChange={e => setEstimatedPrice(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#86868B] block mb-1">Advance Received (₹)</label>
                  <input
                    type="number"
                    value={advancePaid}
                    onChange={e => setAdvancePaid(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#86868B] block mb-1">Target Delivery Date</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={e => setDeliveryDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F]"
                  />
                </div>
              </div>

              {/* Advance Payment Mode Selector */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-[#86868B]">Advance Payment Mode:</span>
                <div className="flex items-center gap-1.5">
                  {(['cash', 'upi', 'card'] as PaymentMethod[]).map(pm => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setAdvancePaymentMethod(pm)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold capitalize border transition-all cursor-pointer ${
                        advancePaymentMethod === pm
                          ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-2xs'
                          : 'bg-[#F5F5F7] text-[#1D1D1F] border-[#E5E5E7]'
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Dynamic UPI QR for Advance */}
              {advancePaymentMethod === 'upi' && advanceAmount > 0 && advanceUpiQr && (
                <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-[#E5E5E7] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-white border border-[#E5E5E7] rounded-xl shadow-xs">
                      <img src={advanceUpiQr} alt="Advance UPI QR" className="w-20 h-20 object-contain" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[#1D1D1F] font-extrabold text-xs">
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Dynamic Advance QR</span>
                      </div>
                      <div className="text-sm font-black text-[#1D1D1F]">
                        Amount: ₹{advanceAmount}
                      </div>
                      <div className="text-[10px] font-mono text-[#86868B]">
                        UPI: {shopConfig?.upi_id || '9876543210@upi'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowStandeeQr(true)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-bold border border-[#E5E5E7] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Standee</span>
                  </button>
                </div>
              )}

              <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] flex items-center justify-between text-xs">
                <span className="text-[#86868B]">Balance Due on Pickup:</span>
                <span className="text-sm font-extrabold text-[#1D1D1F]">₹{balanceDue}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 rounded-xl border border-[#E5E5E7] text-xs font-bold text-[#86868B] hover:bg-[#F5F5F7] cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#1D1D1F] text-white text-xs font-extrabold hover:bg-[#333336] shadow-xs cursor-pointer"
              >
                {isSubmitting ? 'Creating Job...' : 'Save Job & Print Token Slip'}
              </button>
            </div>
          </form>
        )}

      </div>

      {/* Standee Fullscreen QR Modal for Advance Deposit */}
      {showStandeeQr && advanceUpiQr && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl space-y-4 animate-in fade-in-50 border-4 border-[#1D1D1F]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-[#1D1D1F] tracking-wider">
                {shopConfig?.legal_name || 'SARASWATI GARMENTS'}
              </span>
              <button
                onClick={() => setShowStandeeQr(false)}
                className="text-[#86868B] hover:text-[#1D1D1F] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="font-extrabold text-base text-[#1D1D1F]">
              Scan &amp; Pay Advance Deposit
            </h3>

            <div className="p-3 bg-white border-2 border-dashed border-[#E5E5E7] rounded-2xl flex justify-center">
              <img src={advanceUpiQr} alt="UPI QR Standee" className="w-56 h-56 object-contain" />
            </div>

            <div className="p-3 rounded-2xl bg-[#F5F5F7] border border-[#E5E5E7]">
              <div className="text-xs text-[#86868B]">Advance Amount:</div>
              <div className="text-3xl font-mono font-black text-[#1D1D1F]">
                ₹{advanceAmount}
              </div>
              <div className="text-[11px] font-mono text-[#86868B] mt-1">
                UPI: {shopConfig?.upi_id || '9876543210@upi'}
              </div>
            </div>

            <p className="text-[11px] text-[#86868B]">
              Supports GPay, PhonePe, Paytm, BHIM &amp; Banking UPI apps
            </p>

            <button
              onClick={() => setShowStandeeQr(false)}
              className="w-full py-2.5 rounded-xl bg-[#1D1D1F] text-white font-extrabold text-xs hover:bg-[#333336] cursor-pointer"
            >
              Done / Return to Counter
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
