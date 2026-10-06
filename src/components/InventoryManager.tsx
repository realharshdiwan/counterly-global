import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  AlertTriangle, 
  Plus, 
  Minus, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RotateCcw, 
  History, 
  X, 
  Check,
  Filter,
  Barcode,
  FolderTree
} from 'lucide-react';
import { db } from '../db/db';
import { type Product, type SizeItem, type ProductStock, type InventoryMovement, type Category } from '../types';
import { BarcodeStickerModal } from './BarcodeStickerModal';
import { CategoryManagerModal } from './CategoryManagerModal';

export const InventoryManager: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<SizeItem[]>([]);
  const [stocks, setStocks] = useState<ProductStock[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');

  // Adjust Modal state
  const [adjustingStock, setAdjustingStock] = useState<ProductStock | null>(null);
  const [adjustQty, setAdjustQty] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'purchase' | 'adjustment' | 'return'>('purchase');
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const loadData = async () => {
    try {
      const [prodList, szList, stList, movList, catList] = await Promise.all([
        db.products.toArray(),
        db.sizes.toArray(),
        db.stocks.toArray(),
        db.inventory_movements.reverse().limit(100).toArray(),
        db.categories.toArray(),
      ]);

      setProducts(prodList);
      setSizes(szList);
      setStocks(stList);
      setMovements(movList);
      setCategories(catList.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  // Enriched Stock items with product details
  const enrichedStocks = useMemo(() => {
    return stocks.map(st => {
      const prod = productMap.get(st.product_id);
      return {
        ...st,
        productName: prod ? prod.name : 'Unknown Product',
        category: prod ? prod.category : 'uniform',
        isLow: st.quantity <= (st.min_stock || 10) && st.quantity > 0,
        isOut: st.quantity <= 0,
      };
    });
  }, [stocks, productMap]);

  // Low stock items count
  const lowStockCount = useMemo(() => {
    return enrichedStocks.filter(s => s.isLow || s.isOut).length;
  }, [enrichedStocks]);

  // Filtered Stocks
  const filteredStocks = useMemo(() => {
    return enrichedStocks.filter(s => {
      if (filterLowStockOnly && !s.isLow && !s.isOut) return false;
      if (selectedCategory !== 'all' && s.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.productName.toLowerCase().includes(q) || s.size_label.toLowerCase().includes(q);
      }
      return true;
    });
  }, [enrichedStocks, filterLowStockOnly, selectedCategory, searchQuery]);

  // Quick adjust execution
  const handleApplyAdjustment = async () => {
    if (!adjustingStock) return;
    const qtyChange = parseInt(adjustQty, 10);
    if (isNaN(qtyChange) || qtyChange === 0) {
      showToast('Please enter a valid quantity');
      return;
    }

    try {
      const finalChange = adjustType === 'return' ? -Math.abs(qtyChange) : Math.abs(qtyChange);
      const currentQty = adjustingStock.quantity;
      const newQty = Math.max(0, currentQty + finalChange);

      await db.stocks.update(adjustingStock.id, { quantity: newQty });

      await db.inventory_movements.add({
        id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        product_id: adjustingStock.product_id,
        product_name: adjustingStock.product_id,
        size_label: adjustingStock.size_label,
        type: adjustType,
        qty: finalChange,
        previous_stock: currentQty,
        new_stock: newQty,
        notes: adjustNotes.trim() || `Manual ${adjustType} inward/adjustment`,
        created_at: new Date().toISOString(),
      });

      await loadData();
      setAdjustingStock(null);
      setAdjustQty('');
      setAdjustNotes('');
      showToast(`Stock updated: now ${newQty} units`);
    } catch (err) {
      console.error('Failed stock adjustment:', err);
      showToast('Error updating stock');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1D1D1F] text-white px-5 py-2 rounded-xl shadow-lg border border-[#333336] font-semibold text-xs animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-[#E5E5E7] p-5 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E5E7]">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-[#1D1D1F]" />
              <h1 className="font-bold text-xl text-[#1D1D1F]">Stock &amp; Inventory</h1>
            </div>
            <p className="text-xs text-[#86868B] mt-0.5">
              Live counter stock, automatic sale deductions, and purchase restock entries
            </p>
          </div>

          {/* Sub-tab: Stock Table vs History Log */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsBarcodeModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-semibold hover:bg-[#E8E8ED] transition-all shadow-xs cursor-pointer"
              title="Generate & Print 50x25mm Barcode Stickers"
            >
              <Barcode className="w-3.5 h-3.5 text-[#1D1D1F]" />
              <span>Print Barcodes</span>
            </button>

            <div className="flex items-center gap-1 bg-[#F5F5F7] p-1 rounded-xl border border-[#E5E5E7]">
              <button
                onClick={() => setActiveTab('stock')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'stock'
                    ? 'bg-[#1D1D1F] text-white shadow-xs'
                    : 'text-[#515154] hover:text-[#1D1D1F]'
                }`}
              >
                Current Stock
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-[#1D1D1F] text-white shadow-xs'
                    : 'text-[#515154] hover:text-[#1D1D1F]'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Audit Log</span>
              </button>
            </div>
          </div>
        </div>

        {/* Low Stock Warning Banner */}
        {lowStockCount > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="text-xs font-bold text-amber-900">
                {lowStockCount} items are running low or out of stock.
              </span>
            </div>
            <button
              onClick={() => setFilterLowStockOnly(prev => !prev)}
              className="text-xs font-extrabold text-amber-800 underline hover:text-amber-950 shrink-0"
            >
              {filterLowStockOnly ? 'Show All Items' : 'Filter Low Stock Only'}
            </button>
          </div>
        )}

        {/* Search & Category Filter Row */}
        {activeTab === 'stock' && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all border cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-xs'
                    : 'bg-[#F5F5F7] text-[#515154] border-[#E5E5E7] hover:text-[#1D1D1F]'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all border cursor-pointer ${
                    selectedCategory.toLowerCase() === cat.id.toLowerCase()
                      ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-xs'
                      : 'bg-[#F5F5F7] text-[#515154] border-[#E5E5E7] hover:text-[#1D1D1F]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl border border-dashed border-[#E5E5E7] hover:border-[#1D1D1F] text-[11px] font-semibold text-[#1D1D1F] flex items-center gap-1 transition-all cursor-pointer shadow-xs whitespace-nowrap"
                title="Manage Categories"
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Manage</span>
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search garment or size..."
                className="w-full h-8 pl-8 pr-3 rounded-xl border border-[#E5E5E7] text-xs font-medium focus:outline-none focus:border-[#1D1D1F]"
              />
            </div>
          </div>
        )}
      </div>

      {/* VIEW 1: CURRENT STOCK TABLE */}
      {activeTab === 'stock' && (
        <div className="bg-white rounded-2xl border border-[#E5E5E7] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F5F7] text-[#1D1D1F] font-bold uppercase border-b border-[#E5E5E7]">
                <tr>
                  <th className="py-3 px-4">Item &amp; Uniform</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Stock on Hand</th>
                  <th className="py-3 px-4">Min Alert Threshold</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Quick Restock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E7]">
                {filteredStocks.map(item => (
                  <tr key={item.id} className="hover:bg-[#F5F5F7] transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#1D1D1F]">
                      {item.productName}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#1D1D1F]">
                      {item.size_label}
                    </td>
                    <td className="py-3 px-4 capitalize font-medium text-[#515154]">
                      {item.category}
                    </td>
                    <td className="py-3 px-4 font-bold text-sm text-[#1D1D1F]">
                      {item.quantity} units
                    </td>
                    <td className="py-3 px-4 font-medium text-[#86868B]">
                      {item.min_stock || 10} units
                    </td>
                    <td className="py-3 px-4">
                      {item.isOut ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          Out of Stock
                        </span>
                      ) : item.isLow ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7]">
                          In Stock
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setAdjustingStock(item);
                          setAdjustQty('20');
                          setAdjustType('purchase');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] font-semibold text-xs border border-[#E5E5E7] transition-colors cursor-pointer"
                      >
                        + Restock
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredStocks.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[#86868B]">
                      No items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: AUDIT LOG (MOVEMENTS) */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-[#E5E5E7] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F5F7] text-[#1D1D1F] font-bold uppercase border-b border-[#E5E5E7]">
                <tr>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Product &amp; Size</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4">Change</th>
                  <th className="py-3 px-4">Stock Before / After</th>
                  <th className="py-3 px-4">Reference Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E7]">
                {movements.map(mov => {
                  const isPositive = mov.qty > 0;
                  const dateStr = new Date(mov.created_at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={mov.id} className="hover:bg-[#F5F5F7] transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#86868B]">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1D1D1F]">
                        {mov.product_name} <span className="text-[#515154]">({mov.size_label})</span>
                      </td>
                      <td className="py-3 px-4 capitalize font-semibold">
                        <span className={`inline-flex items-center gap-1 ${
                          mov.type === 'sale'
                            ? 'text-purple-700'
                            : mov.type === 'purchase'
                            ? 'text-[#1D1D1F] font-bold'
                            : 'text-[#515154]'
                        }`}>
                          {mov.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={isPositive ? 'text-[#1D1D1F]' : 'text-red-600'}>
                          {isPositive ? `+${mov.qty}` : mov.qty} pcs
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#86868B]">
                        {mov.previous_stock} → <strong className="text-[#1D1D1F]">{mov.new_stock}</strong>
                      </td>
                      <td className="py-3 px-4 text-[#86868B]">
                        {mov.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[#86868B]">
                      No movement history yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QUICK RESTOCK / ADJUSTMENT MODAL */}
      {adjustingStock && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-[#E5E5E7] animate-in fade-in-50">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E7] mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#1D1D1F]" />
                <h3 className="font-bold text-base text-[#1D1D1F]">
                  Restock Item
                </h3>
              </div>
              <button
                onClick={() => setAdjustingStock(null)}
                className="text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
                <div className="font-bold text-xs text-[#1D1D1F]">
                  {productMap.get(adjustingStock.product_id)?.name}
                </div>
                <div className="text-xs text-[#515154] font-medium mt-0.5">
                  Size: <strong>{adjustingStock.size_label}</strong> · Current: <strong>{adjustingStock.quantity} units</strong>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[#515154] block mb-1">
                  Movement Type
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['purchase', 'adjustment', 'return'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setAdjustType(t)}
                      className={`py-1.5 rounded-lg text-xs font-semibold capitalize border transition-colors cursor-pointer ${
                        adjustType === t
                          ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                          : 'bg-[#F5F5F7] text-[#515154] border-[#E5E5E7]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[#515154] block mb-1">
                  Quantity ({adjustType === 'return' ? 'Deduct' : 'Add'})
                </label>
                <input
                  type="number"
                  min="1"
                  value={adjustQty}
                  onChange={e => setAdjustQty(e.target.value)}
                  placeholder="20"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-semibold focus:outline-none focus:border-[#1D1D1F]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#515154] block mb-1">
                  Supplier / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={e => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Shanti Garments Inward #441"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-medium focus:outline-none focus:border-[#1D1D1F]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setAdjustingStock(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#86868B] hover:bg-[#F5F5F7] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyAdjustment}
                  className="flex-1 py-2.5 rounded-xl bg-[#1D1D1F] text-white text-xs font-semibold hover:bg-[#333336] shadow-xs cursor-pointer"
                >
                  Confirm Restock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode & Price Tag Sticker Generator Modal */}
      <BarcodeStickerModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        products={products}
        sizes={sizes}
      />

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesChanged={loadData}
      />
    </div>
  );
};
