import React, { useState, useEffect, useMemo } from 'react';
import { 
  Tag, 
  Search, 
  Edit3, 
  Check, 
  X, 
  Sliders, 
  TrendingUp, 
  Sparkles,
  School as SchoolIcon,
  Save,
  Plus,
  PackagePlus,
  Zap,
  Settings2,
  Trash2,
  Layers,
  FileSpreadsheet,
  Upload,
  Sparkle,
  Barcode,
  FolderTree
} from 'lucide-react';
import { db } from '../db/db';
import { type School, type Product, type SizeItem, type PriceEntry, type Category, type StoreBusinessType } from '../types';
import { AddProductModal } from './AddProductModal';
import { EditMultiRatesModal } from './EditMultiRatesModal';
import { CatalogGeneratorModal } from './CatalogGeneratorModal';
import { CsvRateUploadModal } from './CsvRateUploadModal';
import { BarcodeStickerModal } from './BarcodeStickerModal';
import { CategoryManagerModal } from './CategoryManagerModal';
import { getCatalogTabMeta } from '../lib/catalogLabels';

export const PriceManager: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<SizeItem[]>([]);
  const [priceEntries, setPriceEntries] = useState<PriceEntry[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [productQuery, setProductQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [storeType, setStoreType] = useState<StoreBusinessType | undefined>('apparel');

  // Inline editing state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editPriceVal, setEditPriceVal] = useState<string>('');

  // Batch edit mode state (spreadsheet table mode)
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchPriceEdits, setBatchPriceEdits] = useState<Map<string, number>>(new Map());

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Modals state
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productForMultiRates, setProductForMultiRates] = useState<Product | null>(null);
  const [isCatalogGenOpen, setIsCatalogGenOpen] = useState(false);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);

  // Bulk adjustment modal state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAdjustmentType, setBulkAdjustmentType] = useState<'flat' | 'percent'>('flat');
  const [bulkAdjustmentVal, setBulkAdjustmentVal] = useState<string>('20');
  const [bulkTargetCategory, setBulkTargetCategory] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const loadData = async () => {
    try {
      const [schList, prodList, szList, prList, catList, cfgs] = await Promise.all([
        db.schools.toArray(),
        db.products.toArray(),
        db.sizes.orderBy('sort_order').toArray(),
        db.price_list.toArray(),
        db.categories.toArray(),
        db.shop_config.toArray(),
      ]);
      setSchools(schList);
      setProducts(prodList);
      setSizes(szList);
      setPriceEntries(prList);
      setCategories(catList.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      if (cfgs.length > 0) setStoreType(cfgs[0].store_type);

      if (!selectedSchoolId && schList.length > 0) {
        setSelectedSchoolId(schList[0].id);
      }
    } catch (err) {
      console.error('Failed to load prices:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick lookup price map: `${school_id}_${product_id}_${size_id || 'null'}`
  const priceMap = useMemo(() => {
    const map = new Map<string, PriceEntry>();
    for (const p of priceEntries) {
      const key = `${p.school_id}_${p.product_id}_${p.size_id || 'null'}`;
      map.set(key, p);
    }
    return map;
  }, [priceEntries]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCategory !== 'all') {
      list = list.filter(p => p.category?.toLowerCase() === selectedCategory.toLowerCase());
    }
    const q = productQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, selectedCategory, productQuery]);

  // Selected School Object
  const currentSchool = useMemo(() => {
    return schools.find(s => s.id === selectedSchoolId) || null;
  }, [schools, selectedSchoolId]);

  // Start inline edit
  const handleStartEdit = (key: string, currentPrice: number) => {
    setEditingKey(key);
    setEditPriceVal(String(currentPrice));
  };

  // Save single inline edit
  const handleSaveInlinePrice = async (productId: string, sizeId: string | null) => {
    if (!selectedSchoolId) return;

    const newPrice = Math.max(0, parseInt(editPriceVal, 10) || 0);
    const key = `${selectedSchoolId}_${productId}_${sizeId || 'null'}`;
    const existing = priceMap.get(key);

    try {
      if (existing) {
        await db.price_list.update(existing.id, { price: newPrice });
      } else {
        const newId = `pr_${selectedSchoolId}_${productId}_${sizeId || 'null'}`;
        await db.price_list.add({
          id: newId,
          school_id: selectedSchoolId,
          product_id: productId,
          size_id: sizeId,
          price: newPrice,
        });
      }

      const freshPrices = await db.price_list.toArray();
      setPriceEntries(freshPrices);
      setEditingKey(null);
      showToast(`Updated to ₹${newPrice}`);
    } catch (err) {
      console.error('Error saving price:', err);
      showToast('Error saving price');
    }
  };

  // Batch Mode change handler
  const handleBatchCellChange = (key: string, value: number) => {
    setBatchPriceEdits(prev => {
      const copy = new Map(prev);
      copy.set(key, Math.max(0, value));
      return copy;
    });
  };

  // Save all changes in Batch Edit Mode
  const handleSaveBatchChanges = async () => {
    if (batchPriceEdits.size === 0) {
      setIsBatchMode(false);
      return;
    }

    try {
      const updatesToPut: PriceEntry[] = [];
      for (const [key, newPrice] of batchPriceEdits.entries()) {
        const parts = key.split('_'); // `${school_id}_${product_id}_${size_id || 'null'}`
        const schId = parts[0];
        const prodId = parts[1];
        const szId = parts[2] === 'null' ? null : parts[2];

        updatesToPut.push({
          id: `pr_${schId}_${prodId}_${szId || 'null'}`,
          school_id: schId,
          product_id: prodId,
          size_id: szId,
          price: newPrice,
        });
      }

      await db.price_list.bulkPut(updatesToPut);
      const freshPrices = await db.price_list.toArray();
      setPriceEntries(freshPrices);
      setBatchPriceEdits(new Map());
      setIsBatchMode(false);
      showToast(`Saved ${updatesToPut.length} rates in batch!`);
    } catch (err) {
      console.error('Error saving batch rates:', err);
      showToast('Failed to save batch rates');
    }
  };

  // Bulk Price Update Execution
  const handleApplyBulkUpdate = async () => {
    if (!selectedSchoolId) return;

    const val = parseFloat(bulkAdjustmentVal) || 0;
    if (val === 0) {
      showToast('Please enter adjustment value');
      return;
    }

    try {
      const targetProducts = products.filter(p => {
        if (bulkTargetCategory === 'all') return true;
        return p.category === bulkTargetCategory;
      });

      const targetProdIds = new Set(targetProducts.map(p => p.id));
      const updatesToApply: PriceEntry[] = [];

      for (const pr of priceEntries) {
        if (pr.school_id === selectedSchoolId && targetProdIds.has(pr.product_id)) {
          let updatedPrice = pr.price;
          if (bulkAdjustmentType === 'flat') {
            updatedPrice = pr.price + val;
          } else {
            updatedPrice = Math.round((pr.price * (1 + val / 100)) / 5) * 5;
          }
          updatedPrice = Math.max(10, Math.round(updatedPrice / 5) * 5);
          updatesToApply.push({ ...pr, price: updatedPrice });
        }
      }

      await db.price_list.bulkPut(updatesToApply);
      const freshPrices = await db.price_list.toArray();
      setPriceEntries(freshPrices);
      setShowBulkModal(false);
      showToast(`Bulk updated ${updatesToApply.length} prices for ${currentSchool?.code}`);
    } catch (err) {
      console.error('Failed bulk update:', err);
      showToast('Error updating prices');
    }
  };

  const catalogMeta = getCatalogTabMeta(storeType);
  const CatalogIcon = catalogMeta.icon;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1D1D1F] text-white px-5 py-2 rounded-xl shadow-lg border border-[#333336] font-semibold text-xs animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Header & Controls Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-[#E5E5E7] dark:border-zinc-800 p-5 shadow-xs mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E5E5E7] dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <CatalogIcon className="w-5 h-5 text-[#1D1D1F] dark:text-zinc-100" />
              <h1 className="font-bold text-xl text-[#1D1D1F] dark:text-zinc-100">{catalogMeta.title}</h1>
            </div>
            <p className="text-xs text-[#86868B] dark:text-zinc-400 mt-0.5">
              Custom catalog rate cards · Product pricing · Edit multiple size curves &amp; rates in batch
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1-CLICK UNIFORM CATALOG GENERATOR */}
            <button
              onClick={() => setIsCatalogGenOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-semibold hover:bg-[#E5E5E7] transition-all cursor-pointer"
              title="Auto-generate standard shirts, pants, skirts, shoes & rate curves for this school"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#1D1D1F]" />
              <span>1-Click Catalog</span>
            </button>

            {/* CSV BULK RATE UPLOAD */}
            <button
              onClick={() => setIsCsvUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-semibold hover:bg-[#E5E5E7] transition-colors cursor-pointer"
              title="Upload Excel / CSV price list with size matrix"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#86868B]" />
              <span>Upload CSV</span>
            </button>

            {/* BARCODE PRICE TAG GENERATOR */}
            <button
              onClick={() => setIsBarcodeModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-semibold hover:bg-[#E5E5E7] transition-colors cursor-pointer"
              title="Generate & Print 50x25mm Barcode Stickers"
            >
              <Barcode className="w-3.5 h-3.5 text-[#86868B]" />
              <span>Print Barcodes</span>
            </button>

            {/* ADD PRODUCT BUTTON (ON WILL) */}
            <button
              onClick={() => {
                setProductToEdit(null);
                setIsAddProductOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1D1D1F] text-white rounded-xl text-xs font-semibold hover:bg-black transition-all shadow-xs cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Add Product</span>
            </button>

            {/* BATCH EDIT SPREADSHEET MODE TOGGLE */}
            <button
              onClick={() => {
                if (isBatchMode) {
                  handleSaveBatchChanges();
                } else {
                  setIsBatchMode(true);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                isBatchMode
                  ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-xs ring-2 ring-[#1D1D1F]/20'
                  : 'bg-[#F5F5F7] text-[#1D1D1F] border-[#E5E5E7] hover:border-[#1D1D1F]'
              }`}
            >
              <span>{isBatchMode ? 'Save Batch Edits' : 'Batch Edit Rates'}</span>
              {isBatchMode && batchPriceEdits.size > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white text-[#1D1D1F] text-[10px] font-bold">
                  {batchPriceEdits.size}
                </span>
              )}
            </button>

            {/* Bulk Adjust Modal Button */}
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-semibold hover:bg-[#E5E5E7] transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-[#86868B]" />
              <span>Bulk +/- %</span>
            </button>
          </div>
        </div>

        {/* BATCH MODE ACTIVE NOTIFICATION BANNER */}
        {isBatchMode && (
          <div className="mt-4 p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#1D1D1F] shrink-0" />
              <span className="text-xs font-semibold text-[#1D1D1F]">
                Batch Edit Mode Active: Type rates directly in any box below. Press Tab to jump between sizes!
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setBatchPriceEdits(new Map());
                  setIsBatchMode(false);
                }}
                className="text-xs font-semibold text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={handleSaveBatchChanges}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                Save All ({batchPriceEdits.size})
              </button>
            </div>
          </div>
        )}

        {/* School Selector Filter */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <span className="text-xs font-semibold text-[#86868B] whitespace-nowrap">School:</span>
            {schools.map(sch => (
              <button
                key={sch.id}
                onClick={() => {
                  if (isBatchMode && batchPriceEdits.size > 0) {
                    if (window.confirm('Save current batch changes before switching schools?')) {
                      handleSaveBatchChanges();
                    }
                  }
                  setSelectedSchoolId(sch.id);
                  setBatchPriceEdits(new Map());
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                  selectedSchoolId === sch.id
                    ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-xs'
                    : 'bg-[#F5F5F7] text-[#1D1D1F] border-[#E5E5E7] hover:border-[#1D1D1F]'
                }`}
              >
                <span>{sch.code}</span>
                <span className="opacity-75 ml-1 font-normal hidden sm:inline">({sch.multiplier || 1}x)</span>
              </button>
            ))}
          </div>

          {/* Search Product */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={productQuery}
              onChange={e => setProductQuery(e.target.value)}
              placeholder="Search product..."
              className="w-full h-8 pl-8 pr-3 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
            />
          </div>
        </div>

        {/* Category Tabs & Manager Button */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-[#E5E5E7]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#1D1D1F] text-white shadow-2xs'
                  : 'bg-white border border-[#E5E5E7] text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-colors cursor-pointer ${
                  selectedCategory.toLowerCase() === cat.id.toLowerCase()
                    ? 'bg-[#1D1D1F] text-white shadow-2xs'
                    : 'bg-white border border-[#E5E5E7] text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-2.5 py-1 rounded-xl border border-dashed border-[#E5E5E7] hover:border-[#1D1D1F] hover:bg-[#F5F5F7] text-[11px] font-semibold text-[#0071E3] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
            title="Add, rename, or remove product categories"
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Manage Categories</span>
          </button>
        </div>
      </div>

      {/* PRICE MATRIX TABLE */}
      <div className="bg-white rounded-2xl border border-[#E5E5E7] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F5F7] text-[#1D1D1F] font-bold uppercase border-b border-[#E5E5E7]">
              <tr>
                <th className="py-3 px-4 min-w-[200px]">Product</th>
                <th className="py-3 px-4 min-w-[100px]">Category</th>
                <th className="py-3 px-4">Size Rates &amp; Pricing</th>
                <th className="py-3 px-4 text-right min-w-[170px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E7]">
              {filteredProducts.map(prod => {
                const prodSizes = prod.size_group_id
                  ? sizes.filter(s => s.size_group_id === prod.size_group_id)
                  : [];

                return (
                  <tr key={prod.id} className="hover:bg-[#F5F5F7]/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-[#1D1D1F]">
                      {prod.name}
                      <span className="block text-[11px] font-normal text-[#86868B]">
                        Base: ₹{prod.base_price} · {prod.size_group_id ? `${prodSizes.length} sizes` : 'Free Size'}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize font-semibold text-[#86868B]">
                      {prod.category}
                    </td>

                    {/* SIZE RATES COLUMN */}
                    <td className="py-3 px-4">
                      {prod.size_group_id ? (
                        <div className="flex flex-wrap gap-1.5 py-1">
                          {prodSizes.map(sz => {
                            const key = `${selectedSchoolId}_${prod.id}_${sz.id}`;
                            const prEntry = priceMap.get(key);
                            const actualPrice = prEntry ? prEntry.price : prod.base_price;
                            const isEditing = editingKey === key;
                            const currentBatchVal = batchPriceEdits.has(key)
                              ? batchPriceEdits.get(key)!
                              : actualPrice;

                            if (isBatchMode) {
                              return (
                                <div
                                  key={sz.id}
                                  className="inline-flex items-center gap-1 bg-amber-50 border border-amber-300 rounded-lg px-1.5 py-1"
                                >
                                  <span className="font-bold text-[11px] text-[#1D1D1F]">
                                    {sz.label}:
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={currentBatchVal}
                                    onChange={e =>
                                      handleBatchCellChange(key, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-14 h-6 px-1 text-xs font-bold text-black bg-white border border-amber-400 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  />
                                </div>
                              );
                            }

                            return (
                              <div
                                key={sz.id}
                                className={`inline-flex items-center rounded-lg border text-xs px-2 py-1 transition-all ${
                                  isEditing
                                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300'
                                    : 'bg-white border-[#E5E5E7] hover:border-[#1D1D1F]'
                                }`}
                              >
                                <span className="font-bold text-[#1D1D1F] mr-1">
                                  {sz.label}:
                                </span>

                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      value={editPriceVal}
                                      onChange={e => setEditPriceVal(e.target.value)}
                                      className="w-14 h-6 px-1 text-xs font-bold border border-amber-400 rounded focus:outline-none text-[#1D1D1F]"
                                      autoFocus
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleSaveInlinePrice(prod.id, sz.id);
                                        if (e.key === 'Escape') setEditingKey(null);
                                      }}
                                    />
                                    <button
                                      onClick={() => handleSaveInlinePrice(prod.id, sz.id)}
                                      className="text-[#1D1D1F] hover:text-black cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingKey(null)}
                                      className="text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleStartEdit(key, actualPrice)}
                                    className="font-semibold text-[#1D1D1F] hover:text-[#0071E3] flex items-center gap-1 group cursor-pointer"
                                  >
                                    <span>₹{actualPrice}</span>
                                    <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-[#0071E3]" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        // Free size price cell
                        (() => {
                          const key = `${selectedSchoolId}_${prod.id}_null`;
                          const prEntry = priceMap.get(key);
                          const actualPrice = prEntry ? prEntry.price : prod.base_price;
                          const isEditing = editingKey === key;
                          const currentBatchVal = batchPriceEdits.has(key)
                            ? batchPriceEdits.get(key)!
                            : actualPrice;

                          if (isBatchMode) {
                            return (
                              <div className="inline-flex items-center gap-1 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1">
                                <span className="font-bold text-[11px] text-[#1D1D1F]">
                                  Free:
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  value={currentBatchVal}
                                  onChange={e =>
                                    handleBatchCellChange(key, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-16 h-6 px-1 text-xs font-bold text-black bg-white border border-amber-400 rounded focus:outline-none"
                                />
                              </div>
                            );
                          }

                          return (
                            <div className="inline-flex items-center">
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={editPriceVal}
                                    onChange={e => setEditPriceVal(e.target.value)}
                                    className="w-16 h-7 px-1 text-xs font-bold border border-amber-400 rounded text-[#1D1D1F]"
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleSaveInlinePrice(prod.id, null);
                                      if (e.key === 'Escape') setEditingKey(null);
                                    }}
                                  />
                                  <button
                                    onClick={() => handleSaveInlinePrice(prod.id, null)}
                                    className="p-1 text-[#1D1D1F] hover:text-black cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingKey(null)}
                                    className="p-1 text-[#86868B] cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleStartEdit(key, actualPrice)}
                                  className="px-3 py-1 rounded-lg bg-white border border-[#E5E5E7] hover:border-[#1D1D1F] font-semibold text-[#1D1D1F] flex items-center gap-2 group cursor-pointer"
                                >
                                  <span>₹{actualPrice}</span>
                                  <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#0071E3]" />
                                </button>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </td>

                    {/* ACTIONS: MULTI-RATE & PRODUCT EDIT */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setProductForMultiRates(prod)}
                          className="px-2.5 py-1 bg-[#F5F5F7] hover:bg-[#E5E5E7] text-[#1D1D1F] font-semibold text-xs rounded-lg border border-[#E5E5E7] flex items-center gap-1 transition-colors cursor-pointer"
                          title="Edit multiple sizes and rates together"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Multi-Rates</span>
                        </button>

                        <button
                          onClick={() => {
                            setProductToEdit(prod);
                            setIsAddProductOpen(true);
                          }}
                          className="p-1.5 text-[#86868B] hover:text-[#1D1D1F] rounded-lg hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                          title="Edit product info or delete"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT PRODUCT MODAL */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => {
          setIsAddProductOpen(false);
          setProductToEdit(null);
        }}
        productToEdit={productToEdit}
        onProductSaved={() => {
          loadData();
          showToast(productToEdit ? 'Product updated' : 'New product added!');
        }}
      />

      {/* MULTI-SIZE & RATES MODAL */}
      {productForMultiRates && (
        <EditMultiRatesModal
          isOpen={!!productForMultiRates}
          onClose={() => setProductForMultiRates(null)}
          product={productForMultiRates}
          initialSchoolId={selectedSchoolId}
          onRatesUpdated={() => {
            loadData();
            showToast('Multiple size rates updated!');
          }}
        />
      )}

      {/* BULK ADJUSTMENT MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-[#E5E5E7] animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E7] mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#1D1D1F]" />
                <h3 className="font-extrabold text-base text-[#1D1D1F]">
                  Bulk Adjust Rates for {currentSchool?.code}
                </h3>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-[#86868B] hover:text-[#1D1D1F]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-[#86868B] block mb-1">
                  Target Items Category
                </label>
                <select
                  value={bulkTargetCategory}
                  onChange={e => setBulkTargetCategory(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-white text-[#1D1D1F]"
                >
                  <option value="all">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} Only
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#86868B] block mb-1">
                  Adjustment Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setBulkAdjustmentType('flat')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      bulkAdjustmentType === 'flat'
                        ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                        : 'bg-[#F5F5F7] text-[#1D1D1F] border-[#E5E5E7]'
                    }`}
                  >
                    Flat ₹ Amount (e.g. +₹20)
                  </button>
                  <button
                    onClick={() => setBulkAdjustmentType('percent')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      bulkAdjustmentType === 'percent'
                        ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                        : 'bg-[#F5F5F7] text-[#1D1D1F] border-[#E5E5E7]'
                    }`}
                  >
                    Percentage % (e.g. +5%)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#86868B] block mb-1">
                  {bulkAdjustmentType === 'flat' ? 'Amount (₹)' : 'Percentage (%)'}
                </label>
                <input
                  type="number"
                  value={bulkAdjustmentVal}
                  onChange={e => setBulkAdjustmentVal(e.target.value)}
                  placeholder="20"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-white text-[#1D1D1F]"
                />
                <p className="text-[11px] text-[#86868B] mt-1">
                  Prices will automatically round to the nearest ₹5 for clean cashier cash handling.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyBulkUpdate}
                  className="flex-1 py-2.5 rounded-xl bg-[#1D1D1F] text-white text-xs font-semibold hover:bg-black shadow-xs transition-colors cursor-pointer"
                >
                  Apply to {currentSchool?.code}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 1-Click Catalog Generator Modal */}
      <CatalogGeneratorModal
        isOpen={isCatalogGenOpen}
        onClose={() => setIsCatalogGenOpen(false)}
        schools={schools}
        onGenerated={async () => {
          await loadData();
          showToast('1-Click Uniform Catalog generated!');
        }}
      />

      {/* CSV Bulk Rate Uploader Modal */}
      <CsvRateUploadModal
        isOpen={isCsvUploadOpen}
        onClose={() => setIsCsvUploadOpen(false)}
        onImportComplete={async () => {
          await loadData();
          showToast('CSV Rates imported successfully!');
        }}
      />

      {/* Barcode & Price Tag Sticker Generator Modal */}
      <BarcodeStickerModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        schools={schools}
        products={products}
        sizes={sizes}
        prices={priceEntries}
        initialSchoolId={selectedSchoolId}
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
