import React, { useState, useEffect } from 'react';
import {
  X,
  PackagePlus,
  Check,
  AlertCircle,
  Trash2,
  FolderTree,
  Plus,
} from 'lucide-react';
import { db } from '../db/db';
import { getCurrencySymbol } from '../lib/locale';
import { type Product, type ProductVariant, type Category, type ShopConfig } from '../types';
import { CategoryManagerModal } from './CategoryManagerModal';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductSaved: (product: Product) => void;
  productToEdit?: Product | null;
}

interface EditableVariantRow {
  id: string;
  size_label: string;
  color_label: string;
  sku: string;
  barcode: string;
  price: string;
  cost_price: string;
  tax_rate: string;
  stock_qty: string;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onProductSaved,
  productToEdit,
}) => {
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('tops');
  const [brand, setBrand] = useState('');
  const [skuPrefix, setSkuPrefix] = useState('');
  const [basePrice, setBasePrice] = useState('45');
  const [costPrice, setCostPrice] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [hasVariants, setHasVariants] = useState(true);

  const [sizesInput, setSizesInput] = useState('S, M, L, XL');
  const [colorsInput, setColorsInput] = useState('Black, White');
  const [singleBarcode, setSingleBarcode] = useState('');
  const [singleStock, setSingleStock] = useState('20');
  const [variantRows, setVariantRows] = useState<EditableVariantRow[]>([]);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadMetadata = async () => {
    const [catList, cfgs] = await Promise.all([
      db.categories.toArray(),
      db.shop_config.toArray(),
    ]);
    const sorted = catList.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    setCategories(sorted);
    if (cfgs.length > 0) setShopConfig(cfgs[0]);
    if (!productToEdit && sorted.length > 0 && !sorted.some(c => c.id === category)) {
      setCategory(sorted[0].id);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadMetadata();
    setConfirmDelete(false);
    setErrorMsg(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    async function hydrateEdit() {
      if (productToEdit) {
        setName(productToEdit.name);
        setCategory(productToEdit.category || 'tops');
        setBrand(productToEdit.brand || '');
        setSkuPrefix(productToEdit.sku_prefix || '');
        setBasePrice(String(productToEdit.base_price));
        setCostPrice(
          typeof productToEdit.cost_price === 'number' ? String(productToEdit.cost_price) : ''
        );
        setTaxRate(
          typeof productToEdit.tax_rate === 'number' ? String(productToEdit.tax_rate) : ''
        );
        setLowStockThreshold(String(productToEdit.low_stock_threshold || 5));

        const existingVariants = await db.variants
          .where('product_id')
          .equals(productToEdit.id)
          .toArray();

        if (existingVariants.length <= 1 && !productToEdit.has_variants) {
          setHasVariants(false);
          const v = existingVariants[0];
          setSingleBarcode(v?.barcode || '');
          setSingleStock(String(v?.stock_qty ?? productToEdit.stock ?? 0));
          if (typeof v?.cost_price === 'number' && !productToEdit.cost_price) {
            setCostPrice(String(v.cost_price));
          }
          if (typeof v?.tax_rate === 'number' && typeof productToEdit.tax_rate !== 'number') {
            setTaxRate(String(v.tax_rate));
          }
          setVariantRows([]);
        } else {
          setHasVariants(true);
          setVariantRows(
            existingVariants.map(v => ({
              id: v.id,
              size_label: v.size_label,
              color_label: v.color_label,
              sku: v.sku,
              barcode: v.barcode,
              price: String(v.price),
              cost_price:
                typeof v.cost_price === 'number'
                  ? String(v.cost_price)
                  : typeof productToEdit.cost_price === 'number'
                  ? String(productToEdit.cost_price)
                  : '',
              tax_rate: typeof v.tax_rate === 'number' ? String(v.tax_rate) : '',
              stock_qty: String(v.stock_qty),
            }))
          );
        }
      } else {
        setName('');
        setBrand('');
        setSkuPrefix('');
        setBasePrice('45');
        setCostPrice('');
        setTaxRate('');
        setLowStockThreshold('5');
        setHasVariants(true);
        setSizesInput('S, M, L, XL');
        setColorsInput('Black');
        setSingleBarcode(`890${Math.floor(100000 + Math.random() * 899999)}`);
        setSingleStock('20');
        setVariantRows([]);
      }
    }

    hydrateEdit();
  }, [productToEdit, isOpen]);

  if (!isOpen) return null;

  const currencySymbol = getCurrencySymbol(shopConfig);

  const generateMatrix = () => {
    const cleanName = name.trim() || 'ITEM';
    const prefix = (
      skuPrefix.trim() ||
      cleanName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) ||
      'SKU'
    ).toUpperCase();

    const sizeList = sizesInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const colorList = colorsInput
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    const finalSizes = sizeList.length > 0 ? sizeList : ['One Size'];
    const finalColors = colorList.length > 0 ? colorList : ['Standard'];
    const parsedPrice = String(Math.max(0, parseFloat(basePrice) || 0));

    const generated: EditableVariantRow[] = [];
    let counter = 1;
    for (const color of finalColors) {
      for (const size of finalSizes) {
        const colShort = color.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'STD';
        const szShort = size.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'OS';
        const randSuffix = Math.floor(100 + Math.random() * 899);
        generated.push({
          id: `var_${Date.now()}_${counter++}_${Math.random().toString(36).slice(2, 5)}`,
          size_label: size,
          color_label: color,
          sku: `${prefix}-${colShort}-${szShort}`,
          barcode: `${Date.now().toString().slice(-6)}${counter}${randSuffix}`.slice(0, 10),
          price: parsedPrice,
          cost_price: costPrice.trim(),
          tax_rate: taxRate.trim(),
          stock_qty: '10',
        });
      }
    }
    setVariantRows(generated);
  };

  const handleAddEmptyVariantRow = () => {
    const prefix = (skuPrefix.trim() || name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'SKU').toUpperCase();
    const idx = variantRows.length + 1;
    setVariantRows(prev => [
      ...prev,
      {
        id: `var_${Date.now()}_${idx}`,
        size_label: 'M',
        color_label: 'Standard',
        sku: `${prefix}-V${idx}`,
        barcode: `${Date.now().toString().slice(-6)}${idx}`,
        price: basePrice || '0',
        cost_price: costPrice.trim(),
        tax_rate: taxRate.trim(),
        stock_qty: '10',
      },
    ]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Please enter a product name.');
      return;
    }

    const parsedBase = Math.max(0, parseFloat(basePrice) || 0);
    const parsedCost =
      costPrice.trim() !== '' && !isNaN(parseFloat(costPrice))
        ? Math.max(0, parseFloat(costPrice))
        : undefined;
    const parsedProductTax =
      taxRate.trim() !== '' && !isNaN(parseFloat(taxRate))
        ? Math.max(0, parseFloat(taxRate))
        : undefined;
    const parsedThreshold = Math.max(1, parseInt(lowStockThreshold, 10) || 5);
    const cleanPrefix = (
      skuPrefix.trim() ||
      trimmedName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) ||
      'SKU'
    ).toUpperCase();

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const prodId = productToEdit
        ? productToEdit.id
        : `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      let variantsToSave: ProductVariant[] = [];

      if (hasVariants) {
        let rows = variantRows;
        if (rows.length === 0) {
          // Auto-build once if merchant didn't press Generate
          const sizeList = sizesInput.split(',').map(s => s.trim()).filter(Boolean);
          const colorList = colorsInput.split(',').map(c => c.trim()).filter(Boolean);
          const finalSizes = sizeList.length > 0 ? sizeList : ['One Size'];
          const finalColors = colorList.length > 0 ? colorList : ['Standard'];
          let idx = 1;
          rows = [];
          for (const c of finalColors) {
            for (const s of finalSizes) {
              rows.push({
                id: `var_${prodId}_${idx++}`,
                size_label: s,
                color_label: c,
                sku: `${cleanPrefix}-${c.slice(0, 3).toUpperCase()}-${s.toUpperCase()}`,
                barcode: `${Date.now().toString().slice(-6)}${idx}`,
                price: String(parsedBase),
                cost_price: costPrice.trim(),
                tax_rate: taxRate.trim(),
                stock_qty: '10',
              });
            }
          }
        }

        variantsToSave = rows.map((r, i) => {
          const rowCost =
            r.cost_price.trim() !== '' && !isNaN(parseFloat(r.cost_price))
              ? Math.max(0, parseFloat(r.cost_price))
              : parsedCost;
          const rowTax =
            r.tax_rate.trim() !== '' && !isNaN(parseFloat(r.tax_rate))
              ? Math.max(0, parseFloat(r.tax_rate))
              : parsedProductTax;
          return {
            id: r.id,
            product_id: prodId,
            size_label: r.size_label.trim() || 'One Size',
            color_label: r.color_label.trim() || 'Standard',
            sku: r.sku.trim() || `${cleanPrefix}-${i + 1}`,
            barcode: r.barcode.trim() || `${Date.now().toString().slice(-6)}${i + 1}`,
            price: Math.max(0, parseFloat(r.price) || parsedBase),
            cost_price: rowCost,
            tax_rate: rowTax,
            stock_qty: Math.max(0, parseInt(r.stock_qty, 10) || 0),
            low_stock_threshold: parsedThreshold,
          };
        });
      } else {
        const qty = Math.max(0, parseInt(singleStock, 10) || 0);
        variantsToSave = [
          {
            id: `var_${prodId}_free`,
            product_id: prodId,
            size_label: 'One Size',
            color_label: 'Standard',
            sku: `${cleanPrefix}-OS`,
            barcode: singleBarcode.trim() || `${Date.now().toString().slice(-8)}`,
            price: parsedBase,
            cost_price: parsedCost,
            tax_rate: parsedProductTax,
            stock_qty: qty,
            low_stock_threshold: parsedThreshold,
          },
        ];
      }

      const totalStock = variantsToSave.reduce((acc, v) => acc + v.stock_qty, 0);

      const productRecord: Product = {
        id: prodId,
        name: trimmedName,
        category,
        brand: brand.trim() || undefined,
        sku_prefix: cleanPrefix,
        has_variants: hasVariants && variantsToSave.length > 1,
        size_group_id: null,
        base_price: parsedBase,
        cost_price: parsedCost,
        tax_rate: parsedProductTax,
        stock: totalStock,
        low_stock_threshold: parsedThreshold,
        active: true,
      };

      if (productToEdit) {
        await db.products.update(prodId, productRecord);
        await db.variants.where('product_id').equals(prodId).delete();
      } else {
        await db.products.add(productRecord);
      }

      await db.variants.bulkPut(variantsToSave);

      onProductSaved(productRecord);
      onClose();
    } catch (err: any) {
      console.error('Failed to save product:', err);
      setErrorMsg(err?.message || 'Failed to save product.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!productToEdit) return;
    setIsSaving(true);
    try {
      await db.products.delete(productToEdit.id);
      await db.variants.where('product_id').equals(productToEdit.id).delete();
      await db.stocks.where('product_id').equals(productToEdit.id).delete();
      onProductSaved(productToEdit);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete product');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-zinc-950 dark:text-zinc-50">
                {productToEdit ? 'Edit Product & Variants' : 'Add Product'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Set category, pricing, barcodes, and Size × Color stock
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Heavyweight Crew Tee"
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                autoFocus
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Category *
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <FolderTree className="w-3 h-3" />
                  <span>Manage</span>
                </button>
              </div>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-950 dark:text-zinc-50"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Brand / Collection
              </label>
              <input
                type="text"
                value={brand}
                onChange={e => setBrand(e.target.value)}
                placeholder="Optional (e.g. Studio Basics)"
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-950 dark:text-zinc-50"
              />
            </div>
          </div>

          {/* Pricing & SKU Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Base Price ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={basePrice}
                onChange={e => setBasePrice(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm font-semibold tabular-nums text-zinc-950 dark:text-zinc-50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Cost ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={e => setCostPrice(e.target.value)}
                placeholder="Optional"
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm tabular-nums text-zinc-950 dark:text-zinc-50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Tax % Override
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={taxRate}
                onChange={e => setTaxRate(e.target.value)}
                placeholder={shopConfig ? `Default (${shopConfig.tax_rate}%)` : 'Store default'}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm tabular-nums text-zinc-950 dark:text-zinc-50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                SKU Prefix
              </label>
              <input
                type="text"
                value={skuPrefix}
                onChange={e => setSkuPrefix(e.target.value.toUpperCase())}
                placeholder="TEE"
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono font-semibold uppercase text-zinc-950 dark:text-zinc-50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Low Stock Alert
              </label>
              <input
                type="number"
                min="1"
                value={lowStockThreshold}
                onChange={e => setLowStockThreshold(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm tabular-nums text-zinc-950 dark:text-zinc-50"
              />
            </div>
          </div>

          {/* Variant Toggle */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-50">
                  Size &amp; Color Variants
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Create separate SKUs, barcodes, and stock levels per variant
                </div>
              </div>

              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setHasVariants(true)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                    hasVariants
                      ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Variants
                </button>
                <button
                  type="button"
                  onClick={() => setHasVariants(false)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                    !hasVariants
                      ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Single Item
                </button>
              </div>
            </div>

            {!hasVariants ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Barcode
                  </label>
                  <input
                    type="text"
                    value={singleBarcode}
                    onChange={e => setSingleBarcode(e.target.value)}
                    placeholder="890100101"
                    className="w-full h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-950 dark:text-zinc-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Opening Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={singleStock}
                    onChange={e => setSingleStock(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm tabular-nums text-zinc-950 dark:text-zinc-50"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Sizes (comma-separated)
                        </label>
                        <div className="flex gap-1.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setSizesInput('XS, S, M, L, XL')}
                            className="text-zinc-500 hover:text-zinc-950 dark:hover:text-white underline cursor-pointer"
                          >
                            Apparel
                          </button>
                          <button
                            type="button"
                            onClick={() => setSizesInput('7, 8, 9, 10, 11')}
                            className="text-zinc-500 hover:text-zinc-950 dark:hover:text-white underline cursor-pointer"
                          >
                            Shoes
                          </button>
                          <button
                            type="button"
                            onClick={() => setSizesInput('28, 30, 32, 34, 36')}
                            className="text-zinc-500 hover:text-zinc-950 dark:hover:text-white underline cursor-pointer"
                          >
                            Waist
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={sizesInput}
                        onChange={e => setSizesInput(e.target.value)}
                        placeholder="S, M, L, XL"
                        className="w-full h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-950 dark:text-zinc-50"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                        Colors (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={colorsInput}
                        onChange={e => setColorsInput(e.target.value)}
                        placeholder="Black, Navy, Chalk"
                        className="w-full h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-950 dark:text-zinc-50"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={generateMatrix}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 cursor-pointer"
                    >
                      Generate Size × Color Matrix
                    </button>

                    <button
                      type="button"
                      onClick={handleAddEmptyVariantRow}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Row</span>
                    </button>
                  </div>
                </div>

                {variantRows.length > 0 && (
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="py-2 px-2 font-medium">Size</th>
                          <th className="py-2 px-2 font-medium">Color</th>
                          <th className="py-2 px-2 font-medium">SKU</th>
                          <th className="py-2 px-2 font-medium">Barcode</th>
                          <th className="py-2 px-2 font-medium text-right">Price</th>
                          <th className="py-2 px-2 font-medium text-right">Cost</th>
                          <th className="py-2 px-2 font-medium text-right">Tax %</th>
                          <th className="py-2 px-2 font-medium text-right">Stock</th>
                          <th className="py-2 px-1" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {variantRows.map((row, idx) => (
                          <tr key={row.id}>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.size_label}
                                onChange={e =>
                                  setVariantRows(prev =>
                                    prev.map((r, i) => (i === idx ? { ...r, size_label: e.target.value } : r))
                                  )
                                }
                                className="w-14 h-8 px-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.color_label}
                                onChange={e =>
                                  setVariantRows(prev =>
                                    prev.map((r, i) => (i === idx ? { ...r, color_label: e.target.value } : r))
                                  )
                                }
                                className="w-20 h-8 px-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.sku}
                                onChange={e =>
                                  setVariantRows(prev =>
                                    prev.map((r, i) => (i === idx ? { ...r, sku: e.target.value.toUpperCase() } : r))
                                  )
                                }
                                className="w-24 h-8 px-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-[11px]"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.barcode}
                                onChange={e =>
                                  setVariantRows(prev =>
                                    prev.map((r, i) => (i === idx ? { ...r, barcode: e.target.value } : r))
                                  )
                                }
                                className="w-24 h-8 px-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-[11px]"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={row.price}
                                onChange={e =>
                                  setVariantRows(prev =>
                                    prev.map((r, i) => (i === idx ? { ...r, price: e.target.value } : r))
                                  )
                                }
                                className="w-16 h-8 px-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-right font-mono tabular-nums"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="—"
                                value={row.cost_price}
                                onChange={e =>
                                  setVariantRows(prev =>
                                    prev.map((r, i) => (i === idx ? { ...r, cost_price: e.target.value } : r))
                                  )
                                }
                                className="w-16 h-8 px-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-right font-mono tabular-nums"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                placeholder="Std"
                                value={row.tax_rate}
                                onChange={e =>
                                  setVariantRows(prev =>
                                    prev.map((r, i) => (i === idx ? { ...r, tax_rate: e.target.value } : r))
                                  )
                                }
                                className="w-14 h-8 px-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-right font-mono tabular-nums"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="number"
                                min="0"
                                value={row.stock_qty}
                                onChange={e =>
                                  setVariantRows(prev =>
                                    prev.map((r, i) => (i === idx ? { ...r, stock_qty: e.target.value } : r))
                                  )
                                }
                                className="w-14 h-8 px-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-right font-mono tabular-nums"
                              />
                            </td>
                            <td className="p-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => setVariantRows(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1 text-zinc-400 hover:text-rose-600 cursor-pointer"
                                title="Remove variant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            {productToEdit ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSaving}
                    className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : productToEdit ? 'Save Changes' : 'Create Product'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesChanged={loadMetadata}
      />
    </div>
  );
};
