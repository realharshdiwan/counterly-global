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
    tagline: 'Store Operations & Cloud Backup',
    description: 'Full store setup, team accounts, printer hardware, database sync & backup',
    badgeClass: 'bg-[#F5F5F7] text-[#1D1D1F] border-[#E5E5E7]',
    dotClass: 'bg-[#1D1D1F]',
  },
  manager: {
    key: 'manager',
    label: 'Shift Lead',
    shortLabel: 'Shift Lead',
    tagline: 'Catalog, Stock & Approvals',
    description: 'School rate books, stock adjustments, register reviews & discount approvals',
    badgeClass: 'bg-[#F5F5F7] text-[#1D1D1F] border-[#E5E5E7]',
    dotClass: 'bg-[#515154]',
  },
  cashier: {
    key: 'cashier',
    label: 'Counter Associate',
    shortLabel: 'Associate',
    tagline: 'Counter Billing & Checkout',
    description: 'Fast billing, student search, exchanges, thermal printing & counter checkout',
    badgeClass: 'bg-[#F5F5F7] text-[#1D1D1F] border-[#E5E5E7]',
    dotClass: 'bg-[#86868B]',
  },
};

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  pin: string; // 6-digit PIN
  phone?: string;
  avatar_url?: string; // Profile picture URL or base64 Data URL
  active: boolean;
  max_discount_percent?: number; // max % discount cashier can give without manager PIN
  max_discount_amount?: number; // max flat ₹ discount cashier can give without manager PIN
  created_at: string;
}

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'credit' | 'split';

export interface SplitPayment {
  cash: number;
  upi: number;
  card: number;
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
  multiplier?: number; // base multiplier e.g. 1.0, 1.15
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
  size_group_id: string | null; // null if free-size like tie, belt, bag
  base_price: number;
  stock: number; // aggregate stock or default
  low_stock_threshold: number;
  hsn?: string;
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
  id: string; // `${product_id}_${size_id || 'free'}`
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
  size_id: string | null;
  size_label: string | null;
  school_id?: string;
  school_code?: string;
  school_name?: string;
  hsn?: string;
  qty: number;
  unit_price: number;
  discount_amount: number;
  subtotal: number;
}

export interface Bill {
  id: string;
  bill_number: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
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
  total: number;
  payment_method: PaymentMethod;
  payment_details: Partial<SplitPayment>;
  notes?: string;
  is_paid: boolean;
  paid_at?: string | null;
  status: 'completed' | 'voided';
  voided_at?: string | null;
  void_reason?: string;
  billed_by_id?: string;
  billed_by_name?: string;
  items: BillItem[];
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  product_name: string;
  size_label: string;
  type: 'purchase' | 'adjustment' | 'return' | 'sale';
  qty: number; // positive for addition, negative for reduction
  previous_stock: number;
  new_stock: number;
  notes?: string;
  created_at: string;
  reference_bill_id?: string;
}

export type GstSchemeType = 'composition' | 'regular' | 'none';

export type StoreBusinessType = 'apparel' | 'boutique' | 'footwear' | 'uniform' | 'general';

export interface ShopConfig {
  id: string;
  legal_name: string;
  shop_tagline: string;
  shop_address: string;
  shop_phone: string;
  store_type?: StoreBusinessType;
  gstin: string;
  gst_scheme?: GstSchemeType;
  upi_id: string;
  printer_width: 32 | 48; // 32 = 58mm, 48 = 80mm
  auto_print_cash: boolean;
  auto_print_upi: boolean;
  sound_feedback: boolean;
  bill_prefix: string;
  bill_sequence: number;
  tax_type: 'none' | 'inclusive' | 'exclusive';
  tax_rate: number;
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  terms_conditions?: string;
  state_name?: string;
  state_code?: string;
}

export interface CartItem {
  product_id: string;
  product_name: string;
  size_id: string | null;
  size_label: string | null;
  school_id: string;
  school_code: string;
  school_name: string;
  unit_price: number;
  qty: number;
  available_stock: number;
}

export interface StudentProfile {
  id: string;
  parent_phone: string;
  parent_name?: string;
  student_name: string;
  school_id: string;
  school_name: string;
  grade?: string; // e.g. "Grade 6-B"
  house_color?: string; // e.g. "Red House", "Blue House", "Green House", "Yellow House"
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
  alteration_notes?: string; // e.g. "Hem pant length by 1.5 inches", "Embroider name 'Aarav'"
}

export interface AdvanceOrderJob {
  id: string;
  token_number: string; // e.g. "ALT-1042"
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
  machine_id: string; // Hardware signature or 'UNIV' for wildcard
  tier: LicenseTier;
  issued_at: string;
  expires_at: string; // 'PERPETUAL' or ISO string
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

