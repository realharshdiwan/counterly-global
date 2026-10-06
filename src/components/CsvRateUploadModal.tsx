import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Layers 
} from 'lucide-react';
import { db } from '../db/db';
import { type School, type Product, type SizeItem, type PriceEntry, type ProductStock } from '../types';

interface CsvRateUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ParsedCsvRow {
  schoolCode: string;
  productName: string;
  category: string;
  sizeLabel: string;
  price: number;
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

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const headers = ['School_Code', 'Product_Name', 'Category', 'Size_Label', 'Price', 'Stock'];
    const sampleRows = [
      ['DAV', 'Half Sleeve School Shirt', 'uniform', '28', '260', '15'],
      ['DAV', 'Half Sleeve School Shirt', 'uniform', '30', '280', '15'],
      ['DAV', 'School Pant / Trousers', 'uniform', '28', '340', '10'],
      ['DAV', 'School Pant / Trousers', 'uniform', '30', '360', '10'],
      ['DAV', 'School Tie', 'accessories', 'Free', '80', '50'],
      ['DPS', 'Full Sleeve School Shirt', 'uniform', '32', '320', '20'],
      ['DPS', 'Black School Shoes', 'footwear', '6', '460', '8'],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Uniform_Rate_Template_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse Uploaded CSV file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setErrorMsg('CSV file is empty or missing headers');
        return;
      }

      const rows: ParsedCsvRow[] = [];
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length < 5) continue;

        const schoolCode = (parts[0] || '').toUpperCase();
        const productName = parts[1] || '';
        const catRaw = (parts[2] || 'uniform').toLowerCase();
        const category = catRaw || 'uniform';
        const sizeLabel = parts[3] || 'Free';
        const price = parseFloat(parts[4]) || 0;
        const stock = parseInt(parts[5], 10) || 10;

        const isValid = Boolean(schoolCode && productName && price > 0);
        rows.push({
          schoolCode,
          productName,
          category,
          sizeLabel,
          price,
          stock,
          status: isValid ? 'valid' : 'invalid',
          error: !schoolCode ? 'Missing School Code' : !productName ? 'Missing Product' : price <= 0 ? 'Invalid Price' : undefined,
        });
      }

      setParsedRows(rows);
    };

    reader.readAsText(file);
  };

  // Commit Parsed CSV to Dexie DB
  const handleCommitImport = async () => {
    const validRows = parsedRows.filter(r => r.status === 'valid');
    if (validRows.length === 0) {
      setErrorMsg('No valid rows found to import');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const [existingSchools, existingProducts, existingSizes, existingSizeGroups] = await Promise.all([
        db.schools.toArray(),
        db.products.toArray(),
        db.sizes.toArray(),
        db.size_groups.toArray(),
      ]);

      const schoolsMap = new Map(existingSchools.map(s => [s.code.toUpperCase(), s]));
      const productsMap = new Map(existingProducts.map(p => [p.name.toLowerCase(), p]));
      const sizesMap = new Map(existingSizes.map(s => [s.label.toLowerCase(), s]));

      const newSchoolsToPut: School[] = [];
      const newProductsToPut: Product[] = [];
      const newSizesToPut: SizeItem[] = [];
      const pricesToPut: PriceEntry[] = [];
      const stocksToPut: ProductStock[] = [];

      for (const row of validRows) {
        // 1. School check/create
        let school = schoolsMap.get(row.schoolCode);
        if (!school) {
          const newSchool: School = {
            id: `sch_${row.schoolCode.toLowerCase()}_${Date.now().toString(36)}`,
            code: row.schoolCode,
            name: `${row.schoolCode} Public School`,
            active: true,
          };
          schoolsMap.set(row.schoolCode, newSchool);
          newSchoolsToPut.push(newSchool);
          school = newSchool;
        }

        // 2. Size check/create if not free
        const isFree = row.sizeLabel.toLowerCase() === 'free' || row.sizeLabel === '-';
        let sizeId: string | null = null;
        if (!isFree) {
          let size = sizesMap.get(row.sizeLabel.toLowerCase());
          if (!size) {
            const defaultSgId = 'sg_custom_sizes';
            if (!existingSizeGroups.some(sg => sg.id === defaultSgId)) {
              await db.size_groups.put({ id: defaultSgId, name: 'Imported Sizes' });
            }
            const newSize: SizeItem = {
              id: `sz_${row.sizeLabel.toLowerCase()}`,
              size_group_id: defaultSgId,
              label: row.sizeLabel,
              sort_order: parseInt(row.sizeLabel, 10) || 50,
            };
            sizesMap.set(row.sizeLabel.toLowerCase(), newSize);
            newSizesToPut.push(newSize);
            size = newSize;
          }
          sizeId = size.id;
        }

        // 3. Product check/create
        let product = productsMap.get(row.productName.toLowerCase());
        if (!product) {
          const newProd: Product = {
            id: `p_${row.productName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`,
            name: row.productName,
            category: row.category,
            size_group_id: isFree ? null : 'sg_custom_sizes',
            base_price: row.price,
            stock: row.stock,
            low_stock_threshold: 5,
          };
          productsMap.set(row.productName.toLowerCase(), newProd);
          newProductsToPut.push(newProd);
          product = newProd;
        }

        // 4. Price Entry
        const priceId = `pr_${school.id}_${product.id}_${sizeId || 'null'}`;
        pricesToPut.push({
          id: priceId,
          school_id: school.id,
          product_id: product.id,
          size_id: sizeId,
          price: row.price,
        });

        // 5. Stock Entry
        const stockId = `${product.id}_${sizeId || 'free'}`;
        stocksToPut.push({
          id: stockId,
          product_id: product.id,
          size_id: sizeId,
          size_label: isFree ? 'Free' : row.sizeLabel,
          quantity: row.stock,
          min_stock: 5,
        });
      }

      if (newSchoolsToPut.length > 0) await db.schools.bulkPut(newSchoolsToPut);
      if (newSizesToPut.length > 0) await db.sizes.bulkPut(newSizesToPut);
      if (newProductsToPut.length > 0) await db.products.bulkPut(newProductsToPut);
      if (pricesToPut.length > 0) await db.price_list.bulkPut(pricesToPut);
      if (stocksToPut.length > 0) await db.stocks.bulkPut(stocksToPut);

      onImportComplete();
      onClose();
    } catch (err) {
      console.error('Error importing CSV:', err);
      setErrorMsg('Failed to save imported CSV records');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-7 shadow-xl border border-[#E5E5E7] animate-in fade-in-50 max-h-[90vh] flex flex-col my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E7]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-[#1D1D1F]">Excel / CSV Bulk Rate Uploader</h2>
              <p className="text-xs text-[#86868B]">
                Upload school uniform price matrices, categories, sizes, and stock counts in bulk
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#86868B] hover:text-[#1D1D1F] p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 bg-red-50 text-red-900 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <button
            onClick={handleDownloadSampleCsv}
            className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-[#E5E5E7] hover:bg-[#E5E5E7] transition-all flex items-center gap-3 text-left group cursor-pointer"
          >
            <Download className="w-5 h-5 text-[#1D1D1F] group-hover:scale-110 transition-transform" />
            <div>
              <span className="font-extrabold text-xs text-[#1D1D1F] block">Download CSV Template</span>
              <span className="text-[11px] text-[#86868B]">Ready-to-use columns format</span>
            </div>
          </button>

          <label className="p-3.5 rounded-2xl bg-white border border-[#E5E5E7] hover:border-[#1D1D1F] transition-all flex items-center gap-3 cursor-pointer group shadow-2xs">
            <Upload className="w-5 h-5 text-[#1D1D1F] group-hover:scale-110 transition-transform" />
            <div className="flex-1 truncate">
              <span className="font-extrabold text-xs text-[#1D1D1F] block truncate">
                {fileName || 'Select CSV / Excel File'}
              </span>
              <span className="text-[11px] text-[#86868B]">Upload price sheet</span>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Parsed Rows Preview Table */}
        {parsedRows.length > 0 && (
          <div className="flex-1 overflow-y-auto py-3 space-y-2 mt-2">
            <div className="flex items-center justify-between text-xs font-extrabold text-[#1D1D1F]">
              <span>Preview Parsed Rows ({parsedRows.length} items):</span>
              <span className="text-[#1D1D1F]">
                {parsedRows.filter(r => r.status === 'valid').length} Valid Rows Ready
              </span>
            </div>

            <div className="border border-[#E5E5E7] rounded-2xl overflow-hidden shadow-2xs max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F5F5F7] text-[#1D1D1F] font-extrabold uppercase border-b border-[#E5E5E7] sticky top-0">
                  <tr>
                    <th className="py-2 px-3">School</th>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-3">Size</th>
                    <th className="py-2 px-3">Price</th>
                    <th className="py-2 px-3">Stock</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E7]">
                  {parsedRows.map((r, i) => (
                    <tr key={i} className={r.status === 'invalid' ? 'bg-red-50 text-red-900' : 'hover:bg-[#F5F5F7]'}>
                      <td className="py-2 px-3 font-bold">{r.schoolCode}</td>
                      <td className="py-2 px-3">{r.productName}</td>
                      <td className="py-2 px-3 font-mono">{r.sizeLabel}</td>
                      <td className="py-2 px-3 font-extrabold">₹{r.price}</td>
                      <td className="py-2 px-3">{r.stock}</td>
                      <td className="py-2 px-3">
                        {r.status === 'valid' ? (
                          <span className="text-emerald-700 font-bold text-[10px]">Valid</span>
                        ) : (
                          <span className="text-red-700 font-bold text-[10px]">{r.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-[#E5E5E7] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#E5E5E7] text-xs font-bold text-[#86868B] hover:bg-[#F5F5F7] cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleCommitImport}
            disabled={isProcessing || parsedRows.filter(r => r.status === 'valid').length === 0}
            className="px-5 py-2.5 rounded-xl bg-[#1D1D1F] text-white text-xs font-extrabold hover:bg-[#333336] transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isProcessing ? 'Importing...' : 'Save & Import All Rates'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
