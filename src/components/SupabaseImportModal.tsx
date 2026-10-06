import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  CloudDownload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  FileText, 
  Check, 
  ChevronRight,
  Eye,
  EyeOff,
  Code2,
  Terminal,
  Search,
  AlertTriangle
} from 'lucide-react';
import { db } from '../db/db';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  introspectAllSupabaseTables, 
  executeSupabaseImport,
  fetchSupabaseTableData,
  detectKeyType,
  type IntrospectionResult,
  type CustomMapping,
  type ImportLogEntry,
} from '../lib/supabase';
import { type School, type Product, type PriceEntry, type Bill } from '../types';

interface SupabaseImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const SupabaseImportModal: React.FC<SupabaseImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'connect' | 'custom' | 'json' | 'sql'>('connect');
  
  // Credentials
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Introspection & mapping state
  const [isScanning, setIsScanning] = useState(false);
  const [introspection, setIntrospection] = useState<IntrospectionResult | null>(null);
  
  // Custom manual table names (editable text inputs)
  const [schoolsTable, setSchoolsTable] = useState('schools');
  const [productsTable, setProductsTable] = useState('products');
  const [sizesTable, setSizesTable] = useState('sizes');
  const [sizeGroupsTable, setSizeGroupsTable] = useState('size_groups');
  const [pricesTable, setPricesTable] = useState('price_list');
  const [stocksTable, setStocksTable] = useState('stocks');
  const [billsTable, setBillsTable] = useState('bills');

  // Single Table Tester
  const [testTableName, setTestTableName] = useState('');
  const [isTestingTable, setIsTestingTable] = useState(false);
  const [tablePreviewData, setTablePreviewData] = useState<{ name: string; count: number; rows: any[] } | null>(null);

  // Execution state
  const [isImporting, setIsImporting] = useState(false);
  const [logs, setLogs] = useState<ImportLogEntry[]>([]);
  const [importSummary, setImportSummary] = useState<string[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // JSON Direct Paste State
  const [jsonDataType, setJsonDataType] = useState<'products' | 'schools' | 'prices' | 'bills'>('products');
  const [rawJsonText, setRawJsonText] = useState('');
  const [jsonImportResult, setJsonImportResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setUrl(cfg.url);
      setAnonKey(cfg.anonKey);
      setErrorMessage(null);
      setImportSummary(null);
      setLogs([]);

      if (cfg.url && cfg.anonKey) {
        handleScanTables(cfg.url, cfg.anonKey);
      }
    }
  }, [isOpen]);

  const handleScanTables = async (customUrl?: string, customKey?: string) => {
    const targetUrl = customUrl || url;
    const targetKey = customKey || anonKey;

    if (!targetUrl.trim() || !targetKey.trim()) {
      setErrorMessage('Please enter both Supabase Project URL and Key');
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);
    try {
      saveSupabaseConfig({
        url: targetUrl.trim(),
        anonKey: targetKey.trim(),
        autoSync: true,
        lastSyncedAt: getSupabaseConfig().lastSyncedAt,
      });

      const res = await introspectAllSupabaseTables(targetUrl, targetKey);
      setIntrospection(res);

      if (res.suggestedMapping) {
        if (res.suggestedMapping.schools) setSchoolsTable(res.suggestedMapping.schools);
        if (res.suggestedMapping.products) setProductsTable(res.suggestedMapping.products);
        if (res.suggestedMapping.sizes) setSizesTable(res.suggestedMapping.sizes);
        if (res.suggestedMapping.sizeGroups) setSizeGroupsTable(res.suggestedMapping.sizeGroups);
        if (res.suggestedMapping.prices) setPricesTable(res.suggestedMapping.prices);
        if (res.suggestedMapping.stocks) setStocksTable(res.suggestedMapping.stocks);
        if (res.suggestedMapping.bills) setBillsTable(res.suggestedMapping.bills);
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Failed to scan database');
    } finally {
      setIsScanning(false);
    }
  };

  // Test single custom table
  const handleTestSingleTable = async () => {
    if (!testTableName.trim()) return;
    setIsTestingTable(true);
    setTablePreviewData(null);
    try {
      const rows = await fetchSupabaseTableData(testTableName.trim());
      setTablePreviewData({
        name: testTableName.trim(),
        count: rows.length,
        rows: rows.slice(0, 3),
      });
    } catch (e: any) {
      setErrorMessage(`Error fetching '${testTableName}': ${e.message}`);
    } finally {
      setIsTestingTable(false);
    }
  };

  const handleRunImport = async () => {
    setIsImporting(true);
    setLogs([]);
    setErrorMessage(null);
    setImportSummary(null);

    const customMapping: CustomMapping = {
      schoolsTable: schoolsTable.trim(),
      productsTable: productsTable.trim(),
      sizesTable: sizesTable.trim(),
      sizeGroupsTable: sizeGroupsTable.trim(),
      pricesTable: pricesTable.trim(),
      stocksTable: stocksTable.trim(),
      billsTable: billsTable.trim(),
    };

    try {
      const res = await executeSupabaseImport(customMapping, (entry) => {
        setLogs(prev => [...prev, entry]);
      });

      if (res.success) {
        setImportSummary(res.summary);
        setTimeout(() => {
          onImportComplete();
        }, 1200);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Import error occurred');
    } finally {
      setIsImporting(false);
    }
  };

  // Direct JSON Paste Importer
  const handleImportJson = async () => {
    if (!rawJsonText.trim()) {
      setJsonImportResult('Please paste JSON content first.');
      return;
    }

    try {
      const parsed = JSON.parse(rawJsonText);
      let count = 0;

      if (Array.isArray(parsed)) {
        if (jsonDataType === 'schools') {
          const schools: School[] = parsed.map((r, i) => ({
            id: String(r.id || `sch_${i + 1}`),
            code: String(r.code || r.school_code || `SCH${i + 1}`),
            name: String(r.name || r.school_name || 'School'),
            multiplier: Number(r.multiplier) || 1.0,
            active: r.active !== false,
            phone: r.phone || '',
          }));
          await db.schools.clear();
          await db.schools.bulkAdd(schools);
          count = schools.length;
        } else if (jsonDataType === 'products') {
          const products: Product[] = parsed.map((r, i) => ({
            id: String(r.id || `p_${i + 1}`),
            name: String(r.name || r.product_name || r.title || 'Product'),
            category: r.category || 'uniform',
            size_group_id: r.size_group_id || null,
            base_price: Number(r.base_price || r.price || r.rate || 0),
            stock: Number(r.stock || r.quantity || 0),
            low_stock_threshold: Number(r.low_stock_threshold || 5),
            hsn: String(r.hsn || '6205'),
          }));
          await db.products.clear();
          await db.products.bulkAdd(products);
          count = products.length;
        } else if (jsonDataType === 'prices') {
          const prices: PriceEntry[] = parsed.map((r, i) => ({
            id: String(r.id || `pr_${r.school_id}_${r.product_id}_${i}`),
            school_id: String(r.school_id || ''),
            product_id: String(r.product_id || ''),
            size_id: r.size_id ? String(r.size_id) : null,
            price: Number(r.price || r.rate || 0),
          }));
          await db.price_list.clear();
          await db.price_list.bulkAdd(prices);
          count = prices.length;
        } else if (jsonDataType === 'bills') {
          await db.bills.clear();
          await db.bills.bulkAdd(parsed as Bill[]);
          count = parsed.length;
        }
      }

      setJsonImportResult(`Successfully imported ${count} items into local database!`);
      onImportComplete();
    } catch (err: unknown) {
      setJsonImportResult(`JSON parse error: ${(err as Error)?.message}`);
    }
  };

  if (!isOpen) return null;

  const keyType = detectKeyType(anonKey);

  const sampleSqlScript = `-- ==========================================
-- COUNTERLY POS: SUPABASE TABLE SCHEMA
-- Run this in Supabase Dashboard -> SQL Editor
-- ==========================================

CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  multiplier NUMERIC DEFAULT 1.0,
  active BOOLEAN DEFAULT true,
  phone TEXT,
  address TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'uniform',
  size_group_id TEXT,
  base_price NUMERIC DEFAULT 0,
  stock NUMERIC DEFAULT 0,
  low_stock_threshold NUMERIC DEFAULT 5,
  hsn TEXT DEFAULT '6205'
);

CREATE TABLE IF NOT EXISTS size_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sizes (
  id TEXT PRIMARY KEY,
  size_group_id TEXT,
  label TEXT NOT NULL,
  sort_order NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS price_list (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  size_id TEXT,
  price NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stocks (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  size_id TEXT,
  size_label TEXT,
  quantity NUMERIC DEFAULT 0,
  min_stock NUMERIC DEFAULT 5
);

CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  bill_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  customer_name TEXT,
  customer_phone TEXT,
  school_id TEXT,
  school_name TEXT,
  schools JSONB,
  subtotal NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  discount_type TEXT DEFAULT 'flat',
  total NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  payment_details JSONB,
  notes TEXT,
  is_paid BOOLEAN DEFAULT true,
  items JSONB
);

-- Row Level Security (RLS) Configuration
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE size_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

-- Catalog Data Policies: Public read allows POS offline sync
CREATE POLICY "Allow public read on schools" ON schools FOR SELECT USING (true);
CREATE POLICY "Allow public read on products" ON products FOR SELECT USING (true);
CREATE POLICY "Allow public read on size_groups" ON size_groups FOR SELECT USING (true);
CREATE POLICY "Allow public read on sizes" ON sizes FOR SELECT USING (true);
CREATE POLICY "Allow public read on price_list" ON price_list FOR SELECT USING (true);
CREATE POLICY "Allow public read on stocks" ON stocks FOR SELECT USING (true);

-- Bills & Invoices Policies: Allow POS Terminal to write sales records
CREATE POLICY "Allow terminal insert on bills" ON bills FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow terminal update on bills" ON bills FOR UPDATE USING (true);
CREATE POLICY "Allow terminal read on bills" ON bills FOR SELECT USING (true);
`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-xl border border-[#E5E5E7] overflow-hidden my-auto animate-in fade-in-50 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-[#1D1D1F] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <Database className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base">Supabase Database Importer</h2>
              <p className="text-xs text-[#86868B]">
                Server-side direct sync, custom table mapper &amp; JSON loader
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#86868B] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-[#E5E5E7] bg-[#F5F5F7] px-4 gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('connect')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'connect'
                ? 'border-[#1D1D1F] text-[#1D1D1F]'
                : 'border-transparent text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>1. Auto Scan</span>
          </button>

          <button
            onClick={() => setActiveTab('custom')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'custom'
                ? 'border-[#1D1D1F] text-[#1D1D1F]'
                : 'border-transparent text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>2. Custom Table Names &amp; Run</span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'json'
                ? 'border-[#1D1D1F] text-[#1D1D1F]'
                : 'border-transparent text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>3. Direct Paste (JSON)</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'sql'
                ? 'border-[#1D1D1F] text-[#1D1D1F]'
                : 'border-transparent text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>4. SQL Schema</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: Auto Scan & Credentials */}
          {activeTab === 'connect' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[#86868B] block mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="text"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://xyzproject.supabase.co"
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-[#F5F5F7] text-[#1D1D1F]"
                  />
                  <span className="text-[10px] text-[#86868B] mt-0.5 block">
                    Found in Supabase Dashboard → Settings → API → Project URL
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#86868B]">
                      Supabase API Key
                    </label>
                    <span className="text-[10px] font-bold text-[#1D1D1F]">
                      Detected: {keyType}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={anonKey}
                      onChange={e => setAnonKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                      className="w-full h-9 pl-3 pr-10 rounded-xl border border-[#E5E5E7] text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-[#F5F5F7] text-[#1D1D1F]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F]"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {keyType.includes('service_role') ? (
                    <div className="mt-1.5 p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-[11px] font-semibold flex items-start gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Security Notice:</strong> You are using a secret <code>service_role</code> key. Because this terminal runs in client browsers, using your project's <code>anon (public)</code> key with Row Level Security (RLS) is strongly recommended for store operations.
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#86868B] mt-0.5 block">
                      Recommended: Use your Supabase project's <strong>anon (public)</strong> key with Row Level Security (RLS) enabled.
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleScanTables()}
                  disabled={isScanning || !url || !anonKey}
                  className="flex-1 py-2.5 rounded-xl bg-[#1D1D1F] hover:bg-[#333336] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'Querying Supabase Server Proxy...' : 'Auto-Scan Database Tables'}</span>
                </button>
              </div>

              {/* Status or Error */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Scan Note:</div>
                    <div>{errorMessage}</div>
                  </div>
                </div>
              )}

              {/* Server-Side Logs & Introspection */}
              {introspection && (
                <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs text-[#1D1D1F] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{introspection.message}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('custom')}
                      className="px-3 py-1 rounded-lg bg-[#1D1D1F] text-white text-xs font-bold flex items-center gap-1 hover:bg-[#333336] cursor-pointer"
                    >
                      <span>Next: Review &amp; Import</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {introspection.allTables.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {introspection.allTables.map(tbl => (
                        <div
                          key={tbl.name}
                          className="p-2 rounded-lg bg-white border border-[#E5E5E7] text-xs font-mono"
                        >
                          <div className="font-bold text-[#1D1D1F] truncate">{tbl.name}</div>
                          <div className="text-[10px] text-[#86868B]">{tbl.rowCount} rows</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-[#86868B] bg-white p-3 rounded-lg border border-[#E5E5E7]">
                      If your older app uses unique table names that weren't auto-detected, switch to <strong>2. Custom Table Names</strong> tab to type them directly!
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Custom Table Names & Execution */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#F5F5F7] border border-[#E5E5E7] rounded-xl text-xs text-[#1D1D1F] font-semibold">
                Type the exact names of tables in your Supabase database. You can edit any table name below:
              </div>

              {/* Single Table Quick Tester */}
              <div className="p-3 rounded-xl bg-white border border-[#E5E5E7] space-y-2">
                <label className="text-xs font-bold text-[#1D1D1F] flex items-center gap-1">
                  <Search className="w-3.5 h-3.5 text-[#1D1D1F]" />
                  <span>Test Any Table Name in your Supabase DB:</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={testTableName}
                    onChange={e => setTestTableName(e.target.value)}
                    placeholder="e.g. uniform_products, school_master, tbl_items"
                    className="flex-1 h-8 px-2.5 rounded-lg border border-[#E5E5E7] font-mono text-xs bg-white text-[#1D1D1F]"
                  />
                  <button
                    type="button"
                    onClick={handleTestSingleTable}
                    disabled={isTestingTable || !testTableName.trim()}
                    className="px-3 h-8 rounded-lg bg-[#1D1D1F] text-white text-xs font-bold hover:bg-[#333336] disabled:opacity-50 cursor-pointer"
                  >
                    {isTestingTable ? 'Querying...' : 'Fetch Rows'}
                  </button>
                </div>

                {tablePreviewData && (
                  <div className="p-2 rounded-lg bg-[#F5F5F7] border border-[#E5E5E7] text-xs font-mono">
                    <div className="text-[#1D1D1F] font-bold">
                      Table '{tablePreviewData.name}' found: {tablePreviewData.count} total rows.
                    </div>
                    {tablePreviewData.rows.length > 0 && (
                      <pre className="text-[10px] text-[#86868B] mt-1 max-h-24 overflow-y-auto">
                        {JSON.stringify(tablePreviewData.rows[0], null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Schools Table */}
                <div>
                  <label className="font-bold text-[#86868B] block mb-1">
                    Schools Table Name
                  </label>
                  <input
                    type="text"
                    value={schoolsTable}
                    onChange={e => setSchoolsTable(e.target.value)}
                    placeholder="schools"
                    className="w-full h-8 px-2.5 rounded-lg border border-[#E5E5E7] font-mono font-semibold bg-white text-[#1D1D1F] text-xs"
                  />
                </div>

                {/* Products Table */}
                <div>
                  <label className="font-bold text-[#86868B] block mb-1">
                    Products / Uniforms Table Name
                  </label>
                  <input
                    type="text"
                    value={productsTable}
                    onChange={e => setProductsTable(e.target.value)}
                    placeholder="products"
                    className="w-full h-8 px-2.5 rounded-lg border border-[#E5E5E7] font-mono font-semibold bg-white text-[#1D1D1F] text-xs"
                  />
                </div>

                {/* Sizes Table */}
                <div>
                  <label className="font-bold text-[#86868B] block mb-1">
                    Sizes Table Name
                  </label>
                  <input
                    type="text"
                    value={sizesTable}
                    onChange={e => setSizesTable(e.target.value)}
                    placeholder="sizes"
                    className="w-full h-8 px-2.5 rounded-lg border border-[#E5E5E7] font-mono font-semibold bg-white text-[#1D1D1F] text-xs"
                  />
                </div>

                {/* Price List Table */}
                <div>
                  <label className="font-bold text-[#86868B] block mb-1">
                    Price List / Rates Table Name
                  </label>
                  <input
                    type="text"
                    value={pricesTable}
                    onChange={e => setPricesTable(e.target.value)}
                    placeholder="price_list"
                    className="w-full h-8 px-2.5 rounded-lg border border-[#E5E5E7] font-mono font-semibold bg-white text-[#1D1D1F] text-xs"
                  />
                </div>

                {/* Stocks Table */}
                <div>
                  <label className="font-bold text-[#86868B] block mb-1">
                    Stocks / Inventory Table Name
                  </label>
                  <input
                    type="text"
                    value={stocksTable}
                    onChange={e => setStocksTable(e.target.value)}
                    placeholder="stocks"
                    className="w-full h-8 px-2.5 rounded-lg border border-[#E5E5E7] font-mono font-semibold bg-white text-[#1D1D1F] text-xs"
                  />
                </div>

                {/* Bills Table */}
                <div>
                  <label className="font-bold text-[#86868B] block mb-1">
                    Bills / Sales Table Name
                  </label>
                  <input
                    type="text"
                    value={billsTable}
                    onChange={e => setBillsTable(e.target.value)}
                    placeholder="bills"
                    className="w-full h-8 px-2.5 rounded-lg border border-[#E5E5E7] font-mono font-semibold bg-white text-[#1D1D1F] text-xs"
                  />
                </div>
              </div>

              {/* Run Import Action */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleRunImport}
                  disabled={isImporting}
                  className="w-full py-3 rounded-xl bg-[#1D1D1F] hover:bg-[#333336] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <CloudDownload className={`w-4 h-4 ${isImporting ? 'animate-bounce' : ''}`} />
                  <span>{isImporting ? 'Importing Data into Offline Cache...' : 'Start Full Data Import'}</span>
                </button>
              </div>

              {/* Live Import Logs */}
              {logs.length > 0 && (
                <div className="p-3 rounded-xl bg-[#1D1D1F] text-[#F5F5F7] text-xs font-mono space-y-1 max-h-48 overflow-y-auto border border-[#333336]">
                  <div className="text-white font-bold text-[11px] pb-1 border-b border-[#333336]">
                    Live Import Progress:
                  </div>
                  {logs.map((l, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={l.status === 'success' ? 'text-emerald-400' : (l.status === 'error' ? 'text-red-400' : 'text-amber-300')}>
                        [{l.step}]
                      </span>
                      <span>{l.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Success summary */}
              {importSummary && (
                <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] text-xs text-[#1D1D1F] font-semibold space-y-2">
                  <div className="font-extrabold flex items-center gap-1.5 text-[#1D1D1F] text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Import Completed Successfully!</span>
                  </div>
                  <div className="space-y-1">
                    {importSummary.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Direct JSON Paste */}
          {activeTab === 'json' && (
            <div className="space-y-3">
              <div className="p-3 bg-[#F5F5F7] border border-[#E5E5E7] rounded-xl text-xs text-[#1D1D1F] font-semibold">
                You can download/export your tables from Supabase Dashboard → Table Editor as CSV/JSON, and paste them here directly:
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-[#86868B]">Target Data:</label>
                <select
                  value={jsonDataType}
                  onChange={e => setJsonDataType(e.target.value as any)}
                  className="h-8 px-2 rounded-lg border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F]"
                >
                  <option value="products">Products / Uniforms</option>
                  <option value="schools">Schools</option>
                  <option value="prices">Prices / Rates</option>
                  <option value="bills">Past Bills</option>
                </select>
              </div>

              <textarea
                rows={6}
                value={rawJsonText}
                onChange={e => setRawJsonText(e.target.value)}
                placeholder='[ { "name": "White Shirt", "price": 260 }, { "name": "Navy Pant", "price": 340 } ]'
                className="w-full p-3 rounded-xl border border-[#E5E5E7] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-[#F5F5F7] text-[#1D1D1F]"
              />

              <button
                type="button"
                onClick={handleImportJson}
                className="w-full py-2.5 rounded-xl bg-[#1D1D1F] text-white font-extrabold text-xs hover:bg-[#333336] cursor-pointer"
              >
                Parse &amp; Import JSON Data
              </button>

              {jsonImportResult && (
                <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F]">
                  {jsonImportResult}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SQL Schema Script */}
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="p-3 bg-[#F5F5F7] border border-[#E5E5E7] rounded-xl text-xs text-[#1D1D1F] font-semibold flex items-center justify-between">
                <span>Run this SQL in your Supabase SQL Editor if you want to initialize or sync schema:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(sampleSqlScript);
                    alert('SQL schema copied to clipboard!');
                  }}
                  className="px-2.5 py-1 rounded bg-[#1D1D1F] text-white text-[11px] font-bold hover:bg-[#333336] cursor-pointer"
                >
                  Copy SQL
                </button>
              </div>

              <pre className="p-3 rounded-xl bg-[#1D1D1F] text-[#F5F5F7] font-mono text-[11px] max-h-60 overflow-y-auto whitespace-pre border border-[#333336]">
                {sampleSqlScript}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
