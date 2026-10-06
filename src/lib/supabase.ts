import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db/db';
import { 
  type School, 
  type Product, 
  type SizeGroup, 
  type SizeItem, 
  type PriceEntry, 
  type ProductStock, 
  type Bill, 
  type ShopConfig 
} from '../types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  autoSync: boolean;
  lastSyncedAt: string | null;
}

const STORAGE_KEY = 'nandalaya_supabase_config';

export function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let u = rawUrl.trim();
  const dashboardMatch = u.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/i);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }
  u = u.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  return u;
}

export function sanitizeSupabaseKey(rawKey: string): string {
  if (!rawKey) return '';
  let k = rawKey.trim().replace(/^['"]|['"]$/g, '');
  if (k.toLowerCase().startsWith('bearer ')) {
    k = k.substring(7).trim();
  }
  return k;
}

export function getSupabaseConfig(): SupabaseConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        url: sanitizeSupabaseUrl(parsed.url || ''),
        anonKey: sanitizeSupabaseKey(parsed.anonKey || ''),
        autoSync: parsed.autoSync ?? true,
        lastSyncedAt: parsed.lastSyncedAt || null,
      };
    }
  } catch {
    // fallback
  }

  return {
    url: sanitizeSupabaseUrl((import.meta.env.VITE_SUPABASE_URL as string) || ''),
    anonKey: sanitizeSupabaseKey((import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''),
    autoSync: true,
    lastSyncedAt: null,
  };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  const cleanConfig: SupabaseConfig = {
    url: sanitizeSupabaseUrl(config.url),
    anonKey: sanitizeSupabaseKey(config.anonKey),
    autoSync: config.autoSync,
    lastSyncedAt: config.lastSyncedAt,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanConfig));
  cachedClient = null;
  lastClientKey = '';
}

let cachedClient: SupabaseClient | null = null;
let lastClientKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) return null;

  const currentKey = `${cfg.url}_${cfg.anonKey}`;
  if (cachedClient && lastClientKey === currentKey) {
    return cachedClient;
  }

  try {
    const cleanUrl = sanitizeSupabaseUrl(cfg.url);
    const cleanKey = sanitizeSupabaseKey(cfg.anonKey);

    cachedClient = createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { apikey: cleanKey, Authorization: `Bearer ${cleanKey}` } },
    });
    lastClientKey = currentKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

export function detectKeyType(key: string): 'service_role (Secret Key)' | 'anon (Public Key)' | 'API Key' {
  if (!key) return 'API Key';
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      if (payload.role === 'service_role') {
        return 'service_role (Secret Key)';
      }
      if (payload.role === 'anon') {
        return 'anon (Public Key)';
      }
    }
  } catch {
    // ignore
  }
  return 'API Key';
}

export interface TableInfo {
  name: string;
  rowCount: number;
  columns?: string[];
  sampleRows?: any[];
}

export interface IntrospectionResult {
  success: boolean;
  message: string;
  keyType: string;
  allTables: TableInfo[];
  suggestedMapping: {
    schools?: string;
    products?: string;
    sizes?: string;
    sizeGroups?: string;
    prices?: string;
    stocks?: string;
    bills?: string;
    shopConfig?: string;
  };
  diagnosticLogs?: string[];
  errorDetail?: string;
}

/**
 * Introspects Supabase tables via server proxy first (to avoid browser CORS), with client fallback
 */
export async function introspectAllSupabaseTables(url?: string, key?: string): Promise<IntrospectionResult> {
  const targetUrl = sanitizeSupabaseUrl(url || getSupabaseConfig().url);
  const targetKey = sanitizeSupabaseKey(key || getSupabaseConfig().anonKey);

  if (!targetUrl || !targetKey) {
    return {
      success: false,
      message: 'Please provide Supabase Project URL and Key',
      keyType: 'None',
      allTables: [],
      suggestedMapping: {},
    };
  }

  const keyType = detectKeyType(targetKey);
  const logs: string[] = [];

  // 1. Try Server-Side Proxy first (no CORS limitations)
  try {
    const proxyResp = await fetch('/api/supabase/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl, key: targetKey }),
    });

    if (proxyResp.ok) {
      const pData = await proxyResp.json();
      if (pData.success && Array.isArray(pData.detectedTables)) {
        const tables: TableInfo[] = pData.detectedTables.map((t: any) => ({
          name: t.name,
          rowCount: t.rowCount || 0,
          columns: t.sampleCols || [],
        }));

        const suggested: IntrospectionResult['suggestedMapping'] = {};
        for (const t of tables) {
          const l = t.name.toLowerCase();
          if (l.includes('school')) suggested.schools = t.name;
          if (l.includes('product') || l.includes('item') || l.includes('uniform')) suggested.products = t.name;
          if (l.includes('size') && !l.includes('group')) suggested.sizes = t.name;
          if (l.includes('group') || l.includes('category')) suggested.sizeGroups = t.name;
          if (l.includes('price') || l.includes('rate')) suggested.prices = t.name;
          if (l.includes('stock') || l.includes('invent')) suggested.stocks = t.name;
          if (l.includes('bill') || l.includes('sale') || l.includes('invoice')) suggested.bills = t.name;
        }

        return {
          success: true,
          message: tables.length > 0 
            ? `Server connected! Found ${tables.length} tables in your Supabase database.` 
            : `Connected to Supabase (${keyType}), but no tables with data were found yet.`,
          keyType,
          allTables: tables,
          suggestedMapping: suggested,
          diagnosticLogs: pData.logs,
        };
      }
    }
  } catch (err) {
    logs.push(`Server proxy check skipped: ${err}`);
  }

  // 2. Direct client fallback
  const tablesMap = new Map<string, TableInfo>();
  const client = createClient(targetUrl, targetKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { apikey: targetKey, Authorization: `Bearer ${targetKey}` } },
  });

  const candidateNames = [
    'schools', 'school', 'school_master', 'school_masters', 'tbl_schools', 'schools_list',
    'products', 'product', 'items', 'item', 'product_master', 'uniforms', 'tbl_products',
    'sizes', 'size', 'size_items', 'size_item', 'size_master',
    'size_groups', 'size_group', 'categories',
    'price_list', 'prices', 'price', 'rates', 'school_prices',
    'stocks', 'stock', 'inventory', 'product_stocks',
    'bills', 'bill', 'sales', 'sale', 'invoices', 'orders',
    'shop_config', 'settings', 'config'
  ];

  for (const tbl of candidateNames) {
    try {
      const { data, error, count } = await client.from(tbl).select('*', { count: 'exact' }).limit(1);
      if (!error && Array.isArray(data)) {
        tablesMap.set(tbl, {
          name: tbl,
          rowCount: typeof count === 'number' ? count : data.length,
          columns: data.length > 0 ? Object.keys(data[0]) : [],
        });
      }
    } catch {
      // ignore
    }
  }

  const detected = Array.from(tablesMap.values());
  return {
    success: true,
    message: detected.length > 0 
      ? `Found ${detected.length} tables in Supabase.` 
      : `Connected, but no standard tables detected. You can type table names manually below.`,
    keyType,
    allTables: detected,
    suggestedMapping: {
      schools: detected.find(t => t.name.includes('school'))?.name,
      products: detected.find(t => t.name.includes('product') || t.name.includes('item'))?.name,
      sizes: detected.find(t => t.name.includes('size') && !t.name.includes('group'))?.name,
      sizeGroups: detected.find(t => t.name.includes('group'))?.name,
      prices: detected.find(t => t.name.includes('price') || t.name.includes('rate'))?.name,
      stocks: detected.find(t => t.name.includes('stock') || t.name.includes('invent'))?.name,
      bills: detected.find(t => t.name.includes('bill') || t.name.includes('sale'))?.name,
    },
    diagnosticLogs: logs,
  };
}

/**
 * Fetches rows from a specific table (via server proxy or direct)
 */
export async function fetchSupabaseTableData(tableName: string): Promise<any[]> {
  const cfg = getSupabaseConfig();
  const url = sanitizeSupabaseUrl(cfg.url);
  const key = sanitizeSupabaseKey(cfg.anonKey);

  if (!url || !key || !tableName) return [];

  // Try server proxy first
  try {
    const resp = await fetch('/api/supabase/fetch-table', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, key, tableName }),
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data.success && Array.isArray(data.rows)) {
        return data.rows;
      }
    }
  } catch {
    // fallback
  }

  // Direct client fallback
  const client = getSupabaseClient();
  if (client) {
    const { data } = await client.from(tableName).select('*');
    if (Array.isArray(data)) return data;
  }

  return [];
}

export interface CustomMapping {
  schoolsTable?: string;
  productsTable?: string;
  sizesTable?: string;
  sizeGroupsTable?: string;
  pricesTable?: string;
  stocksTable?: string;
  billsTable?: string;
  shopConfigTable?: string;
}

export interface ImportLogEntry {
  step: string;
  status: 'pending' | 'running' | 'success' | 'warning' | 'error';
  message: string;
  count?: number;
}

export async function executeSupabaseImport(
  customMapping?: CustomMapping,
  onLog?: (entry: ImportLogEntry) => void
): Promise<{ success: boolean; message: string; summary: string[] }> {
  const log = (step: string, status: ImportLogEntry['status'], message: string, count?: number) => {
    console.log(`[Import] ${step}: ${message}`);
    if (onLog) onLog({ step, status, message, count });
  };

  const summary: string[] = [];

  try {
    // 1. Schools
    const schoolsTable = customMapping?.schoolsTable || 'schools';
    log('Schools', 'running', `Querying schools from '${schoolsTable}'...`);
    const rawSchools = await fetchSupabaseTableData(schoolsTable);
    if (rawSchools.length > 0) {
      const mappedSchools: School[] = rawSchools.map((r: any, i: number) => ({
        id: String(r.id || r.school_id || r.code || `sch_${i + 1}`),
        code: String(r.code || r.school_code || r.short_name || r.name?.substring(0, 4)?.toUpperCase() || `SCH${i + 1}`),
        name: String(r.name || r.school_name || r.title || 'School'),
        multiplier: Number(r.multiplier) || 1.0,
        active: r.active !== false && r.is_active !== false,
        phone: r.phone || r.contact || r.mobile || '',
        address: r.address || '',
      }));

      await db.schools.clear();
      await db.schools.bulkAdd(mappedSchools);
      summary.push(`${mappedSchools.length} Schools from '${schoolsTable}'`);
      log('Schools', 'success', `Imported ${mappedSchools.length} schools`, mappedSchools.length);
    } else {
      log('Schools', 'warning', `No records found in table '${schoolsTable}'`);
    }

    // 2. Size Groups
    const sgTable = customMapping?.sizeGroupsTable || 'size_groups';
    log('Size Groups', 'running', `Querying size groups from '${sgTable}'...`);
    const rawSg = await fetchSupabaseTableData(sgTable);
    if (rawSg.length > 0) {
      const mappedSg: SizeGroup[] = rawSg.map((r: any, i: number) => ({
        id: String(r.id || r.group_id || `sg_${i + 1}`),
        name: String(r.name || r.group_name || r.title || 'Size Group'),
      }));

      await db.size_groups.clear();
      await db.size_groups.bulkAdd(mappedSg);
      summary.push(`${mappedSg.length} Size Groups from '${sgTable}'`);
      log('Size Groups', 'success', `Imported ${mappedSg.length} size groups`, mappedSg.length);
    } else {
      log('Size Groups', 'warning', `No size groups found in '${sgTable}'`);
    }

    // 3. Sizes
    const sizesTable = customMapping?.sizesTable || 'sizes';
    log('Sizes', 'running', `Querying sizes from '${sizesTable}'...`);
    const rawSizes = await fetchSupabaseTableData(sizesTable);
    if (rawSizes.length > 0) {
      const mappedSizes: SizeItem[] = rawSizes.map((r: any, i: number) => ({
        id: String(r.id || r.size_id || `sz_${i + 1}`),
        size_group_id: String(r.size_group_id || r.group_id || ''),
        label: String(r.label || r.size || r.name || 'Free'),
        sort_order: Number(r.sort_order || r.order || r.index || i + 1),
      }));

      await db.sizes.clear();
      await db.sizes.bulkAdd(mappedSizes);
      summary.push(`${mappedSizes.length} Sizes from '${sizesTable}'`);
      log('Sizes', 'success', `Imported ${mappedSizes.length} sizes`, mappedSizes.length);
    } else {
      log('Sizes', 'warning', `No sizes in '${sizesTable}'`);
    }

    // 4. Products / Items
    const productsTable = customMapping?.productsTable || 'products';
    log('Products', 'running', `Querying products from '${productsTable}'...`);
    const rawProducts = await fetchSupabaseTableData(productsTable);
    if (rawProducts.length > 0) {
      const mappedProducts: Product[] = rawProducts.map((r: any, i: number) => ({
        id: String(r.id || r.product_id || r.item_id || `p_${i + 1}`),
        name: String(r.name || r.product_name || r.item_name || r.title || 'Uniform Item'),
        category: (r.category || r.type || 'uniform') as any,
        size_group_id: r.size_group_id || r.size_group || r.group_id || null,
        base_price: Number(r.base_price || r.price || r.rate || r.unit_price || r.mrp || 0),
        stock: Number(r.stock || r.quantity || r.available_stock || 0),
        low_stock_threshold: Number(r.low_stock_threshold || r.min_stock || 5),
        hsn: String(r.hsn || r.hsn_code || '6205'),
      }));

      await db.products.clear();
      await db.products.bulkAdd(mappedProducts);
      summary.push(`${mappedProducts.length} Products from '${productsTable}'`);
      log('Products', 'success', `Imported ${mappedProducts.length} products`, mappedProducts.length);
    } else {
      log('Products', 'warning', `No products in '${productsTable}'`);
    }

    // 5. Prices / Rates
    const pricesTable = customMapping?.pricesTable || 'price_list';
    log('Prices', 'running', `Querying rates from '${pricesTable}'...`);
    const rawPrices = await fetchSupabaseTableData(pricesTable);
    if (rawPrices.length > 0) {
      const mappedPrices: PriceEntry[] = rawPrices.map((r: any, i: number) => ({
        id: String(r.id || `pr_${r.school_id}_${r.product_id}_${r.size_id || 'null'}_${i}`),
        school_id: String(r.school_id || ''),
        product_id: String(r.product_id || r.item_id || ''),
        size_id: r.size_id ? String(r.size_id) : null,
        price: Number(r.price || r.rate || r.unit_price || r.amount || 0),
      }));

      await db.price_list.clear();
      await db.price_list.bulkAdd(mappedPrices);
      summary.push(`${mappedPrices.length} Rates from '${pricesTable}'`);
      log('Prices', 'success', `Imported ${mappedPrices.length} rate entries`, mappedPrices.length);
    } else {
      log('Prices', 'warning', `No prices in '${pricesTable}'`);
    }

    // 6. Stocks
    const stocksTable = customMapping?.stocksTable || 'stocks';
    log('Stocks', 'running', `Querying stocks from '${stocksTable}'...`);
    const rawStocks = await fetchSupabaseTableData(stocksTable);
    if (rawStocks.length > 0) {
      const mappedStocks: ProductStock[] = rawStocks.map((r: any, i: number) => ({
        id: String(r.id || `${r.product_id}_${r.size_id || 'free'}`),
        product_id: String(r.product_id || ''),
        size_id: r.size_id ? String(r.size_id) : null,
        size_label: String(r.size_label || r.size || 'Free Size'),
        quantity: Number(r.quantity || r.qty || r.stock || 0),
        min_stock: Number(r.min_stock || 5),
      }));

      await db.stocks.clear();
      await db.stocks.bulkAdd(mappedStocks);
      summary.push(`${mappedStocks.length} Stock rows from '${stocksTable}'`);
      log('Stocks', 'success', `Imported ${mappedStocks.length} inventory stocks`, mappedStocks.length);
    } else {
      log('Stocks', 'warning', `No stock entries in '${stocksTable}'`);
    }

    // 7. Bills
    const billsTable = customMapping?.billsTable || 'bills';
    log('Bills', 'running', `Querying past bills from '${billsTable}'...`);
    const rawBills = await fetchSupabaseTableData(billsTable);
    if (rawBills.length > 0) {
      const mappedBills: Bill[] = rawBills.map((r: any, i: number) => {
        let itemsArr = [];
        if (Array.isArray(r.items)) {
          itemsArr = r.items;
        } else if (typeof r.items === 'string') {
          try {
            itemsArr = JSON.parse(r.items);
          } catch {
            itemsArr = [];
          }
        }

        return {
          id: String(r.id || `bill_${i + 1}`),
          bill_number: String(r.bill_number || r.bill_no || r.invoice_no || `SG-${1000 + i}`),
          created_at: String(r.created_at || r.date || new Date().toISOString()),
          customer_name: r.customer_name || r.customer || '',
          customer_phone: r.customer_phone || r.phone || '',
          school_id: String(r.school_id || ''),
          school_name: String(r.school_name || 'School'),
          schools: Array.isArray(r.schools) ? r.schools : (r.school_name ? [r.school_name] : []),
          subtotal: Number(r.subtotal || r.amount || 0),
          discount_amount: Number(r.discount_amount || r.discount || 0),
          discount_type: (r.discount_type || 'flat') as any,
          total: Number(r.total || r.grand_total || r.net_amount || 0),
          payment_method: (r.payment_method || r.mode || 'cash') as any,
          payment_details: r.payment_details || { [r.payment_method || 'cash']: Number(r.total || 0) },
          notes: r.notes || '',
          is_paid: r.is_paid !== false,
          paid_at: r.paid_at || null,
          status: (r.status || 'completed') as any,
          items: itemsArr,
        };
      });

      await db.bills.clear();
      await db.bills.bulkAdd(mappedBills);
      summary.push(`${mappedBills.length} Bills from '${billsTable}'`);
      log('Bills', 'success', `Imported ${mappedBills.length} bills`, mappedBills.length);
    } else {
      log('Bills', 'warning', `No past bills in '${billsTable}'`);
    }

    if (summary.length === 0) {
      log('Complete', 'error', 'No records loaded. Please verify your table names.');
      return {
        success: false,
        message: 'No records found in the specified tables. You can enter your exact table names under Custom Table Mapping.',
        summary: [],
      };
    }

    const updatedCfg = getSupabaseConfig();
    updatedCfg.lastSyncedAt = new Date().toISOString();
    saveSupabaseConfig(updatedCfg);

    log('Complete', 'success', `Import complete!`);
    return {
      success: true,
      message: `Imported: ${summary.join(' · ')}`,
      summary,
    };
  } catch (err: unknown) {
    log('Fatal', 'error', (err as Error)?.message || 'Import error');
    return {
      success: false,
      message: (err as Error)?.message || 'Import failed',
      summary,
    };
  }
}

export async function importFromSupabase(): Promise<{ success: boolean; message: string; summary?: string[] }> {
  return executeSupabaseImport();
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; discoveredTables: { name: string; category: string; rowCount: number }[] }> {
  const res = await introspectAllSupabaseTables();
  return {
    success: res.success,
    message: res.message,
    discoveredTables: res.allTables.map(t => ({
      name: t.name,
      category: t.name,
      rowCount: t.rowCount,
    })),
  };
}

export async function syncBillToSupabase(bill: Bill): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('bills').upsert(bill);
    if (error) {
      const fallback = await client.from('sales').upsert(bill);
      if (fallback.error) {
        console.warn('Could not sync bill to Supabase:', error.message);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.warn('Supabase bill sync failed:', e);
    return false;
  }
}

/**
 * Pushes all locally stored IndexedDB data (schools, products, sizes, prices, stocks, bills)
 * up to Supabase Cloud for safe keeping and cloud backup.
 */
export async function pushLocalDataToSupabase(
  onProgress?: (step: string, count: number) => void
): Promise<{ success: boolean; message: string; summary: string[] }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase credentials not configured. Please enter your Project URL and Key.',
      summary: [],
    };
  }

  const summary: string[] = [];

  try {
    // 1. Schools
    const schools = await db.schools.toArray();
    if (schools.length > 0) {
      if (onProgress) onProgress('Schools', schools.length);
      const { error } = await client.from('schools').upsert(schools);
      if (error) {
        console.warn('Supabase schools sync warning:', error.message);
      } else {
        summary.push(`${schools.length} Schools`);
      }
    }

    // 2. Size Groups
    const sgs = await db.size_groups.toArray();
    if (sgs.length > 0) {
      if (onProgress) onProgress('Size Groups', sgs.length);
      const { error } = await client.from('size_groups').upsert(sgs);
      if (!error) summary.push(`${sgs.length} Size Groups`);
    }

    // 3. Sizes
    const sizes = await db.sizes.toArray();
    if (sizes.length > 0) {
      if (onProgress) onProgress('Sizes', sizes.length);
      const { error } = await client.from('sizes').upsert(sizes);
      if (!error) summary.push(`${sizes.length} Sizes`);
    }

    // 4. Products
    const products = await db.products.toArray();
    if (products.length > 0) {
      if (onProgress) onProgress('Products', products.length);
      const { error } = await client.from('products').upsert(products);
      if (error) {
        console.warn('Supabase products sync warning:', error.message);
      } else {
        summary.push(`${products.length} Products`);
      }
    }

    // 5. Price List
    const prices = await db.price_list.toArray();
    if (prices.length > 0) {
      if (onProgress) onProgress('Prices', prices.length);
      const { error } = await client.from('price_list').upsert(prices);
      if (!error) summary.push(`${prices.length} Price entries`);
    }

    // 6. Stocks
    const stocks = await db.stocks.toArray();
    if (stocks.length > 0) {
      if (onProgress) onProgress('Stocks', stocks.length);
      const { error } = await client.from('stocks').upsert(stocks);
      if (!error) summary.push(`${stocks.length} Stock rows`);
    }

    // 7. Bills (batch in chunks of 40)
    const bills = await db.bills.toArray();
    if (bills.length > 0) {
      if (onProgress) onProgress('Bills', bills.length);
      let syncedBillsCount = 0;
      for (let i = 0; i < bills.length; i += 40) {
        const chunk = bills.slice(i, i + 40);
        const { error } = await client.from('bills').upsert(chunk);
        if (!error) {
          syncedBillsCount += chunk.length;
        }
      }
      if (syncedBillsCount > 0) {
        summary.push(`${syncedBillsCount} Bills`);
      }
    }

    if (summary.length === 0) {
      return {
        success: false,
        message: 'No local data found to push, or Supabase tables require matching columns/RLS.',
        summary: [],
      };
    }

    const cfg = getSupabaseConfig();
    cfg.lastSyncedAt = new Date().toISOString();
    saveSupabaseConfig(cfg);

    return {
      success: true,
      message: `Pushed to Supabase: ${summary.join(' · ')}`,
      summary,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Push to Supabase failed',
      summary,
    };
  }
}
