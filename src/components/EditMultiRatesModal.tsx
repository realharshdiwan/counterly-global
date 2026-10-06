import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  Zap, 
  Sliders, 
  Copy, 
  Check, 
  AlertCircle, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { db } from '../db/db';
import { type Product, type SizeItem, type School, type PriceEntry, type ProductStock } from '../types';

interface EditMultiRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onRatesUpdated: () => void;
  initialSchoolId?: string;
}

interface SizeRow {
  sizeId: string;
  label: string;
  price: number;
  stock: number;
  isNew?: boolean;
}

export const EditMultiRatesModal: React.FC<EditMultiRatesModalProps> = ({
  isOpen,
  onClose,
  product,
  onRatesUpdated,
  initialSchoolId,
}) => {
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [sizeRows, setSizeRows] = useState<SizeRow[]>([]);
  const [newSizeLabel, setNewSizeLabel] = useState('');
  const [newSizePrice, setNewSizePrice] = useState('300');
  const [newSizeStock, setNewSizeStock] = useState('20');

  // Step fill auto tools
  const [stepBaseRate, setStepBaseRate] = useState<string>('260');
  const [stepIncrement, setStepIncrement] = useState<string>('10');

  // Bulk adjust tool
  const [bulkAdjustmentVal, setBulkAdjustmentVal] = useState<string>('20');
  const [bulkAdjustmentMode, setBulkAdjustmentMode] = useState<'flat' | 'percent'>('flat');

  // Copy to schools
  const [copyToOtherSchools, setCopyToOtherSchools] = useState(false);
  const [selectedTargetSchoolIds, setSelectedTargetSchoolIds] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  useEffect(() => {
    async function loadData() {
      const schList = await db.schools.toArray();
      setSchools(schList);
      if (initialSchoolId) {
        setSelectedSchoolId(initialSchoolId);
      } else if (schList.length > 0) {
        setSelectedSchoolId(schList[0].id);
      }
    }
    loadData();
  }, [initialSchoolId, isOpen]);

  // Load sizes and prices for current product and selected school
  useEffect(() => {
    if (!product || !selectedSchoolId || !isOpen) return;

    async function loadProductSizesAndPrices() {
      if (!product) return;

      let sizes: SizeItem[] = [];
      if (product.size_group_id) {
        sizes = await db.sizes.where('size_group_id').equals(product.size_group_id).sortBy('sort_order');
      }

      const [prices, stocks] = await Promise.all([
        db.price_list.where('product_id').equals(product.id).toArray(),
        db.stocks.where('product_id').equals(product.id).toArray(),
      ]);

      const priceMap = new Map<string, number>();
      prices
        .filter(p => p.school_id === selectedSchoolId)
        .forEach(p => priceMap.set(p.size_id || 'null', p.price));

      const stockMap = new Map<string, number>();
      stocks.forEach(s => stockMap.set(s.size_id || 'free', s.quantity));

      if (sizes.length > 0) {
        const rows: SizeRow[] = sizes.map((sz, idx) => {
          const defaultPrice = product.base_price + idx * 10;
          const currentPrice = priceMap.get(sz.id) ?? defaultPrice;
          const currentStock = stockMap.get(sz.id) ?? 20;

          return {
            sizeId: sz.id,
            label: sz.label,
            price: currentPrice,
            stock: currentStock,
          };
        });
        setSizeRows(rows);
        if (rows.length > 0) {
          setStepBaseRate(String(rows[0].price));
        }
      } else {
        // Free size
        const currentPrice = priceMap.get('null') ?? product.base_price;
        const currentStock = stockMap.get('free') ?? product.stock;
        setSizeRows([
          {
            sizeId: 'free',
            label: 'Free Size',
            price: currentPrice,
            stock: currentStock,
          },
        ]);
        setStepBaseRate(String(currentPrice));
      }
    }

    loadProductSizesAndPrices();
  }, [product, selectedSchoolId, isOpen]);

  if (!isOpen || !product) return null;

  // 1. Auto-fill Step Formula (e.g. Base ₹260 + ₹10 per size step)
  const handleApplyStepFormula = () => {
    const base = parseFloat(stepBaseRate) || 0;
    const step = parseFloat(stepIncrement) || 0;

    setSizeRows(prev =>
      prev.map((row, idx) => ({
        ...row,
        price: Math.max(0, Math.round((base + idx * step) / 5) * 5),
      }))
    );
    showToast('Applied step formula to all sizes!');
  };

  // 2. Bulk Adjust All (+/- ₹ flat or %)
  const handleBulkAdjustAll = () => {
    const val = parseFloat(bulkAdjustmentVal) || 0;
    if (val === 0) return;

    setSizeRows(prev =>
      prev.map(row => {
        let newPrice = row.price;
        if (bulkAdjustmentMode === 'flat') {
          newPrice = row.price + val;
        } else {
          newPrice = row.price * (1 + val / 100);
        }
        return {
          ...row,
          price: Math.max(10, Math.round(newPrice / 5) * 5),
        };
      })
    );
    showToast(`Adjusted all size rates by ${bulkAdjustmentMode === 'flat' ? `₹${val}` : `${val}%`}`);
  };

  // 3. Add New Size Row
  const handleAddNewSize = async () => {
    const label = newSizeLabel.trim();
    if (!label) {
      showToast('Enter size label');
      return;
    }

    const price = Math.max(0, parseInt(newSizePrice, 10) || 0);
    const stock = Math.max(0, parseInt(newSizeStock, 10) || 0);

    const tempId = `sz_new_${Date.now()}`;
    setSizeRows(prev => [
      ...prev,
      {
        sizeId: tempId,
        label,
        price,
        stock,
        isNew: true,
      },
    ]);

    setNewSizeLabel('');
    showToast(`Added Size ${label}`);
  };

  // 4. Remove a size row
  const handleRemoveSizeRow = (index: number) => {
    setSizeRows(prev => prev.filter((_, i) => i !== index));
  };

  // 5. Save All Changes into IndexedDB
  const handleSaveAll = async () => {
    setIsSaving(true);

    try {
      // 1. If sizes were added or renamed, update sizes in db
      let targetGroupId = product.size_group_id;

      if (!targetGroupId && sizeRows.length > 1) {
        // Upgrade product to multi-size group
        targetGroupId = `sg_${product.id}_${Date.now()}`;
        await db.size_groups.add({
          id: targetGroupId,
          name: `${product.name} Sizes`,
        });
        await db.products.update(product.id, { size_group_id: targetGroupId });
      }

      // If product has size group, persist new sizes
      for (let i = 0; i < sizeRows.length; i++) {
        const row = sizeRows[i];
        if (row.isNew && targetGroupId) {
          await db.sizes.add({
            id: row.sizeId,
            size_group_id: targetGroupId,
            label: row.label,
            sort_order: i + 1,
          });
        }
      }

      // Determine target schools (current school + any copied schools)
      const targetSchools = [selectedSchoolId];
      if (copyToOtherSchools) {
        selectedTargetSchoolIds.forEach(id => {
          if (!targetSchools.includes(id)) targetSchools.push(id);
        });
      }

      // 2. Update price entries for each target school
      const pricesToPut: PriceEntry[] = [];
      const stocksToPut: ProductStock[] = [];

      for (const schId of targetSchools) {
        for (const row of sizeRows) {
          const isFree = row.sizeId === 'free' || !targetGroupId;
          const szId = isFree ? null : row.sizeId;
          const priceId = `pr_${schId}_${product.id}_${szId || 'null'}`;

          pricesToPut.push({
            id: priceId,
            school_id: schId,
            product_id: product.id,
            size_id: szId,
            price: row.price,
          });
        }
      }

      await db.price_list.bulkPut(pricesToPut);

      // 3. Update stock entries
      for (const row of sizeRows) {
        const isFree = row.sizeId === 'free' || !targetGroupId;
        const szId = isFree ? null : row.sizeId;
        const stockKey = `${product.id}_${szId || 'free'}`;

        stocksToPut.push({
          id: stockKey,
          product_id: product.id,
          size_id: szId,
          size_label: row.label,
          quantity: row.stock,
          min_stock: product.low_stock_threshold || 8,
        });
      }

      await db.stocks.bulkPut(stocksToPut);

      showToast(`Saved ${sizeRows.length} size rates successfully!`);
      onRatesUpdated();
      setTimeout(onClose, 500);
    } catch (err: unknown) {
      console.error('Failed to save multi rates:', err);
      showToast('Error saving rates');
    } finally {
      setIsSaving(false);
    }
  };

  const currentSchool = schools.find(s => s.id === selectedSchoolId);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-xl border border-[#E5E5E7] overflow-hidden my-auto animate-in zoom-in-95">
        {/* Toast */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1D1D1F] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg animate-bounce">
            {toastMessage}
          </div>
        )}

        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#F5F5F7] border-b border-[#E5E5E7] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1D1D1F]" />
              <h2 className="font-bold text-base text-[#1D1D1F]">
                Edit Multiple Sizes &amp; Rates
              </h2>
            </div>
            <p className="text-xs text-[#86868B] mt-0.5">
              Product: <strong className="text-[#1D1D1F]">{product.name}</strong>
            </p>
          </div>

          <button onClick={onClose} className="text-[#86868B] hover:text-[#1D1D1F] p-1.5 rounded-lg hover:bg-[#E5E5E7]/50 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {/* Active School Selector */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
            <div className="text-xs font-semibold text-[#1D1D1F]">
              Editing rates for school:
            </div>
            <select
              value={selectedSchoolId}
              onChange={e => setSelectedSchoolId(e.target.value)}
              className="h-8 px-3 rounded-xl border border-[#E5E5E7] text-xs font-semibold bg-white text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
            >
              {schools.map(sch => (
                <option key={sch.id} value={sch.id}>
                  {sch.code} — {sch.name}
                </option>
              ))}
            </select>
          </div>

          {/* QUICK FORMULA ACCELERATOR TOOLBAR */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#E5E5E7] shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#1D1D1F]">
              <span className="flex items-center gap-1.5 text-[#1D1D1F]">
                <Zap className="w-4 h-4 text-[#1D1D1F]" />
                Auto-Step Formula Fill
              </span>
              <span className="text-[11px] text-[#86868B] font-normal hidden sm:inline">
                Fills size rates incrementally in 1 tap
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[#86868B] font-semibold">Start ₹:</span>
                <input
                  type="number"
                  value={stepBaseRate}
                  onChange={e => setStepBaseRate(e.target.value)}
                  className="w-16 h-8 px-2 rounded-lg border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                />
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-[#86868B] font-semibold">+ Step ₹:</span>
                <input
                  type="number"
                  value={stepIncrement}
                  onChange={e => setStepIncrement(e.target.value)}
                  className="w-14 h-8 px-2 rounded-lg border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                />
              </div>

              <button
                type="button"
                onClick={handleApplyStepFormula}
                className="px-3 py-1.5 bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Zap className="w-3 h-3" />
                <span>Apply Step Formula</span>
              </button>
            </div>
          </div>

          {/* SIZES & RATES SPREADSHEET TABLE */}
          <div className="border border-[#E5E5E7] rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F5F7] text-[#1D1D1F] font-bold uppercase border-b border-[#E5E5E7]">
                <tr>
                  <th className="py-2.5 px-3">Size Label</th>
                  <th className="py-2.5 px-3 min-w-[120px]">Rate / Price (₹)</th>
                  <th className="py-2.5 px-3 min-w-[100px]">Stock Count</th>
                  <th className="py-2.5 px-2 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E7]">
                {sizeRows.map((row, idx) => (
                  <tr key={row.sizeId} className="hover:bg-[#F5F5F7]/50 transition-colors">
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={row.label}
                        onChange={e => {
                          const val = e.target.value;
                          setSizeRows(prev =>
                            prev.map((r, i) => (i === idx ? { ...r, label: val } : r))
                          );
                        }}
                        className="w-24 h-8 px-2 rounded-lg border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#0071E3]"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-[#86868B]">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={row.price}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setSizeRows(prev =>
                              prev.map((r, i) => (i === idx ? { ...r, price: val } : r))
                            );
                          }}
                          className="w-24 h-8 px-2 rounded-lg border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#0071E3]"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0"
                        value={row.stock}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setSizeRows(prev =>
                            prev.map((r, i) => (i === idx ? { ...r, stock: val } : r))
                          );
                        }}
                        className="w-20 h-8 px-2 rounded-lg border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      {sizeRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSizeRow(idx)}
                          className="p-1 text-[#86868B] hover:text-red-600 transition-colors cursor-pointer"
                          title="Remove size"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Quick Add Size Row inside Table */}
            <div className="p-3 bg-[#F5F5F7] border-t border-[#E5E5E7] flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#86868B]">+ Add Size:</span>
              <input
                type="text"
                value={newSizeLabel}
                onChange={e => setNewSizeLabel(e.target.value)}
                placeholder="e.g. 40, XXL"
                className="w-20 h-8 px-2 rounded-lg border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none bg-white"
              />
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[#86868B]">₹</span>
                <input
                  type="number"
                  value={newSizePrice}
                  onChange={e => setNewSizePrice(e.target.value)}
                  placeholder="Rate"
                  className="w-20 h-8 px-2 rounded-lg border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] focus:outline-none bg-white"
                />
              </div>
              <button
                type="button"
                onClick={handleAddNewSize}
                className="px-3 py-1.5 bg-[#1D1D1F] text-white rounded-lg text-xs font-semibold hover:bg-black transition-colors cursor-pointer"
              >
                + Add Size Row
              </button>
            </div>
          </div>

          {/* COPY RATES TO OTHER SCHOOLS DRAWER */}
          <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-[#E5E5E7] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#1D1D1F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={copyToOtherSchools}
                  onChange={e => setCopyToOtherSchools(e.target.checked)}
                  className="w-4 h-4 accent-[#1D1D1F] rounded"
                />
                <span>Also replicate these rates to other schools</span>
              </label>
            </div>

            {copyToOtherSchools && (
              <div className="pt-2 border-t border-[#E5E5E7] flex flex-wrap gap-2 animate-in fade-in">
                {schools
                  .filter(s => s.id !== selectedSchoolId)
                  .map(sch => {
                    const isChecked = selectedTargetSchoolIds.includes(sch.id);
                    return (
                      <button
                        type="button"
                        key={sch.id}
                        onClick={() => {
                          setSelectedTargetSchoolIds(prev =>
                            isChecked ? prev.filter(id => id !== sch.id) : [...prev, sch.id]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          isChecked
                            ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                            : 'bg-white text-[#86868B] border-[#E5E5E7] hover:border-[#1D1D1F]'
                        }`}
                      >
                        {sch.code}
                      </button>
                    );
                  })}
                <button
                  type="button"
                  onClick={() => setSelectedTargetSchoolIds(schools.map(s => s.id))}
                  className="text-xs text-[#0071E3] font-semibold underline hover:text-[#0071E3]/80 cursor-pointer"
                >
                  Select All
                </button>
              </div>
            )}
          </div>

          {/* Action Save Buttons */}
          <div className="pt-3 border-t border-[#E5E5E7] flex items-center justify-between gap-3">
            <span className="text-xs text-[#86868B]">
              {sizeRows.length} size rates ready to save
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveAll}
                className="px-5 py-2.5 rounded-xl bg-[#1D1D1F] text-white text-xs font-semibold hover:bg-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Saving All...' : 'Save All Sizes & Rates'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
