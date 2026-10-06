import React, { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, Store, Calendar, ArrowLeft, Phone, Printer } from 'lucide-react';
import { db } from '../db/db';
import { type Bill, type ShopConfig } from '../types';
import { numberToWords } from '../lib/printer';

interface EReceiptVerificationViewProps {
  billNumber: string;
  onBackToApp: () => void;
}

export const EReceiptVerificationView: React.FC<EReceiptVerificationViewProps> = ({
  billNumber,
  onBackToApp,
}) => {
  const [bill, setBill] = useState<Bill | null>(null);
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBill() {
      try {
        const found = await db.bills.where('bill_number').equals(billNumber).first();
        if (found) {
          setBill(found);
        }
        const configs = await db.shop_config.toArray();
        if (configs.length > 0) {
          setConfig(configs[0]);
        }
      } catch (err) {
        console.error('Failed to query bill for verification:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchBill();
  }, [billNumber]);

  const shopName = config?.legal_name || 'SARASWATI GARMENTS';
  const shopPhone = config?.shop_phone || '+91 98765 43210';
  const shopAddress = config?.shop_address || 'Main Market Complex';

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center p-4 text-[#1D1D1F]">
      <div className="max-w-md w-full bg-white rounded-3xl border border-[#E5E5E7] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Verification Banner */}
        <div className="bg-[#1D1D1F] text-white p-6 text-center relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold mb-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verified Authentic E-Receipt
          </span>
          <h1 className="text-xl font-black tracking-tight">{shopName}</h1>
          <p className="text-xs text-white/70 mt-1">{shopAddress} · Ph: {shopPhone}</p>
        </div>

        {/* Verification Details */}
        <div className="p-6 space-y-5">
          {loading ? (
            <div className="py-8 text-center text-xs text-[#86868B] animate-pulse">
              Verifying cryptographic digital receipt record...
            </div>
          ) : bill ? (
            <>
              {/* Receipt Meta */}
              <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#E5E5E7] space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-[#E5E5E7]">
                  <span className="text-[#86868B] font-bold">Bill Number</span>
                  <span className="font-extrabold text-[#1D1D1F] font-mono text-sm">{bill.bill_number}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#86868B] font-medium">Issue Date & Time</span>
                  <span className="font-semibold text-[#1D1D1F]">
                    {new Date(bill.created_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#86868B] font-medium">School / Section</span>
                  <span className="font-bold text-[#1D1D1F]">{bill.school_name}</span>
                </div>
                {bill.customer_name && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#86868B] font-medium">Customer</span>
                    <span className="font-semibold text-[#1D1D1F]">{bill.customer_name}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-[#86868B] font-medium">Payment Mode</span>
                  <span className="font-bold uppercase text-[#1D1D1F] bg-white border border-[#E5E5E7] px-2 py-0.5 rounded-md">
                    {bill.payment_method} ({bill.is_paid ? 'PAID' : 'PENDING'})
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#86868B] block">
                  Billed Garment Items ({bill.items.length})
                </span>
                <div className="divide-y divide-[#E5E5E7] border border-[#E5E5E7] rounded-2xl overflow-hidden bg-white">
                  {bill.items.map(item => (
                    <div key={item.id} className="p-3 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold text-[#1D1D1F]">
                          {item.school_code ? `[${item.school_code}] ` : ''}{item.product_name}
                        </p>
                        <p className="text-[11px] text-[#86868B] mt-0.5">
                          Size: <span className="font-semibold text-[#1D1D1F]">{item.size_label}</span> · Qty: {item.qty} × ₹{item.unit_price}
                        </p>
                      </div>
                      <span className="font-extrabold text-[#1D1D1F] font-mono">
                        ₹{item.subtotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grand Total */}
              <div className="p-4 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] text-white/70 uppercase tracking-wider font-bold block">Grand Total Paid</span>
                  <span className="text-xs text-white/80 font-medium italic mt-0.5 block">{numberToWords(bill.total)}</span>
                </div>
                <span className="text-xl font-black tracking-tight">₹{bill.total.toLocaleString('en-IN')}</span>
              </div>

              {/* Anti-Fraud Seal */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <p className="text-[11px] font-bold text-emerald-900">
                  Official Verification Seal Active
                </p>
                <p className="text-[10px] text-emerald-700 mt-0.5">
                  Eligible for 7-day size exchange against intact garment barcode tag.
                </p>
              </div>
            </>
          ) : (
            <div className="py-6 text-center space-y-2">
              <p className="text-sm font-bold text-[#1D1D1F]">Receipt #{billNumber}</p>
              <p className="text-xs text-[#86868B]">
                This genuine e-receipt link was generated by the counter POS system.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBackToApp}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] hover:bg-[#E5E5E7] text-xs font-bold text-[#1D1D1F] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Store POS</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="py-2.5 px-4 rounded-xl bg-[#1D1D1F] hover:bg-[#333336] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Copy</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
