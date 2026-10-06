import Dexie, { type Table } from 'dexie';
import {
  type School,
  type Product,
  type SizeGroup,
  type SizeItem,
  type PriceEntry,
  type ProductStock,
  type Bill,
  type InventoryMovement,
  type ShopConfig,
  type UserProfile,
  type StudentProfile,
  type AdvanceOrderJob,
  type Category,
} from '../types';

export class NandalayaDB extends Dexie {
  schools!: Table<School, string>;
  products!: Table<Product, string>;
  size_groups!: Table<SizeGroup, string>;
  sizes!: Table<SizeItem, string>;
  price_list!: Table<PriceEntry, string>;
  stocks!: Table<ProductStock, string>;
  bills!: Table<Bill, string>;
  inventory_movements!: Table<InventoryMovement, string>;
  shop_config!: Table<ShopConfig, string>;
  users!: Table<UserProfile, string>;
  students!: Table<StudentProfile, string>;
  advance_orders!: Table<AdvanceOrderJob, string>;
  customer_display_state!: Table<any, string>;
  categories!: Table<Category, string>;

  constructor() {
    super('NANDALAYADB');
    this.version(4).stores({
      schools: 'id, code, name, active',
      products: 'id, name, category, size_group_id',
      size_groups: 'id, name',
      sizes: 'id, size_group_id, sort_order',
      price_list: 'id, school_id, product_id, size_id, [school_id+product_id]',
      stocks: 'id, product_id, size_id, quantity',
      bills: 'id, bill_number, school_id, created_at, is_paid, status, customer_phone, billed_by_id',
      inventory_movements: 'id, product_id, type, created_at',
      shop_config: 'id',
      users: 'id, pin, role, active',
      students: 'id, parent_phone, student_name, school_id',
      advance_orders: 'id, token_number, customer_phone, status, created_at',
      customer_display_state: 'id',
    });
    this.version(5).stores({
      schools: 'id, code, name, active',
      products: 'id, name, category, size_group_id',
      size_groups: 'id, name',
      sizes: 'id, size_group_id, sort_order',
      price_list: 'id, school_id, product_id, size_id, [school_id+product_id]',
      stocks: 'id, product_id, size_id, quantity',
      bills: 'id, bill_number, school_id, created_at, is_paid, status, customer_phone, billed_by_id',
      inventory_movements: 'id, product_id, type, created_at',
      shop_config: 'id',
      users: 'id, pin, role, active',
      students: 'id, parent_phone, student_name, school_id',
      advance_orders: 'id, token_number, customer_phone, status, created_at',
      customer_display_state: 'id',
      categories: 'id, name, sort_order',
    });
  }
}

export let db = new NandalayaDB();

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'uniform', name: 'Uniform', sort_order: 1 },
  { id: 'accessories', name: 'Accessories', sort_order: 2 },
  { id: 'footwear', name: 'Footwear', sort_order: 3 },
  { id: 'winterwear', name: 'Winterwear', sort_order: 4 },
];

export const CLEAN_DEFAULT_CONFIG: ShopConfig = {
  id: 'cfg_default',
  legal_name: 'SARASWATI GARMENTS',
  shop_tagline: 'School Uniforms & Retail Garments',
  shop_address: 'Main Market Complex',
  shop_phone: '+91 98765 43210',
  gstin: '',
  gst_scheme: 'composition',
  upi_id: 'saraswatigarments@upi',
  printer_width: 48,
  auto_print_cash: true,
  auto_print_upi: true,
  sound_feedback: true,
  bill_prefix: 'SG-2026-',
  bill_sequence: 1001,
  tax_type: 'inclusive',
  tax_rate: 5,
};

export const DEFAULT_STAFF_USERS: UserProfile[] = [
  {
    id: 'usr_admin',
    name: 'Store Admin',
    role: 'admin',
    pin: '123456',
    active: true,
    phone: '+91 98765 43210',
    created_at: new Date().toISOString(),
  },
  {
    id: 'usr_manager',
    name: 'Shift Lead',
    role: 'manager',
    pin: '222222',
    active: true,
    phone: '+91 98765 43211',
    created_at: new Date().toISOString(),
  },
  {
    id: 'usr_cashier',
    name: 'Counter Associate',
    role: 'cashier',
    pin: '111111',
    active: true,
    max_discount_percent: 5,
    max_discount_amount: 100,
    created_at: new Date().toISOString(),
  },
];

const LEGACY_MOCK_SCHOOL_IDS = [
  'sch_dav', 'sch_kv', 'sch_dps', 'sch_stx', 'sch_sj', 'sch_gmss', 'sch_mcs'
];

const LEGACY_MOCK_PRODUCT_IDS = [
  'p_shirt_half', 'p_shirt_full', 'p_pant', 'p_skirt', 'p_tunic',
  'p_shoes_black', 'p_shoes_pt', 'p_belt', 'p_tie', 'p_socks', 'p_bag',
  'p_trackpant', 'p_tshirt', 'p_blazer'
];

const LEGACY_MOCK_SIZEGROUP_IDS = [
  'sg_shirt', 'sg_pant', 'sg_skirt', 'sg_tunic', 'sg_shoe', 'sg_belt'
];

/**
 * Automatically purges any legacy demo/mock data that was stored in older sessions.
 */
export async function purgeLegacyMockData() {
  try {
    if (!db.isOpen()) {
      await db.open();
    }

    // Purge demo schools
    const schools = await db.schools.toArray();
    const demoSchools = schools.filter(s => LEGACY_MOCK_SCHOOL_IDS.includes(s.id));
    if (demoSchools.length > 0) {
      await db.schools.bulkDelete(demoSchools.map(s => s.id));
    }

    // Purge demo products
    const products = await db.products.toArray();
    const demoProducts = products.filter(p => LEGACY_MOCK_PRODUCT_IDS.includes(p.id));
    if (demoProducts.length > 0) {
      await db.products.bulkDelete(demoProducts.map(p => p.id));
    }

    // Purge demo size groups
    const sgs = await db.size_groups.toArray();
    const demoSgs = sgs.filter(sg => LEGACY_MOCK_SIZEGROUP_IDS.includes(sg.id));
    if (demoSgs.length > 0) {
      await db.size_groups.bulkDelete(demoSgs.map(sg => sg.id));
    }

    // Purge demo sizes
    const sizes = await db.sizes.toArray();
    const demoSizes = sizes.filter(sz => 
      sz.id.startsWith('sz_s_') || sz.id.startsWith('sz_p_') || 
      sz.id.startsWith('sz_sk_') || sz.id.startsWith('sz_tu_') || 
      sz.id.startsWith('sz_sh_') || sz.id.startsWith('sz_b_')
    );
    if (demoSizes.length > 0) {
      await db.sizes.bulkDelete(demoSizes.map(sz => sz.id));
    }

    // Purge demo bills
    const bills = await db.bills.toArray();
    const demoBills = bills.filter(b => b.id.startsWith('bill_demo_'));
    if (demoBills.length > 0) {
      await db.bills.bulkDelete(demoBills.map(b => b.id));
    }

    // Purge demo prices & stocks
    const prices = await db.price_list.toArray();
    const demoPrices = prices.filter(pr => 
      LEGACY_MOCK_SCHOOL_IDS.includes(pr.school_id) || 
      LEGACY_MOCK_PRODUCT_IDS.includes(pr.product_id)
    );
    if (demoPrices.length > 0) {
      await db.price_list.bulkDelete(demoPrices.map(pr => pr.id));
    }

    const stocks = await db.stocks.toArray();
    const demoStocks = stocks.filter(st => LEGACY_MOCK_PRODUCT_IDS.includes(st.product_id));
    if (demoStocks.length > 0) {
      await db.stocks.bulkDelete(demoStocks.map(st => st.id));
    }

    // Clean parked bills in localStorage
    try {
      const saved = localStorage.getItem('nandalaya_parked_bills');
      if (saved) {
        const pb = JSON.parse(saved);
        if (Array.isArray(pb)) {
          const filtered = pb.filter(p => !LEGACY_MOCK_SCHOOL_IDS.includes(p.school_id));
          localStorage.setItem('nandalaya_parked_bills', JSON.stringify(filtered));
        }
      }
    } catch {
      // ignore
    }
  } catch (err) {
    console.error('Error purging legacy mock data:', err);
  }
}

export async function initializeDatabase() {
  if (!db.isOpen()) {
    await db.open();
  }

  // Purge any leftover mock records
  await purgeLegacyMockData();

  // Initialize clean shop config if not set
  const cfgCount = await db.shop_config.count();
  if (cfgCount === 0) {
    await db.shop_config.add(CLEAN_DEFAULT_CONFIG);
  } else {
    const existing = await db.shop_config.toArray();
    if (existing[0] && (existing[0].legal_name?.includes('NANDALAYA') || existing[0].upi_id?.includes('nandalaya'))) {
      await db.shop_config.update(existing[0].id, {
        legal_name: 'SARASWATI GARMENTS',
        shop_tagline: 'School Uniforms & Retail Garments',
        upi_id: 'saraswatigarments@upi'
      });
    }
  }

  // Initialize staff accounts if not set
  const userCount = await db.users.count();
  if (userCount === 0) {
    await db.users.bulkAdd(DEFAULT_STAFF_USERS);
  }

  // Initialize categories if not set
  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }
}

export const initDatabase = initializeDatabase;

/**
 * Completely wipes all local IndexedDB tables and local storage caches
 */
export async function wipeAllLocalData() {
  try {
    if (!db.isOpen()) {
      await db.open();
    }

    await Promise.all([
      db.schools.clear().catch(() => {}),
      db.products.clear().catch(() => {}),
      db.sizes.clear().catch(() => {}),
      db.size_groups.clear().catch(() => {}),
      db.price_list.clear().catch(() => {}),
      db.stocks.clear().catch(() => {}),
      db.bills.clear().catch(() => {}),
      db.inventory_movements.clear().catch(() => {}),
      db.categories.clear().catch(() => {}),
    ]);

    // Re-ensure default shop config
    const configs = await db.shop_config.toArray();
    if (configs.length === 0) {
      await db.shop_config.add(CLEAN_DEFAULT_CONFIG);
    }

    // Re-ensure staff users
    const userCount = await db.users.count();
    if (userCount === 0) {
      await db.users.bulkAdd(DEFAULT_STAFF_USERS);
    }

    // Re-ensure default categories
    const catCount = await db.categories.count();
    if (catCount === 0) {
      await db.categories.bulkAdd(DEFAULT_CATEGORIES);
    }

    try {
      localStorage.removeItem('nandalaya_parked_bills');
    } catch {
      // ignore
    }
    return true;
  } catch (err) {
    console.error('Wipe data failed, executing hard delete:', err);
    // Hard fallback: delete database entirely
    try {
      await db.delete();
      db = new NandalayaDB();
      await db.open();
      await db.shop_config.add(CLEAN_DEFAULT_CONFIG);
      await db.users.bulkAdd(DEFAULT_STAFF_USERS);
      return true;
    } catch (e) {
      console.error('Hard delete failed:', e);
      return false;
    }
  }
}

/**
 * Hard Reset: Deletes database, localStorage, and resets everything to zero
 */
export async function hardResetEntireApp(preserveSupabaseCredentials = true) {
  try {
    let savedSupabaseConfig = null;
    if (preserveSupabaseCredentials) {
      try {
        savedSupabaseConfig = localStorage.getItem('nandalaya_supabase_config');
      } catch {
        // ignore
      }
    }

    await db.delete();
    localStorage.clear();

    if (preserveSupabaseCredentials && savedSupabaseConfig) {
      localStorage.setItem('nandalaya_supabase_config', savedSupabaseConfig);
    }

    db = new NandalayaDB();
    await db.open();
    await db.shop_config.add(CLEAN_DEFAULT_CONFIG);
    await db.users.bulkAdd(DEFAULT_STAFF_USERS);
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
    return true;
  } catch (err) {
    console.error('Hard reset error:', err);
    return false;
  }
}
