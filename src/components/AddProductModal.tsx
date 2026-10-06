import React, { useState, useEffect } from 'react';
import { 
  X, 
  PackagePlus, 
  Tag, 
  Layers, 
  Check, 
  AlertCircle, 
  Trash2,
  Sparkles,
  FolderTree
} from 'lucide-react';
import { db } from '../db/db';
import { type Product, type SizeGroup, type SizeItem, type School, type Category } from '../types';
import { CategoryManagerModal } from './CategoryManagerModal';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductSaved: (product: Product) => void;
  productToEdit?: Product | null;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onProductSaved,
  productToEdit,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('uniform');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [sizingType, setSizingType] = useState<'group' | 'custom' | 'free'>('group');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [customSizesInput, setCustomSizesInput] = useState<string>('24, 26, 28, 30, 32, 34');
  const [basePrice, setBasePrice] = useState<string>('280');
  const [priceStep, setPriceStep] = useState<string>('10');
  const [initialStock, setInitialStock] = useState<string>('25');
  const [lowStockThreshold, setLowStockThreshold] = useState<string>('8');
  const [hsnCode, setHsnCode] = useState<string>('6205');

  const [sizeGroups, setSizeGroups] = useState<SizeGroup[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadMetadata = async () => {
    const [groups, schoolList, catList] = await Promise.all([
      db.size_groups.toArray(),
      db.schools.toArray(),
      db.categories.toArray(),
    ]);
    setSizeGroups(groups);
    setSchools(schoolList);
    const sortedCats = catList.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    setCategories(sortedCats);
    if (!selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMetadata();
    }
  }, [isOpen]);

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setCategory(productToEdit.category);
      setBasePrice(String(productToEdit.base_price));
      setLowStockThreshold(String(productToEdit.low_stock_threshold || 8));
      setHsnCode(productToEdit.hsn || '6205');

      if (!productToEdit.size_group_id) {
        setSizingType('free');
      } else {
        setSizingType('group');
        setSelectedGroupId(productToEdit.size_group_id);
      }
    } else {
      // Default reset
      setName('');
      setCategory('uniform');
      setSizingType('group');
      setBasePrice('280');
      setPriceStep('10');
      setInitialStock('25');
      setLowStockThreshold('8');
      setHsnCode('6205');
      setErrorMsg(null);
    }
  }, [productToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Please enter a product name');
      return;
    }

    const parsedBase = Math.max(0, parseInt(basePrice, 10) || 0);
    const parsedStep = parseInt(priceStep, 10) || 0;
    const parsedStock = Math.max(0, parseInt(initialStock, 10) || 0);
    const parsedThreshold = Math.max(1, parseInt(lowStockThreshold, 10) || 5);

    setIsSaving(true);
    setErrorMsg(null);

    try {
      let finalGroupId: string | null = null;
      let sizesToUse: { id: string; label: string; sort_order: number }[] = [];

      if (sizingType === 'group') {
        finalGroupId = selectedGroupId;
        const matchingSizes = await db.sizes.where('size_group_id').equals(selectedGroupId).sortBy('sort_order');
        sizesToUse = matchingSizes;
      } else if (sizingType === 'custom') {
        // Create custom size group
        const customGroupId = `sg_custom_${Date.now()}`;
        const groupName = `${trimmedName} Sizes`;
        await db.size_groups.add({
          id: customGroupId,
          name: groupName,
        });
        finalGroupId = customGroupId;

        // Parse custom sizes
        const sizeLabels = customSizesInput
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

        const newSizes: SizeItem[] = sizeLabels.map((lbl, idx) => ({
          id: `sz_c_${Date.now()}_${idx}`,
          size_group_id: customGroupId,
          label: lbl,
          sort_order: idx + 1,
        }));

        await db.sizes.bulkAdd(newSizes);
        sizesToUse = newSizes;
      } else {
        // Free size
        finalGroupId = null;
        sizesToUse = [];
      }

      const prodId = productToEdit ? productToEdit.id : `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const productRecord: Product = {
        id: prodId,
        name: trimmedName,
        category,
        size_group_id: finalGroupId,
        base_price: parsedBase,
        stock: parsedStock,
        low_stock_threshold: parsedThreshold,
        hsn: hsnCode.trim() || undefined,
      };

      if (productToEdit) {
        await db.products.update(prodId, productRecord);
      } else {
        await db.products.add(productRecord);
      }

      // Populate Price List across all active schools
      const priceEntriesToPut = [];
      const stockEntriesToPut = [];

      for (const sch of schools) {
        const mult = sch.multiplier || 1.0;
        if (sizesToUse.length > 0) {
          sizesToUse.forEach((sz, idx) => {
            const calculatedPrice = Math.round((parsedBase * mult) / 5) * 5 + (idx * parsedStep);
            priceEntriesToPut.push({
              id: `pr_${sch.id}_${prodId}_${sz.id}`,
              school_id: sch.id,
              product_id: prodId,
              size_id: sz.id,
              price: calculatedPrice,
            });
          });
        } else {
          const calculatedPrice = Math.round((parsedBase * mult) / 5) * 5;
          priceEntriesToPut.push({
            id: `pr_${sch.id}_${prodId}_null`,
            school_id: sch.id,
            product_id: prodId,
            size_id: null,
            price: calculatedPrice,
          });
        }
      }

      await db.price_list.bulkPut(priceEntriesToPut);

      // Populate initial stock records
      if (sizesToUse.length > 0) {
        for (const sz of sizesToUse) {
          const stockKey = `${prodId}_${sz.id}`;
          const existingStock = await db.stocks.get(stockKey);
          if (!existingStock) {
            stockEntriesToPut.push({
              id: stockKey,
              product_id: prodId,
              size_id: sz.id,
              size_label: sz.label,
              quantity: parsedStock,
              min_stock: parsedThreshold,
            });
          }
        }
      } else {
        const stockKey = `${prodId}_free`;
        const existingStock = await db.stocks.get(stockKey);
        if (!existingStock) {
          stockEntriesToPut.push({
            id: stockKey,
            product_id: prodId,
            size_id: null,
            size_label: 'Free Size',
            quantity: parsedStock,
            min_stock: parsedThreshold,
          });
        }
      }

      if (stockEntriesToPut.length > 0) {
        await db.stocks.bulkPut(stockEntriesToPut);
      }

      onProductSaved(productRecord);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to save product:', err);
      setErrorMsg((err as Error)?.message || 'Failed to save product to database');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!productToEdit) return;
    if (!window.confirm(`Are you sure you want to delete "${productToEdit.name}"? This will remove its rates and stocks.`)) {
      return;
    }

    try {
      setIsSaving(true);
      await db.products.delete(productToEdit.id);
      await db.price_list.where('product_id').equals(productToEdit.id).delete();
      await db.stocks.where('product_id').equals(productToEdit.id).delete();
      onProductSaved(productToEdit);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to delete product:', err);
      setErrorMsg((err as Error)?.message || 'Failed to delete');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-[#E5E5E7] overflow-hidden my-auto animate-in fade-in-50">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#F5F5F7] border-b border-[#E5E5E7] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-base text-[#1D1D1F]">
                {productToEdit ? 'Edit Product' : 'Add New Product'}
              </h2>
              <p className="text-xs text-[#86868B]">
                Instantly generates rates and counter stock
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#86868B] hover:text-[#1D1D1F] p-1.5 rounded-lg hover:bg-[#E5E5E7]/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Product Name */}
          <div>
            <label className="text-xs font-semibold text-[#86868B] block mb-1">
              Product / Uniform Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. School Tracksuit, House Cap, Lab Apron"
              className="w-full h-10 px-3.5 rounded-xl border border-[#E5E5E7] text-sm font-medium text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[#86868B]">
                Category *
              </label>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="text-[11px] font-semibold text-[#0071E3] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <FolderTree className="w-3 h-3" />
                <span>Manage Categories</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 bg-[#F5F5F7] p-1.5 rounded-xl border border-[#E5E5E7]">
              {categories.map(cat => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    category.toLowerCase() === cat.id.toLowerCase()
                      ? 'bg-[#1D1D1F] text-white shadow-xs'
                      : 'bg-white border border-[#E5E5E7] text-[#86868B] hover:text-[#1D1D1F]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Sizing Structure */}
          <div>
            <label className="text-xs font-semibold text-[#86868B] block mb-1">
              Sizing Mode
            </label>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setSizingType('group')}
                className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-colors ${
                  sizingType === 'group'
                    ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                    : 'bg-[#F5F5F7] text-[#86868B] border-[#E5E5E7] hover:bg-[#E5E5E7]/50'
                }`}
              >
                Existing Sizes
              </button>
              <button
                type="button"
                onClick={() => setSizingType('custom')}
                className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-colors ${
                  sizingType === 'custom'
                    ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                    : 'bg-[#F5F5F7] text-[#86868B] border-[#E5E5E7] hover:bg-[#E5E5E7]/50'
                }`}
              >
                Custom Sizes
              </button>
              <button
                type="button"
                onClick={() => setSizingType('free')}
                className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-colors ${
                  sizingType === 'free'
                    ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                    : 'bg-[#F5F5F7] text-[#86868B] border-[#E5E5E7] hover:bg-[#E5E5E7]/50'
                }`}
              >
                Free / No Size
              </button>
            </div>

            {sizingType === 'group' && (
              <div>
                <select
                  value={selectedGroupId}
                  onChange={e => setSelectedGroupId(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
                >
                  {sizeGroups.map(sg => (
                    <option key={sg.id} value={sg.id}>
                      {sg.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {sizingType === 'custom' && (
              <div>
                <input
                  type="text"
                  value={customSizesInput}
                  onChange={e => setCustomSizesInput(e.target.value)}
                  placeholder="e.g. S, M, L, XL or 28, 30, 32, 34"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
                />
                <p className="text-[10px] text-[#86868B] mt-1">
                  Separate sizes with commas. Each size will become an instant tap button in billing.
                </p>
              </div>
            )}

            {sizingType === 'free' && (
              <p className="text-xs text-[#86868B] italic p-2 bg-[#F5F5F7] rounded-lg border border-[#E5E5E7]">
                Single-size item: tapping it in Bill will add 1 unit directly.
              </p>
            )}
          </div>

          {/* Pricing Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#86868B] block mb-1">
                Base Rate (₹) *
              </label>
              <input
                type="number"
                min="0"
                required
                value={basePrice}
                onChange={e => setBasePrice(e.target.value)}
                placeholder="280"
                className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
              />
            </div>

            {sizingType !== 'free' ? (
              <div>
                <label className="text-xs font-semibold text-[#86868B] block mb-1">
                  Step Increment (₹ / size)
                </label>
                <input
                  type="number"
                  min="0"
                  value={priceStep}
                  onChange={e => setPriceStep(e.target.value)}
                  placeholder="10"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-[#86868B] block mb-1">
                  HSN Code
                </label>
                <input
                  type="text"
                  value={hsnCode}
                  onChange={e => setHsnCode(e.target.value)}
                  placeholder="6205"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
                />
              </div>
            )}
          </div>

          {/* Initial Stock & Threshold */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#86868B] block mb-1">
                Initial Stock (per size)
              </label>
              <input
                type="number"
                min="0"
                value={initialStock}
                onChange={e => setInitialStock(e.target.value)}
                placeholder="25"
                className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#86868B] block mb-1">
                Low Stock Alert Threshold
              </label>
              <input
                type="number"
                min="1"
                value={lowStockThreshold}
                onChange={e => setLowStockThreshold(e.target.value)}
                placeholder="8"
                className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#E5E5E7] flex items-center justify-between gap-3">
            {productToEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="px-3.5 py-2.5 rounded-xl bg-red-50 text-red-700 font-semibold text-xs hover:bg-red-100 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-[#1D1D1F] text-white text-xs font-semibold hover:bg-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : productToEdit ? 'Save Changes' : 'Create Product'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesChanged={loadMetadata}
      />
    </div>
  );
};
