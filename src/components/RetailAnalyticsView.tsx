import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Download,
  Package,
  AlertTriangle,
  Users,
  ShoppingBag,
  Layers,
} from 'lucide-react';
import { db } from '../db/db';
import {
  type Bill,
  type Product,
  type ProductVariant,
  type Category,
  type ShopConfig,
  type PaymentMethod,
} from '../types';
import { formatMoney, getCurrencyCode, getPaymentMethodLabel } from '../lib/locale';

type PeriodKey = 'today' | '7d' | '30d' | 'all';

interface RetailAnalyticsViewProps {
  onNavigateToRegister?: () => void;
}

export const RetailAnalyticsView: React.FC<RetailAnalyticsViewProps> = ({
  onNavigateToRegister,
}) => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [bList, pList, vList, cList, cfgList] = await Promise.all([
          db.bills.toArray(),
          db.products.toArray(),
          db.variants.toArray(),
          db.categories.toArray(),
          db.shop_config.toArray(),
        ]);
        setBills(bList.filter(b => b.status !== 'voided'));
        setProducts(pList);
        setVariants(vList);
        setCategories(cList.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
        if (cfgList.length > 0) setShopConfig(cfgList[0]);
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach(p => m.set(p.id, p));
    return m;
  }, [products]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach(c => m.set(c.id.toLowerCase(), c.name));
    return m;
  }, [categories]);

  const periodCutoff = useMemo(() => {
    const now = new Date();
    if (period === 'today') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }
    if (period === '7d') {
      return now.getTime() - 7 * 24 * 60 * 60 * 1000;
    }
    if (period === '30d') {
      return now.getTime() - 30 * 24 * 60 * 60 * 1000;
    }
    return 0;
  }, [period]);

  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const ts = new Date(b.created_at).getTime();
      if (periodCutoff > 0 && ts < periodCutoff) return false;
      if (selectedCategory !== 'all') {
        return b.items.some(item => {
          const prod = productMap.get(item.product_id);
          return prod?.category?.toLowerCase() === selectedCategory.toLowerCase();
        });
      }
      return true;
    });
  }, [bills, periodCutoff, selectedCategory, productMap]);

  // Core KPI & COGS Calculations
  const analytics = useMemo(() => {
    let grossRevenue = 0;
    let totalTax = 0;
    let totalDiscounts = 0;
    let totalCogs = 0;
    let totalUnits = 0;
    let costKnownUnits = 0;

    const categoryStats = new Map<
      string,
      { id: string; name: string; revenue: number; cogs: number; units: number }
    >();
    const variantSales = new Map<
      string,
      {
        key: string;
        productName: string;
        variantLabel: string;
        sku: string;
        units: number;
        revenue: number;
        cogs: number;
      }
    >();
    const staffStats = new Map<
      string,
      { name: string; bills: number; revenue: number; units: number }
    >();
    const paymentMix = new Map<string, number>();
    const dailyMap = new Map<string, { label: string; revenue: number; profit: number; bills: number }>();

    for (const bill of filteredBills) {
      const refundedAmt = bill.refunded_amount || 0;
      const netBillTotal = Math.max(0, (bill.total || 0) - refundedAmt);
      const returnRecords = bill.return_records || [];

      // Map returned qty & refund per bill_item_id
      const returnedQtyByItem = new Map<string, number>();
      const returnedRevByItem = new Map<string, number>();
      for (const rec of returnRecords) {
        for (const ri of rec.items) {
          returnedQtyByItem.set(ri.bill_item_id, (returnedQtyByItem.get(ri.bill_item_id) || 0) + ri.qty);
          returnedRevByItem.set(ri.bill_item_id, (returnedRevByItem.get(ri.bill_item_id) || 0) + ri.refund_amount);
        }
      }

      grossRevenue += netBillTotal;
      const taxRatio = (bill.total || 0) > 0 ? netBillTotal / (bill.total || 1) : 1;
      const netBillTax = (bill.tax_amount || 0) * taxRatio;
      totalTax += netBillTax;
      totalDiscounts += bill.discount_amount || 0;

      // Tender breakdown (net of store credit used when single tender, and deduct refund outflows)
      if (bill.payment_method === 'split' && bill.payment_details) {
        for (const [k, v] of Object.entries(bill.payment_details)) {
          if (v && v > 0) {
            paymentMix.set(k, (paymentMix.get(k) || 0) + v);
          }
        }
      } else {
        const pm = bill.payment_method || 'cash';
        const netTendered = Math.max(0, (bill.total || 0) - (bill.store_credit_used || 0));
        paymentMix.set(pm, (paymentMix.get(pm) || 0) + netTendered);
      }
      if (bill.store_credit_used && bill.store_credit_used > 0) {
        paymentMix.set('store_credit', (paymentMix.get('store_credit') || 0) + bill.store_credit_used);
      }
      for (const rec of returnRecords) {
        const rMethod = rec.refund_method === 'store_credit' ? 'store_credit' : rec.refund_method;
        paymentMix.set(rMethod, Math.max(0, (paymentMix.get(rMethod) || 0) - rec.refund_amount));
      }

      // Staff breakdown
      const staffName = bill.billed_by_name || 'Counter Staff';
      const prevStaff = staffStats.get(staffName) || { name: staffName, bills: 0, revenue: 0, units: 0 };
      prevStaff.bills += 1;
      prevStaff.revenue += netBillTotal;

      let billCogs = 0;
      let billUnits = 0;

      // Distribute bill discount proportionally when computing net item revenue
      const billItemSubTotal = bill.items.reduce((s, it) => s + (it.subtotal || 0), 0) || 1;
      const discountRatio = bill.discount_amount > 0 ? Math.max(0, 1 - bill.discount_amount / billItemSubTotal) : 1;

      for (const item of bill.items) {
        const prod = productMap.get(item.product_id);
        const catId = (prod?.category || 'general').toLowerCase();
        if (selectedCategory !== 'all' && catId !== selectedCategory.toLowerCase()) {
          continue;
        }

        const catName = categoryMap.get(catId) || prod?.category || 'General';
        const retQty = returnedQtyByItem.get(item.id) || 0;
        const netQty = Math.max(0, (item.qty || 1) - retQty);
        const grossItemRev = (item.subtotal || item.unit_price * (item.qty || 1)) * discountRatio;
        const netItemRev = Math.max(0, grossItemRev - (returnedRevByItem.get(item.id) || 0));
        const itemCostPerUnit =
          typeof item.unit_cost === 'number'
            ? item.unit_cost
            : typeof prod?.cost_price === 'number'
            ? prod.cost_price
            : 0;

        if (typeof item.unit_cost === 'number' || (prod && typeof prod.cost_price === 'number' && prod.cost_price > 0)) {
          costKnownUnits += netQty;
        }

        const itemCogs = itemCostPerUnit * netQty;
        billCogs += itemCogs;
        billUnits += netQty;
        totalCogs += itemCogs;
        totalUnits += netQty;

        const cEntry = categoryStats.get(catId) || {
          id: catId,
          name: catName,
          revenue: 0,
          cogs: 0,
          units: 0,
        };
        cEntry.revenue += netItemRev;
        cEntry.cogs += itemCogs;
        cEntry.units += netQty;
        categoryStats.set(catId, cEntry);

        const vKey = item.variant_id || item.product_id;
        const vEntry = variantSales.get(vKey) || {
          key: vKey,
          productName: item.product_name,
          variantLabel: [item.size_label, item.color_label].filter(Boolean).join(' · ') || 'Standard',
          sku: item.sku || '',
          units: 0,
          revenue: 0,
          cogs: 0,
        };
        vEntry.units += netQty;
        vEntry.revenue += netItemRev;
        vEntry.cogs += itemCogs;
        variantSales.set(vKey, vEntry);
      }

      prevStaff.units += billUnits;
      staffStats.set(staffName, prevStaff);

      const dKey = bill.created_at.slice(0, 10);
      const dObj = new Date(bill.created_at);
      const dLabel = dObj.toLocaleDateString(shopConfig?.locale || 'en-IN', {
        month: 'short',
        day: 'numeric',
      });
      const prevDay = dailyMap.get(dKey) || { label: dLabel, revenue: 0, profit: 0, bills: 0 };
      prevDay.revenue += netBillTotal;
      prevDay.profit += netBillTotal - netBillTax - billCogs;
      prevDay.bills += 1;
      dailyMap.set(dKey, prevDay);
    }

    const netSalesExTax = Math.max(0, grossRevenue - totalTax);
    const grossProfit = netSalesExTax - totalCogs;
    const marginPct = netSalesExTax > 0 ? (grossProfit / netSalesExTax) * 100 : 0;
    const avgBasket = filteredBills.length > 0 ? grossRevenue / filteredBills.length : 0;
    const costCoveragePct = totalUnits > 0 ? Math.round((costKnownUnits / totalUnits) * 100) : 100;

    const sortedDays = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([dateKey, v]) => ({ dateKey, ...v }));

    const topSellers = Array.from(variantSales.values())
      .filter(v => v.units > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // Dead / Slow-moving Stock: stocked variants with 0 units sold in filtered window
    const soldVariantIds = new Set(variantSales.keys());
    const slowStock = variants
      .filter(v => {
        if (v.stock_qty <= 0) return false;
        const prod = productMap.get(v.product_id);
        if (selectedCategory !== 'all' && prod?.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
        return !soldVariantIds.has(v.id) && !soldVariantIds.has(v.product_id);
      })
      .map(v => {
        const prod = productMap.get(v.product_id);
        const unitCost = prod?.cost_price ?? 0;
        return {
          id: v.id,
          productName: prod?.name || 'Item',
          variantLabel: `${v.size_label} · ${v.color_label}`,
          sku: v.sku,
          stockQty: v.stock_qty,
          retailValue: v.stock_qty * v.price,
          costValue: v.stock_qty * unitCost,
        };
      })
      .sort((a, b) => b.retailValue - a.retailValue)
      .slice(0, 8);

    return {
      grossRevenue,
      netSalesExTax,
      totalTax,
      totalDiscounts,
      totalCogs,
      grossProfit,
      marginPct,
      avgBasket,
      totalUnits,
      costCoveragePct,
      categories: Array.from(categoryStats.values()).sort((a, b) => b.revenue - a.revenue),
      topSellers,
      slowStock,
      staff: Array.from(staffStats.values()).sort((a, b) => b.revenue - a.revenue),
      paymentMix: Array.from(paymentMix.entries()).sort((a, b) => b[1] - a[1]),
      dailyTrend: sortedDays,
    };
  }, [filteredBills, productMap, categoryMap, variants, selectedCategory, shopConfig]);

  const maxDayRev = useMemo(
    () => Math.max(1, ...analytics.dailyTrend.map(d => d.revenue)),
    [analytics.dailyTrend]
  );

  const handleExportCsv = () => {
    const code = getCurrencyCode(shopConfig);
    const headers = ['Metric / Item', 'Category / Details', 'Units', `Value (${code})`, 'Margin / Note'];
    const rows: (string | number)[][] = [
      ['Gross Revenue', period, analytics.totalUnits, analytics.grossRevenue.toFixed(2), `${filteredBills.length} invoices`],
      ['Net Sales (Ex-Tax)', period, analytics.totalUnits, analytics.netSalesExTax.toFixed(2), `Tax: ${analytics.totalTax.toFixed(2)}`],
      ['Estimated COGS', period, analytics.totalUnits, analytics.totalCogs.toFixed(2), `${analytics.costCoveragePct}% cost coverage`],
      ['Gross Profit', period, analytics.totalUnits, analytics.grossProfit.toFixed(2), `${analytics.marginPct.toFixed(1)}% margin`],
      [],
      ['--- Top Selling Variants ---', '', '', '', ''],
      ...analytics.topSellers.map(t => [
        t.productName,
        t.variantLabel,
        t.units,
        t.revenue.toFixed(2),
        t.revenue > 0 ? `${(((t.revenue - t.cogs) / t.revenue) * 100).toFixed(1)}% margin` : '0%',
      ]),
    ];

    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SikkaDesk_Analytics_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700 w-fit">
          {(
            [
              { id: 'today', label: 'Today' },
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: 'all', label: 'All Time' },
            ] as const
          ).map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                period === p.id
                  ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium text-zinc-900 dark:text-zinc-100"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredBills.length === 0}
            className="h-9 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {filteredBills.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-3">
          <TrendingUp className="w-8 h-8 text-zinc-400 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            No completed sales in this window
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            Complete checkouts in the Register or expand the date range to analyze profit margins, top variants, and stock velocity.
          </p>
          {onNavigateToRegister && (
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
            >
              Open Register
            </button>
          )}
        </div>
      ) : (
        <>
          {/* 4-Card KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-1">
              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Gross Revenue
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50">
                {formatMoney(analytics.grossRevenue, shopConfig)}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                {filteredBills.length} invoices · {analytics.totalUnits} units
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-1">
              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Gross Profit
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatMoney(analytics.grossProfit, shopConfig)}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                {analytics.marginPct.toFixed(1)}% margin · COGS {formatMoney(analytics.totalCogs, shopConfig)}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-1">
              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Average Basket
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50">
                {formatMoney(analytics.avgBasket, shopConfig)}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                Discounts given: {formatMoney(analytics.totalDiscounts, shopConfig)}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-1">
              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Net Sales &amp; Tax
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50">
                {formatMoney(analytics.netSalesExTax, shopConfig)}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                {shopConfig?.tax_label || 'Tax'} collected: {formatMoney(analytics.totalTax, shopConfig)}
              </div>
            </div>
          </div>

          {analytics.costCoveragePct < 100 && (
            <div className="px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Cost price is recorded on <strong>{analytics.costCoveragePct}%</strong> of sold units. Add unit cost in Catalog to make gross margin tracking 100% exact.
              </span>
            </div>
          )}

          {/* Daily Trend + Payment & Staff Mix */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Daily Revenue vs Profit Chart */}
            <div className="lg:col-span-8 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                    Daily Revenue &amp; Profit Trend
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Last {analytics.dailyTrend.length} active trading day(s)
                  </p>
                </div>
                {hoveredDayIdx !== null && analytics.dailyTrend[hoveredDayIdx] && (
                  <div className="text-right text-xs font-mono tabular-nums">
                    <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                      {analytics.dailyTrend[hoveredDayIdx].label}:{' '}
                      {formatMoney(analytics.dailyTrend[hoveredDayIdx].revenue, shopConfig)}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 block text-[11px]">
                      Profit {formatMoney(analytics.dailyTrend[hoveredDayIdx].profit, shopConfig)} (
                      {analytics.dailyTrend[hoveredDayIdx].bills} bills)
                    </span>
                  </div>
                )}
              </div>

              <div className="h-48 flex items-end gap-2 pt-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                {analytics.dailyTrend.map((day, idx) => {
                  const revHeightPct = Math.max(8, Math.round((day.revenue / maxDayRev) * 100));
                  const profitHeightPct =
                    day.revenue > 0
                      ? Math.max(4, Math.round((Math.max(0, day.profit) / maxDayRev) * 100))
                      : 0;
                  return (
                    <div
                      key={day.dateKey}
                      onMouseEnter={() => setHoveredDayIdx(idx)}
                      onMouseLeave={() => setHoveredDayIdx(null)}
                      className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer"
                    >
                      <div className="w-full max-w-[36px] h-full flex items-end justify-center gap-0.5">
                        <div
                          style={{ height: `${revHeightPct}%` }}
                          className="w-1/2 rounded-t bg-zinc-900 dark:bg-zinc-100 group-hover:opacity-80 transition-opacity"
                          title={`Revenue: ${formatMoney(day.revenue, shopConfig)}`}
                        />
                        <div
                          style={{ height: `${profitHeightPct}%` }}
                          className="w-1/2 rounded-t bg-emerald-600 dark:bg-emerald-500 group-hover:opacity-80 transition-opacity"
                          title={`Profit: ${formatMoney(day.profit, shopConfig)}`}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-full">
                        {day.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-zinc-900 dark:bg-zinc-100 inline-block" />
                  <span>Gross Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 dark:bg-emerald-500 inline-block" />
                  <span>Estimated Gross Profit</span>
                </div>
              </div>
            </div>

            {/* Payment Tenders & Staff Leaderboard */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
                <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                  Tender Breakdown
                </h3>
                <div className="space-y-2.5">
                  {analytics.paymentMix.map(([method, amount]) => {
                    const share =
                      analytics.grossRevenue > 0
                        ? Math.round((amount / analytics.grossRevenue) * 100)
                        : 0;
                    const label =
                      method === 'store_credit'
                        ? 'Store Credit'
                        : getPaymentMethodLabel(method as PaymentMethod, shopConfig);
                    return (
                      <div key={method} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {label}
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-zinc-950 dark:text-zinc-50">
                            {formatMoney(amount, shopConfig)} · {share}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, share)}%` }}
                            className="h-full bg-zinc-900 dark:bg-zinc-100"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-zinc-400" />
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                    Associate Sales
                  </h3>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {analytics.staff.map(st => (
                    <div key={st.name} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-zinc-950 dark:text-zinc-50">{st.name}</div>
                        <div className="text-[11px] text-zinc-500">
                          {st.bills} bills · {st.units} units
                        </div>
                      </div>
                      <span className="font-mono font-bold tabular-nums text-zinc-950 dark:text-zinc-50">
                        {formatMoney(st.revenue, shopConfig)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Category Performance Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                Category Margin Breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                    <th className="py-2.5 px-5 font-medium">Category</th>
                    <th className="py-2.5 px-4 font-medium text-right">Units Sold</th>
                    <th className="py-2.5 px-4 font-medium text-right">Net Revenue</th>
                    <th className="py-2.5 px-4 font-medium text-right">Est. COGS</th>
                    <th className="py-2.5 px-4 font-medium text-right">Gross Profit</th>
                    <th className="py-2.5 px-5 font-medium text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {analytics.categories.map(cat => {
                    const profit = cat.revenue - cat.cogs;
                    const mPct = cat.revenue > 0 ? (profit / cat.revenue) * 100 : 0;
                    return (
                      <tr key={cat.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-950/60">
                        <td className="py-2.5 px-5 font-semibold text-zinc-950 dark:text-zinc-50">
                          {cat.name}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">{cat.units}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium">
                          {formatMoney(cat.revenue, shopConfig)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-500">
                          {formatMoney(cat.cogs, shopConfig)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatMoney(profit, shopConfig)}
                        </td>
                        <td className="py-2.5 px-5 text-right font-mono tabular-nums">
                          {mPct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Sellers & Slow-Moving Stock */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-zinc-400" />
                <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                  Top-Selling Variants
                </h3>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                {analytics.topSellers.map(item => (
                  <div key={item.key} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-950 dark:text-zinc-50 truncate">
                        {item.productName}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {item.variantLabel}
                        {item.sku ? ` · ${item.sku}` : ''} · {item.units} sold
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold tabular-nums text-zinc-950 dark:text-zinc-50">
                        {formatMoney(item.revenue, shopConfig)}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        +{formatMoney(item.revenue - item.cogs, shopConfig)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-zinc-400" />
                <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                  Zero-Sale Stock Radar
                </h3>
              </div>
              {analytics.slowStock.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 py-6 text-center">
                  All stocked variants recorded sales during this timeframe.
                </p>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {analytics.slowStock.map(item => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-950 dark:text-zinc-50 truncate">
                          {item.productName}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {item.variantLabel} · {item.stockQty} units idle
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
                          {formatMoney(item.retailValue, shopConfig)} retail
                        </div>
                        {item.costValue > 0 && (
                          <div className="text-[11px] font-mono tabular-nums text-zinc-500">
                            {formatMoney(item.costValue, shopConfig)} cost tied up
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
