import React, { useState, useEffect } from 'react';
import { 
  X, 
  School as SchoolIcon, 
  Check, 
  Trash2, 
  AlertCircle,
  TrendingUp,
  Phone,
  MapPin,
  FileText
} from 'lucide-react';
import { db } from '../db/db';
import { type School, type PriceEntry, type StoreBusinessType, type ShopConfig } from '../types';
import { getCatalogTabMeta } from '../lib/catalogLabels';
import { formatMoney } from '../lib/locale';

interface SchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchoolSaved: (school: School) => void;
  schoolToEdit?: School | null;
}

export const SchoolModal: React.FC<SchoolModalProps> = ({
  isOpen,
  onClose,
  onSchoolSaved,
  schoolToEdit,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [multiplier, setMultiplier] = useState('1.0');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);

  const [recalcRates, setRecalcRates] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [storeType, setStoreType] = useState<StoreBusinessType | undefined>('apparel');
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);

  useEffect(() => {
    async function loadStoreType() {
      const cfgs = await db.shop_config.toArray();
      if (cfgs.length > 0) {
        setStoreType(cfgs[0].store_type);
        setShopConfig(cfgs[0]);
      }
    }
    loadStoreType();
    setConfirmDelete(false);
  }, [isOpen]);

  const catalogMeta = getCatalogTabMeta(storeType);
  const CatalogIcon = catalogMeta.icon;

  useEffect(() => {
    if (schoolToEdit) {
      setName(schoolToEdit.name);
      setCode(schoolToEdit.code);
      setMultiplier(String(schoolToEdit.multiplier || 1.0));
      setPhone(schoolToEdit.phone || '');
      setAddress(schoolToEdit.address || '');
      setNotes(schoolToEdit.notes || '');
      setActive(schoolToEdit.active !== false);
      setRecalcRates(false);
    } else {
      setName('');
      setCode('');
      setMultiplier('1.0');
      setPhone('');
      setAddress('');
      setNotes('');
      setActive(true);
      setRecalcRates(false);
      setErrorMsg(null);
    }
  }, [schoolToEdit, isOpen]);

  if (!isOpen) return null;

  // Auto-generate short code from name if code is empty or user is typing name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!schoolToEdit && (!code || code.length <= 4)) {
      // e.g. "Army Public School" -> "APS"
      const words = val.trim().split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        const acronym = words.map(w => w[0].toUpperCase()).join('').substring(0, 5);
        setCode(acronym);
      } else if (words.length === 1 && words[0].length >= 3) {
        setCode(words[0].substring(0, 4).toUpperCase());
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();

    if (!trimmedName) {
      setErrorMsg(`Please enter ${catalogMeta.entityName.toLowerCase()} name`);
      return;
    }
    if (!trimmedCode) {
      setErrorMsg('Please enter a short code (e.g. DAV, DPS, APS)');
      return;
    }

    const mult = Math.max(0.1, parseFloat(multiplier) || 1.0);
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const schoolId = schoolToEdit
        ? schoolToEdit.id
        : `sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const schoolRecord: School = {
        id: schoolId,
        code: trimmedCode,
        name: trimmedName,
        multiplier: mult,
        active,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (schoolToEdit) {
        await db.schools.update(schoolId, schoolRecord);

        // If multiplier changed and user opted to recalculate
        if (recalcRates) {
          const products = await db.products.toArray();
          const sizes = await db.sizes.toArray();
          const pricesToPut: PriceEntry[] = [];

          for (const prod of products) {
            if (prod.size_group_id) {
              const matchingSizes = sizes.filter(s => s.size_group_id === prod.size_group_id);
              matchingSizes.forEach((sz, idx) => {
                const step = idx * 10;
                const calcPrice = Math.round((prod.base_price * mult) / 5) * 5 + step;
                pricesToPut.push({
                  id: `pr_${schoolId}_${prod.id}_${sz.id}`,
                  school_id: schoolId,
                  product_id: prod.id,
                  size_id: sz.id,
                  price: calcPrice,
                });
              });
            } else {
              const calcPrice = Math.round((prod.base_price * mult) / 5) * 5;
              pricesToPut.push({
                id: `pr_${schoolId}_${prod.id}_null`,
                school_id: schoolId,
                product_id: prod.id,
                size_id: null,
                price: calcPrice,
              });
            }
          }
          await db.price_list.bulkPut(pricesToPut);
        }
      } else {
        // NEW SCHOOL: insert school record and automatically populate price list for all existing products!
        await db.schools.add(schoolRecord);

        const products = await db.products.toArray();
        const sizes = await db.sizes.toArray();
        const pricesToPut: PriceEntry[] = [];

        for (const prod of products) {
          if (prod.size_group_id) {
            const matchingSizes = sizes.filter(s => s.size_group_id === prod.size_group_id);
            matchingSizes.forEach((sz, idx) => {
              const step = idx * 10;
              const calcPrice = Math.round((prod.base_price * mult) / 5) * 5 + step;
              pricesToPut.push({
                id: `pr_${schoolId}_${prod.id}_${sz.id}`,
                school_id: schoolId,
                product_id: prod.id,
                size_id: sz.id,
                price: calcPrice,
              });
            });
          } else {
            const calcPrice = Math.round((prod.base_price * mult) / 5) * 5;
            pricesToPut.push({
              id: `pr_${schoolId}_${prod.id}_null`,
              school_id: schoolId,
              product_id: prod.id,
              size_id: null,
              price: calcPrice,
            });
          }
        }

        if (pricesToPut.length > 0) {
          await db.price_list.bulkPut(pricesToPut);
        }
      }

      onSchoolSaved(schoolRecord);
      onClose();
    } catch (err: unknown) {
      console.error(`Failed to save ${catalogMeta.entityName.toLowerCase()}:`, err);
      setErrorMsg((err as Error)?.message || `Failed to save ${catalogMeta.entityName.toLowerCase()}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!schoolToEdit) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    try {
      setIsSaving(true);
      await db.schools.delete(schoolToEdit.id);
      await db.price_list.where('school_id').equals(schoolToEdit.id).delete();
      onSchoolSaved(schoolToEdit);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to delete account:', err);
      setErrorMsg((err as Error)?.message || 'Failed to delete');
    } finally {
      setIsSaving(false);
    }
  };

  // Preview calculations
  const parsedMult = parseFloat(multiplier) || 1.0;
  const sampleShirt = Math.round((25 * parsedMult) * 100) / 100;
  const samplePant = Math.round((45 * parsedMult) * 100) / 100;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl max-w-lg w-full shadow-xl border border-[#E5E5E7] dark:border-zinc-800 overflow-hidden my-auto animate-in fade-in-50">
        {/* Header */}
        <div className="p-4 bg-[#F5F5F7] dark:bg-zinc-900 border-b border-[#E5E5E7] dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center">
              <CatalogIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-base text-[#1D1D1F] dark:text-zinc-100">
                {schoolToEdit ? `Edit ${catalogMeta.entityName} Master` : `Add New ${catalogMeta.entityName}`}
              </h2>
              <p className="text-xs text-[#86868B] dark:text-zinc-400">
                Registers {catalogMeta.entityName.toLowerCase()} for instant 1-tap counter billing and price books
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#86868B] hover:text-[#1D1D1F] p-1 cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto bg-white dark:bg-zinc-950">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* School Name */}
          <div>
            <label className="text-xs font-medium text-[#515154] dark:text-zinc-300 block mb-1">
              {catalogMeta.entityName} Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder={`e.g. ${catalogMeta.entityName === 'School' ? 'Delhi Public School, Sector 45' : 'Platinum Premium Catalog'}`}
              className="w-full h-10 px-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-800 text-sm font-medium focus:outline-none focus:border-[#1D1D1F] bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white"
              autoFocus
            />
          </div>

          {/* Short Code & Pricing Multiplier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#515154] dark:text-zinc-300 block mb-1">
                Short Code (Chip Label) *
              </label>
              <input
                type="text"
                required
                maxLength={8}
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. DPS, KV, DAV"
                className="w-full h-10 px-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-800 text-sm font-bold text-[#1D1D1F] dark:text-zinc-100 uppercase focus:outline-none focus:border-[#1D1D1F] bg-white dark:bg-zinc-900"
              />
              <span className="text-[10px] text-[#86868B] dark:text-zinc-400 block mt-0.5">
                Displays on counter billing chips
              </span>
            </div>

            <div>
              <label className="text-xs font-medium text-[#515154] dark:text-zinc-300 block mb-1">
                Rate Multiplier
              </label>
              <input
                type="number"
                step="0.05"
                min="0.2"
                max="3.0"
                value={multiplier}
                onChange={e => setMultiplier(e.target.value)}
                placeholder="1.0"
                className="w-full h-10 px-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-800 text-sm font-medium focus:outline-none focus:border-[#1D1D1F] bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white"
              />
              <span className="text-[10px] text-[#86868B] dark:text-zinc-400 block mt-0.5">
                1.0 = standard, 1.15 = +15%
              </span>
            </div>
          </div>

          {/* Multiplier Calculation Live Preview */}
          <div className="p-3 rounded-xl bg-[#F5F5F7] dark:bg-zinc-900 border border-[#E5E5E7] dark:border-zinc-800 text-xs space-y-1">
            <div className="font-bold text-[#1D1D1F] dark:text-zinc-100 flex items-center justify-between">
              <span>Automatic Price Calculation Preview ({parsedMult}x):</span>
            </div>
            <div className="flex justify-between text-[#86868B] dark:text-zinc-400">
              <span>Sample Item A ({formatMoney(25, shopConfig)}):</span>
              <strong className="text-[#1D1D1F] dark:text-zinc-100">{formatMoney(sampleShirt, shopConfig)}</strong>
            </div>
            <div className="flex justify-between text-[#86868B] dark:text-zinc-400">
              <span>Sample Item B ({formatMoney(45, shopConfig)}):</span>
              <strong className="text-[#1D1D1F] dark:text-zinc-100">{formatMoney(samplePant, shopConfig)}</strong>
            </div>
            <p className="text-[10px] text-[#86868B] dark:text-zinc-400 italic pt-1">
              Saving this {catalogMeta.entityName.toLowerCase()} will seed rate card entries at these multiplier values.
            </p>
          </div>

          {/* If editing: recalculate rates checkbox */}
          {schoolToEdit && (
            <label className="flex items-center gap-2 p-2 rounded-xl bg-[#F5F5F7] dark:bg-zinc-900 border border-[#E5E5E7] dark:border-zinc-800 text-xs font-medium text-[#1D1D1F] dark:text-zinc-200 cursor-pointer">
              <input
                type="checkbox"
                checked={recalcRates}
                onChange={e => setRecalcRates(e.target.checked)}
                className="w-4 h-4 accent-[#1D1D1F] rounded"
              />
              <span>Recalculate &amp; reset all product prices for this {catalogMeta.entityName.toLowerCase()} using multiplier ({parsedMult}x)?</span>
            </label>
          )}

          {/* Contact & Address */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#515154] dark:text-zinc-300 block mb-1">
                Contact Phone (Optional)
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 011-23456789"
                className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-800 text-xs font-medium focus:outline-none focus:border-[#1D1D1F] bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[#515154] dark:text-zinc-300 block mb-1">
                Campus / Address (Optional)
              </label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="e.g. Sector 14, Main Road"
                className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-800 text-xs font-medium focus:outline-none focus:border-[#1D1D1F] bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white"
              />
            </div>
          </div>

          {/* Active Status Toggle */}
          <div className="p-3 rounded-xl border border-[#E5E5E7] dark:border-zinc-800 bg-[#F5F5F7] dark:bg-zinc-900 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[#1D1D1F] dark:text-zinc-100">Active on POS Counter</div>
              <div className="text-[11px] text-[#86868B] dark:text-zinc-400">
                Inactive {catalogMeta.label.toLowerCase()} are hidden from quick billing chips but preserved in history
              </div>
            </div>
            <input
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="w-4 h-4 accent-[#1D1D1F] rounded"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#E5E5E7] dark:border-zinc-800 flex items-center justify-between gap-3">
            {schoolToEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 font-semibold text-xs hover:bg-red-100 dark:hover:bg-red-950/50 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmDelete ? 'Confirm Delete?' : 'Delete'}</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#E5E5E7] dark:border-zinc-800 text-xs font-semibold text-[#86868B] dark:text-zinc-400 hover:bg-[#F5F5F7] dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:bg-[#333336] dark:hover:bg-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : schoolToEdit ? 'Save Changes' : `Create ${catalogMeta.entityName}`}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
