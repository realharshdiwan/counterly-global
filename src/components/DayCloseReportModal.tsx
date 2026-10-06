import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Printer, 
  Share2, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Calendar, 
  Coins, 
  CreditCard, 
  QrCode, 
  Users,
  ShieldCheck,
  TrendingUp,
  ReceiptText
} from 'lucide-react';
import { db } from '../db/db';
import { type Bill, type ShopConfig, type UserProfile } from '../types';
import { bluetoothPrinter, playBeep } from '../lib/printer';
import { useAuth } from '../context/AuthContext';

interface DayCloseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DayCloseReportModal: React.FC<DayCloseReportModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, users } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  
  // Cash denomination counter
  const [n500, setN500] = useState<string>('');
  const [n200, setN200] = useState<string>('');
  const [n100, setN100] = useState<string>('');
  const [n50, setN50] = useState<string>('');
  const [n20, setN20] = useState<string>('');
  const [n10, setN10] = useState<string>('');
  const [coins, setCoins] = useState<string>('');
  const [openingFloat, setOpeningFloat] = useState<string>('0');
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, selectedDate]);

  const loadData = async () => {
    try {
      const [allBills, configs] = await Promise.all([
        db.bills.toArray(),
        db.shop_config.toArray(),
      ]);
      setBills(allBills);
      if (configs.length > 0) setShopConfig(configs[0]);
    } catch (err) {
      console.error('Failed to load day close bills:', err);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Filter bills for chosen date and staff
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const bDate = b.created_at.slice(0, 10);
      if (bDate !== selectedDate) return false;
      if (b.status === 'voided') return false;
      if (selectedStaffId !== 'all' && b.billed_by_id !== selectedStaffId) return false;
      return true;
    });
  }, [bills, selectedDate, selectedStaffId]);

  const voidedBills = useMemo(() => {
    return bills.filter(b => {
      const bDate = b.created_at.slice(0, 10);
      return bDate === selectedDate && b.status === 'voided';
    });
  }, [bills, selectedDate]);

  // Aggregate metrics
  const summary = useMemo(() => {
    let totalGross = 0;
    let totalDiscount = 0;
    let totalNet = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;
    let creditTotal = 0;
    let totalItems = 0;

    for (const b of filteredBills) {
      totalGross += b.subtotal || b.total;
      totalDiscount += b.discount_amount || 0;
      totalNet += b.total;
      totalItems += b.items.reduce((acc, it) => acc + it.qty, 0);

      if (b.payment_method === 'cash') {
        cashTotal += b.total;
      } else if (b.payment_method === 'upi') {
        upiTotal += b.total;
      } else if (b.payment_method === 'card') {
        cardTotal += b.total;
      } else if (b.payment_method === 'credit') {
        creditTotal += b.total;
      } else if (b.payment_method === 'split' && b.payment_details) {
        cashTotal += b.payment_details.cash || 0;
        upiTotal += b.payment_details.upi || 0;
        cardTotal += b.payment_details.card || 0;
        creditTotal += b.payment_details.credit || 0;
      }
    }

    return {
      billsCount: filteredBills.length,
      totalGross,
      totalDiscount,
      totalNet,
      cashTotal,
      upiTotal,
      cardTotal,
      creditTotal,
      totalItems,
      voidedCount: voidedBills.length,
      voidedAmount: voidedBills.reduce((acc, b) => acc + b.total, 0),
    };
  }, [filteredBills, voidedBills]);

  // Physical counted cash calculation
  const countedPhysicalCash = useMemo(() => {
    const v500 = (parseInt(n500, 10) || 0) * 500;
    const v200 = (parseInt(n200, 10) || 0) * 200;
    const v100 = (parseInt(n100, 10) || 0) * 100;
    const v50 = (parseInt(n50, 10) || 0) * 50;
    const v20 = (parseInt(n20, 10) || 0) * 20;
    const v10 = (parseInt(n10, 10) || 0) * 10;
    const vCoins = parseFloat(coins) || 0;
    return v500 + v200 + v100 + v50 + v20 + v10 + vCoins;
  }, [n500, n200, n100, n50, n20, n10, coins]);

  const floatVal = parseFloat(openingFloat) || 0;
  const expectedTotalCashInDrawer = floatVal + summary.cashTotal;
  const cashDifference = countedPhysicalCash > 0 ? (countedPhysicalCash - expectedTotalCashInDrawer) : 0;

  if (!isOpen) return null;

  // Print Thermal Z-Report via ESC/POS or standard printer
  const handlePrintZReport = async () => {
    setIsPrinting(true);
    const shopName = shopConfig?.legal_name || 'SARASWATI GARMENTS';
    const dateFormatted = new Date(selectedDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    try {
      if (bluetoothPrinter.isConnected()) {
        const text = `\x1B@\x1Ba\x01\x1BE\x01${shopName}\x1BE\x00\nDAY-CLOSE SHIFT REPORT (Z-REPORT)\nDate: ${dateFormatted}\n--------------------------------\n\x1Ba\x00Total Invoices: ${summary.billsCount}\nTotal Garments: ${summary.totalItems}\nGross Sales: Rs.${summary.totalGross}\nDiscounts: -Rs.${summary.totalDiscount}\n\x1BE\x01NET REVENUE: Rs.${summary.totalNet}\x1BE\x00\n--------------------------------\nPAYMENT BREAKDOWN:\n- Cash: Rs.${summary.cashTotal}\n- UPI/QR: Rs.${summary.upiTotal}\n- Card: Rs.${summary.cardTotal}\n- Credit/Pending: Rs.${summary.creditTotal}\n--------------------------------\nCASH DRAWER TALLY:\nOpening Float: Rs.${floatVal}\nExpected Cash: Rs.${expectedTotalCashInDrawer}\nPhysical Count: Rs.${countedPhysicalCash}\nDifference: Rs.${cashDifference}\n--------------------------------\nGenerated by: ${currentUser?.name || 'Staff'}\n\n\n\x1DV\x42\x00`;
        const data = new TextEncoder().encode(text);
        await bluetoothPrinter.printData(data);
        showToast('Z-Report printed via Bluetooth Thermal!');
      } else {
        window.print();
        showToast('Print dialog opened');
      }
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Failed to print');
    } finally {
      setIsPrinting(false);
    }
  };

  // Share summary on WhatsApp to Owner / Manager
  const handleShareWhatsApp = () => {
    const shopName = shopConfig?.legal_name || 'SARASWATI GARMENTS';
    const msg = `*DAY-CLOSE SHIFT REPORT*\nStore: ${shopName}\nDate: ${selectedDate}\n\n*SUMMARY*\n• Total Bills: ${summary.billsCount}\n• Total Items: ${summary.totalItems}\n• Gross: Rs.${summary.totalGross}\n• Discounts: Rs.${summary.totalDiscount}\n• *NET SALES: Rs.${summary.totalNet}*\n\n*COLLECTIONS*\n• Cash: Rs.${summary.cashTotal}\n• UPI/QR: Rs.${summary.upiTotal}\n• Card: Rs.${summary.cardTotal}\n• Credit: Rs.${summary.creditTotal}\n\n*DRAWER RECONCILIATION*\n• Expected: Rs.${expectedTotalCashInDrawer}\n• Counted: Rs.${countedPhysicalCash}\n• Diff: Rs.${cashDifference}\n\nGenerated by: ${currentUser?.name || 'Staff'}`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-xl border border-[#E5E5E7] animate-in fade-in-50 max-h-[90vh] flex flex-col my-auto">
        
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E7]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-[#1D1D1F]">Day-Close Register &amp; Shift Report</h2>
              <p className="text-xs text-[#86868B]">
                End-of-day revenue audit, tender breakdown, and physical cash drawer tally
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#86868B] hover:text-[#1D1D1F] p-1.5 rounded-lg hover:bg-[#F5F5F7] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {toastMessage && (
          <div className="mt-3 p-2.5 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-semibold text-center">
            {toastMessage}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-4 p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#1D1D1F]" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-8 px-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] bg-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1D1D1F]" />
            <select
              value={selectedStaffId}
              onChange={e => setSelectedStaffId(e.target.value)}
              className="h-8 px-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] bg-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
            >
              <option value="all">All Counter Staff</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          
          {/* Revenue Key Figures */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
              <div className="text-[10px] uppercase font-bold text-[#86868B]">Net Revenue</div>
              <div className="text-xl font-bold text-[#1D1D1F] mt-0.5">
                ₹{summary.totalNet.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
              <div className="text-[10px] uppercase font-bold text-[#86868B]">Completed Bills</div>
              <div className="text-xl font-bold text-[#1D1D1F] mt-0.5">
                {summary.billsCount} Bills
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
              <div className="text-[10px] uppercase font-bold text-[#86868B]">Total Garments</div>
              <div className="text-xl font-bold text-[#1D1D1F] mt-0.5">
                {summary.totalItems} Pcs
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
              <div className="text-[10px] uppercase font-bold text-[#86868B]">Total Discounts</div>
              <div className="text-xl font-bold text-[#1D1D1F] mt-0.5">
                ₹{summary.totalDiscount.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="p-4 rounded-xl bg-white border border-[#E5E5E7] space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
              Payment Collections Breakdown
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1D1D1F]">
                  <Coins className="w-4 h-4 text-[#1D1D1F]" />
                  <span>Cash</span>
                </div>
                <div className="text-base font-bold text-[#1D1D1F] mt-1">
                  ₹{summary.cashTotal.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1D1D1F]">
                  <QrCode className="w-4 h-4 text-[#1D1D1F]" />
                  <span>UPI / QR</span>
                </div>
                <div className="text-base font-bold text-[#1D1D1F] mt-1">
                  ₹{summary.upiTotal.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1D1D1F]">
                  <CreditCard className="w-4 h-4 text-[#1D1D1F]" />
                  <span>Card POS</span>
                </div>
                <div className="text-base font-bold text-[#1D1D1F] mt-1">
                  ₹{summary.cardTotal.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1D1D1F]">
                  <ReceiptText className="w-4 h-4 text-[#1D1D1F]" />
                  <span>Pending Credit</span>
                </div>
                <div className="text-base font-bold text-[#1D1D1F] mt-1">
                  ₹{summary.creditTotal.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          {/* Physical Cash Drawer Denominations & Reconciliation */}
          <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
                  Cash Drawer Tally &amp; Note Denominations
                </h3>
                <p className="text-[11px] text-[#86868B]">
                  Count physical currency notes in the drawer to verify cash balance
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-semibold text-[#86868B] block">Expected Drawer Cash:</span>
                <span className="text-sm font-bold text-[#1D1D1F]">
                  ₹{expectedTotalCashInDrawer.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div>
                <label className="text-[10px] font-medium text-[#515154] block mb-0.5">₹500 Notes</label>
                <input
                  type="number"
                  value={n500}
                  onChange={e => setN500(e.target.value)}
                  placeholder="0"
                  className="w-full h-8 px-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-[#515154] block mb-0.5">₹200 Notes</label>
                <input
                  type="number"
                  value={n200}
                  onChange={e => setN200(e.target.value)}
                  placeholder="0"
                  className="w-full h-8 px-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-[#515154] block mb-0.5">₹100 Notes</label>
                <input
                  type="number"
                  value={n100}
                  onChange={e => setN100(e.target.value)}
                  placeholder="0"
                  className="w-full h-8 px-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-[#515154] block mb-0.5">₹50 Notes</label>
                <input
                  type="number"
                  value={n50}
                  onChange={e => setN50(e.target.value)}
                  placeholder="0"
                  className="w-full h-8 px-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-[#515154] block mb-0.5">₹20 Notes</label>
                <input
                  type="number"
                  value={n20}
                  onChange={e => setN20(e.target.value)}
                  placeholder="0"
                  className="w-full h-8 px-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-[#515154] block mb-0.5">₹10 Notes</label>
                <input
                  type="number"
                  value={n10}
                  onChange={e => setN10(e.target.value)}
                  placeholder="0"
                  className="w-full h-8 px-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-[#515154] block mb-0.5">Coins Total (₹)</label>
                <input
                  type="number"
                  value={coins}
                  onChange={e => setCoins(e.target.value)}
                  placeholder="0"
                  className="w-full h-8 px-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-[#515154] block mb-0.5">Opening Float (₹)</label>
                <input
                  type="number"
                  value={openingFloat}
                  onChange={e => setOpeningFloat(e.target.value)}
                  placeholder="0"
                  className="w-full h-8 px-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold bg-white"
                />
              </div>
            </div>

            {/* Reconciliation Difference Badge */}
            {countedPhysicalCash > 0 && (
              <div className="p-3 rounded-xl border border-[#E5E5E7] bg-white flex items-center justify-between text-[#1D1D1F]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#34C759]" />
                  <span className="font-semibold text-xs">
                    Counted Physical Cash: ₹{countedPhysicalCash.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="font-bold text-xs">
                  {cashDifference === 0 && 'Exact Match (Balanced)'}
                  {cashDifference > 0 && `Over: +₹${cashDifference} (Excess)`}
                  {cashDifference < 0 && `Short: -₹${Math.abs(cashDifference)} (Deficit)`}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-[#E5E5E7] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#86868B] hover:bg-[#F5F5F7] cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="px-3.5 py-2 rounded-xl border border-[#E5E5E7] bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold hover:bg-[#E8E8ED] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-[#34C759]" />
              <span>WhatsApp Report</span>
            </button>

            <button
              onClick={handlePrintZReport}
              disabled={isPrinting}
              className="px-4 py-2 rounded-xl bg-[#1D1D1F] text-white text-xs font-semibold hover:bg-[#333336] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Z-Report</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
