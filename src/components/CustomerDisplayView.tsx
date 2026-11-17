import React, { useState, useEffect } from 'react';
import { CheckCircle2, Maximize, Minimize, User } from 'lucide-react';
import QRCode from 'qrcode';
import { db } from '../db/db';
import { getPaymentMethodLabel } from '../lib/locale';
import { type PaymentMethod } from '../types';

export interface CustomerDisplayPayload {
  terminalId?: string;
  shopName: string;
  currencySymbol?: string;
  currencyCode?: string;
  locale?: string;
  upiId?: string;
  customerName?: string;
  cart: {
    product_name: string;
    size_label?: string | null;
    color_label?: string | null;
    qty: number;
    unit_price: number;
  }[];
  subtotal: number;
  taxAmount?: number;
  taxLabel?: string;
  discount: number;
  grandTotal: number;
  paymentMethod: string;
  upiAmount: number;
  status: 'idle' | 'active' | 'completed';
  lastBillNumber?: string;
}

function formatDisplayMoney(amount: number, data: CustomerDisplayPayload): string {
  const sym = data.currencySymbol || '₹';
  const loc = data.locale || 'en-IN';
  const code = data.currencyCode || 'INR';
  const isWhole = code === 'INR' && Math.abs(amount % 1) < 0.001;
  try {
    return `${sym}${new Intl.NumberFormat(loc, {
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount || 0)}`;
  } catch {
    return `${sym}${(amount || 0).toFixed(2)}`;
  }
}

export const CustomerDisplayView: React.FC = () => {
  const terminalId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('terminal') || 'default'
      : 'default';

  const [data, setData] = useState<CustomerDisplayPayload>({
    terminalId,
    shopName: 'SIKKADESK RETAIL',
    currencySymbol: '₹',
    currencyCode: 'INR',
    locale: 'en-IN',
    upiId: '',
    cart: [],
    subtotal: 0,
    taxAmount: 0,
    taxLabel: 'GST',
    discount: 0,
    grandTotal: 0,
    paymentMethod: 'cash',
    upiAmount: 0,
    status: 'idle',
  });

  const [upiQrUrl, setUpiQrUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    const channelName = `counterly_display_${terminalId}`;
    const storageKey = `counterly_display_state_${terminalId}`;

    try {
      channel = new BroadcastChannel(channelName);
      channel.onmessage = (event: MessageEvent) => {
        if (event.data && typeof event.data === 'object' && event.data.type !== 'REQUEST_STATE') {
          setData(event.data);
        }
      };
      channel.postMessage({ type: 'REQUEST_STATE' });
    } catch {
      // BroadcastChannel unsupported
    }

    const syncSources = async () => {
      try {
        const dbState = await db.customer_display_state.get(terminalId);
        if (dbState && dbState.timestamp) {
          setData(prev => (JSON.stringify(prev) !== JSON.stringify(dbState) ? dbState : prev));
          return;
        }

        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            setData(prev => (JSON.stringify(prev) !== JSON.stringify(parsed) ? parsed : prev));
            return;
          }
        }

        const resp = await fetch(`/api/display/${encodeURIComponent(terminalId)}`);
        if (resp.ok) {
          const srvData = await resp.json();
          if (srvData && srvData.timestamp) {
            setData(prev => (JSON.stringify(prev) !== JSON.stringify(srvData) ? srvData : prev));
          }
        }
      } catch {
        // silent sync
      }
    };

    syncSources();
    const pollInterval = setInterval(syncSources, 350);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          setData(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) channel.close();
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorage);
    };
  }, [terminalId]);

  useEffect(() => {
    if (data.status === 'completed') {
      const t = setTimeout(() => {
        setData(prev => (prev.status === 'completed' ? { ...prev, status: 'idle', cart: [], grandTotal: 0 } : prev));
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [data.status]);

  const isUpiActive =
    Boolean(data.upiId) &&
    ((data.paymentMethod === 'upi') || (data.paymentMethod === 'split' && data.upiAmount > 0));
  const upiPayableAmount = data.upiAmount > 0 ? data.upiAmount : data.grandTotal;

  useEffect(() => {
    if (isUpiActive && upiPayableAmount > 0 && data.upiId) {
      const payee = encodeURIComponent(data.shopName || 'Retail Store');
      const upiUrl = `upi://pay?pa=${data.upiId}&pn=${payee}&am=${upiPayableAmount}&cu=${data.currencyCode || 'INR'}&tn=POS+Payment`;
      QRCode.toDataURL(upiUrl, { width: 320, margin: 1 })
        .then(url => setUpiQrUrl(url))
        .catch(() => setUpiQrUrl(''));
    } else {
      setUpiQrUrl('');
    }
  }, [isUpiActive, upiPayableAmount, data.upiId, data.shopName, data.currencyCode]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 flex flex-col justify-between p-6 sm:p-10 select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{data.shopName}</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Customer Checkout Display · Terminal {terminalId}
          </p>
        </div>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Stage */}
      <div className="flex-1 py-8 flex items-center justify-center">
        {data.status === 'completed' ? (
          <div className="text-center space-y-3 max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Thank You</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Payment received{data.lastBillNumber ? ` · Receipt ${data.lastBillNumber}` : ''}
            </p>
          </div>
        ) : data.cart.length === 0 ? (
          <div className="text-center space-y-2 max-w-md">
            <p className="text-2xl font-semibold tracking-tight">Welcome to {data.shopName}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Your items and total will appear here as they are scanned.
            </p>
          </div>
        ) : (
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            {/* Items Table */}
            <div className="lg:col-span-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
              {data.customerName && (
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <User className="w-3.5 h-3.5" />
                  <span>Customer: {data.customerName}</span>
                </div>
              )}

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[55vh] overflow-y-auto">
                {data.cart.map((item, idx) => {
                  const varLabel = [item.size_label, item.color_label].filter(Boolean).join(' · ');
                  return (
                    <div key={idx} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold">{item.product_name}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {varLabel ? `${varLabel} · ` : ''}Qty {item.qty} × {formatDisplayMoney(item.unit_price, data)}
                        </div>
                      </div>
                      <div className="text-sm font-semibold font-mono tabular-nums">
                        {formatDisplayMoney(item.qty * item.unit_price, data)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals & QR */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{formatDisplayMoney(data.subtotal, data)}</span>
                </div>
                {data.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount</span>
                    <span className="font-mono tabular-nums">-{formatDisplayMoney(data.discount, data)}</span>
                  </div>
                )}
                {Boolean(data.taxAmount && data.taxAmount > 0) && (
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>{data.taxLabel || 'Tax'}</span>
                    <span className="font-mono tabular-nums">{formatDisplayMoney(data.taxAmount || 0, data)}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Amount Due</div>
                <div className="text-4xl font-bold font-mono tabular-nums tracking-tight mt-1">
                  {formatDisplayMoney(data.grandTotal, data)}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Payment: {getPaymentMethodLabel(data.paymentMethod as PaymentMethod)}
                </div>
              </div>

              {isUpiActive && upiQrUrl && (
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                  <img
                    src={upiQrUrl}
                    alt="Scan to pay"
                    className="w-44 h-44 mx-auto rounded-xl border border-zinc-200 bg-white p-2"
                  />
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Scan to pay {formatDisplayMoney(upiPayableAmount, data)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-zinc-400 dark:text-zinc-600">
        Powered by SikkaDesk POS
      </div>
    </div>
  );
};
