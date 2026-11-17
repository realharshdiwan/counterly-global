import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Barcode, Printer, X, Scan, Check } from 'lucide-react';
import { db } from '../db/db';
import { formatMoney } from '../lib/locale';
import { type Product, type ProductVariant, type ShopConfig } from '../types';
import { playBeep } from '../lib/printer';
import { encodeCode128 } from '../lib/barcode';

interface BarcodeStickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductId?: string;
}

export const BarcodeStickerModal: React.FC<BarcodeStickerModalProps> = ({
  isOpen,
  onClose,
  initialProductId,
}) => {
  const [activeTab, setActiveTab] = useState<'generator' | 'scanner_test'>('generator');
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [labelFormat, setLabelFormat] = useState<'thermal_single' | 'a4_sheet'>('thermal_single');
  const [variantQuantities, setVariantQuantities] = useState<Record<string, number>>({});
  const [testScanInput, setTestScanInput] = useState('');
  const [matchedScan, setMatchedScan] = useState<{ product: Product; variant: ProductVariant } | null>(null);
  const scannerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    async function load() {
      const [prods, vars, cfgs] = await Promise.all([
        db.products.toArray(),
        db.variants.toArray(),
        db.shop_config.toArray(),
      ]);
      setProducts(prods);
      setVariants(vars);
      if (cfgs.length > 0) setShopConfig(cfgs[0]);

      const targetId =
        initialProductId && prods.some(p => p.id === initialProductId)
          ? initialProductId
          : prods[0]?.id || '';
      setSelectedProductId(targetId);

      const qtyInit: Record<string, number> = {};
      vars.filter(v => v.product_id === targetId).forEach(v => {
        qtyInit[v.id] = 1;
      });
      setVariantQuantities(qtyInit);
    }
    load();
  }, [isOpen, initialProductId]);

  const currentProduct = products.find(p => p.id === selectedProductId) || products[0];

  const productVariants = useMemo(() => {
    if (!currentProduct) return [];
    return variants.filter(v => v.product_id === currentProduct.id);
  }, [currentProduct, variants]);

  const stickersToPrint = useMemo(() => {
    if (!currentProduct) return [];
    const list: { product: Product; variant: ProductVariant; barcode: ReturnType<typeof encodeCode128> }[] = [];
    for (const v of productVariants) {
      const count = variantQuantities[v.id] ?? 0;
      const encoded = encodeCode128(v.barcode || v.sku);
      for (let i = 0; i < count; i++) {
        list.push({ product: currentProduct, variant: v, barcode: encoded });
      }
    }
    return list;
  }, [currentProduct, productVariants, variantQuantities]);

  if (!isOpen) return null;

  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const nextQty: Record<string, number> = {};
    variants.filter(v => v.product_id === prodId).forEach(v => {
      nextQty[v.id] = 1;
    });
    setVariantQuantities(nextQty);
  };

  const handleTestScan = (code: string) => {
    setTestScanInput(code);
    const q = code.trim().toUpperCase();
    if (!q) {
      setMatchedScan(null);
      return;
    }
    const foundVar = variants.find(v => v.barcode.toUpperCase() === q || v.sku.toUpperCase() === q);
    if (foundVar) {
      const foundProd = products.find(p => p.id === foundVar.product_id);
      if (foundProd) {
        playBeep('success');
        setMatchedScan({ product: foundProd, variant: foundVar });
        return;
      }
    }
    setMatchedScan(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-3xl w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh] print:border-none print:shadow-none print:max-h-none">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center">
              <Barcode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-zinc-950 dark:text-zinc-50">Barcode Label Printer</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Print Code-128 hang tags &amp; stickers for variants
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('generator')}
                className={`px-3 py-1 rounded-md cursor-pointer ${
                  activeTab === 'generator'
                    ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                    : 'text-zinc-600 dark:text-zinc-300'
                }`}
              >
                Print Labels
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('scanner_test');
                  setTimeout(() => scannerRef.current?.focus(), 60);
                }}
                className={`px-3 py-1 rounded-md cursor-pointer ${
                  activeTab === 'scanner_test'
                    ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                    : 'text-zinc-600 dark:text-zinc-300'
                }`}
              >
                Scanner Test
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 print:p-0 print:overflow-visible">
          {activeTab === 'scanner_test' ? (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                  <Scan className="w-4 h-4" />
                  <span>Scan any Barcode or Type SKU</span>
                </label>
                <input
                  ref={scannerRef}
                  type="text"
                  value={testScanInput}
                  onChange={e => handleTestScan(e.target.value)}
                  placeholder="Scan barcode here..."
                  className="w-full h-11 px-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 font-mono text-sm font-semibold"
                />
              </div>

              {matchedScan && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      <span>{matchedScan.product.name}</span>
                    </div>
                    <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {matchedScan.variant.size_label} · {matchedScan.variant.color_label} · SKU {matchedScan.variant.sku}
                    </div>
                  </div>
                  <div className="text-base font-bold font-mono tabular-nums text-emerald-900 dark:text-emerald-200">
                    {formatMoney(matchedScan.variant.price, shopConfig)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:hidden">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Product
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={e => handleSelectProduct(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Label Format
                  </label>
                  <select
                    value={labelFormat}
                    onChange={e => setLabelFormat(e.target.value as 'thermal_single' | 'a4_sheet')}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold"
                  >
                    <option value="thermal_single">Thermal Roll (50 × 25 mm)</option>
                    <option value="a4_sheet">A4 Adhesive Sheet (3-Column Grid)</option>
                  </select>
                </div>
              </div>

              {productVariants.length > 0 && (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden print:hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                      <tr>
                        <th className="py-2 px-3">Variant</th>
                        <th className="py-2 px-3">SKU / Barcode</th>
                        <th className="py-2 px-3 text-right">Price</th>
                        <th className="py-2 px-3 text-right">Copies</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {productVariants.map(v => (
                        <tr key={v.id}>
                          <td className="py-2 px-3 font-medium">
                            {v.size_label} · {v.color_label}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-zinc-500">
                            {v.sku} · {v.barcode}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {formatMoney(v.price, shopConfig)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={variantQuantities[v.id] ?? 0}
                              onChange={e =>
                                setVariantQuantities(prev => ({
                                  ...prev,
                                  [v.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                                }))
                              }
                              className="w-16 h-7 px-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-right font-mono tabular-nums"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Printable Preview Area */}
              <div
                id="printable-barcode-stickers"
                className={`p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 print:border-none print:bg-white ${
                  labelFormat === 'a4_sheet'
                    ? 'barcode-print-a4 grid grid-cols-2 sm:grid-cols-3 gap-3'
                    : 'barcode-print-thermal-single flex flex-wrap gap-3'
                }`}
              >
                {stickersToPrint.map((st, idx) => (
                  <div
                    key={idx}
                    className="barcode-sticker-item bg-white text-black border border-zinc-300 rounded-lg p-2.5 w-48 flex flex-col justify-between gap-1"
                  >
                    <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wide border-b border-zinc-200 pb-0.5">
                      <span className="truncate">{shopConfig?.legal_name || 'SIKKADESK'}</span>
                      <span className="font-mono">{formatMoney(st.variant.price, shopConfig)}</span>
                    </div>
                    <div className="text-[11px] font-bold truncate leading-tight">
                      {st.product.name}
                    </div>
                    <div className="text-[9px] text-zinc-600 truncate">
                      {st.variant.size_label} · {st.variant.color_label}
                    </div>
                    <svg
                      viewBox={`0 0 ${st.barcode.totalWidth} 28`}
                      className="w-full h-7"
                      preserveAspectRatio="none"
                    >
                      {st.barcode.pattern.split('').map((bit, bIdx) =>
                        bit === '1' ? <rect key={bIdx} x={bIdx} y={0} width={1} height={28} fill="#000" /> : null
                      )}
                    </svg>
                    <div className="text-[8px] font-mono text-center tracking-widest">
                      {st.barcode.text}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between print:hidden">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {stickersToPrint.length} sticker{stickersToPrint.length === 1 ? '' : 's'} queued
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
            {activeTab === 'generator' && stickersToPrint.length > 0 && (
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Stickers</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
