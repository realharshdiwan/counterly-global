import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Barcode, 
  Printer, 
  X, 
  Tag, 
  Check, 
  RefreshCw,
  Usb,
  Radio,
  HelpCircle,
  Copy,
  Sliders,
  CheckCheck
} from 'lucide-react';
import { db } from '../db/db';
import { 
  type School, 
  type Product, 
  type SizeItem, 
  type PriceEntry, 
  type ShopConfig 
} from '../types';
import { bluetoothPrinter, playBeep } from '../lib/printer';
import { encodeCode128 } from '../lib/barcode';

interface BarcodeStickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools?: School[];
  products?: Product[];
  sizes?: SizeItem[];
  prices?: PriceEntry[];
  initialSchoolId?: string;
  initialProductId?: string;
}

export const BarcodeStickerModal: React.FC<BarcodeStickerModalProps> = ({
  isOpen,
  onClose,
  schools: propSchools,
  products: propProducts,
  sizes: propSizes,
  prices: propPrices,
  initialSchoolId,
  initialProductId,
}) => {
  const [activeTab, setActiveTab] = useState<'generator' | 'scanner_guide'>('generator');
  const [dbSchools, setDbSchools] = useState<School[]>([]);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [dbSizes, setDbSizes] = useState<SizeItem[]>([]);
  const [dbPrices, setDbPrices] = useState<PriceEntry[]>([]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [labelFormat, setLabelFormat] = useState<'thermal_single' | 'thermal_dual' | 'a4_sheet'>('thermal_single');
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Live scanner test state
  const [testScanInput, setTestScanInput] = useState('');
  const [lastScannedResult, setLastScannedResult] = useState<{
    code: string;
    matchedProduct?: Product;
    matchedSchool?: School;
    matchedSize?: string;
    matchedPrice?: number;
    timestamp: string;
  } | null>(null);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Data loading from DB on modal open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const [schs, prods, szs, prs, cfgs] = await Promise.all([
          propSchools && propSchools.length > 0 ? propSchools : db.schools.toArray(),
          propProducts && propProducts.length > 0 ? propProducts : db.products.toArray(),
          propSizes && propSizes.length > 0 ? propSizes : db.sizes.toArray(),
          propPrices && propPrices.length > 0 ? propPrices : db.price_list.toArray(),
          db.shop_config.toArray(),
        ]);

        if (!isMounted) return;

        setDbSchools(schs);
        setDbProducts(prods);
        setDbSizes(szs);
        setDbPrices(prs);
        if (cfgs.length > 0) setShopConfig(cfgs[0]);

        const targetSchId = initialSchoolId && schs.some(s => s.id === initialSchoolId)
          ? initialSchoolId
          : schs[0]?.id || '';
        setSelectedSchoolId(targetSchId);

        const targetProdId = initialProductId && prods.some(p => p.id === initialProductId)
          ? initialProductId
          : prods[0]?.id || '';
        setSelectedProductId(targetProdId);

        const initQty: Record<string, number> = {};
        const activeProd = prods.find(p => p.id === targetProdId);
        if (activeProd && activeProd.size_group_id) {
          const matchedSizes = szs.filter(s => s.size_group_id === activeProd.size_group_id);
          matchedSizes.forEach(s => {
            initQty[s.id] = 1;
          });
        } else {
          initQty['free'] = 1;
        }
        setSizeQuantities(initQty);

      } catch (err) {
        console.error('Failed to load barcode generator data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, initialSchoolId, initialProductId, propSchools, propProducts, propSizes, propPrices]);

  const handleProductChange = (newProdId: string) => {
    setSelectedProductId(newProdId);
    const prod = dbProducts.find(p => p.id === newProdId);
    const updatedQty: Record<string, number> = {};
    if (prod && prod.size_group_id) {
      const matchedSizes = dbSizes.filter(s => s.size_group_id === prod.size_group_id);
      matchedSizes.forEach(s => {
        updatedQty[s.id] = 1;
      });
    } else {
      updatedQty['free'] = 1;
    }
    setSizeQuantities(updatedQty);
  };

  const currentSchool = dbSchools.find(s => s.id === selectedSchoolId) || dbSchools[0];
  const currentProduct = dbProducts.find(p => p.id === selectedProductId) || dbProducts[0];

  const productSizes = useMemo(() => {
    if (!currentProduct || !currentProduct.size_group_id) return [];
    const matched = dbSizes.filter(s => s.size_group_id === currentProduct.size_group_id);
    matched.sort((a, b) => a.sort_order - b.sort_order);
    return matched;
  }, [currentProduct, dbSizes]);

  const getPrice = (sizeId?: string | null) => {
    if (!currentProduct || !currentSchool) return 0;
    const found = dbPrices.find(
      p => p.school_id === currentSchool.id && p.product_id === currentProduct.id && (sizeId ? p.size_id === sizeId : !p.size_id)
    );
    return found ? found.price : currentProduct.base_price;
  };

  const labelItemsToPrint: {
    schoolCode: string;
    schoolName: string;
    productName: string;
    sizeLabel: string;
    price: number;
    barcodeValue: string;
  }[] = useMemo(() => {
    const list: {
      schoolCode: string;
      schoolName: string;
      productName: string;
      sizeLabel: string;
      price: number;
      barcodeValue: string;
    }[] = [];

    if (!currentProduct) return list;

    if (productSizes.length > 0) {
      productSizes.forEach(sz => {
        const qty = sizeQuantities[sz.id] || 0;
        const pr = getPrice(sz.id);
        const cleanName = currentProduct.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
        const barcodeVal = `${currentSchool?.code || 'SCH'}-${cleanName}-${sz.label}`;
        
        for (let i = 0; i < qty; i++) {
          list.push({
            schoolCode: currentSchool?.code || 'SCH',
            schoolName: currentSchool?.name || '',
            productName: currentProduct.name,
            sizeLabel: sz.label,
            price: pr,
            barcodeValue: barcodeVal,
          });
        }
      });
    } else {
      const qty = sizeQuantities['free'] || 0;
      const pr = getPrice(null);
      const cleanName = currentProduct.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
      const barcodeVal = `${currentSchool?.code || 'SCH'}-${cleanName}-FREE`;
      for (let i = 0; i < qty; i++) {
        list.push({
          schoolCode: currentSchool?.code || 'SCH',
          schoolName: currentSchool?.name || '',
          productName: currentProduct.name,
          sizeLabel: 'Free Size',
          price: pr,
          barcodeValue: barcodeVal,
        });
      }
    }
    return list;
  }, [currentProduct, currentSchool, productSizes, sizeQuantities, dbPrices]);

  const setAllQuantities = (qty: number) => {
    const updated: Record<string, number> = {};
    if (productSizes.length > 0) {
      productSizes.forEach(s => {
        updated[s.id] = qty;
      });
    } else {
      updated['free'] = qty;
    }
    setSizeQuantities(updated);
  };

  const handleCopyBarcode = (val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedCode(val);
    showToast(`Barcode copied: ${val}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleTestScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = testScanInput.trim().toUpperCase();
    if (!code) return;

    playBeep('success');

    const parts = code.split('-');
    let matchedSch: School | undefined;
    let matchedProd: Product | undefined;
    let matchedSz: string | undefined;
    let matchedPr = 0;

    if (parts.length >= 2) {
      matchedSch = dbSchools.find(s => s.code.toUpperCase() === parts[0]);
      matchedProd = dbProducts.find(p => p.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().startsWith(parts[1]));
      matchedSz = parts.slice(2).join('-');
    }

    if (!matchedProd) {
      matchedProd = dbProducts.find(p => p.name.toUpperCase().includes(code) || code.includes(p.name.toUpperCase()));
    }

    if (matchedProd) {
      if (matchedSch && matchedSz) {
        const szObj = dbSizes.find(s => s.label.toUpperCase() === matchedSz);
        const pEntry = dbPrices.find(p => p.school_id === matchedSch?.id && p.product_id === matchedProd?.id && (szObj ? p.size_id === szObj.id : true));
        matchedPr = pEntry ? pEntry.price : matchedProd.base_price;
      } else {
        matchedPr = matchedProd.base_price;
      }
    }

    setLastScannedResult({
      code,
      matchedProduct: matchedProd,
      matchedSchool: matchedSch,
      matchedSize: matchedSz,
      matchedPrice: matchedPr,
      timestamp: new Date().toLocaleTimeString(),
    });

    setTestScanInput('');
  };

  const handlePrint = async () => {
    if (labelItemsToPrint.length === 0) {
      showToast('Please specify quantity to print');
      return;
    }

    if (bluetoothPrinter.isConnected()) {
      try {
        let escPosCommand = '\x1B@\x1Ba\x01';
        for (const item of labelItemsToPrint) {
          escPosCommand += `\x1BE\x01${shopConfig?.legal_name || 'SARASWATI GARMENTS'}\x1BE\x00\n`;
          escPosCommand += `[${item.schoolCode}] ${item.productName}\n`;
          escPosCommand += `SIZE: ${item.sizeLabel}  |  MRP: Rs.${item.price}\n`;
          escPosCommand += `\x1Dh\x50\x1Dw\x02\x1Dk\x04${item.barcodeValue}\x00\n`;
          escPosCommand += `${item.barcodeValue}\n\n----------------\n\n`;
        }
        escPosCommand += '\x1DV\x42\x00';
        await bluetoothPrinter.printData(new TextEncoder().encode(escPosCommand));
        showToast('Printed stickers directly to Bluetooth Thermal Printer!');
        return;
      } catch (bleErr) {
        console.error('Bluetooth print error:', bleErr);
      }
    }

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const isA4 = labelFormat === 'a4_sheet';
    const isDual = labelFormat === 'thermal_dual';
    const storeName = shopConfig?.legal_name || 'SARASWATI GARMENTS';

    const stickersHtml = labelItemsToPrint.map((item) => {
      const barcodeData = encodeCode128(item.barcodeValue);
      const rects = barcodeData.pattern.split('').map((bit, bIdx) => 
        bit === '1' ? `<rect x="${bIdx}" y="0" width="1" height="12" fill="#000000" />` : ''
      ).join('');

      return `
        <div class="sticker-card">
          <div class="sticker-header">
            <span class="shop-name">${storeName}</span>
            <span class="school-tag">[${item.schoolCode}]</span>
          </div>
          <div class="product-info">
            <div class="product-name">${item.productName}</div>
            <div class="meta-row">
              <span class="size-box">SIZE: <strong>${item.sizeLabel}</strong></span>
              <span class="mrp-box">MRP: ₹${item.price}</span>
            </div>
          </div>
          <div class="barcode-wrapper">
            <svg viewBox="0 0 ${barcodeData.totalWidth} 12" preserveAspectRatio="none" class="barcode-svg">
              ${rects}
            </svg>
            <div class="barcode-text">${item.barcodeValue}</div>
          </div>
        </div>
      `;
    }).join('');

    const pageStyle = isA4
      ? `
        @page { size: A4 portrait; margin: 8mm 6mm; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fff; }
        .grid-container {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 3.5mm;
        }
        .sticker-card {
          border: 1px dashed #d1d5db;
          padding: 2.5mm 3mm;
          border-radius: 2mm;
          box-sizing: border-box;
          page-break-inside: avoid;
          break-inside: avoid;
          height: 28mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: #fff;
        }
      `
      : isDual
      ? `
        @page { size: 100mm 25mm landscape; margin: 0; }
        body { margin: 0; padding: 1mm; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fff; }
        .grid-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2mm;
        }
        .sticker-card {
          padding: 1.5mm 2mm;
          box-sizing: border-box;
          page-break-inside: avoid;
          break-inside: avoid;
          height: 23mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: #fff;
        }
      `
      : `
        @page { size: 50mm 25mm landscape; margin: 0; }
        body { margin: 0; padding: 1.2mm 1.5mm; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fff; }
        .grid-container {
          display: block;
        }
        .sticker-card {
          width: 47mm;
          height: 22.5mm;
          padding: 1mm 1.5mm;
          box-sizing: border-box;
          page-break-inside: avoid;
          break-inside: avoid;
          page-break-after: always;
          break-after: page;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: #fff;
        }
      `;

    const docContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode Stickers - ${storeName}</title>
        <meta charset="utf-8" />
        <style>
          ${pageStyle}
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .sticker-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 0.5px solid #000;
            padding-bottom: 0.5mm;
          }
          .shop-name {
            font-size: 7.5pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: -0.2px;
            color: #000;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .school-tag {
            font-size: 7pt;
            font-weight: 900;
            color: #000;
          }
          .product-info {
            margin: 0.3mm 0;
          }
          .product-name {
            font-size: 8pt;
            font-weight: 800;
            color: #000;
            line-height: 1.1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 7.5pt;
            font-weight: 700;
            color: #000;
            margin-top: 0.3mm;
          }
          .meta-row strong {
            font-weight: 900;
          }
          .mrp-box {
            font-size: 8pt;
            font-weight: 900;
          }
          .barcode-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
          }
          .barcode-svg {
            width: 100%;
            height: 6.5mm;
            display: block;
          }
          .barcode-text {
            font-family: monospace;
            font-size: 5.5pt;
            font-weight: 700;
            letter-spacing: 0.5px;
            color: #000;
            line-height: 1;
            margin-top: 0.3mm;
          }
        </style>
      </head>
      <body>
        <div class="grid-container">
          ${stickersHtml}
        </div>
      </body>
      </html>
    `;

    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(docContent);
      frameDoc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
          showToast('Print dialog opened');
        } catch (e) {
          console.error('Print iframe error:', e);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(printFrame)) {
              document.body.removeChild(printFrame);
            }
          }, 60000);
        }
      }, 400);
    } else {
      window.print();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-xl border border-[#E5E5E7] animate-in zoom-in-95 max-h-[94vh] flex flex-col my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E5E7]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs shrink-0">
              <Barcode className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg text-[#1D1D1F] tracking-tight">
                Thermal Barcode &amp; Price Tag Generator
              </h2>
              <p className="text-xs text-[#86868B]">
                Generate 50×25mm thermal stickers, PDF sheets, and hardware configuration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex items-center bg-[#F5F5F7] p-0.5 rounded-xl border border-[#E5E5E7]">
              <button
                type="button"
                onClick={() => setActiveTab('generator')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'generator'
                    ? 'bg-white text-[#1D1D1F] shadow-2xs'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Stickers</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('scanner_guide')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'scanner_guide'
                    ? 'bg-white text-[#1D1D1F] shadow-2xs'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                <Usb className="w-3.5 h-3.5" />
                <span>Scanner Guide &amp; Test</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-[#86868B] hover:text-[#1D1D1F] p-1.5 rounded-xl hover:bg-[#F5F5F7] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {toastMessage && (
          <div className="mt-3 p-2.5 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-bold text-center animate-in fade-in flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-[#1D1D1F]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-xs text-[#86868B] flex flex-col items-center justify-center">
            <RefreshCw className="w-5 h-5 animate-spin text-[#1D1D1F] mb-2" />
            <p className="font-bold">Loading Price Books &amp; Size Matrix...</p>
          </div>
        ) : activeTab === 'scanner_guide' ? (
          /* SCANNER CONNECTION GUIDE & LIVE TEST PANEL */
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* How it connects */}
              <div className="bg-[#F5F5F7] rounded-2xl p-4 border border-[#E5E5E7] space-y-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-[#1D1D1F] uppercase tracking-wider">
                  <Usb className="w-4 h-4 text-[#1D1D1F]" />
                  <span>How Barcode Scanners Connect</span>
                </div>

                <div className="space-y-2.5 text-xs text-[#1D1D1F] leading-relaxed">
                  <div className="p-3 bg-white rounded-xl border border-[#E5E5E7] space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-[#1D1D1F]">
                      <span className="w-5 h-5 rounded-full bg-[#1D1D1F] text-white text-[10px] flex items-center justify-center font-bold">1</span>
                      <span>USB &amp; Wireless Dongle Scanners (Plug &amp; Play)</span>
                    </div>
                    <p className="text-[11px] text-[#86868B] pl-6.5">
                      Standard handheld 1D/2D laser scanners connect directly to your PC, laptop, or Android POS terminal via USB port or 2.4GHz wireless USB dongle. No driver or software setup is needed.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-[#E5E5E7] space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-[#1D1D1F]">
                      <span className="w-5 h-5 rounded-full bg-[#1D1D1F] text-white text-[10px] flex items-center justify-center font-bold">2</span>
                      <span>Bluetooth Wireless Scanners</span>
                    </div>
                    <p className="text-[11px] text-[#86868B] pl-6.5">
                      Turn on the scanner in <strong>Bluetooth HID Mode</strong> and pair it in your computer or tablet's Bluetooth Settings. It will register as a fast input keyboard.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-[#E5E5E7] space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-[#1D1D1F]">
                      <span className="w-5 h-5 rounded-full bg-[#1D1D1F] text-white text-[10px] flex items-center justify-center font-bold">3</span>
                      <span>Instant Billing at POS Counter</span>
                    </div>
                    <p className="text-[11px] text-[#86868B] pl-6.5">
                      When you scan any sticker on a garment, the barcode instantly inputs into the Quick Billing counter, automatically identifies the uniform school, product, size, and price, and adds it straight to the customer's cart with an audio confirmation.
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Scanner Interactive Test Tool */}
              <div className="bg-white rounded-2xl p-4 border border-[#E5E5E7] space-y-3.5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-[#1D1D1F] uppercase tracking-wider">
                      <Radio className="w-4 h-4 text-[#1D1D1F]" />
                      <span>Live Scanner Hardware Test</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-[#F5F5F7] text-[#1D1D1F] text-[10px] font-bold border border-[#E5E5E7]">
                      Scanner Ready
                    </span>
                  </div>

                  <p className="text-xs text-[#86868B] mb-3">
                    Point your physical USB/Bluetooth scanner at any sticker and pull the trigger, or type a barcode manually below:
                  </p>

                  <form onSubmit={handleTestScanSubmit} className="space-y-2">
                    <div className="relative">
                      <input
                        ref={scannerInputRef}
                        type="text"
                        placeholder="Scan barcode sticker here (e.g. DPS-SHIRT-32)..."
                        value={testScanInput}
                        onChange={e => setTestScanInput(e.target.value)}
                        className="w-full h-10 pl-3.5 pr-20 rounded-xl border border-[#E5E5E7] text-xs font-bold text-[#1D1D1F] bg-[#F5F5F7] focus:bg-white focus:outline-none tracking-wide"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-[#1D1D1F] text-white text-xs font-bold hover:bg-[#333336] cursor-pointer"
                      >
                        Test
                      </button>
                    </div>
                  </form>
                </div>

                {/* Scan Result Box */}
                <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] min-h-[140px] flex flex-col justify-center">
                  {lastScannedResult ? (
                    <div className="space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between text-xs border-b border-[#E5E5E7] pb-1.5">
                        <span className="font-extrabold text-[#1D1D1F] flex items-center gap-1.5">
                          <CheckCheck className="w-4 h-4 text-[#1D1D1F]" />
                          Barcode Decoded Successfully
                        </span>
                        <span className="text-[10px] text-[#86868B] font-mono">{lastScannedResult.timestamp}</span>
                      </div>
                      
                      <div className="font-mono text-xs font-extrabold text-[#1D1D1F] bg-white px-2.5 py-1 rounded-lg border border-[#E5E5E7] inline-block">
                        {lastScannedResult.code}
                      </div>

                      {lastScannedResult.matchedProduct ? (
                        <div className="text-xs space-y-0.5 text-[#1D1D1F] pt-1">
                          <div className="font-bold">
                            {lastScannedResult.matchedSchool ? `[${lastScannedResult.matchedSchool.code}] ` : ''}
                            {lastScannedResult.matchedProduct.name}
                          </div>
                          <div className="text-[#86868B] flex items-center gap-3 text-[11px]">
                            <span>Size: <strong className="text-[#1D1D1F]">{lastScannedResult.matchedSize || 'Standard'}</strong></span>
                            <span>Price: <strong className="text-[#1D1D1F]">₹{lastScannedResult.matchedPrice}</strong></span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-[#86868B] italic pt-1">
                          Scanned code received. Ready to link with catalog products.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-xs text-[#86868B] space-y-1">
                      <Barcode className="w-5 h-5 mx-auto text-[#86868B] opacity-40" />
                      <p className="font-bold">No barcode scanned yet</p>
                      <p className="text-[11px]">Click inside the box and scan any printed sticker.</p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>
        ) : (
          /* STICKER GENERATOR TAB */
          <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1">
            {/* Configuration Ribbon */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[#F5F5F7] border border-[#E5E5E7]">
              <div>
                <label className="text-xs font-bold text-[#1D1D1F] block mb-1">Select School</label>
                <select
                  value={selectedSchoolId}
                  onChange={e => setSelectedSchoolId(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F] focus:outline-none"
                >
                  {dbSchools.map(s => (
                    <option key={s.id} value={s.id}>
                      [{s.code}] {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1D1D1F] block mb-1">Select Garment Product</label>
                <select
                  value={selectedProductId}
                  onChange={e => handleProductChange(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F] focus:outline-none"
                >
                  {dbProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1D1D1F] block mb-1">Label Sticker Format</label>
                <select
                  value={labelFormat}
                  onChange={e => setLabelFormat(e.target.value as any)}
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F] focus:outline-none"
                >
                  <option value="thermal_single">Thermal Roll 50×25mm (1-Up Single Roll)</option>
                  <option value="thermal_dual">Thermal Roll 50×25mm (2-Up Dual Roll)</option>
                  <option value="a4_sheet">A4 Sticker Sheet (24 Labels Grid)</option>
                </select>
              </div>
            </div>

            {/* Quantity per Size Strip */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E5E5E7] space-y-2.5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[#1D1D1F] uppercase tracking-wider">
                  Quantities to Print ({currentProduct?.name}):
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAllQuantities(1)}
                    className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#E5E5E7] text-xs font-bold text-[#1D1D1F] border border-[#E5E5E7] cursor-pointer"
                  >
                    +1 Each
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllQuantities(5)}
                    className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#E5E5E7] text-xs font-bold text-[#1D1D1F] border border-[#E5E5E7] cursor-pointer"
                  >
                    +5 Each
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllQuantities(10)}
                    className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#E5E5E7] text-xs font-bold text-[#1D1D1F] border border-[#E5E5E7] cursor-pointer"
                  >
                    +10 Each
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllQuantities(0)}
                    className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#E5E5E7] text-xs font-bold text-[#86868B] border border-[#E5E5E7] cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2 pt-1">
                {productSizes.length > 0 ? (
                  productSizes.map(sz => (
                    <div key={sz.id} className="p-2 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] text-center">
                      <span className="text-xs font-extrabold text-[#1D1D1F] block">{sz.label}</span>
                      <span className="text-[10px] font-bold text-[#1D1D1F] block mb-1">₹{getPrice(sz.id)}</span>
                      <input
                        type="number"
                        min={0}
                        value={sizeQuantities[sz.id] === undefined ? 1 : sizeQuantities[sz.id]}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setSizeQuantities(prev => ({ ...prev, [sz.id]: val }));
                        }}
                        className="w-full h-7 px-1 rounded-lg border border-[#E5E5E7] text-xs font-bold text-center bg-white text-[#1D1D1F]"
                      />
                    </div>
                  ))
                ) : (
                  <div className="col-span-full p-2.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1D1D1F]">Free Size / Accessories Tag (₹{getPrice(null)})</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#86868B]">Qty:</span>
                      <input
                        type="number"
                        min={0}
                        value={sizeQuantities['free'] === undefined ? 1 : sizeQuantities['free']}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setSizeQuantities(prev => ({ ...prev, free: val }));
                        }}
                        className="w-20 h-7 px-2 rounded-lg border border-[#E5E5E7] text-xs font-bold text-center bg-white text-[#1D1D1F]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Live Sticker Print Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-[#1D1D1F]">
                <span>Live Sticker Preview ({labelItemsToPrint.length} tags queued):</span>
                <span className="text-[#1D1D1F] flex items-center gap-1 font-bold text-[11px]">
                  <Check className="w-3.5 h-3.5 text-[#1D1D1F]" />
                  Code128 High-Density Ready
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#E5E5E7] max-h-72 overflow-y-auto">
                {labelItemsToPrint.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#86868B]">
                    Enter quantities above to generate barcode stickers.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {labelItemsToPrint.map((item, idx) => {
                      const barcodeData = encodeCode128(item.barcodeValue);
                      return (
                        <div
                          key={idx}
                          className="bg-white rounded-xl p-2.5 border border-[#E5E5E7] shadow-xs flex flex-col justify-between h-[120px] font-sans relative group"
                        >
                          {/* Top Brand & School */}
                          <div className="flex items-center justify-between border-b border-[#E5E5E7] pb-0.5">
                            <span className="text-[10px] font-extrabold uppercase text-[#1D1D1F] tracking-tight truncate max-w-[140px]">
                              {shopConfig?.legal_name || 'SARASWATI GARMENTS'}
                            </span>
                            <span className="text-[9px] font-extrabold text-[#1D1D1F] bg-[#F5F5F7] border border-[#E5E5E7] px-1 rounded shrink-0">
                              [{item.schoolCode}]
                            </span>
                          </div>

                          {/* Garment Name & Size & Price */}
                          <div className="my-0.5">
                            <div className="text-[11px] font-bold text-[#1D1D1F] truncate leading-tight">
                              {item.productName}
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-extrabold mt-0.5 text-[#1D1D1F]">
                              <span>SIZE: <span className="underline font-black">{item.sizeLabel}</span></span>
                              <span className="text-xs font-black">MRP: ₹{item.price}</span>
                            </div>
                          </div>

                          {/* Standard Vector Code128 Barcode */}
                          <div className="flex flex-col items-center justify-center">
                            <svg className="w-full h-6" viewBox={`0 0 ${barcodeData.totalWidth} 12`} preserveAspectRatio="none">
                              {barcodeData.pattern.split('').map((bit, bIdx) => (
                                bit === '1' ? (
                                  <rect key={bIdx} x={bIdx} y={0} width={1} height={12} fill="#000000" />
                                ) : null
                              ))}
                            </svg>
                            <div className="flex items-center gap-1 text-[8px] font-mono font-bold tracking-wider leading-none mt-0.5 text-[#86868B]">
                              <span>{item.barcodeValue}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyBarcode(item.barcodeValue)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-[#86868B] hover:text-[#1D1D1F]"
                                title="Copy barcode string"
                              >
                                <Copy className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3.5 border-t border-[#E5E5E7] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#E5E5E7] text-xs font-bold text-[#86868B] hover:bg-[#F5F5F7] cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'generator' ? 'scanner_guide' : 'generator')}
              className="px-3 py-2 rounded-xl border border-[#E5E5E7] text-xs font-bold text-[#1D1D1F] hover:bg-[#F5F5F7] cursor-pointer flex items-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#86868B]" />
              <span>{activeTab === 'generator' ? 'Scanner Setup & Test' : 'Back to Generator'}</span>
            </button>
          </div>

          <button
            onClick={handlePrint}
            disabled={labelItemsToPrint.length === 0}
            className="px-5 py-2.5 rounded-xl bg-[#1D1D1F] text-white text-xs font-extrabold hover:bg-[#333336] transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF ({labelItemsToPrint.length} Stickers)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
