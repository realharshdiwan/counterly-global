import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Package,
  Search,
  Plus,
  Edit3,
  Check,
  X,
  AlertTriangle,
  Barcode,
  Upload,
  FolderTree,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
} from 'lucide-react';
import { db } from '../db/db';
import { formatDateShort, formatMoney, formatTimeShort } from '../lib/locale';
import {
  type Product,
  type ProductVariant,
  type Category,
  type InventoryMovement,
  type ShopConfig,
} from '../types';
import { AddProductModal } from './AddProductModal';
import { CategoryManagerModal } from './CategoryManagerModal';
import { CsvRateUploadModal } from './CsvRateUploadModal';
import { BarcodeStickerModal } from './BarcodeStickerModal';
import { SchoolsManager } from './SchoolsManager';

export const CatalogManager: React.FC<{ onNavigateToRegister?: () => void }> = ({
  onNavigateToRegister,
}) => {
  const [subTab, setSubTab] = useState<'items' | 'stock' | 'audit' | 'accounts'>('items');
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Modals
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeProductId, setBarcodeProductId] = useState<string | undefined>(undefined);

  // Inline Variant Edit State
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editPriceVal, setEditPriceVal] = useState('');
  const [editCostVal, setEditCostVal] = useState('');
  const [editTaxVal, setEditTaxVal] = useState('');
  const [editStockVal, setEditStockVal] = useState('');

  // Quick Restock Modal
  const [adjustingVariant, setAdjustingVariant] = useState<(ProductVariant & { productName: string }) | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState<'purchase' | 'adjustment' | 'return'>('purchase');
  const [adjustNotes, setAdjustNotes] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  };

  const loadData = async () => {
    try {
      const [prodList, varList, catList, movList, cfgs] = await Promise.all([
        db.products.toArray(),
        db.variants.toArray(),
        db.categories.toArray(),
        db.inventory_movements.reverse().limit(100).toArray(),
        db.shop_config.toArray(),
      ]);

      setProducts(prodList);
      setVariants(varList);
      setCategories(catList.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      setMovements(movList);
      if (cfgs.length > 0) setShopConfig(cfgs[0]);
    } catch (err) {
      console.error('Failed to load catalog:', err);
    }
  };

  useEffect(() => {
    loadData();
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

  const enrichedVariants = useMemo(() => {
    return variants.map(v => {
      const prod = productMap.get(v.product_id);
      const minThreshold = v.low_stock_threshold || prod?.low_stock_threshold || 5;
      const resolvedCost =
        typeof v.cost_price === 'number'
          ? v.cost_price
          : typeof prod?.cost_price === 'number'
          ? prod.cost_price
          : undefined;
      const resolvedTax =
        typeof v.tax_rate === 'number'
          ? v.tax_rate
          : typeof prod?.tax_rate === 'number'
          ? prod.tax_rate
          : undefined;
      return {
        ...v,
        productName: prod?.name || 'Unknown Product',
        category: prod?.category || 'tops',
        categoryName: categoryMap.get((prod?.category || '').toLowerCase()) || prod?.category || 'General',
        brand: prod?.brand || '',
        resolvedCost,
        resolvedTax,
        isLow: v.stock_qty > 0 && v.stock_qty <= minThreshold,
        isOut: v.stock_qty <= 0,
      };
    });
  }, [variants, productMap, categoryMap]);

  const lowStockCount = useMemo(
    () => enrichedVariants.filter(v => v.isLow || v.isOut).length,
    [enrichedVariants]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter(p => {
      if (selectedCategory !== 'all' && p.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      if (p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q))) {
        return true;
      }
      const prodVars = enrichedVariants.filter(v => v.product_id === p.id);
      return prodVars.some(
        v =>
          v.sku.toLowerCase().includes(q) ||
          v.barcode.toLowerCase().includes(q) ||
          v.color_label.toLowerCase().includes(q) ||
          v.size_label.toLowerCase().includes(q)
      );
    });
  }, [products, enrichedVariants, selectedCategory, searchQuery]);

  const filteredStockVariants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedVariants.filter(v => {
      if (filterLowStockOnly && !v.isLow && !v.isOut) return false;
      if (selectedCategory !== 'all' && v.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (q) {
        return (
          v.productName.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q) ||
          v.barcode.toLowerCase().includes(q) ||
          v.size_label.toLowerCase().includes(q) ||
          v.color_label.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [enrichedVariants, filterLowStockOnly, selectedCategory, searchQuery]);

  const handleSaveVariantInline = async (vId: string) => {
    const newPrice = Math.max(0, parseFloat(editPriceVal) || 0);
    const newCost =
      editCostVal.trim() !== '' && !isNaN(parseFloat(editCostVal))
        ? Math.max(0, parseFloat(editCostVal))
        : undefined;
    const newTax =
      editTaxVal.trim() !== '' && !isNaN(parseFloat(editTaxVal))
        ? Math.max(0, parseFloat(editTaxVal))
        : undefined;
    const newStock = Math.max(0, parseInt(editStockVal, 10) || 0);
    const existing = variants.find(v => v.id === vId);
    if (!existing) return;

    await db.variants.update(vId, {
      price: newPrice,
      cost_price: newCost,
      tax_rate: newTax,
      stock_qty: newStock,
    });
    if (existing.stock_qty !== newStock) {
      const prod = productMap.get(existing.product_id);
      await db.inventory_movements.add({
        id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        product_id: existing.product_id,
        variant_id: vId,
        product_name: prod?.name || 'Product',
        size_label: `${existing.size_label} · ${existing.color_label}`,
        type: 'adjustment',
        qty: newStock - existing.stock_qty,
        previous_stock: existing.stock_qty,
        new_stock: newStock,
        notes: 'Inline catalog update',
        created_at: new Date().toISOString(),
      });
    }

    setEditingVariantId(null);
    await loadData();
    showToast('Variant updated');
  };

  const handleApplyAdjustment = async () => {
    if (!adjustingVariant) return;
    const qtyChange = parseInt(adjustQty, 10);
    if (isNaN(qtyChange) || qtyChange === 0) {
      showToast('Enter a valid quantity');
      return;
    }

    const delta = adjustType === 'return' ? -Math.abs(qtyChange) : Math.abs(qtyChange);
    const prevQty = adjustingVariant.stock_qty;
    const nextQty = Math.max(0, prevQty + delta);

    await db.variants.update(adjustingVariant.id, { stock_qty: nextQty });
    await db.inventory_movements.add({
      id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      product_id: adjustingVariant.product_id,
      variant_id: adjustingVariant.id,
      product_name: adjustingVariant.productName,
      size_label: `${adjustingVariant.size_label} · ${adjustingVariant.color_label}`,
      type: adjustType,
      qty: delta,
      previous_stock: prevQty,
      new_stock: nextQty,
      notes: adjustNotes.trim() || `Manual ${adjustType}`,
      created_at: new Date().toISOString(),
    });

    setAdjustingVariant(null);
    setAdjustQty('');
    setAdjustNotes('');
    await loadData();
    showToast(`Stock updated to ${nextQty}`);
  };

  const showInstitutionalAccounts = Boolean(shopConfig?.enabled_modules?.institutional_accounts);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 px-4 py-2 rounded-lg shadow-lg text-xs font-semibold">
          {toastMessage}
        </div>
      )}

      {/* Top Workspace Header */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h1 className="text-lg font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
              Catalog &amp; Inventory
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Products, Size &amp; Color variants, SKU barcodes, and live stock counts
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setProductToEdit(null);
                setIsAddProductOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Categories</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCsvUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBarcodeProductId(undefined);
                setIsBarcodeModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Barcodes</span>
            </button>
          </div>
        </div>

        {/* Sub-view Switcher & Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 w-fit">
            <button
              type="button"
              onClick={() => setSubTab('items')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                subTab === 'items'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Items &amp; Variants ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('stock')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                subTab === 'stock'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Stock &amp; Restock ({variants.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('audit')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                subTab === 'audit'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Audit Log
            </button>
            {showInstitutionalAccounts && (
              <button
                type="button"
                onClick={() => setSubTab('accounts')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  subTab === 'accounts'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Institutional Accounts
              </button>
            )}
          </div>

          {subTab !== 'accounts' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search product, SKU, or barcode..."
                  className="h-9 pl-8 pr-3 w-64 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium text-zinc-800 dark:text-zinc-200"
              >
                <option value="all">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {lowStockCount > 0 && subTab !== 'accounts' && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="tabular-nums">{lowStockCount} variant(s) are low or out of stock.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSubTab('stock');
                setFilterLowStockOnly(prev => !prev);
              }}
              className="text-xs font-semibold text-amber-800 dark:text-amber-300 underline cursor-pointer shrink-0"
            >
              {filterLowStockOnly ? 'Show All Stock' : 'View Low Stock'}
            </button>
          </div>
        )}
      </div>

      {/* Sub-view 1: Items & Variants */}
      {subTab === 'items' && (
        <div className="space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-3">
              <Layers className="w-8 h-8 text-zinc-400 mx-auto" />
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">No products in catalog</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                Add your first item with Size &amp; Color variants or upload a CSV catalog to start ringing up sales.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setProductToEdit(null);
                    setIsAddProductOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
                >
                  Add First Product
                </button>
                <button
                  type="button"
                  onClick={() => setIsCsvUploadOpen(true)}
                  className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold cursor-pointer"
                >
                  Import CSV
                </button>
              </div>
            </div>
          ) : (
            filteredProducts.map(prod => {
              const prodVars = enrichedVariants.filter(v => v.product_id === prod.id);
              const totalUnits = prodVars.reduce((acc, v) => acc + v.stock_qty, 0);
              const catLabel = categoryMap.get(prod.category.toLowerCase()) || prod.category;

              return (
                <div
                  key={prod.id}
                  className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                >
                  <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{prod.name}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                        {catLabel}
                        {prod.brand ? ` · ${prod.brand}` : ''}
                        {' · '}
                        {prodVars.length} variant{prodVars.length === 1 ? '' : 's'}
                        {' · '}
                        {totalUnits} units in stock
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBarcodeProductId(prod.id);
                          setIsBarcodeModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Barcode className="w-3.5 h-3.5" />
                        <span>Labels</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProductToEdit(prod);
                          setIsAddProductOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>

                  {prodVars.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-zinc-50/70 dark:bg-zinc-950/60 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                          <tr>
                            <th className="py-2 px-5 font-medium">Variant</th>
                            <th className="py-2 px-3 font-medium">SKU</th>
                            <th className="py-2 px-3 font-medium">Barcode</th>
                            <th className="py-2 px-3 font-medium text-right">Price</th>
                            <th className="py-2 px-3 font-medium text-right">Cost · Margin</th>
                            <th className="py-2 px-3 font-medium text-right">Tax</th>
                            <th className="py-2 px-3 font-medium text-right">Stock</th>
                            <th className="py-2 px-5 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {prodVars.map(v => {
                            const isEditing = editingVariantId === v.id;
                            const marginPct =
                              typeof v.resolvedCost === 'number' && v.price > 0
                                ? Math.round(((v.price - v.resolvedCost) / v.price) * 100)
                                : null;
                            return (
                              <tr key={v.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                                <td className="py-2.5 px-5 font-medium text-zinc-900 dark:text-zinc-100">
                                  {v.size_label} · {v.color_label}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {v.sku}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {v.barcode}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editPriceVal}
                                      onChange={e => setEditPriceVal(e.target.value)}
                                      className="w-20 h-7 px-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-right text-xs"
                                    />
                                  ) : (
                                    formatMoney(v.price, shopConfig)
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder="Cost"
                                      value={editCostVal}
                                      onChange={e => setEditCostVal(e.target.value)}
                                      className="w-20 h-7 px-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-right text-xs"
                                    />
                                  ) : typeof v.resolvedCost === 'number' ? (
                                    <span>
                                      {formatMoney(v.resolvedCost, shopConfig)}
                                      {marginPct !== null ? ` (${marginPct}%)` : ''}
                                    </span>
                                  ) : (
                                    <span>—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      step="0.1"
                                      placeholder="Std"
                                      value={editTaxVal}
                                      onChange={e => setEditTaxVal(e.target.value)}
                                      className="w-16 h-7 px-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-right text-xs"
                                    />
                                  ) : typeof v.resolvedTax === 'number' ? (
                                    <span>{v.resolvedTax}%</span>
                                  ) : (
                                    <span>Default</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      value={editStockVal}
                                      onChange={e => setEditStockVal(e.target.value)}
                                      className="w-16 h-7 px-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-right text-xs"
                                    />
                                  ) : (
                                    <span
                                      className={
                                        v.isOut
                                          ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                          : v.isLow
                                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                          : 'text-zinc-900 dark:text-zinc-100'
                                      }
                                    >
                                      {v.stock_qty}
                                      {v.isOut ? ' (Out)' : v.isLow ? ' (Low)' : ''}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-5 text-right">
                                  {isEditing ? (
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleSaveVariantInline(v.id)}
                                        className="p-1 rounded bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 cursor-pointer"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingVariantId(null)}
                                        className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingVariantId(v.id);
                                        setEditPriceVal(String(v.price));
                                        setEditCostVal(
                                          typeof v.cost_price === 'number' ? String(v.cost_price) : ''
                                        );
                                        setEditTaxVal(
                                          typeof v.tax_rate === 'number' ? String(v.tax_rate) : ''
                                        );
                                        setEditStockVal(String(v.stock_qty));
                                      }}
                                      className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                                    >
                                      Quick Edit
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Sub-view 2: Stock & Restock */}
      {subTab === 'stock' && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="py-3 px-4 font-medium">Product</th>
                <th className="py-3 px-4 font-medium">Variant</th>
                <th className="py-3 px-4 font-medium">SKU</th>
                <th className="py-3 px-4 font-medium text-right">On Hand</th>
                <th className="py-3 px-4 font-medium text-right">Status</th>
                <th className="py-3 px-4 font-medium text-right">Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredStockVariants.map(v => (
                <tr key={v.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-4 font-semibold text-zinc-950 dark:text-zinc-50">{v.productName}</td>
                  <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300">
                    {v.size_label} · {v.color_label}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-500">{v.sku}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">{v.stock_qty}</td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`text-xs font-medium ${
                        v.isOut
                          ? 'text-rose-600 dark:text-rose-400'
                          : v.isLow
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {v.isOut ? 'Out of Stock' : v.isLow ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustingVariant(v);
                        setAdjustQty('10');
                        setAdjustType('purchase');
                        setAdjustNotes('');
                      }}
                      className="px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sub-view 3: Audit Log */}
      {subTab === 'audit' && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          {movements.length === 0 ? (
            <div className="p-10 text-center text-xs text-zinc-500">No inventory movements recorded yet.</div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Product</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium text-right">Change</th>
                  <th className="py-3 px-4 font-medium text-right">Balance</th>
                  <th className="py-3 px-4 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {movements.map(m => (
                  <tr key={m.id}>
                    <td className="py-2.5 px-4 text-zinc-500 tabular-nums">
                      {formatDateShort(m.created_at, shopConfig)} · {formatTimeShort(m.created_at, shopConfig)}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {m.product_name} ({m.size_label})
                    </td>
                    <td className="py-2.5 px-4 capitalize text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
                      {m.qty > 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                      ) : m.type === 'return' ? (
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" />
                      )}
                      {m.type}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                      {m.qty > 0 ? `+${m.qty}` : m.qty}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{m.new_stock}</td>
                    <td className="py-2.5 px-4 text-zinc-500 truncate max-w-[200px]">{m.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Sub-view 4 (Opt-In Module Only): Institutional Accounts */}
      {subTab === 'accounts' && showInstitutionalAccounts && (
        <SchoolsManager
          onSelectSchoolForBilling={() => onNavigateToRegister?.()}
          onViewSchoolPrices={() => setSubTab('items')}
        />
      )}

      {/* Stock Adjustment Modal */}
      {adjustingVariant && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  Adjust Stock · {adjustingVariant.productName}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {adjustingVariant.size_label} · {adjustingVariant.color_label} (Current: {adjustingVariant.stock_qty})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingVariant(null)}
                className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(['purchase', 'adjustment', 'return'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAdjustType(t)}
                  className={`py-2 rounded-lg text-xs font-semibold capitalize cursor-pointer border ${
                    adjustType === t
                      ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                      : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  {t === 'return' ? 'Deduct' : t}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={adjustQty}
                onChange={e => setAdjustQty(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Notes
              </label>
              <input
                type="text"
                value={adjustNotes}
                onChange={e => setAdjustNotes(e.target.value)}
                placeholder="Supplier PO # or stock count reason"
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAdjustingVariant(null)}
                className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyAdjustment}
                className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
              >
                Update Stock
              </button>
            </div>
          </div>
        </div>
      )}

      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => {
          setIsAddProductOpen(false);
          setProductToEdit(null);
        }}
        onProductSaved={loadData}
        productToEdit={productToEdit}
      />

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesChanged={loadData}
      />

      <CsvRateUploadModal
        isOpen={isCsvUploadOpen}
        onClose={() => setIsCsvUploadOpen(false)}
        onImportComplete={loadData}
      />

      <BarcodeStickerModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        initialProductId={barcodeProductId}
      />
    </div>
  );
};
