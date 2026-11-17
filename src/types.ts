export type UserRole = 'admin' | 'manager' | 'cashier';

export interface RoleMeta {
  key: UserRole;
  label: string;
  shortLabel: string;
  tagline: string;
  description: string;
  badgeClass: string;
  dotClass: string;
}

export const ROLE_INFO: Record<UserRole, RoleMeta> = {
  admin: {
    key: 'admin',
    label: 'Store Admin',
    shortLabel: 'Admin',
    tagline: 'Store Operations & Hardware',
    description: 'Full store setup, team PINs, printer hardware, modules, license & backups',
    badgeClass: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700',
    dotClass: 'bg-zinc-900 dark:bg-zinc-100',
  },
  manager: {
    key: 'manager',
    label: 'Shift Lead',
    shortLabel: 'Shift Lead',
    tagline: 'Catalog, Stock & Approvals',
    description: 'Product catalog, variant pricing, stock adjustments, day-close & discount approvals',
    badgeClass: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700',
    dotClass: 'bg-zinc-600 dark:bg-zinc-400',
  },
  cashier: {
    key: 'cashier',
    label: 'Counter Associate',
    shortLabel: 'Associate',
    tagline: 'Counter Billing & Checkout',
    description: 'Fast barcode checkout, customer lookup, exchanges, receipts & drawer tally',
    badgeClass: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700',
    dotClass: 'bg-zinc-400 dark:bg-zinc-500',
  },
};

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  pin: string; // 6-digit PIN
  phone?: string;
  avatar_url?: string;
  active: boolean;
  max_discount_percent?: number;
  max_discount_amount?: number;
  created_at: string;
}

export type PaymentMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'credit' | 'split';

export interface SplitPayment {
  cash: number;
  card: number;
  upi: number;
  wallet?: number;
  credit: number;
}

export interface School {
  id: string;
  code: string;
  name: string;
  school_group_id?: string;
  active: boolean;
  phone?: string;
  address?: string;
  notes?: string;
  multiplier?: number;
}

export interface Category {
  id: string;
  name: string;
  sort_order?: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  brand?: string;
  sku_prefix?: string;
  has_variants?: boolean;
  size_group_id: string | null;
  base_price: number;
  cost_price?: number;
  tax_rate?: number;
  stock: number;
  low_stock_threshold: number;
  hsn?: string;
  active?: boolean;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size_label: string;
  color_label: string;
  sku: string;
  barcode: string;
  price: number;
  cost_price?: number;
  tax_rate?: number;
  stock_qty: number;
  low_stock_threshold: number;
}

export interface SizeGroup {
  id: string;
  name: string;
}

export interface SizeItem {
  id: string;
  size_group_id: string;
  label: string;
  sort_order: number;
}

export interface PriceEntry {
  id: string;
  school_id: string;
  product_id: string;
  size_id?: string | null;
  price: number;
}

export interface ProductStock {
  id: string;
  product_id: string;
  size_id: string | null;
  size_label: string;
  quantity: number;
  min_stock: number;
}

export interface BillItem {
  id: string;
  product_id: string;
  product_name: string;
  variant_id?: string;
  size_id: string | null;
  size_label: string | null;
  color_label?: string | null;
  sku?: string;
  barcode?: string;
  school_id?: string;
  school_code?: string;
  school_name?: string;
  hsn?: string;
  qty: number;
  unit_price: number;
  unit_cost?: number;
  tax_rate?: number;
  tax_amount?: number;
  discount_amount: number;
  subtotal: number;
}

export interface BillReturnItem {
  bill_item_id: string;
  product_id: string;
  variant_id?: string;
  product_name: string;
  size_label?: string | null;
  color_label?: string | null;
  qty: number;
  unit_price: number;
  refund_amount: number;
}

export interface BillReturnRecord {
  id: string;
  return_number: string;
  created_at: string;
  items: BillReturnItem[];
  refund_amount: number;
  refund_method: 'cash' | 'card' | 'store_credit';
  reason?: string;
  processed_by?: string;
}

export interface Bill {
  id: string;
  bill_number: string;
  created_at: string;
  currency_code?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_gstin?: string;
  customer_address?: string;
  po_number?: string;
  bill_type?: 'retail' | 'b2b';
  school_id: string;
  school_name: string;
  schools?: string[];
  subtotal: number;
  discount_amount: number;
  discount_type: 'flat' | 'percent';
  tax_amount?: number;
  tax_label?: string;
  total: number;
  payment_method: PaymentMethod;
  payment_details: Partial<SplitPayment>;
  store_credit_used?: number;
  refunded_amount?: number;
  return_records?: BillReturnRecord[];
  notes?: string;
  is_paid: boolean;
  paid_at?: string | null;
  status: 'completed' | 'voided' | 'exchanged';
  voided_at?: string | null;
  void_reason?: string;
  billed_by_id?: string;
  billed_by_name?: string;
  items: BillItem[];
}

export interface CashDrawerEntry {
  id: string;
  type: 'float_in' | 'safe_drop' | 'paid_out';
  amount: number;
  reason: string;
  staff_id?: string;
  staff_name?: string;
  created_at: string;
}

export interface ShiftCloseRecord {
  id: string;
  date: string;
  closed_at: string;
  closed_by: string;
  bills_count: number;
  gross_sales: number;
  refunds_total: number;
  store_credit_used: number;
  net_sales: number;
  cash_sales: number;
  card_sales: number;
  digital_sales: number;
  credit_sales: number;
  float_in_total: number;
  safe_drop_total: number;
  paid_out_total: number;
  cash_refunds: number;
  opening_float: number;
  expected_cash: number;
  counted_cash: number;
  variance: number;
  notes?: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  variant_id?: string;
  product_name: string;
  size_label: string;
  type: 'purchase' | 'adjustment' | 'return' | 'sale';
  qty: number;
  previous_stock: number;
  new_stock: number;
  notes?: string;
  created_at: string;
  reference_bill_id?: string;
}

export type GstSchemeType = 'composition' | 'regular' | 'none';
export type TaxLabel = 'Sales Tax' | 'VAT' | 'GST' | 'Tax';

export type StoreBusinessType = 'apparel' | 'boutique' | 'footwear' | 'uniform' | 'general';

export interface StoreModules {
  alterations: boolean;
  institutional_accounts: boolean;
}

export interface ShopConfig {
  id: string;
  legal_name: string;
  shop_tagline: string;
  shop_address: string;
  shop_phone: string;
  store_type?: StoreBusinessType;
  currency_code?: string;
  currency_symbol?: string;
  locale?: string;
  tax_label?: TaxLabel;
  gstin: string;
  gst_scheme?: GstSchemeType;
  upi_id: string;
  printer_width: 32 | 48;
  auto_print_cash: boolean;
  auto_print_upi: boolean;
  sound_feedback: boolean;
  bill_prefix: string;
  bill_sequence: number;
  tax_type: 'none' | 'inclusive' | 'exclusive';
  tax_rate: number;
  enabled_modules?: StoreModules;
  checkout_payment_url?: string;
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  terms_conditions?: string;
  state_name?: string;
  state_code?: string;
}

export interface CartItem {
  variant_id?: string;
  product_id: string;
  product_name: string;
  size_id: string | null;
  size_label: string | null;
  color_label?: string | null;
  sku?: string;
  barcode?: string;
  school_id: string;
  school_code: string;
  school_name: string;
  unit_price: number;
  unit_cost?: number;
  tax_rate?: number;
  qty: number;
  available_stock: number;
}

export interface CustomerCreditEntry {
  id: string;
  amount: number;
  type: 'issue' | 'redeem' | 'refund';
  note: string;
  created_at: string;
  bill_number?: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  fit_notes?: string;
  store_credit_balance?: number;
  credit_transactions?: CustomerCreditEntry[];
  last_visit_at: string;
}

export interface VendorLicenseRecord {
  key: string;
  buyerName: string;
  buyerEmail?: string;
  tier: LicenseTier;
  expiresAt: string;
  machineId: string;
  createdAt: string;
  revoked: boolean;
  revokedAt?: string;
  notes?: string;
}

export interface StudentProfile {
  id: string;
  parent_phone: string;
  parent_name?: string;
  student_name: string;
  school_id: string;
  school_name: string;
  grade?: string;
  house_color?: string;
  gender?: 'boy' | 'girl' | 'unisex';
  past_sizes: {
    [product_name: string]: {
      size: string;
      date: string;
      school_code?: string;
    };
  };
  notes?: string;
  updated_at: string;
}

export type AdvanceOrderStatus = 'received' | 'in_progress' | 'ready_for_pickup' | 'delivered' | 'cancelled';

export interface AdvanceOrderItem {
  id: string;
  product_name: string;
  size_label: string;
  qty: number;
  estimated_price: number;
  alteration_notes?: string;
}

export interface AdvanceOrderJob {
  id: string;
  token_number: string;
  order_type: 'alteration' | 'advance_booking' | 'custom_tailoring';
  customer_name: string;
  customer_phone: string;
  student_name?: string;
  school_id?: string;
  school_name?: string;
  items: AdvanceOrderItem[];
  total_amount: number;
  advance_paid: number;
  balance_due: number;
  advance_payment_method: PaymentMethod;
  status: AdvanceOrderStatus;
  expected_delivery_date: string;
  created_at: string;
  ready_at?: string | null;
  delivered_at?: string | null;
  notes?: string;
}

export interface ParkedBill {
  id: string;
  parked_at: string;
  cart: CartItem[];
  school_id: string | null;
  school_code: string | null;
  school_name: string | null;
  customer_name: string;
  customer_phone: string;
  discount_val: string;
  discount_type: 'flat' | 'percent';
  notes: string;
  total: number;
}

export type LicenseTier = 'starter' | 'pro' | 'enterprise' | 'lifetime';

export type LicenseStatus =
  | 'trial_active'
  | 'trial_expiring'
  | 'trial_expired'
  | 'licensed_active'
  | 'license_expiring'
  | 'license_expired'
  | 'clock_tampered'
  | 'machine_mismatch';

export interface LicenseFeatures {
  multi_school: boolean;
  barcode_labels: boolean;
  advance_alterations: boolean;
  gst_reports: boolean;
  cloud_sync: boolean;
  customer_display: boolean;
  unlimited_bills: boolean;
}

export interface LicenseRecord {
  license_key: string;
  store_name: string;
  machine_id: string;
  tier: LicenseTier;
  issued_at: string;
  expires_at: string;
  max_counters: number;
  features: LicenseFeatures;
  signature: string;
  activated_at: string;
}

export interface LicenseState {
  isValid: boolean;
  isTrial: boolean;
  status: LicenseStatus;
  daysRemaining: number;
  tier: LicenseTier;
  storeName: string;
  machineId: string;
  expiresAt: string;
  licenseKey: string | null;
  features: LicenseFeatures;
  warningMessage: string | null;
  activatedAt?: string;
  firstInstalledAt?: string;
}
