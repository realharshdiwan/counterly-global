import React, { useState } from 'react';
import { FileSpreadsheet, Upload, Download, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { db } from '../db/db';
import { type Product, type ProductVariant } from '../types';

interface CsvRateUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ParsedCsvRow {
  productName: string;
  category: string;
  sizeLabel: string;
  colorLabel: string;
  sku: string;
  barcode: string;
  price: number;
  costPrice?: number;
  taxRate?: number;
  stock: number;
  status: 'valid' | 'invalid';
  error?: string;
}

export const CsvRateUploadModal: React.FC<CsvRateUploadModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadSampleCsv = () => {
    const headers = [
      'Product_Name',
      'Category',
      'Size',
      'Color',
      'SKU',
      'Barcode',
      'Price',
      'Cost_Price',
      'Tax_Rate',
      'Stock',
    ];
    const sampleRows = [
      ['Heavyweight Crew Tee', 'tops', 'M', 'Black', 'TEE-BLK-M', '890100101', '799', '340', '0', '15'],
      ['Heavyweight Crew Tee', 'tops', 'L', 'Black', 'TEE-BLK-L', '890100102', '799', '340', '0', '12'],
      ['Relaxed Tapered Denim', 'bottoms', '32', 'Indigo', 'DNM-IND-32', '890100201', '1899', '850', '0', '10'],
      ['Low-Top Court Sneaker', 'footwear', 'UK 9', 'White', 'SNK-WHT-9', '890100301', '2499', '1150', '0', '8'],
      ['Waxed Canvas Tote', 'accessories', 'One Size', 'Olive', 'TOT-OLV-OS', '890100401', '699', '280', '0', '20'],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `SikkaDesk_Catalog_Template_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setErrorMsg('CSV file is empty or missing headers.');
        return;
      }

      const headerCols = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/[^a-z0-9_]/g, ''));
      const isLegacySchoolCsv = headerCols[0]?.includes('school');

      const findCol = (aliases: string[]) => headerCols.findIndex(h => aliases.includes(h));
      const idxName = findCol(['product_name', 'product', 'name', 'item']);
      const idxCat = findCol(['category', 'cat']);
      const idxSize = findCol(['size', 'size_label']);
      const idxColor = findCol(['color', 'colour', 'color_label']);
      const idxSku = findCol(['sku']);
      const idxBarcode = findCol(['barcode', 'ean', 'upc']);
      const idxPrice = findCol(['price', 'retail_price', 'selling_price']);
      const idxCost = findCol(['cost_price', 'cost', 'unit_cost', 'cogs']);
      const idxTax = findCol(['tax_rate', 'tax', 'vat', 'gst']);
      const idxStock = findCol(['stock', 'stock_qty', 'qty', 'quantity']);

      const rows: ParsedCsvRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length < 4) continue;

        let productName = '';
        let category = 'tops';
        let sizeLabel = 'One Size';
        let colorLabel = 'Standard';
        let sku = '';
        let barcode = '';
        let price = 0;
        let costPrice: number | undefined = undefined;
        let taxRate: number | undefined = undefined;
        let stock = 10;

        if (isLegacySchoolCsv) {
          productName = parts[1] || '';
          category = (parts[2] || 'tops').toLowerCase();
          sizeLabel = parts[3] || 'One Size';
          price = parseFloat(parts[4]) || 0;
          stock = parseInt(parts[5], 10) || 10;
        } else {
          productName = parts[idxName >= 0 ? idxName : 0] || '';
          category = (parts[idxCat >= 0 ? idxCat : 1] || 'tops').toLowerCase().replace(/[^a-z0-9]+/g, '_');
          sizeLabel = parts[idxSize >= 0 ? idxSize : 2] || 'One Size';
          colorLabel = parts[idxColor >= 0 ? idxColor : 3] || 'Standard';
          sku = (parts[idxSku >= 0 ? idxSku : 4] || '').toUpperCase();
          barcode = parts[idxBarcode >= 0 ? idxBarcode : 5] || '';
          price = parseFloat(parts[idxPrice >= 0 ? idxPrice : 6]) || 0;

          if (idxCost >= 0 && parts[idxCost] !== '' && parts[idxCost] !== undefined) {
            const c = parseFloat(parts[idxCost]);
            if (!isNaN(c) && c >= 0) costPrice = c;
          }
          if (idxTax >= 0 && parts[idxTax] !== '' && parts[idxTax] !== undefined) {
            const t = parseFloat(parts[idxTax]);
            if (!isNaN(t) && t >= 0) taxRate = t;
          }
          const stockCol = idxStock >= 0 ? idxStock : parts.length >= 10 ? 9 : 7;
          stock = parseInt(parts[stockCol], 10) || 0;
        }

        const prefix = (productName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'ITEM').toUpperCase();
        if (!sku) sku = `${prefix}-${sizeLabel.replace(/\s+/g, '').toUpperCase()}-${i}`;
        if (!barcode) barcode = `${Date.now().toString().slice(-6)}${i}`;

        const valid = Boolean(productName && price >= 0);
        rows.push({
          productName,
          category,
          sizeLabel,
          colorLabel,
          sku,
          barcode,
          price,
          costPrice,
          taxRate,
          stock,
          status: valid ? 'valid' : 'invalid',
          error: !productName ? 'Missing Product Name' : undefined,
        });
      }

      setParsedRows(rows);
    };

    reader.readAsText(file);
  };

  const handleCommitImport = async () => {
    const validRows = parsedRows.filter(r => r.status === 'valid');
    if (validRows.length === 0) return;

    setIsProcessing(true);
    try {
      const [existingProducts, existingCategories] = await Promise.all([
        db.products.toArray(),
        db.categories.toArray(),
      ]);

      const catSet = new Set(existingCategories.map(c => c.id.toLowerCase()));
      const prodMap = new Map<string, Product>();
      existingProducts.forEach(p => prodMap.set(p.name.toLowerCase(), p));

      const variantsToPut: ProductVariant[] = [];

      for (const row of validRows) {
        if (!catSet.has(row.category)) {
          await db.categories.put({
            id: row.category,
            name: row.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            sort_order: catSet.size + 1,
          });
          catSet.add(row.category);
        }

        let prod = prodMap.get(row.productName.toLowerCase());
        if (!prod) {
          const prodId = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          prod = {
            id: prodId,
            name: row.productName,
            category: row.category,
            sku_prefix: row.sku.split('-')[0] || 'ITEM',
            has_variants: true,
            size_group_id: null,
            base_price: row.price,
            cost_price: row.costPrice,
            tax_rate: row.taxRate,
            stock: row.stock,
            low_stock_threshold: 5,
            active: true,
          };
          await db.products.add(prod);
          prodMap.set(row.productName.toLowerCase(), prod);
        }

        variantsToPut.push({
          id: `var_${prod.id}_${row.sku.toLowerCase()}`,
          product_id: prod.id,
          size_label: row.sizeLabel,
          color_label: row.colorLabel,
          sku: row.sku,
          barcode: row.barcode,
          price: row.price,
          cost_price: row.costPrice ?? prod.cost_price,
          tax_rate: row.taxRate ?? prod.tax_rate,
          stock_qty: row.stock,
          low_stock_threshold: 5,
        });
      }

      if (variantsToPut.length > 0) {
        await db.variants.bulkPut(variantsToPut);
      }

      onImportComplete();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to import CSV rows.');
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedRows.filter(r => r.status === 'valid').length;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-zinc-950 dark:text-zinc-50">Import Products &amp; Variants (CSV)</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Upload catalog spreadsheet with SKU, barcode, price, unit cost, tax rate, and stock
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">CSV Template</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Product_Name, Category, Size, Color, SKU, Barcode, Price, Cost_Price, Tax_Rate, Stock
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Template</span>
            </button>
          </div>

          <label className="block border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-6 text-center cursor-pointer hover:border-zinc-500 dark:hover:border-zinc-500 transition-colors">
            <Upload className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {fileName ? fileName : 'Click to choose a .csv file'}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              Supports Cost_Price &amp; Tax_Rate columns as well as 8-column retail sheets
            </div>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>

          {parsedRows.length > 0 && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold flex items-center justify-between">
                <span>Preview ({parsedRows.length} rows)</span>
                <span className="text-emerald-600 dark:text-emerald-400">{validCount} ready to import</span>
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                {parsedRows.slice(0, 20).map((r, i) => {
                  const marginPct =
                    typeof r.costPrice === 'number' && r.price > 0
                      ? Math.round(((r.price - r.costPrice) / r.price) * 100)
                      : null;
                  return (
                    <div key={i} className="px-4 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold">{r.productName}</span>
                        <span className="text-zinc-500 ml-2">
                          {r.sizeLabel} · {r.colorLabel} · {r.sku}
                        </span>
                      </div>
                      <div className="font-mono tabular-nums shrink-0 text-right">
                        <span>{r.price}</span>
                        {typeof r.costPrice === 'number' && (
                          <span className="text-zinc-500"> · Cost {r.costPrice} ({marginPct}%)</span>
                        )}
                        {typeof r.taxRate === 'number' && (
                          <span className="text-zinc-500"> · {r.taxRate}% Tax</span>
                        )}
                        <span className="text-zinc-500"> · Qty {r.stock}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCommitImport}
            disabled={isProcessing || validCount === 0}
            className="px-5 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Importing...' : `Import ${validCount} Variants`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
