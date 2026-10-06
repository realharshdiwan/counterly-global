import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  X, 
  Calendar, 
  Copy, 
  Check,
  Building2,
  Users
} from 'lucide-react';
import { db } from '../db/db';
import { type Bill, type ShopConfig, type InventoryMovement, type GstSchemeType } from '../types';
import { playBeep } from '../lib/printer';

interface GstCompositionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ShopConfig | null;
}

type PeriodType = 'q1' | 'q2' | 'q3' | 'q4' | 'fy' | 'custom';

export const GstCompositionReportModal: React.FC<GstCompositionReportModalProps> = ({
  isOpen,
  onClose,
  config,
}) => {
  const currentYear = new Date().getFullYear();
  const [selectedFY, setSelectedFY] = useState<number>(new Date().getMonth() >= 3 ? currentYear : currentYear - 1);
  const [periodType, setPeriodType] = useState<PeriodType>('q1');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  
  // Scheme state: defaults to shop config, but allows interactive switching on-the-fly
  const [activeScheme, setActiveScheme] = useState<GstSchemeType>(() => config?.gst_scheme || 'composition');

  useEffect(() => {
    if (config?.gst_scheme) {
      setActiveScheme(config.gst_scheme);
    }
  }, [config?.gst_scheme, isOpen]);

  const [bills, setBills] = useState<Bill[]>([]);
  const [, setMovements] = useState<InventoryMovement[]>([]);
  const [, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Compute start and end date for chosen quarter / FY
  const { startDate, endDate, periodLabel, filingDueDate } = useMemo(() => {
    let start = new Date(selectedFY, 3, 1);
    let end = new Date(selectedFY, 5, 30, 23, 59, 59);
    let label = `Q1 (Apr – Jun ${selectedFY})`;
    let due = `18th July ${selectedFY}`;

    if (periodType === 'q1') {
      start = new Date(selectedFY, 3, 1, 0, 0, 0);
      end = new Date(selectedFY, 5, 30, 23, 59, 59);
      label = `Q1: Apr – Jun ${selectedFY}`;
      due = activeScheme === 'composition' 
        ? `18th July ${selectedFY} (CMP-08)` 
        : activeScheme === 'regular' 
        ? `Monthly: 11th & 20th / QRMP: 13th & 22nd July ${selectedFY}`
        : `Q1 Internal Accounting`;
    } else if (periodType === 'q2') {
      start = new Date(selectedFY, 6, 1, 0, 0, 0);
      end = new Date(selectedFY, 8, 30, 23, 59, 59);
      label = `Q2: Jul – Sep ${selectedFY}`;
      due = activeScheme === 'composition' 
        ? `18th October ${selectedFY} (CMP-08)` 
        : activeScheme === 'regular'
        ? `Monthly: 11th & 20th / QRMP: 13th & 22nd Oct ${selectedFY}`
        : `Q2 Internal Accounting`;
    } else if (periodType === 'q3') {
      start = new Date(selectedFY, 9, 1, 0, 0, 0);
      end = new Date(selectedFY, 11, 31, 23, 59, 59);
      label = `Q3: Oct – Dec ${selectedFY}`;
      due = activeScheme === 'composition' 
        ? `18th January ${selectedFY + 1} (CMP-08)` 
        : activeScheme === 'regular'
        ? `Monthly: 11th & 20th / QRMP: 13th & 22nd Jan ${selectedFY + 1}`
        : `Q3 Internal Accounting`;
    } else if (periodType === 'q4') {
      start = new Date(selectedFY + 1, 0, 1, 0, 0, 0);
      end = new Date(selectedFY + 1, 2, 31, 23, 59, 59);
      label = `Q4: Jan – Mar ${selectedFY + 1}`;
      due = activeScheme === 'composition' 
        ? `18th April ${selectedFY + 1} (CMP-08)` 
        : activeScheme === 'regular'
        ? `Monthly: 11th & 20th / QRMP: 13th & 22nd Apr ${selectedFY + 1}`
        : `Q4 Internal Accounting`;
    } else if (periodType === 'fy') {
      start = new Date(selectedFY, 3, 1, 0, 0, 0);
      end = new Date(selectedFY + 1, 2, 31, 23, 59, 59);
      label = `Annual FY ${selectedFY}–${(selectedFY + 1) % 100}`;
      due = activeScheme === 'composition' 
        ? `30th April ${selectedFY + 1} (GSTR-4 Annual)` 
        : activeScheme === 'regular'
        ? `31st December ${selectedFY + 1} (GSTR-9 Annual)`
        : `31st July ${selectedFY + 1} (ITR Presumptive)`;
    } else if (periodType === 'custom') {
      if (customStart) start = new Date(customStart + 'T00:00:00');
      if (customEnd) end = new Date(customEnd + 'T23:59:59');
      label = `Custom: ${start.toLocaleDateString('en-IN')} to ${end.toLocaleDateString('en-IN')}`;
      due = `Custom Date Range`;
    }

    return { startDate: start, endDate: end, periodLabel: label, filingDueDate: due };
  }, [selectedFY, periodType, customStart, customEnd, activeScheme]);

  useEffect(() => {
    async function loadData() {
      if (!isOpen) return;
      setIsLoading(true);
      try {
        const [allBills, allMovs] = await Promise.all([
          db.bills.toArray(),
          db.inventory_movements.toArray(),
        ]);
        setBills(allBills);
        setMovements(allMovs);
      } catch (err) {
        console.error('Failed to load bills for GST report:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [isOpen]);

  const periodBills = useMemo(() => {
    return bills.filter(b => {
      const d = new Date(b.created_at);
      return d >= startDate && d <= endDate;
    });
  }, [bills, startDate, endDate]);

  const stats = useMemo(() => {
    const validBills = periodBills.filter(b => b.status !== 'voided');
    const voidedBills = periodBills.filter(b => b.status === 'voided');

    const grossSales = validBills.reduce((sum, b) => sum + (b.total || 0), 0);
    const totalBillsCount = validBills.length;
    const voidedAmount = voidedBills.reduce((sum, b) => sum + (b.total || 0), 0);

    const b2bBills = validBills.filter(b => b.bill_type === 'b2b' || !!b.customer_gstin);
    const b2cBills = validBills.filter(b => b.bill_type !== 'b2b' && !b.customer_gstin);

    const b2bGross = b2bBills.reduce((sum, b) => sum + (b.total || 0), 0);
    const b2cGross = b2cBills.reduce((sum, b) => sum + (b.total || 0), 0);

    // Composition Calculation (1% flat on turnover: 0.5% CGST + 0.5% SGST)
    const compTurnover = grossSales;
    const compCgst = Math.round(grossSales * 0.005);
    const compSgst = Math.round(grossSales * 0.005);
    const compTotalTax = compCgst + compSgst;

    // Regular GST Calculation (Standard uniform 5% GST: taxable = gross / 1.05)
    const regGross = grossSales;
    const regTaxable = Math.round(grossSales / 1.05);
    const regTotalTax = regGross - regTaxable;
    const regCgst = Math.round(regTotalTax / 2);
    const regSgst = regTotalTax - regCgst;

    const regB2bTaxable = Math.round(b2bGross / 1.05);
    const regB2bTax = b2bGross - regB2bTaxable;

    const regB2cTaxable = Math.round(b2cGross / 1.05);
    const regB2cTax = b2cGross - regB2cTaxable;

    // Monthly breakdown
    const monthlyData: Record<string, {
      monthName: string;
      gross: number;
      billsCount: number;
      compTax: number;
      regTaxable: number;
      regTax: number;
      cashAmount: number;
      digitalAmount: number;
    }> = {};

    let cashSales = 0;
    let digitalSales = 0;

    validBills.forEach(b => {
      const d = new Date(b.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mName = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      if (!monthlyData[key]) {
        monthlyData[key] = {
          monthName: mName,
          gross: 0,
          billsCount: 0,
          compTax: 0,
          regTaxable: 0,
          regTax: 0,
          cashAmount: 0,
          digitalAmount: 0,
        };
      }
      const bTotal = b.total || 0;
      monthlyData[key].gross += bTotal;
      monthlyData[key].billsCount += 1;
      monthlyData[key].compTax += Math.round(bTotal * 0.01);
      const mTaxable = Math.round(bTotal / 1.05);
      monthlyData[key].regTaxable += mTaxable;
      monthlyData[key].regTax += (bTotal - mTaxable);

      const mode = b.payment_method?.toLowerCase() || 'cash';
      let bCash = 0;
      let bDigital = 0;
      if (b.payment_details && mode === 'split') {
        bCash = b.payment_details.cash || 0;
        bDigital = (b.payment_details.upi || 0) + (b.payment_details.card || 0);
      } else if (mode === 'cash') {
        bCash = bTotal;
      } else {
        bDigital = bTotal;
      }
      monthlyData[key].cashAmount += bCash;
      monthlyData[key].digitalAmount += bDigital;
      cashSales += bCash;
      digitalSales += bDigital;
    });

    const sec44adProfit = Math.round(digitalSales * 0.06 + cashSales * 0.08);

    const paymentBreakdown: Record<string, number> = { cash: 0, upi: 0, card: 0, credit: 0 };
    validBills.forEach(b => {
      const mode = b.payment_method?.toLowerCase() || 'cash';
      if (b.payment_details && mode === 'split') {
        paymentBreakdown.cash += b.payment_details.cash || 0;
        paymentBreakdown.upi += b.payment_details.upi || 0;
        paymentBreakdown.card += b.payment_details.card || 0;
        paymentBreakdown.credit += b.payment_details.credit || 0;
      } else {
        paymentBreakdown[mode] = (paymentBreakdown[mode] || 0) + (b.total || 0);
      }
    });

    return {
      grossSales,
      voidedAmount,
      totalBillsCount,
      b2bCount: b2bBills.length,
      b2cCount: b2cBills.length,
      b2bGross,
      b2cGross,
      compTurnover,
      compCgst,
      compSgst,
      compTotalTax,
      regGross,
      regTaxable,
      regTotalTax,
      regCgst,
      regSgst,
      regB2bTaxable,
      regB2bTax,
      regB2cTaxable,
      regB2cTax,
      cashSales,
      digitalSales,
      sec44adProfit,
      monthlyBreakdown: Object.values(monthlyData),
      paymentBreakdown,
    };
  }, [periodBills]);

  if (!isOpen) return null;

  const handleExportCsv = () => {
    let lines: string[] = [];
    let fileName = '';
    const storeName = config?.legal_name || 'STORE POS';

    if (activeScheme === 'regular') {
      fileName = `GST_GSTR1_3B_${periodType.toUpperCase()}_${selectedFY}_Summary.csv`;
      lines = [
        `GSTR-1 & GSTR-3B REGULAR GST SALES AND TAX STATEMENT`,
        `Shop Name,${storeName}`,
        `GSTIN,${config?.gstin || 'Not Provided'}`,
        `GST Scheme,Regular GST Dealer (Rule 46 / Rule 59 - Tax Invoice)`,
        `Return Period,${periodLabel}`,
        `Portal Filing Note,${filingDueDate}`,
        `Generated On,${new Date().toLocaleString('en-IN')}`,
        ``,
        `GSTR-3B TABLE 3.1 SUMMARY (OUTWARD TAXABLE SUPPLIES)`,
        `Table No,Description,Taxable Value (INR),CGST 2.5% (INR),SGST 2.5% (INR),Total GST 5% (INR),Gross Invoiced (INR)`,
        `3.1(a),Outward Taxable Supplies (Apparel 5%),${stats.regTaxable},${stats.regCgst},${stats.regSgst},${stats.regTotalTax},${stats.regGross}`,
        `3.1(b),Outward Zero-Rated Supplies,0,0,0,0,0`,
        `3.1(c),Other Outward Supplies (Nil/Exempt),0,0,0,0,0`,
        ``,
        `GSTR-1 TABLE SUMMARY (B2B vs B2C BREAKDOWN)`,
        `Category,Description,Invoices Count,Taxable Value (INR),GST 5% (INR),Gross Value (INR)`,
        `Table 4,B2B Supplies to Registered Persons (School / Institution),${stats.b2bCount},${stats.regB2bTaxable},${stats.regB2bTax},${stats.b2bGross}`,
        `Table 7,B2C Small Supplies to Consumers (Retail Walk-in),${stats.b2cCount},${stats.regB2cTaxable},${stats.regB2cTax},${stats.b2cGross}`,
        ``,
        `MONTHLY TURNOVER & TAX BREAKDOWN`,
        `Month,Bills,Taxable Value (INR),CGST 2.5% (INR),SGST 2.5% (INR),Total GST 5% (INR),Gross Invoice Total (INR)`,
        ...stats.monthlyBreakdown.map(m => {
          const halfGst = Math.round(m.regTax / 2);
          return `"${m.monthName}",${m.billsCount},${m.regTaxable},${halfGst},${halfGst},${m.regTax},${m.gross}`;
        }),
        ``,
        `PAYMENT MODE BREAKDOWN`,
        `Mode,Amount (INR)`,
        `Cash,${stats.paymentBreakdown.cash || 0}`,
        `UPI,${stats.paymentBreakdown.upi || 0}`,
        `Card,${stats.paymentBreakdown.card || 0}`,
        `Khata / Credit,${stats.paymentBreakdown.credit || 0}`,
      ];
    } else if (activeScheme === 'none') {
      fileName = `Sales_Turnover_${periodType.toUpperCase()}_${selectedFY}_Summary.csv`;
      lines = [
        `PERIODIC SALES & TURNOVER STATEMENT (NON-GST RETAIL)`,
        `Shop Name,${storeName}`,
        `Status,Unregistered Dealer / Below GST Threshold`,
        `Return Period,${periodLabel}`,
        `Generated On,${new Date().toLocaleString('en-IN')}`,
        ``,
        `TURNOVER SUMMARY`,
        `Gross Sales (INR),Cash Sales (INR),Digital Sales (INR),Total Bills Count`,
        `${stats.grossSales},${stats.cashSales},${stats.digitalSales},${stats.totalBillsCount}`,
        ``,
        `INCOME TAX SECTION 44AD ESTIMATE`,
        `Digital Turnover (6% Rate),${Math.round(stats.digitalSales * 0.06)}`,
        `Cash Turnover (8% Rate),${Math.round(stats.cashSales * 0.08)}`,
        `Estimated Presumptive Net Income,${stats.sec44adProfit}`,
        ``,
        `MONTHLY TURNOVER BREAKDOWN`,
        `Month,Bills Count,Cash Sales (INR),Digital Sales (INR),Total Sales (INR)`,
        ...stats.monthlyBreakdown.map(m => `"${m.monthName}",${m.billsCount},${m.cashAmount},${m.digitalAmount},${m.gross}`),
      ];
    } else {
      fileName = `GST_CMP08_${periodType.toUpperCase()}_${selectedFY}_Statement.csv`;
      lines = [
        `GST CMP-08 COMPOSITION SCHEME STATEMENT`,
        `Shop Name,${storeName}`,
        `GSTIN,${config?.gstin || 'Not Provided'}`,
        `GST Scheme,Section 10 Composition Scheme (Trader - 1% Flat)`,
        `Return Period,${periodLabel}`,
        `Filing Due Date,${filingDueDate}`,
        `Generated On,${new Date().toLocaleString('en-IN')}`,
        ``,
        `FORM CMP-08 TABLE SUMMARY`,
        `Table No,Description,Turnover Value (INR),CGST 0.5% (INR),SGST 0.5% (INR),Total Tax 1.0% (INR)`,
        `3(a),Outward Taxable Supplies (Net Turnover),${stats.compTurnover},${stats.compCgst},${stats.compSgst},${stats.compTotalTax}`,
        `3(b),Inward supplies attracting reverse charge,0,0,0,0`,
        `3(c),Tax Payable on Outward Supplies,${stats.compTurnover},${stats.compCgst},${stats.compSgst},${stats.compTotalTax}`,
        ``,
        `MONTHLY TURNOVER BREAKDOWN`,
        `Month,Total Sales (INR),Bills Count,Estimated 1% Tax (INR)`,
        ...stats.monthlyBreakdown.map(m => `"${m.monthName}",${m.gross},${m.billsCount},${m.compTax}`),
        ``,
        `PAYMENT MODE BREAKDOWN`,
        `Mode,Amount (INR)`,
        `Cash,${stats.paymentBreakdown.cash || 0}`,
        `UPI,${stats.paymentBreakdown.upi || 0}`,
        `Card,${stats.paymentBreakdown.card || 0}`,
        `Khata / Credit,${stats.paymentBreakdown.credit || 0}`,
      ];
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    playBeep('success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-xl border border-[#E5E5E7] animate-in zoom-in-95 max-h-[92vh] flex flex-col my-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#E5E5E7] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs shrink-0">
              <FileSpreadsheet className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base text-[#1D1D1F] tracking-tight">
                  {activeScheme === 'regular'
                    ? 'GSTR-1 & GSTR-3B Return Helper'
                    : activeScheme === 'none'
                    ? 'Sales & Turnover Helper'
                    : 'GST CMP-08 Return Helper'}
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[#F5F5F7] text-[#1D1D1F] text-[10px] font-bold border border-[#E5E5E7]">
                  {activeScheme === 'regular'
                    ? 'Regular GST (5%)'
                    : activeScheme === 'none'
                    ? 'Unregistered / Retail'
                    : 'Composition (1%)'}
                </span>
              </div>
              <p className="text-[11px] text-[#86868B] mt-0.5">
                {activeScheme === 'regular'
                  ? 'Tax Invoice breakdown for GSTR-1 outward supplies & GSTR-3B liability'
                  : activeScheme === 'none'
                  ? 'Retail Cash Memo summary & Section 44AD presumptive turnover'
                  : 'Bill of Supply turnover statement for Section 10 composite dealers'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl bg-[#1D1D1F] hover:bg-[#333336] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="text-[#86868B] hover:text-[#1D1D1F] p-1.5 rounded-xl hover:bg-[#F5F5F7] cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-3.5 space-y-3.5 pr-1">

          {/* Scheme Switcher Tabs */}
          <div className="p-0.5 bg-[#F5F5F7] rounded-xl border border-[#E5E5E7] flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveScheme('composition')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                activeScheme === 'composition'
                  ? 'bg-white text-[#1D1D1F] shadow-2xs'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              Composition Scheme (1%)
            </button>
            <button
              type="button"
              onClick={() => setActiveScheme('regular')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                activeScheme === 'regular'
                  ? 'bg-white text-[#1D1D1F] shadow-2xs'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              Regular GST (5%)
            </button>
            <button
              type="button"
              onClick={() => setActiveScheme('none')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                activeScheme === 'none'
                  ? 'bg-white text-[#1D1D1F] shadow-2xs'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              Unregistered (Non-GST)
            </button>
          </div>

          {/* Period Selector Controls */}
          <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              
              {/* Financial Year Picker */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#1D1D1F]">Financial Year:</span>
                <select
                  value={selectedFY}
                  onChange={e => setSelectedFY(Number(e.target.value))}
                  className="h-8 px-2.5 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F] focus:outline-none"
                >
                  <option value={currentYear + 1}>FY {currentYear}–{(currentYear + 1) % 100}</option>
                  <option value={currentYear}>FY {currentYear - 1}–{currentYear % 100}</option>
                  <option value={currentYear - 1}>FY {currentYear - 2}–{(currentYear - 1) % 100}</option>
                </select>
              </div>

              {/* Due Date Indicator */}
              <div className="flex items-center gap-1.5 text-xs text-[#1D1D1F] bg-white px-2.5 py-1 rounded-xl border border-[#E5E5E7]">
                <Calendar className="w-3.5 h-3.5 text-[#1D1D1F]" />
                <span className="text-[11px] text-[#86868B]">Filing Note: <strong className="text-[#1D1D1F]">{filingDueDate}</strong></span>
              </div>
            </div>

            {/* Quarter Buttons */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              <button
                type="button"
                onClick={() => setPeriodType('q1')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodType === 'q1'
                    ? 'bg-[#1D1D1F] text-white shadow-xs'
                    : 'bg-white text-[#1D1D1F] border border-[#E5E5E7] hover:bg-[#F5F5F7]'
                }`}
              >
                Q1 (Apr–Jun)
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('q2')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodType === 'q2'
                    ? 'bg-[#1D1D1F] text-white shadow-xs'
                    : 'bg-white text-[#1D1D1F] border border-[#E5E5E7] hover:bg-[#F5F5F7]'
                }`}
              >
                Q2 (Jul–Sep)
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('q3')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodType === 'q3'
                    ? 'bg-[#1D1D1F] text-white shadow-xs'
                    : 'bg-white text-[#1D1D1F] border border-[#E5E5E7] hover:bg-[#F5F5F7]'
                }`}
              >
                Q3 (Oct–Dec)
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('q4')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodType === 'q4'
                    ? 'bg-[#1D1D1F] text-white shadow-xs'
                    : 'bg-white text-[#1D1D1F] border border-[#E5E5E7] hover:bg-[#F5F5F7]'
                }`}
              >
                Q4 (Jan–Mar)
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('fy')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodType === 'fy'
                    ? 'bg-[#1D1D1F] text-white shadow-xs'
                    : 'bg-white text-[#1D1D1F] border border-[#E5E5E7] hover:bg-[#F5F5F7]'
                }`}
              >
                Full Year
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('custom')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodType === 'custom'
                    ? 'bg-[#1D1D1F] text-white shadow-xs'
                    : 'bg-white text-[#1D1D1F] border border-[#E5E5E7] hover:bg-[#F5F5F7]'
                }`}
              >
                Custom
              </button>
            </div>

            {periodType === 'custom' && (
              <div className="flex items-center gap-2 pt-2 border-t border-[#E5E5E7]">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="h-8 px-2.5 rounded-xl border border-[#E5E5E7] text-xs bg-white text-[#1D1D1F]"
                />
                <span className="text-xs text-[#86868B]">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="h-8 px-2.5 rounded-xl border border-[#E5E5E7] text-xs bg-white text-[#1D1D1F]"
                />
              </div>
            )}
          </div>

          {/* SCHEME-SPECIFIC SUMMARY CARD */}
          {activeScheme === 'regular' ? (
            /* REGULAR GST DEALER (GSTR-1 & GSTR-3B) */
            <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] space-y-3">
              <div className="flex items-center justify-between border-b border-[#E5E5E7] pb-2">
                <span className="font-extrabold text-xs text-[#1D1D1F] tracking-wide">
                  GSTR-3B Table 3.1 &bull; {periodLabel}
                </span>
                {config?.gstin && (
                  <span className="text-[11px] font-mono font-bold text-[#1D1D1F]">
                    GSTIN: {config.gstin}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 3.1(a) Taxable Value */}
                <div className="p-3 rounded-xl bg-white border border-[#E5E5E7]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-extrabold text-[#86868B]">
                      3.1(a) Taxable Value
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(stats.regTaxable), 'reg_taxable')}
                      className="text-[10px] font-bold text-[#1D1D1F] hover:bg-[#E5E5E7] flex items-center gap-1 bg-[#F5F5F7] px-1.5 py-0.5 rounded-md border border-[#E5E5E7] cursor-pointer"
                      title="Copy taxable value"
                    >
                      {copiedField === 'reg_taxable' ? (
                        <>
                          <Check className="w-3 h-3 text-[#1D1D1F]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#86868B]" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-lg font-black text-[#1D1D1F] mt-1 tabular-nums">
                    ₹{stats.regTaxable.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-[#86868B] font-medium mt-0.5">
                    Gross Invoiced: ₹{stats.regGross.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* CGST & SGST (2.5% + 2.5%) */}
                <div className="p-3 rounded-xl bg-white border border-[#E5E5E7]">
                  <div className="text-[10px] uppercase font-extrabold text-[#86868B]">
                    GST Breakup (2.5% + 2.5%)
                  </div>
                  <div className="text-xs font-bold text-[#1D1D1F] mt-1.5 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-[#86868B] font-medium">CGST (2.5%):</span>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-[#1D1D1F] tabular-nums font-bold">₹{stats.regCgst.toLocaleString('en-IN')}</strong>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(String(stats.regCgst), 'reg_cgst')}
                          className="text-[9px] text-[#86868B] hover:text-[#1D1D1F] cursor-pointer flex items-center gap-0.5"
                        >
                          {copiedField === 'reg_cgst' ? <Check className="w-3 h-3 text-[#1D1D1F]" /> : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-[#86868B] font-medium">SGST (2.5%):</span>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-[#1D1D1F] tabular-nums font-bold">₹{stats.regSgst.toLocaleString('en-IN')}</strong>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(String(stats.regSgst), 'reg_sgst')}
                          className="text-[9px] text-[#86868B] hover:text-[#1D1D1F] cursor-pointer flex items-center gap-0.5"
                        >
                          {copiedField === 'reg_sgst' ? <Check className="w-3 h-3 text-[#1D1D1F]" /> : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total Output GST Payable */}
                <div className="p-3 rounded-xl bg-white border border-[#E5E5E7]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-extrabold text-[#1D1D1F]">
                      Total GST Liability (5%)
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(stats.regTotalTax), 'reg_totaltax')}
                      className="text-[10px] font-bold text-[#1D1D1F] hover:bg-[#E5E5E7] flex items-center gap-1 bg-[#F5F5F7] px-1.5 py-0.5 rounded-md border border-[#E5E5E7] cursor-pointer"
                      title="Copy total tax"
                    >
                      {copiedField === 'reg_totaltax' ? (
                        <>
                          <Check className="w-3 h-3 text-[#1D1D1F]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#86868B]" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-lg font-black text-[#1D1D1F] mt-1 tabular-nums">
                    ₹{stats.regTotalTax.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-[#86868B] font-medium mt-0.5">
                    Payable via Cash / ITC Ledger
                  </div>
                </div>
              </div>

              {/* GSTR-1 Table 4 (B2B) vs Table 7 (B2C) Split */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                <div className="p-3 rounded-xl bg-white border border-[#E5E5E7] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#F5F5F7] flex items-center justify-center text-[#1D1D1F] shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] font-extrabold uppercase text-[#86868B]">
                        GSTR-1 Table 4: B2B Invoices
                      </div>
                      <div className="text-sm font-black text-[#1D1D1F] tabular-nums">
                        ₹{stats.b2bGross.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-[#86868B]">
                    <span className="font-bold text-[#1D1D1F]">{stats.b2bCount}</span> inv · Tax: ₹{stats.regB2bTax.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#E5E5E7] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#F5F5F7] flex items-center justify-center text-[#1D1D1F] shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] font-extrabold uppercase text-[#86868B]">
                        GSTR-1 Table 7: B2C Small
                      </div>
                      <div className="text-sm font-black text-[#1D1D1F] tabular-nums">
                        ₹{stats.b2cGross.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-[#86868B]">
                    <span className="font-bold text-[#1D1D1F]">{stats.b2cCount}</span> inv · Tax: ₹{stats.regB2cTax.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          ) : activeScheme === 'none' ? (
            /* UNREGISTERED / NON-GST DEALER */
            <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] space-y-3">
              <div className="flex items-center justify-between border-b border-[#E5E5E7] pb-2">
                <span className="font-extrabold text-xs text-[#1D1D1F] tracking-wide">
                  Periodic Turnover &bull; {periodLabel}
                </span>
                <span className="text-[10px] font-bold text-[#1D1D1F] bg-white px-2 py-0.5 rounded-md border border-[#E5E5E7]">
                  0% GST (Unregistered)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Total Gross Sales */}
                <div className="p-3 rounded-xl bg-white border border-[#E5E5E7]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-extrabold text-[#86868B]">
                      Gross Net Turnover
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(stats.grossSales), 'none_turnover')}
                      className="text-[10px] font-bold text-[#1D1D1F] hover:bg-[#E5E5E7] flex items-center gap-1 bg-[#F5F5F7] px-1.5 py-0.5 rounded-md border border-[#E5E5E7] cursor-pointer"
                    >
                      {copiedField === 'none_turnover' ? <Check className="w-3 h-3 text-[#1D1D1F]" /> : <Copy className="w-3 h-3 text-[#86868B]" />}
                    </button>
                  </div>
                  <div className="text-lg font-black text-[#1D1D1F] mt-1 tabular-nums">
                    ₹{stats.grossSales.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-[#86868B] font-medium mt-0.5">
                    {stats.totalBillsCount} retail bill{stats.totalBillsCount !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Collection Split */}
                <div className="p-3 rounded-xl bg-white border border-[#E5E5E7]">
                  <div className="text-[10px] uppercase font-extrabold text-[#86868B]">
                    Payment Mode Breakdown
                  </div>
                  <div className="text-xs font-bold text-[#1D1D1F] mt-1.5 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-[#86868B] font-medium">Digital (UPI/Card):</span>
                      <strong className="text-[#1D1D1F] tabular-nums font-bold">₹{stats.digitalSales.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-[#86868B] font-medium">Counter Cash:</span>
                      <strong className="text-[#1D1D1F] tabular-nums font-bold">₹{stats.cashSales.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>

                {/* Section 44AD Presumptive Income Estimate */}
                <div className="p-3 rounded-xl bg-white border border-[#E5E5E7]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-extrabold text-[#1D1D1F]">
                      Sec 44AD Presumptive Net
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(stats.sec44adProfit), 'none_44ad')}
                      className="text-[10px] font-bold text-[#1D1D1F] hover:bg-[#E5E5E7] flex items-center gap-1 bg-[#F5F5F7] px-1.5 py-0.5 rounded-md border border-[#E5E5E7] cursor-pointer"
                    >
                      {copiedField === 'none_44ad' ? <Check className="w-3 h-3 text-[#1D1D1F]" /> : <Copy className="w-3 h-3 text-[#86868B]" />}
                    </button>
                  </div>
                  <div className="text-lg font-black text-[#1D1D1F] mt-1 tabular-nums">
                    ₹{stats.sec44adProfit.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-[#86868B] font-medium mt-0.5">
                    Est. 6% Digital + 8% Cash Profit
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* COMPOSITION SCHEME (FORM CMP-08) */
            <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] space-y-3">
              <div className="flex items-center justify-between border-b border-[#E5E5E7] pb-2">
                <span className="font-extrabold text-xs text-[#1D1D1F] tracking-wide">
                  CMP-08 Summary &bull; {periodLabel}
                </span>
                {config?.gstin && (
                  <span className="text-[11px] font-mono font-bold text-[#1D1D1F]">
                    GSTIN: {config.gstin}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Turnover */}
                <div className="p-3 rounded-xl bg-white border border-[#E5E5E7]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-extrabold text-[#86868B]">
                      3(a) Outward Supplies
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(stats.compTurnover), 'turnover')}
                      className="text-[10px] font-bold text-[#1D1D1F] hover:bg-[#E5E5E7] flex items-center gap-1 bg-[#F5F5F7] px-1.5 py-0.5 rounded-md border border-[#E5E5E7] cursor-pointer"
                      title="Copy turnover"
                    >
                      {copiedField === 'turnover' ? (
                        <>
                          <Check className="w-3 h-3 text-[#1D1D1F]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#86868B]" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-lg font-black text-[#1D1D1F] mt-1 tabular-nums">
                    ₹{stats.compTurnover.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-[#86868B] font-medium mt-0.5">
                    {stats.totalBillsCount} bill{stats.totalBillsCount !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Tax Breakup */}
                <div className="p-3 rounded-xl bg-white border border-[#E5E5E7]">
                  <div className="text-[10px] uppercase font-extrabold text-[#86868B]">
                    Breakup (0.5% + 0.5%)
                  </div>
                  <div className="text-xs font-bold text-[#1D1D1F] mt-1.5 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-[#86868B] font-medium">CGST (0.5%):</span>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-[#1D1D1F] tabular-nums font-bold">₹{stats.compCgst.toLocaleString('en-IN')}</strong>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(String(stats.compCgst), 'cgst')}
                          className="text-[9px] text-[#86868B] hover:text-[#1D1D1F] cursor-pointer flex items-center gap-0.5"
                        >
                          {copiedField === 'cgst' ? <Check className="w-3 h-3 text-[#1D1D1F]" /> : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-[#86868B] font-medium">SGST (0.5%):</span>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-[#1D1D1F] tabular-nums font-bold">₹{stats.compSgst.toLocaleString('en-IN')}</strong>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(String(stats.compSgst), 'sgst')}
                          className="text-[9px] text-[#86868B] hover:text-[#1D1D1F] cursor-pointer flex items-center gap-0.5"
                        >
                          {copiedField === 'sgst' ? <Check className="w-3 h-3 text-[#1D1D1F]" /> : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total GST Payable */}
                <div className="p-3 rounded-xl bg-white border border-[#E5E5E7]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-extrabold text-[#1D1D1F]">
                      3(c) Tax Payable (1%)
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(stats.compTotalTax), 'totaltax')}
                      className="text-[10px] font-bold text-[#1D1D1F] hover:bg-[#E5E5E7] flex items-center gap-1 bg-[#F5F5F7] px-1.5 py-0.5 rounded-md border border-[#E5E5E7] cursor-pointer"
                      title="Copy tax"
                    >
                      {copiedField === 'totaltax' ? (
                        <>
                          <Check className="w-3 h-3 text-[#1D1D1F]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#86868B]" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-lg font-black text-[#1D1D1F] mt-1 tabular-nums">
                    ₹{stats.compTotalTax.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-[#86868B] font-medium mt-0.5">
                    Deposit via Challan
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Breakdown Table */}
          <div className="bg-white rounded-xl border border-[#E5E5E7] overflow-hidden shadow-2xs">
            <div className="px-3.5 py-2.5 bg-[#F5F5F7] border-b border-[#E5E5E7] font-bold text-xs text-[#1D1D1F] flex items-center justify-between">
              <span>
                {activeScheme === 'regular'
                  ? 'Monthly Tax Invoice & GST Breakdown'
                  : activeScheme === 'none'
                  ? 'Monthly Retail Collection Breakdown'
                  : 'Monthly Turnover Breakdown (CMP-08)'}
              </span>
              <span className="text-[11px] font-bold text-[#86868B]">{stats.monthlyBreakdown.length} active month(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#F5F5F7] text-[#86868B] font-bold border-b border-[#E5E5E7]">
                  {activeScheme === 'regular' ? (
                    <tr>
                      <th className="py-2 px-3.5">Month</th>
                      <th className="py-2 px-3 text-center">Bills</th>
                      <th className="py-2 px-3 text-right">Taxable Value</th>
                      <th className="py-2 px-3 text-right">CGST (2.5%)</th>
                      <th className="py-2 px-3 text-right">SGST (2.5%)</th>
                      <th className="py-2 px-3 text-right">Total GST (5%)</th>
                      <th className="py-2 px-3.5 text-right">Invoice Total</th>
                    </tr>
                  ) : activeScheme === 'none' ? (
                    <tr>
                      <th className="py-2 px-3.5">Month</th>
                      <th className="py-2 px-3 text-center">Bills</th>
                      <th className="py-2 px-3 text-right">Counter Cash</th>
                      <th className="py-2 px-3 text-right">UPI / Digital</th>
                      <th className="py-2 px-3.5 text-right">Total Net Sales</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="py-2 px-3.5">Month</th>
                      <th className="py-2 px-3.5 text-center">Bills</th>
                      <th className="py-2 px-3.5 text-right">Turnover</th>
                      <th className="py-2 px-3.5 text-right">CGST (0.5%)</th>
                      <th className="py-2 px-3.5 text-right">SGST (0.5%)</th>
                      <th className="py-2 px-3.5 text-right">Total (1%)</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-[#E5E5E7]">
                  {stats.monthlyBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-[#86868B] font-medium">
                        No invoices in this period.
                      </td>
                    </tr>
                  ) : activeScheme === 'regular' ? (
                    stats.monthlyBreakdown.map(m => {
                      const halfTax = Math.round(m.regTax / 2);
                      return (
                        <tr key={m.monthName} className="hover:bg-[#F5F5F7]">
                          <td className="py-2 px-3.5 font-bold text-[#1D1D1F]">{m.monthName}</td>
                          <td className="py-2 px-3 text-center text-[#86868B] font-bold">{m.billsCount}</td>
                          <td className="py-2 px-3 text-right font-bold text-[#1D1D1F] tabular-nums">
                            ₹{m.regTaxable.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-3 text-right text-[#86868B] font-medium tabular-nums">₹{halfTax.toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3 text-right text-[#86868B] font-medium tabular-nums">₹{halfTax.toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3 text-right font-bold text-[#1D1D1F] tabular-nums">
                            ₹{m.regTax.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-3.5 text-right font-black text-[#1D1D1F] tabular-nums">
                            ₹{m.gross.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })
                  ) : activeScheme === 'none' ? (
                    stats.monthlyBreakdown.map(m => (
                      <tr key={m.monthName} className="hover:bg-[#F5F5F7]">
                        <td className="py-2 px-3.5 font-bold text-[#1D1D1F]">{m.monthName}</td>
                        <td className="py-2 px-3 text-center text-[#86868B] font-bold">{m.billsCount}</td>
                        <td className="py-2 px-3 text-right text-[#86868B] font-medium tabular-nums">₹{m.cashAmount.toLocaleString('en-IN')}</td>
                        <td className="py-2 px-3 text-right text-[#86868B] font-medium tabular-nums">₹{m.digitalAmount.toLocaleString('en-IN')}</td>
                        <td className="py-2 px-3.5 text-right font-black text-[#1D1D1F] tabular-nums">
                          ₹{m.gross.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    stats.monthlyBreakdown.map(m => {
                      const halfTax = Math.round(m.gross * 0.005);
                      return (
                        <tr key={m.monthName} className="hover:bg-[#F5F5F7]">
                          <td className="py-2 px-3.5 font-bold text-[#1D1D1F]">{m.monthName}</td>
                          <td className="py-2 px-3.5 text-center text-[#86868B] font-bold">{m.billsCount}</td>
                          <td className="py-2 px-3.5 text-right font-bold text-[#1D1D1F] tabular-nums">
                            ₹{m.gross.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-3.5 text-right text-[#86868B] font-medium tabular-nums">₹{halfTax.toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3.5 text-right text-[#86868B] font-medium tabular-nums">₹{halfTax.toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3.5 text-right font-black text-[#1D1D1F] tabular-nums">
                            ₹{m.compTax.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#E5E5E7] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] text-[#86868B]">
            {activeScheme === 'regular'
              ? 'Format compliant with GST Portal Form GSTR-1 & GSTR-3B.'
              : activeScheme === 'none'
              ? 'Non-GST retail sales statement for accounting & Section 44AD filing.'
              : 'Format compliant with GST Portal Form CMP-08 quarterly statement & GSTR-4.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-xs font-bold text-[#1D1D1F] cursor-pointer transition-colors self-end sm:self-auto"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
