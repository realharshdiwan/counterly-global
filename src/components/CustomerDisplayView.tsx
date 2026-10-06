import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Maximize, 
  Minimize,
  User,
  School,
  Tag
} from 'lucide-react';
import QRCode from 'qrcode';
import { db } from '../db/db';

export interface CustomerDisplayPayload {
  shopName: string;
  upiId: string;
  studentName?: string;
  studentGrade?: string;
  schoolName?: string;
  cart: {
    product_name: string;
    size_label?: string;
    school_name?: string;
    school_code?: string;
    qty: number;
    unit_price: number;
  }[];
  subtotal: number;
  discount: number;
  grandTotal: number;
  paymentMethod: string;
  upiAmount: number;
  status: 'idle' | 'active' | 'completed';
  lastBillNumber?: string;
}

export const CustomerDisplayView: React.FC = () => {
  const [data, setData] = useState<CustomerDisplayPayload>({
    shopName: 'SARASWATI GARMENTS',
    upiId: 'saraswatigarments@upi',
    cart: [],
    subtotal: 0,
    discount: 0,
    grandTotal: 0,
    paymentMethod: 'cash',
    upiAmount: 0,
    status: 'idle',
  });

  const [upiQrUrl, setUpiQrUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Multi-source real-time synchronization
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('nandalaya_customer_display');
      channel.onmessage = (event: MessageEvent) => {
        if (event.data && typeof event.data === 'object' && event.data.type !== 'REQUEST_STATE') {
          setData(event.data);
        }
      };
      channel.postMessage({ type: 'REQUEST_STATE' });
    } catch (e) {
      console.warn('BroadcastChannel fallback');
    }

    const syncSources = async () => {
      try {
        const dbState = await db.customer_display_state.get('active');
        if (dbState && dbState.timestamp) {
          setData(prev => (JSON.stringify(prev) !== JSON.stringify(dbState) ? dbState : prev));
          return;
        }

        const stored = localStorage.getItem('nandalaya_customer_display_state');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            setData(prev => (JSON.stringify(prev) !== JSON.stringify(parsed) ? parsed : prev));
            return;
          }
        }

        const resp = await fetch('/api/customer-display');
        if (resp.ok) {
          const srvData = await resp.json();
          if (srvData && srvData.timestamp) {
            setData(prev => (JSON.stringify(prev) !== JSON.stringify(srvData) ? srvData : prev));
          }
        }
      } catch (err) {
        // silent sync
      }
    };

    syncSources();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'nandalaya_customer_display_state' && e.newValue) {
        try {
          setData(JSON.parse(e.newValue));
        } catch (err) {
          console.error(err);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    const pollInterval = setInterval(syncSources, 250);

    return () => {
      if (channel) channel.close();
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Auto-reset completed screen to idle after 5 seconds
  useEffect(() => {
    if (data.status === 'completed') {
      const t = setTimeout(() => {
        setData(prev => (prev.status === 'completed' ? { ...prev, status: 'idle' } : prev));
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [data.status]);

  // Determine if UPI payment is specifically active
  const isUpiActive = (data.paymentMethod === 'upi') || (data.paymentMethod === 'split' && data.upiAmount > 0);
  const upiPayableAmount = data.upiAmount > 0 ? data.upiAmount : data.grandTotal;

  // Generate UPI QR ONLY when UPI mode is actively selected
  useEffect(() => {
    if (isUpiActive && upiPayableAmount > 0) {
      const vpa = data.upiId || 'saraswatigarments@upi';
      const payee = encodeURIComponent(data.shopName || 'Saraswati Garments');
      const upiUrl = `upi://pay?pa=${vpa}&pn=${payee}&am=${upiPayableAmount}&cu=INR&tn=Bill+Payment`;

      QRCode.toDataURL(upiUrl, { width: 340, margin: 1 })
        .then(url => setUpiQrUrl(url))
        .catch(err => console.error('Failed to generate customer QR:', err));
    } else {
      setUpiQrUrl('');
    }
  }, [isUpiActive, upiPayableAmount, data.upiId, data.shopName]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const totalItemsCount = data.cart.reduce((a, b) => a + b.qty, 0);

  return (
    <div 
      onDoubleClick={toggleFullscreen}
      className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans flex flex-col justify-center items-center p-6 sm:p-10 select-none antialiased relative"
    >
      {/* Discreet Fullscreen Toggle (Only visible on hover) */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 p-2 rounded-xl text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/80 transition-all opacity-20 hover:opacity-100 z-50"
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </button>

      {/* Main Container */}
      <div className="w-full max-w-5xl mx-auto flex flex-col justify-center">

        {data.status === 'completed' ? (
          /* Payment Received Screen */
          <div className="bg-white border border-[#E5E5EA] rounded-3xl p-10 sm:p-14 text-center shadow-[0_4px_24px_rgba(0,0,0,0.06)] space-y-5 max-w-md mx-auto animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-full bg-[#E8F8EE] text-[#34C759] flex items-center justify-center mx-auto ring-8 ring-[#E8F8EE]/60">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#1D1D1F]">Payment Received</h2>
              <p className="text-sm text-[#86868B]">Thank you for shopping with us</p>
            </div>

            <div className="pt-3 pb-1">
              <div className="text-4xl font-mono font-bold text-[#1D1D1F]">
                ₹{data.grandTotal.toLocaleString('en-IN')}
              </div>
              {data.lastBillNumber && (
                <div className="inline-block mt-3 px-3 py-1 bg-[#F5F5F7] border border-[#E5E5EA] rounded-lg text-xs font-mono font-medium text-[#86868B]">
                  Invoice #{data.lastBillNumber}
                </div>
              )}
            </div>
          </div>

        ) : data.cart.length === 0 || data.status === 'idle' ? (
          /* Pure Minimal Idle State */
          <div className="text-center py-28 space-y-2 animate-in fade-in duration-300">
            <p className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-[#86868B]">
              Welcome to
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#1D1D1F]">
              {data.shopName || 'SARASWATI GARMENTS'}
            </h1>
          </div>

        ) : (
          /* Active Billing State */
          <div className="w-full space-y-4 animate-in fade-in duration-200">
            {/* Store & Customer Header Line */}
            <div className="flex items-center justify-between px-2">
              <span className="font-bold text-xl tracking-tight text-[#1D1D1F]">
                {data.shopName || 'SARASWATI GARMENTS'}
              </span>

              <div className="flex items-center gap-3">
                {data.schoolName && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-[#E5E5EA] text-[#1D1D1F] text-xs font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <School className="w-3.5 h-3.5 text-[#86868B]" />
                    <span>{data.schoolName}</span>
                  </div>
                )}
                {data.studentName && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold">
                    <User className="w-3.5 h-3.5 text-[#86868B]" />
                    <span>{data.studentName} {data.studentGrade ? `(${data.studentGrade})` : ''}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Split or Full Width based on whether UPI scanner is active */}
            {isUpiActive ? (
              /* 2-Column Mode: Items + UPI Scanner */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Left: Items Summary */}
                <div className="lg:col-span-7 bg-white border border-[#E5E5EA] rounded-3xl p-6 sm:p-7 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-[#F5F5F7]">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#86868B]">
                        Items ({totalItemsCount})
                      </span>
                    </div>

                    <div className="divide-y divide-[#F5F5F7] max-h-72 overflow-y-auto pr-1 my-2 scrollbar-thin">
                      {data.cart.map((item, idx) => (
                        <div key={idx} className="py-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[#1D1D1F] flex items-center gap-2">
                              <span>{item.product_name}</span>
                              {item.size_label && (
                                <span className="text-xs font-semibold bg-[#F5F5F7] text-[#1D1D1F] px-2 py-0.5 rounded-md border border-[#E5E5EA]">
                                  Size {item.size_label}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#86868B] mt-0.5 font-mono">
                              {item.qty} × ₹{item.unit_price}
                            </div>
                          </div>

                          <div className="text-sm font-mono font-semibold text-[#1D1D1F]">
                            ₹{(item.unit_price * item.qty).toLocaleString('en-IN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total Strip */}
                  <div className="pt-3 border-t border-[#F5F5F7] space-y-1.5">
                    {data.discount > 0 && (
                      <div className="flex justify-between text-xs text-[#34C759] font-semibold">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          Discount
                        </span>
                        <span className="font-mono">-₹{data.discount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-baseline pt-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#86868B]">Total</span>
                      <span className="font-mono text-[#1D1D1F] text-3xl font-bold">
                        ₹{data.grandTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: UPI Scanner Standee */}
                <div className="lg:col-span-5 bg-[#1D1D1F] rounded-3xl p-6 sm:p-7 flex flex-col justify-between items-center text-center shadow-[0_4px_24px_rgba(0,0,0,0.12)] text-white">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0071E3]">
                      {data.paymentMethod === 'split' ? 'Scan UPI Portion' : 'Scan to Pay'}
                    </span>
                    <div className="text-4xl sm:text-5xl font-mono font-bold tracking-tight text-white">
                      ₹{upiPayableAmount.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="my-3">
                    <div className="p-3 bg-white rounded-2xl shadow-xl inline-block">
                      {upiQrUrl ? (
                        <img src={upiQrUrl} alt="UPI QR" className="w-52 h-52 object-contain" />
                      ) : (
                        <div className="w-52 h-52 bg-slate-50 rounded-xl flex items-center justify-center text-xs text-slate-400">
                          Generating QR...
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-slate-300 flex items-center justify-center gap-2">
                      <span className="bg-white/10 px-2 py-0.5 rounded">GPay</span>
                      <span className="bg-white/10 px-2 py-0.5 rounded">PhonePe</span>
                      <span className="bg-white/10 px-2 py-0.5 rounded">Paytm</span>
                      <span className="bg-white/10 px-2 py-0.5 rounded">BHIM</span>
                    </div>
                    <div className="text-[10px] font-mono text-[#86868B] pt-0.5">
                      {data.upiId || 'saraswatigarments@upi'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Full-Width Focused Order View (No UPI scanner!) */
              <div className="bg-white border border-[#E5E5EA] rounded-3xl p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#F5F5F7]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#86868B]">
                    Order Items ({totalItemsCount})
                  </span>

                  {data.paymentMethod === 'card' ? (
                    <span className="text-xs font-semibold text-[#1D1D1F] bg-[#F5F5F7] px-2.5 py-1 rounded-lg border border-[#E5E5EA]">
                      Card Payment
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-[#6E6E73] bg-[#F5F5F7] px-2.5 py-1 rounded-lg border border-[#E5E5EA]">
                      Cash Payment
                    </span>
                  )}
                </div>

                {/* Generous Item Rows */}
                <div className="divide-y divide-[#F5F5F7] max-h-96 overflow-y-auto pr-2 scrollbar-thin">
                  {data.cart.map((item, idx) => (
                    <div key={idx} className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-base font-semibold text-[#1D1D1F] flex items-center gap-2 flex-wrap">
                          <span>{item.product_name}</span>
                          {item.school_code && (
                            <span className="text-[11px] font-medium bg-[#F5F5F7] text-[#6E6E73] px-2 py-0.5 rounded border border-[#E5E5EA]">
                              {item.school_code}
                            </span>
                          )}
                          {item.size_label && (
                            <span className="text-xs font-semibold bg-[#F5F5F7] text-[#1D1D1F] px-2.5 py-0.5 rounded-md border border-[#E5E5EA]">
                              Size {item.size_label}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#86868B] mt-1 font-mono">
                          {item.qty} × ₹{item.unit_price}
                        </div>
                      </div>

                      <div className="text-lg font-mono font-bold text-[#1D1D1F]">
                        ₹{(item.unit_price * item.qty).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal & Total Bottom Bar */}
                <div className="pt-4 border-t border-[#F5F5F7] flex items-center justify-between">
                  <div>
                    {data.discount > 0 && (
                      <p className="text-xs font-semibold text-[#34C759]">
                        Discount Applied: -₹{data.discount.toLocaleString('en-IN')}
                      </p>
                    )}
                    <span className="text-xs font-bold uppercase tracking-wider text-[#86868B]">
                      Total Amount
                    </span>
                  </div>

                  <span className="font-mono text-[#1D1D1F] text-4xl sm:text-5xl font-bold">
                    ₹{data.grandTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
