import React, { useState } from 'react';
import { 
  Sparkles, 
  PackagePlus, 
  Check, 
  X, 
  AlertCircle, 
  Sliders, 
  Layers, 
  Tag, 
  School as SchoolIcon 
} from 'lucide-react';
import { db } from '../db/db';
import { type School, type Product, type SizeGroup, type SizeItem, type PriceEntry, type ProductStock } from '../types';

interface CatalogGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools: School[];
  onGenerated: () => void;
}

interface UniformTemplateItem {
  id: string;
  name: string;
  category: string;
  hasSizes: boolean;
  sizeGroupId: string;
  sizeGroupName: string;
  sizes: string[];
  basePrice: number;
  sizeIncrement: number;
  selected: boolean;
}

const DEFAULT_TEMPLATES: UniformTemplateItem[] = [
  {
    id: 'tpl_shirt_half',
    name: 'Half Sleeve School Shirt',
    category: 'uniform',
    hasSizes: true,
    sizeGroupId: 'sg_shirt_num',
    sizeGroupName: 'Shirt Sizes (22-42)',
    sizes: ['22', '24', '26', '28', '30', '32', '34', '36', '38', '40', '42'],
    basePrice: 240,
    sizeIncrement: 20,
    selected: true,
  },
  {
    id: 'tpl_shirt_full',
    name: 'Full Sleeve School Shirt',
    category: 'uniform',
    hasSizes: true,
    sizeGroupId: 'sg_shirt_num',
    sizeGroupName: 'Shirt Sizes (22-42)',
    sizes: ['22', '24', '26', '28', '30', '32', '34', '36', '38', '40', '42'],
    basePrice: 280,
    sizeIncrement: 20,
    selected: true,
  },
  {
    id: 'tpl_pant',
    name: 'School Pant / Trousers',
    category: 'uniform',
    hasSizes: true,
    sizeGroupId: 'sg_pant_num',
    sizeGroupName: 'Pant Sizes (20-38)',
    sizes: ['20', '22', '24', '26', '28', '30', '32', '34', '36', '38'],
    basePrice: 320,
    sizeIncrement: 25,
    selected: true,
  },
  {
    id: 'tpl_skirt',
    name: 'School Skirt',
    category: 'uniform',
    hasSizes: true,
    sizeGroupId: 'sg_skirt_num',
    sizeGroupName: 'Skirt Sizes (20-36)',
    sizes: ['20', '22', '24', '26', '28', '30', '32', '34', '36'],
    basePrice: 300,
    sizeIncrement: 20,
    selected: true,
  },
  {
    id: 'tpl_tshirt_pe',
    name: 'House / PE T-Shirt',
    category: 'uniform',
    hasSizes: true,
    sizeGroupId: 'sg_shirt_num',
    sizeGroupName: 'T-Shirt Sizes (22-40)',
    sizes: ['22', '24', '26', '28', '30', '32', '34', '36', '38', '40'],
    basePrice: 220,
    sizeIncrement: 15,
    selected: true,
  },
  {
    id: 'tpl_trackpant',
    name: 'PE Track Pant',
    category: 'uniform',
    hasSizes: true,
    sizeGroupId: 'sg_pant_num',
    sizeGroupName: 'Trackpant Sizes (22-38)',
    sizes: ['22', '24', '26', '28', '30', '32', '34', '36', '38'],
    basePrice: 280,
    sizeIncrement: 20,
    selected: true,
  },
  {
    id: 'tpl_blazer',
    name: 'Winter School Blazer',
    category: 'winterwear',
    hasSizes: true,
    sizeGroupId: 'sg_blazer_num',
    sizeGroupName: 'Blazer Sizes (26-40)',
    sizes: ['26', '28', '30', '32', '34', '36', '38', '40'],
    basePrice: 850,
    sizeIncrement: 50,
    selected: false,
  },
  {
    id: 'tpl_shoes_black',
    name: 'Black School Shoes (Lace/Velcro)',
    category: 'footwear',
    hasSizes: true,
    sizeGroupId: 'sg_shoes_num',
    sizeGroupName: 'Shoe Sizes (1-11)',
    sizes: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
    basePrice: 420,
    sizeIncrement: 20,
    selected: true,
  },
  {
    id: 'tpl_tie',
    name: 'School Tie',
    category: 'accessories',
    hasSizes: false,
    sizeGroupId: '',
    sizeGroupName: 'Free Size',
    sizes: [],
    basePrice: 80,
    sizeIncrement: 0,
    selected: true,
  },
  {
    id: 'tpl_belt',
    name: 'School Belt',
    category: 'accessories',
    hasSizes: false,
    sizeGroupId: '',
    sizeGroupName: 'Free Size',
    sizes: [],
    basePrice: 90,
    sizeIncrement: 0,
    selected: true,
  },
  {
    id: 'tpl_socks',
    name: 'Cotton School Socks (Pair)',
    category: 'accessories',
    hasSizes: false,
    sizeGroupId: '',
    sizeGroupName: 'Free Size',
    sizes: [],
    basePrice: 60,
    sizeIncrement: 0,
    selected: true,
  },
];

export const CatalogGeneratorModal: React.FC<CatalogGeneratorModalProps> = ({
  isOpen,
  onClose,
  schools,
  onGenerated,
}) => {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(schools[0]?.id || '');
  const [templates, setTemplates] = useState<UniformTemplateItem[]>(DEFAULT_TEMPLATES);
  const [defaultStockPerSize, setDefaultStockPerSize] = useState<string>('10');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleTemplate = (id: string) => {
    setTemplates(prev =>
      prev.map(t => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handlePriceChange = (id: string, basePrice: number, sizeIncrement: number) => {
    setTemplates(prev =>
      prev.map(t => (t.id === id ? { ...t, basePrice, sizeIncrement } : t))
    );
  };

  const handleGenerate = async () => {
    if (!selectedSchoolId) {
      setErrorMsg('Please select target school');
      return;
    }

    const selectedTemplates = templates.filter(t => t.selected);
    if (selectedTemplates.length === 0) {
      setErrorMsg('Please select at least 1 garment template');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const stockVal = parseInt(defaultStockPerSize, 10) || 0;

      // 1. Ensure Size Groups & Sizes exist in DB
      const existingSizeGroups = await db.size_groups.toArray();
      const existingSizes = await db.sizes.toArray();

      const sizeGroupsToPut: SizeGroup[] = [];
      const sizesToPut: SizeItem[] = [];

      for (const tpl of selectedTemplates) {
        if (tpl.hasSizes && tpl.sizeGroupId) {
          if (!existingSizeGroups.some(sg => sg.id === tpl.sizeGroupId)) {
            sizeGroupsToPut.push({
              id: tpl.sizeGroupId,
              name: tpl.sizeGroupName,
            });
          }

          tpl.sizes.forEach((szLabel, idx) => {
            const szId = `sz_${tpl.sizeGroupId}_${szLabel}`;
            if (!existingSizes.some(s => s.id === szId)) {
              sizesToPut.push({
                id: szId,
                size_group_id: tpl.sizeGroupId,
                label: szLabel,
                sort_order: idx + 1,
              });
            }
          });
        }
      }

      if (sizeGroupsToPut.length > 0) await db.size_groups.bulkPut(sizeGroupsToPut);
      if (sizesToPut.length > 0) await db.sizes.bulkPut(sizesToPut);

      // Refresh sizes
      const allSizes = await db.sizes.toArray();

      // 2. Create Products, Prices & Stocks
      const existingProducts = await db.products.toArray();
      const productsToPut: Product[] = [];
      const pricesToPut: PriceEntry[] = [];
      const stocksToPut: ProductStock[] = [];

      for (const tpl of selectedTemplates) {
        let prodId = `prod_${tpl.id.replace('tpl_', '')}`;
        const existingProd = existingProducts.find(p => p.id === prodId || p.name.toLowerCase() === tpl.name.toLowerCase());
        if (existingProd) {
          prodId = existingProd.id;
        } else {
          productsToPut.push({
            id: prodId,
            name: tpl.name,
            category: tpl.category,
            size_group_id: tpl.hasSizes ? tpl.sizeGroupId : null,
            base_price: tpl.basePrice,
            stock: stockVal * (tpl.hasSizes ? tpl.sizes.length : 1),
            low_stock_threshold: 5,
          });
        }

        // Generate size rates & stocks
        if (tpl.hasSizes) {
          const productSizes = allSizes.filter(s => s.size_group_id === tpl.sizeGroupId);
          productSizes.sort((a, b) => a.sort_order - b.sort_order);

          productSizes.forEach((sz, idx) => {
            const calculatedPrice = tpl.basePrice + idx * tpl.sizeIncrement;
            const priceId = `pr_${selectedSchoolId}_${prodId}_${sz.id}`;

            pricesToPut.push({
              id: priceId,
              school_id: selectedSchoolId,
              product_id: prodId,
              size_id: sz.id,
              price: calculatedPrice,
            });

            const stockId = `${prodId}_${sz.id}`;
            stocksToPut.push({
              id: stockId,
              product_id: prodId,
              size_id: sz.id,
              size_label: sz.label,
              quantity: stockVal,
              min_stock: 5,
            });
          });
        } else {
          // Free size accessory
          const priceId = `pr_${selectedSchoolId}_${prodId}_null`;
          pricesToPut.push({
            id: priceId,
            school_id: selectedSchoolId,
            product_id: prodId,
            size_id: null,
            price: tpl.basePrice,
          });

          const stockId = `${prodId}_free`;
          stocksToPut.push({
            id: stockId,
            product_id: prodId,
            size_id: null,
            size_label: 'Free',
            quantity: stockVal,
            min_stock: 5,
          });
        }
      }

      if (productsToPut.length > 0) await db.products.bulkPut(productsToPut);
      if (pricesToPut.length > 0) await db.price_list.bulkPut(pricesToPut);
      if (stocksToPut.length > 0) await db.stocks.bulkPut(stocksToPut);

      onGenerated();
      onClose();
    } catch (err) {
      console.error('Error generating catalog:', err);
      setErrorMsg('Failed to generate catalog records');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-7 shadow-xl border border-[#E5E5E7] animate-in fade-in-50 max-h-[90vh] flex flex-col my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E7]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-[#1D1D1F]">1-Click School Uniform Catalog Generator</h2>
              <p className="text-xs text-[#86868B]">
                Auto-generate standard garments, size scales (20-42), and rate matrix curves in seconds
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#86868B] hover:text-[#1D1D1F] p-1 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 bg-red-50 text-red-900 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* School Target & Default Stock */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 p-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
          <div>
            <label className="text-xs font-semibold text-[#1D1D1F] block mb-1">
              Target School
            </label>
            <select
              value={selectedSchoolId}
              onChange={e => setSelectedSchoolId(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F] focus:outline-none"
            >
              {schools.map(s => (
                <option key={s.id} value={s.id}>
                  [{s.code}] {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#1D1D1F] block mb-1">
              Initial Stock Buffer per Size
            </label>
            <input
              type="number"
              value={defaultStockPerSize}
              onChange={e => setDefaultStockPerSize(e.target.value)}
              placeholder="10"
              className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-semibold bg-white text-[#1D1D1F] focus:outline-none"
            />
          </div>
        </div>

        {/* Template Garment Items List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1 mt-2">
          <div className="text-xs font-bold text-[#1D1D1F] uppercase tracking-wider mb-1">
            Select Garment Sets &amp; Set Base Rate Curves:
          </div>

          {templates.map(tpl => (
            <div
              key={tpl.id}
              className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                tpl.selected
                  ? 'bg-white border-[#1D1D1F] shadow-xs'
                  : 'bg-[#F5F5F7] border-[#E5E5E7] opacity-70'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={tpl.selected}
                  onChange={() => handleToggleTemplate(tpl.id)}
                  className="w-4 h-4 mt-1 accent-[#1D1D1F] rounded cursor-pointer"
                />

                <div>
                  <span className="font-bold text-xs text-[#1D1D1F] block">
                    {tpl.name}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#86868B] mt-0.5">
                    <span className="font-semibold">{tpl.sizeGroupName}</span>
                    {tpl.hasSizes && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-[10px] bg-[#F5F5F7] px-1.5 py-0.2 rounded border border-[#E5E5E7]">
                          {tpl.sizes.join(', ')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {tpl.selected && (
                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div>
                    <label className="text-[10px] font-medium text-[#515154] block">Base Rate (₹)</label>
                    <input
                      type="number"
                      value={tpl.basePrice}
                      onChange={e => handlePriceChange(tpl.id, parseFloat(e.target.value) || 0, tpl.sizeIncrement)}
                      className="w-20 h-7 px-2 rounded-lg border border-[#E5E5E7] text-xs font-semibold text-center bg-white"
                    />
                  </div>

                  {tpl.hasSizes && (
                    <div>
                      <label className="text-[10px] font-medium text-[#515154] block">+ Step / Size (₹)</label>
                      <input
                        type="number"
                        value={tpl.sizeIncrement}
                        onChange={e => handlePriceChange(tpl.id, tpl.basePrice, parseFloat(e.target.value) || 0)}
                        className="w-20 h-7 px-2 rounded-lg border border-[#E5E5E7] text-xs font-semibold text-center bg-white"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#E5E5E7] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#E5E5E7] text-xs font-semibold text-[#86868B] hover:bg-[#F5F5F7] cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-5 py-2.5 rounded-xl bg-[#1D1D1F] text-white text-xs font-semibold hover:bg-[#333336] transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isGenerating ? 'Generating Catalog...' : 'Generate Catalog & Rate Cards'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
