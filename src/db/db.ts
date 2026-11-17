import Dexie, { type Table } from 'dexie';
import {
  type School,
  type Product,
  type ProductVariant,
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
  type CustomerProfile,
  type CashDrawerEntry,
  type ShiftCloseRecord,
} from '../types';

export class CounterlyDB extends Dexie {
  schools!: Table<School, string>;
  products!: Table<Product, string>;
  variants!: Table<ProductVariant, string>;
  size_groups!: Table<SizeGroup, string>;
  sizes!: Table<SizeItem, string>;
  price_list!: Table<PriceEntry, string>;
  stocks!: Table<ProductStock, string>;
  bills!: Table<Bill, string>;
  inventory_movements!: Table<InventoryMovement, string>;
  shop_config!: Table<ShopConfig, string>;
  users!: Table<UserProfile, string>;
  students!: Table<StudentProfile, string>;
  customers!: Table<CustomerProfile, string>;
  advance_orders!: Table<AdvanceOrderJob, string>;
  customer_display_state!: Table<any, string>;
  categories!: Table<Category, string>;
  cash_drawer_entries!: Table<CashDrawerEntry, string>;
  shift_closes!: Table<ShiftCloseRecord, string>;

  constructor() {
    // Preserve IndexedDB database name for seamless continuity of existing user stores
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
    this.version(6).stores({
      schools: 'id, code, name, active',
      products: 'id, name, category, size_group_id',
      variants: 'id, product_id, sku, barcode, size_label, color_label',
      size_groups: 'id, name',
      sizes: 'id, size_group_id, sort_order',
      price_list: 'id, school_id, product_id, size_id, [school_id+product_id]',
      stocks: 'id, product_id, size_id, quantity',
      bills: 'id, bill_number, school_id, created_at, is_paid, status, customer_phone, billed_by_id',
      inventory_movements: 'id, product_id, variant_id, type, created_at',
      shop_config: 'id',
      users: 'id, pin, role, active',
      students: 'id, parent_phone, student_name, school_id',
      customers: 'id, phone, name, last_visit_at',
      advance_orders: 'id, token_number, customer_phone, status, created_at',
      customer_display_state: 'id',
      categories: 'id, name, sort_order',
    });
    this.version(7).stores({
      schools: 'id, code, name, active',
      products: 'id, name, category, size_group_id',
      variants: 'id, product_id, sku, barcode, size_label, color_label',
      size_groups: 'id, name',
      sizes: 'id, size_group_id, sort_order',
      price_list: 'id, school_id, product_id, size_id, [school_id+product_id]',
      stocks: 'id, product_id, size_id, quantity',
      bills: 'id, bill_number, school_id, created_at, is_paid, status, customer_phone, billed_by_id',
      inventory_movements: 'id, product_id, variant_id, type, created_at',
      shop_config: 'id',
      users: 'id, pin, role, active',
      students: 'id, parent_phone, student_name, school_id',
      customers: 'id, phone, name, last_visit_at',
      advance_orders: 'id, token_number, customer_phone, status, created_at',
      customer_display_state: 'id',
      categories: 'id, name, sort_order',
      cash_drawer_entries: 'id, type, created_at, staff_id',
      shift_closes: 'id, date, closed_at',
    });
  }
}

export let db = new CounterlyDB();

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'tops', name: 'Tops & Shirts', sort_order: 1 },
  { id: 'bottoms', name: 'Bottoms & Denim', sort_order: 2 },
  { id: 'footwear', name: 'Footwear', sort_order: 3 },
  { id: 'accessories', name: 'Accessories', sort_order: 4 },
];

export const CLEAN_DEFAULT_CONFIG: ShopConfig = {
  id: 'cfg_default',
  legal_name: 'SIKKADESK RETAIL',
  shop_tagline: 'Apparel, Footwear & Boutique',
  shop_address: '42 Commercial Street, Bengaluru',
  shop_phone: '+91 98450 12345',
  store_type: 'apparel',
  currency_code: 'INR',
  currency_symbol: '₹',
  locale: 'en-IN',
  tax_label: 'GST',
  gstin: '',
  gst_scheme: 'none',
  upi_id: '',
  printer_width: 48,
  auto_print_cash: true,
  auto_print_upi: true,
  sound_feedback: true,
  bill_prefix: 'INV-',
  bill_sequence: 1001,
  tax_type: 'none',
  tax_rate: 0,
  enabled_modules: {
    alterations: false,
    institutional_accounts: false,
  },
  terms_conditions: '7-day exchange with original receipt and tags intact.',
};

export const DEFAULT_STAFF_USERS: UserProfile[] = [
  {
    id: 'usr_admin',
    name: 'Store Admin',
    role: 'admin',
    pin: '123456',
    active: true,
    phone: '',
    created_at: new Date().toISOString(),
  },
  {
    id: 'usr_manager',
    name: 'Shift Lead',
    role: 'manager',
    pin: '222222',
    active: true,
    phone: '',
    created_at: new Date().toISOString(),
  },
  {
    id: 'usr_cashier',
    name: 'Counter Associate',
    role: 'cashier',
    pin: '111111',
    active: true,
    max_discount_percent: 10,
    max_discount_amount: 500,
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

export async function purgeLegacyMockData() {
  try {
    if (!db.isOpen()) {
      await db.open();
    }

    const schools = await db.schools.toArray();
    const demoSchools = schools.filter(s => LEGACY_MOCK_SCHOOL_IDS.includes(s.id));
    if (demoSchools.length > 0) {
      await db.schools.bulkDelete(demoSchools.map(s => s.id));
    }

    const products = await db.products.toArray();
    const demoProducts = products.filter(p => LEGACY_MOCK_PRODUCT_IDS.includes(p.id));
    if (demoProducts.length > 0) {
      await db.products.bulkDelete(demoProducts.map(p => p.id));
    }

    const sgs = await db.size_groups.toArray();
    const demoSgs = sgs.filter(sg => LEGACY_MOCK_SIZEGROUP_IDS.includes(sg.id));
    if (demoSgs.length > 0) {
      await db.size_groups.bulkDelete(demoSgs.map(sg => sg.id));
    }

    const sizes = await db.sizes.toArray();
    const demoSizes = sizes.filter(sz =>
      sz.id.startsWith('sz_s_') || sz.id.startsWith('sz_p_') ||
      sz.id.startsWith('sz_sk_') || sz.id.startsWith('sz_tu_') ||
      sz.id.startsWith('sz_sh_') || sz.id.startsWith('sz_b_')
    );
    if (demoSizes.length > 0) {
      await db.sizes.bulkDelete(demoSizes.map(sz => sz.id));
    }

    const bills = await db.bills.toArray();
    const demoBills = bills.filter(b => b.id.startsWith('bill_demo_'));
    if (demoBills.length > 0) {
      await db.bills.bulkDelete(demoBills.map(b => b.id));
    }

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
  } catch (err) {
    console.error('Error purging legacy mock data:', err);
  }
}

/**
 * Automatically bridges any existing legacy products/stocks into unified ProductVariant records.
 */
export async function migrateLegacyProductsToVariants() {
  try {
    const existingVariantsCount = await db.variants.count();
    if (existingVariantsCount > 0) return;

    const [products, stocks, prices] = await Promise.all([
      db.products.toArray(),
      db.stocks.toArray(),
      db.price_list.toArray(),
    ]);

    if (products.length === 0) return;

    const newVariants: ProductVariant[] = [];
    for (const prod of products) {
      const prodStocks = stocks.filter(st => st.product_id === prod.id);
      const skuBase = (prod.sku_prefix || prod.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) || 'ITEM').toUpperCase();

      if (prodStocks.length > 0) {
        prodStocks.forEach((st, idx) => {
          const matchingPrice = prices.find(
            pr => pr.product_id === prod.id && (pr.size_id === st.size_id || (!pr.size_id && !st.size_id))
          );
          const szClean = (st.size_label || 'STD').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
          const sku = `${skuBase}-${szClean}-${idx + 1}`;
          newVariants.push({
            id: `var_${prod.id}_${st.size_id || 'free'}`,
            product_id: prod.id,
            size_label: st.size_label || 'One Size',
            color_label: 'Standard',
            sku,
            barcode: `CNT${prod.id.slice(-4).toUpperCase()}${szClean}${idx + 1}`,
            price: matchingPrice ? matchingPrice.price : prod.base_price,
            stock_qty: st.quantity,
            low_stock_threshold: st.min_stock || prod.low_stock_threshold || 5,
          });
        });
      } else {
        newVariants.push({
          id: `var_${prod.id}_free`,
          product_id: prod.id,
          size_label: 'One Size',
          color_label: 'Standard',
          sku: `${skuBase}-OS`,
          barcode: `CNT${prod.id.slice(-6).toUpperCase()}`,
          price: prod.base_price,
          stock_qty: prod.stock || 0,
          low_stock_threshold: prod.low_stock_threshold || 5,
        });
      }
    }

    if (newVariants.length > 0) {
      await db.variants.bulkPut(newVariants);
    }
  } catch (err) {
    console.error('Variant migration error:', err);
  }
}

export async function seedStarterRetailCatalog() {
  const existingProducts = await db.products.count();
  if (existingProducts > 0) return;

  const starterProducts: Product[] = [
    {
      id: 'prod_tee_essential',
      name: 'Heavyweight Crew Tee',
      category: 'tops',
      brand: 'Studio Basics',
      sku_prefix: 'TEE',
      has_variants: true,
      size_group_id: null,
      base_price: 799,
      cost_price: 340,
      stock: 48,
      low_stock_threshold: 5,
      active: true,
    },
    {
      id: 'prod_denim_selvedge',
      name: 'Relaxed Tapered Denim',
      category: 'bottoms',
      brand: 'Northline',
      sku_prefix: 'DNM',
      has_variants: true,
      size_group_id: null,
      base_price: 1899,
      cost_price: 850,
      stock: 24,
      low_stock_threshold: 4,
      active: true,
    },
    {
      id: 'prod_sneaker_court',
      name: 'Low-Top Court Sneaker',
      category: 'footwear',
      brand: 'Atelier Walk',
      sku_prefix: 'SNK',
      has_variants: true,
      size_group_id: null,
      base_price: 2499,
      cost_price: 1150,
      stock: 18,
      low_stock_threshold: 3,
      active: true,
    },
    {
      id: 'prod_tote_canvas',
      name: 'Waxed Canvas Market Tote',
      category: 'accessories',
      brand: 'SikkaDesk Goods',
      sku_prefix: 'TOT',
      has_variants: false,
      size_group_id: null,
      base_price: 699,
      cost_price: 280,
      stock: 30,
      low_stock_threshold: 5,
      active: true,
    },
  ];

  const starterVariants: ProductVariant[] = [
    { id: 'var_tee_blk_s', product_id: 'prod_tee_essential', size_label: 'S', color_label: 'Obsidian', sku: 'TEE-OBS-S', barcode: '890100101', price: 799, cost_price: 340, stock_qty: 12, low_stock_threshold: 4 },
    { id: 'var_tee_blk_m', product_id: 'prod_tee_essential', size_label: 'M', color_label: 'Obsidian', sku: 'TEE-OBS-M', barcode: '890100102', price: 799, cost_price: 340, stock_qty: 14, low_stock_threshold: 4 },
    { id: 'var_tee_wht_m', product_id: 'prod_tee_essential', size_label: 'M', color_label: 'Chalk', sku: 'TEE-CHK-M', barcode: '890100103', price: 799, cost_price: 340, stock_qty: 10, low_stock_threshold: 4 },
    { id: 'var_tee_wht_l', product_id: 'prod_tee_essential', size_label: 'L', color_label: 'Chalk', sku: 'TEE-CHK-L', barcode: '890100104', price: 799, cost_price: 340, stock_qty: 12, low_stock_threshold: 4 },

    { id: 'var_dnm_ind_30', product_id: 'prod_denim_selvedge', size_label: '30', color_label: 'Indigo', sku: 'DNM-IND-30', barcode: '890100201', price: 1899, cost_price: 850, stock_qty: 8, low_stock_threshold: 3 },
    { id: 'var_dnm_ind_32', product_id: 'prod_denim_selvedge', size_label: '32', color_label: 'Indigo', sku: 'DNM-IND-32', barcode: '890100202', price: 1899, cost_price: 850, stock_qty: 9, low_stock_threshold: 3 },
    { id: 'var_dnm_blk_34', product_id: 'prod_denim_selvedge', size_label: '34', color_label: 'Washed Black', sku: 'DNM-BLK-34', barcode: '890100203', price: 1999, cost_price: 900, stock_qty: 7, low_stock_threshold: 3 },

    { id: 'var_snk_wht_8', product_id: 'prod_sneaker_court', size_label: 'UK 8', color_label: 'Chalk', sku: 'SNK-CHK-8', barcode: '890100301', price: 2499, cost_price: 1150, stock_qty: 6, low_stock_threshold: 2 },
    { id: 'var_snk_wht_9', product_id: 'prod_sneaker_court', size_label: 'UK 9', color_label: 'Chalk', sku: 'SNK-CHK-9', barcode: '890100302', price: 2499, cost_price: 1150, stock_qty: 7, low_stock_threshold: 2 },
    { id: 'var_snk_blk_10', product_id: 'prod_sneaker_court', size_label: 'UK 10', color_label: 'Onyx', sku: 'SNK-ONX-10', barcode: '890100303', price: 2499, cost_price: 1150, stock_qty: 5, low_stock_threshold: 2 },

    { id: 'var_tot_olv_os', product_id: 'prod_tote_canvas', size_label: 'One Size', color_label: 'Olive', sku: 'TOT-OLV-OS', barcode: '890100401', price: 699, cost_price: 280, stock_qty: 30, low_stock_threshold: 5 },
  ];

  await db.products.bulkPut(starterProducts);
  await db.variants.bulkPut(starterVariants);
}

export async function initializeDatabase() {
  if (!db.isOpen()) {
    await db.open();
  }

  await purgeLegacyMockData();

  const cfgCount = await db.shop_config.count();
  if (cfgCount === 0) {
    await db.shop_config.add(CLEAN_DEFAULT_CONFIG);
  } else {
    const existing = await db.shop_config.toArray();
    if (existing[0]) {
      const updates: Partial<ShopConfig> = {};
      const billCount = await db.bills.count();
      const isUntouchedLegacyDefault =
        existing[0].legal_name === 'COUNTERLY RETAIL' &&
        existing[0].currency_code === 'USD' &&
        existing[0].tax_label === 'Sales Tax' &&
        !existing[0].gstin &&
        billCount === 0;

      if (isUntouchedLegacyDefault) {
        updates.currency_code = 'INR';
        updates.currency_symbol = '₹';
        updates.locale = 'en-IN';
        updates.tax_label = 'GST';
        updates.tax_type = 'none';
        updates.tax_rate = 0;
        updates.gst_scheme = 'none';
        updates.shop_address = '42 Commercial Street, Bengaluru';
        updates.shop_phone = '+91 98450 12345';
      } else {
        if (!existing[0].currency_code) updates.currency_code = 'INR';
        if (!existing[0].currency_symbol) updates.currency_symbol = '₹';
        if (!existing[0].locale) updates.locale = 'en-IN';
      }

      if (!existing[0].enabled_modules) {
        updates.enabled_modules = {
          alterations: existing[0].store_type === 'boutique' || existing[0].store_type === 'uniform',
          institutional_accounts: existing[0].store_type === 'uniform',
        };
      }
      if (Object.keys(updates).length > 0) {
        await db.shop_config.update(existing[0].id, updates);
      }
    }
  }

  const userCount = await db.users.count();
  if (userCount === 0) {
    await db.users.bulkAdd(DEFAULT_STAFF_USERS);
  }

  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }

  await migrateLegacyProductsToVariants();
}

export const initDatabase = initializeDatabase;

export async function wipeAllLocalData() {
  try {
    if (!db.isOpen()) {
      await db.open();
    }

    await Promise.all([
      db.schools.clear().catch(() => {}),
      db.products.clear().catch(() => {}),
      db.variants.clear().catch(() => {}),
      db.sizes.clear().catch(() => {}),
      db.size_groups.clear().catch(() => {}),
      db.price_list.clear().catch(() => {}),
      db.stocks.clear().catch(() => {}),
      db.bills.clear().catch(() => {}),
      db.inventory_movements.clear().catch(() => {}),
      db.customers.clear().catch(() => {}),
      db.advance_orders.clear().catch(() => {}),
      db.categories.clear().catch(() => {}),
      db.cash_drawer_entries.clear().catch(() => {}),
      db.shift_closes.clear().catch(() => {}),
    ]);

    const configs = await db.shop_config.toArray();
    if (configs.length === 0) {
      await db.shop_config.add(CLEAN_DEFAULT_CONFIG);
    }

    const userCount = await db.users.count();
    if (userCount === 0) {
      await db.users.bulkAdd(DEFAULT_STAFF_USERS);
    }

    const catCount = await db.categories.count();
    if (catCount === 0) {
      await db.categories.bulkAdd(DEFAULT_CATEGORIES);
    }

    try {
      localStorage.removeItem('counterly_parked_bills');
      localStorage.removeItem('nandalaya_parked_bills');
      localStorage.removeItem('counterly_sandbox_mode');
      localStorage.removeItem('counterly_sandbox_checklist_dismissed');
    } catch {
      // ignore
    }
    return true;
  } catch (err) {
    console.error('Wipe data failed:', err);
    return false;
  }
}

export async function launchInteractiveSandbox() {
  await initializeDatabase();
  const billCount = await db.bills.count();
  const prodCount = await db.products.count();

  if (prodCount === 0) {
    await seedStarterRetailCatalog();
  }

  if (billCount === 0) {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const todayIso = new Date(now - 90 * 60 * 1000).toISOString();
    const todayEarlierIso = new Date(now - 210 * 60 * 1000).toISOString();
    const yesterdayIso = new Date(now - dayMs - 120 * 60 * 1000).toISOString();
    const twoDaysIso = new Date(now - 2 * dayMs - 180 * 60 * 1000).toISOString();

    const sampleCustomers: CustomerProfile[] = [
      {
        id: 'cust_sb_1',
        name: 'Ananya Sharma',
        phone: '+91 98450 11223',
        email: 'ananya.s@example.in',
        fit_notes: 'Prefers Relaxed Fit M tees & 32 waist',
        store_credit_balance: 500,
        credit_transactions: [
          {
            id: 'cred_sb_1',
            amount: 500,
            type: 'issue',
            note: 'Boutique Loyalty Return Credit',
            created_at: yesterdayIso,
          },
        ],
        last_visit_at: todayEarlierIso,
      },
      {
        id: 'cust_sb_2',
        name: 'Rohan Mehta',
        phone: '+91 98201 44556',
        fit_notes: 'UK 9 Court Sneaker',
        store_credit_balance: 0,
        last_visit_at: todayIso,
      },
      {
        id: 'cust_sb_3',
        name: 'Priya Nair',
        phone: '+91 98111 77889',
        store_credit_balance: 0,
        last_visit_at: twoDaysIso,
      },
    ];

    const sampleBills: Bill[] = [
      {
        id: 'bill_sb_1001',
        bill_number: 'INV-1001',
        created_at: twoDaysIso,
        currency_code: 'INR',
        customer_name: 'Priya Nair',
        customer_phone: '+91 98111 77889',
        bill_type: 'retail',
        school_id: 'retail_counter',
        school_name: 'Walk-in Retail',
        subtotal: 2698,
        discount_amount: 0,
        discount_type: 'flat',
        tax_amount: 0,
        tax_label: 'GST',
        total: 2698,
        payment_method: 'upi',
        payment_details: { upi: 2698 },
        is_paid: true,
        paid_at: twoDaysIso,
        status: 'completed',
        billed_by_id: 'usr_admin',
        billed_by_name: 'Store Admin',
        items: [
          {
            id: 'bi_sb_1',
            product_id: 'prod_tee_essential',
            product_name: 'Heavyweight Crew Tee',
            variant_id: 'var_tee_blk_m',
            size_id: 'var_tee_blk_m',
            size_label: 'M',
            color_label: 'Obsidian',
            sku: 'TEE-OBS-M',
            qty: 1,
            unit_price: 799,
            unit_cost: 340,
            tax_rate: 0,
            tax_amount: 0,
            discount_amount: 0,
            subtotal: 799,
          },
          {
            id: 'bi_sb_2',
            product_id: 'prod_denim_selvedge',
            product_name: 'Relaxed Tapered Denim',
            variant_id: 'var_dnm_ind_32',
            size_id: 'var_dnm_ind_32',
            size_label: '32',
            color_label: 'Indigo',
            sku: 'DNM-IND-32',
            qty: 1,
            unit_price: 1899,
            unit_cost: 850,
            tax_rate: 0,
            tax_amount: 0,
            discount_amount: 0,
            subtotal: 1899,
          },
        ],
      },
      {
        id: 'bill_sb_1002',
        bill_number: 'INV-1002',
        created_at: yesterdayIso,
        currency_code: 'INR',
        customer_name: 'Ananya Sharma',
        customer_phone: '+91 98450 11223',
        bill_type: 'retail',
        school_id: 'retail_counter',
        school_name: 'Walk-in Retail',
        subtotal: 2499,
        discount_amount: 200,
        discount_type: 'flat',
        tax_amount: 0,
        tax_label: 'GST',
        total: 2299,
        payment_method: 'cash',
        payment_details: { cash: 2299 },
        is_paid: true,
        paid_at: yesterdayIso,
        status: 'completed',
        billed_by_id: 'usr_cashier',
        billed_by_name: 'Counter Associate',
        items: [
          {
            id: 'bi_sb_3',
            product_id: 'prod_sneaker_court',
            product_name: 'Low-Top Court Sneaker',
            variant_id: 'var_snk_wht_9',
            size_id: 'var_snk_wht_9',
            size_label: 'UK 9',
            color_label: 'Chalk',
            sku: 'SNK-CHK-9',
            qty: 1,
            unit_price: 2499,
            unit_cost: 1150,
            tax_rate: 0,
            tax_amount: 0,
            discount_amount: 0,
            subtotal: 2499,
          },
        ],
      },
      {
        id: 'bill_sb_1003',
        bill_number: 'INV-1003',
        created_at: todayEarlierIso,
        currency_code: 'INR',
        customer_name: 'Rohan Mehta',
        customer_phone: '+91 98201 44556',
        bill_type: 'retail',
        school_id: 'retail_counter',
        school_name: 'Walk-in Retail',
        subtotal: 1498,
        discount_amount: 0,
        discount_type: 'flat',
        tax_amount: 0,
        tax_label: 'GST',
        total: 1498,
        payment_method: 'cash',
        payment_details: { cash: 1498 },
        is_paid: true,
        paid_at: todayEarlierIso,
        status: 'completed',
        billed_by_id: 'usr_admin',
        billed_by_name: 'Store Admin',
        items: [
          {
            id: 'bi_sb_4',
            product_id: 'prod_tee_essential',
            product_name: 'Heavyweight Crew Tee',
            variant_id: 'var_tee_wht_l',
            size_id: 'var_tee_wht_l',
            size_label: 'L',
            color_label: 'Chalk',
            sku: 'TEE-CHK-L',
            qty: 1,
            unit_price: 799,
            unit_cost: 340,
            tax_rate: 0,
            tax_amount: 0,
            discount_amount: 0,
            subtotal: 799,
          },
          {
            id: 'bi_sb_5',
            product_id: 'prod_tote_canvas',
            product_name: 'Waxed Canvas Market Tote',
            variant_id: 'var_tot_olv_os',
            size_id: 'var_tot_olv_os',
            size_label: 'One Size',
            color_label: 'Olive',
            sku: 'TOT-OLV-OS',
            qty: 1,
            unit_price: 699,
            unit_cost: 280,
            tax_rate: 0,
            tax_amount: 0,
            discount_amount: 0,
            subtotal: 699,
          },
        ],
      },
      {
        id: 'bill_sb_1004',
        bill_number: 'INV-1004',
        created_at: todayIso,
        currency_code: 'INR',
        customer_name: 'Walk-in Retail',
        customer_phone: '',
        bill_type: 'retail',
        school_id: 'retail_counter',
        school_name: 'Walk-in Retail',
        subtotal: 1999,
        discount_amount: 0,
        discount_type: 'flat',
        tax_amount: 0,
        tax_label: 'GST',
        total: 1999,
        payment_method: 'upi',
        payment_details: { upi: 1999 },
        is_paid: true,
        paid_at: todayIso,
        status: 'completed',
        billed_by_id: 'usr_cashier',
        billed_by_name: 'Counter Associate',
        items: [
          {
            id: 'bi_sb_6',
            product_id: 'prod_denim_selvedge',
            product_name: 'Relaxed Tapered Denim',
            variant_id: 'var_dnm_blk_34',
            size_id: 'var_dnm_blk_34',
            size_label: '34',
            color_label: 'Washed Black',
            sku: 'DNM-BLK-34',
            qty: 1,
            unit_price: 1999,
            unit_cost: 900,
            tax_rate: 0,
            tax_amount: 0,
            discount_amount: 0,
            subtotal: 1999,
          },
        ],
      },
    ];

    const sampleDrawerEntries: CashDrawerEntry[] = [
      {
        id: 'cd_sb_1',
        type: 'float_in',
        amount: 5000,
        reason: 'Morning register drawer float',
        staff_id: 'usr_admin',
        staff_name: 'Store Admin',
        created_at: todayEarlierIso,
      },
    ];

    await db.customers.bulkPut(sampleCustomers);
    await db.bills.bulkPut(sampleBills);
    await db.cash_drawer_entries.bulkPut(sampleDrawerEntries);

    const cfgs = await db.shop_config.toArray();
    if (cfgs[0] && (cfgs[0].bill_sequence || 1001) <= 1004) {
      await db.shop_config.update(cfgs[0].id, { bill_sequence: 1005 });
    }
  }

  localStorage.setItem('counterly_sandbox_mode', 'true');
  localStorage.setItem('counterly_onboarding_completed', 'true');
  localStorage.removeItem('counterly_sandbox_checklist_dismissed');
}

export async function exitSandboxToLiveStore() {
  await wipeAllLocalData();
  localStorage.removeItem('counterly_sandbox_mode');
  localStorage.removeItem('counterly_sandbox_checklist_dismissed');
}

export async function hardResetEntireApp() {
  try {
    await db.delete();
    localStorage.clear();
    db = new CounterlyDB();
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
