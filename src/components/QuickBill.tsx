import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  PauseCircle,
  Play,
  RotateCcw,
  Barcode,
  Scissors,
  User,
  Banknote,
  CreditCard,
  QrCode,
  ArrowRightLeft,
  Check,
  Maximize2,
  Building2,
  Layers,
  ReceiptText,
} from 'lucide-react';
import { db } from '../db/db';
import {
  type Product,
  type ProductVariant,
  type Category,
  type CartItem,
  type PaymentMethod,
  type ShopConfig,
  type Bill,
  type ParkedBill,
  type CustomerProfile,
  type CustomerCreditEntry,
  type School,
} from '../types';
import {
  formatMoney,
  getCurrencyCode,
  getCurrencySymbol,
  getPaymentMethodLabel,
  getTaxSummaryLabel,
} from '../lib/locale';
import { bluetoothPrinter, generateEscPosReceipt, playBeep } from '../lib/printer';
import { getOrCreateMachineFingerprint } from '../lib/licensing';
import { useAuth } from '../context/AuthContext';
import { AddProductModal } from './AddProductModal';
import { ExchangeReturnModal } from './ExchangeReturnModal';
import { AdvanceAlterationModal } from './AdvanceAlterationModal';
import { ManagerOverrideModal } from './ManagerOverrideModal';
import { type CustomerDisplayPayload } from './CustomerDisplayView';

interface QuickBillProps {
  onBillCreated: (bill: Bill) => void;
  onOpenReceipt: (bill: Bill) => void;
  preselectedCustomer?: CustomerProfile | null;
  onClearPreselectedCustomer?: () => void;
}

function roundMoney(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export const QuickBill: React.FC<QuickBillProps> = ({
  onBillCreated,
  onOpenReceipt,
  preselectedCustomer,
  onClearPreselectedCustomer,
}) => {
  const { currentUser } = useAuth();
  const terminalId = useMemo(() => getOrCreateMachineFingerprint(), []);

  // Catalog & Store State
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [schools, setSchools] = useState<School[]>([]);

  // Active Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('retail_counter');

  // Variant Picker Modal
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);

  // Cart & Tender State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [useStoreCredit, setUseStoreCredit] = useState(false);
  const [notes, setNotes] = useState('');

  const [discountVal, setDiscountVal] = useState('');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountOverrideApproved, setDiscountOverrideApproved] = useState(false);
  const [isDiscountOverrideOpen, setIsDiscountOverrideOpen] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [splitAmounts, setSplitAmounts] = useState({ cash: '', card: '', upi: '', credit: '' });

  // Parked Carts
  const [parkedBills, setParkedBills] = useState<ParkedBill[]>(() => {
    try {
      const saved =
        localStorage.getItem('counterly_parked_bills') ||
        localStorage.getItem('nandalaya_parked_bills');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isParkedModalOpen, setIsParkedModalOpen] = useState(false);

  // Custom Miscellaneous Item Modal
  const [isCustomItemOpen, setIsCustomItemOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');

  // Sub-modals
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
  const [isAlterationModalOpen, setIsAlterationModalOpen] = useState(false);
  const [showStandeeQrModal, setShowStandeeQrModal] = useState(false);
  const [upiQrUrl, setUpiQrUrl] = useState('');

  // UI Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const displayChannelRef = useRef<BroadcastChannel | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(prev => (prev === msg ? null : prev)), 2600);
  }, []);

  const loadRegisterData = useCallback(async () => {
    try {
      const [cfgList, prodList, varList, catList, custList, schList] = await Promise.all([
        db.shop_config.toArray(),
        db.products.toArray(),
        db.variants.toArray(),
        db.categories.toArray(),
        db.customers.toArray(),
        db.schools.toArray(),
      ]);

      if (cfgList.length > 0) setShopConfig(cfgList[0]);
      setProducts(prodList.filter(p => p.active !== false));
      setVariants(varList);
      setCategories(catList.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      setCustomers(custList);
      setSchools(schList.filter(s => s.active !== false));
    } catch (err) {
      console.error('Failed to load register data:', err);
    }
  }, []);

  useEffect(() => {
    loadRegisterData();
  }, [loadRegisterData]);

  useEffect(() => {
    try {
      localStorage.setItem('counterly_parked_bills', JSON.stringify(parkedBills));
    } catch {
      // ignore storage errors
    }
  }, [parkedBills]);

  // Preselect customer when routed from Customers & Credit CRM
  useEffect(() => {
    if (preselectedCustomer) {
      setCustomerName(preselectedCustomer.name || '');
      setCustomerPhone(
        preselectedCustomer.phone && preselectedCustomer.phone !== 'N/A'
          ? preselectedCustomer.phone
          : ''
      );
      setUseStoreCredit(false);
      onClearPreselectedCustomer?.();
    }
  }, [preselectedCustomer, onClearPreselectedCustomer]);

  // Customer auto-lookup by phone
  useEffect(() => {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length >= 6) {
      const match =
        customers.find(c => c.phone.replace(/\D/g, '') === cleanPhone) ||
        customers.find(c => c.phone.replace(/\D/g, '').includes(cleanPhone));
      if (match && !customerName) {
        setCustomerName(match.name);
      }
    }
  }, [customerPhone, customers, customerName]);

  const matchedCustomer = useMemo(() => {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length >= 6) {
      return (
        customers.find(c => c.phone.replace(/\D/g, '') === cleanPhone) ||
        customers.find(c => c.phone.replace(/\D/g, '').includes(cleanPhone)) ||
        null
      );
    }
    const cleanName = customerName.trim().toLowerCase();
    if (cleanName.length >= 2) {
      return customers.find(c => c.name.trim().toLowerCase() === cleanName) || null;
    }
    return null;
  }, [customerPhone, customerName, customers]);

  useEffect(() => {
    if (!matchedCustomer || (matchedCustomer.store_credit_balance || 0) <= 0) {
      setUseStoreCredit(false);
    }
  }, [matchedCustomer]);

  // Keyboard shortcuts: F1 Search/Scanner, F9 Checkout
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && !isSubmitting) {
          handleCheckout();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Derived Totals
  const subtotal = useMemo(
    () => roundMoney(cart.reduce((sum, item) => sum + item.unit_price * item.qty, 0)),
    [cart]
  );

  const rawDiscountNum = parseFloat(discountVal) || 0;
  const discountAmount = useMemo(() => {
    if (rawDiscountNum <= 0 || subtotal <= 0) return 0;
    if (discountType === 'percent') {
      return roundMoney(Math.min(subtotal, (subtotal * Math.min(100, rawDiscountNum)) / 100));
    }
    return roundMoney(Math.min(subtotal, rawDiscountNum));
  }, [rawDiscountNum, discountType, subtotal]);

  const discountedSubtotal = roundMoney(Math.max(0, subtotal - discountAmount));

  const { taxAmount, grandTotal, lineTaxes } = useMemo(() => {
    const taxType = shopConfig?.tax_type || 'none';
    const defaultRate = Number(shopConfig?.tax_rate || 0);
    if (taxType === 'none' || discountedSubtotal <= 0 || cart.length === 0) {
      return { taxAmount: 0, grandTotal: discountedSubtotal, lineTaxes: cart.map(() => 0) };
    }
    const discountRatio = subtotal > 0 ? discountedSubtotal / subtotal : 1;
    let totalTaxSum = 0;
    const computedLines = cart.map(item => {
      const rate = typeof item.tax_rate === 'number' ? item.tax_rate : defaultRate;
      if (rate <= 0) return 0;
      const netLine = item.unit_price * item.qty * discountRatio;
      const lineTax =
        taxType === 'exclusive'
          ? roundMoney((netLine * rate) / 100)
          : roundMoney(netLine - netLine / (1 + rate / 100));
      totalTaxSum = roundMoney(totalTaxSum + lineTax);
      return lineTax;
    });
    return {
      taxAmount: totalTaxSum,
      grandTotal: taxType === 'exclusive' ? roundMoney(discountedSubtotal + totalTaxSum) : discountedSubtotal,
      lineTaxes: computedLines,
    };
  }, [cart, subtotal, discountedSubtotal, shopConfig]);

  // Check if cashier discount limit is exceeded
  const discountExceedsCashierLimit = useMemo(() => {
    if (!currentUser || currentUser.role !== 'cashier' || discountAmount <= 0 || discountOverrideApproved) {
      return false;
    }
    const maxPct = currentUser.max_discount_percent ?? 10;
    const maxAmt = currentUser.max_discount_amount ?? 25;
    const effectivePct = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
    return effectivePct > maxPct || discountAmount > maxAmt;
  }, [currentUser, discountAmount, subtotal, discountOverrideApproved]);

  // Reset override approval if discount drops to 0
  useEffect(() => {
    if (discountAmount === 0 && discountOverrideApproved) {
      setDiscountOverrideApproved(false);
    }
  }, [discountAmount, discountOverrideApproved]);

  const availableStoreCredit = matchedCustomer?.store_credit_balance || 0;
  const appliedStoreCredit = useMemo(() => {
    if (!useStoreCredit || availableStoreCredit <= 0 || grandTotal <= 0) return 0;
    return roundMoney(Math.min(grandTotal, availableStoreCredit));
  }, [useStoreCredit, availableStoreCredit, grandTotal]);

  const netPayable = roundMoney(Math.max(0, grandTotal - appliedStoreCredit));

  // UPI QR Generation when Digital/UPI active
  const digitalChargeAmount = useMemo(() => {
    if (paymentMethod === 'upi') return netPayable;
    if (paymentMethod === 'split') return parseFloat(splitAmounts.upi) || 0;
    return 0;
  }, [paymentMethod, netPayable, splitAmounts.upi]);

  useEffect(() => {
    if (digitalChargeAmount > 0 && shopConfig?.upi_id) {
      const upiUri = `upi://pay?pa=${encodeURIComponent(shopConfig.upi_id)}&pn=${encodeURIComponent(
        shopConfig.legal_name || 'SIKKADESK RETAIL'
      )}&am=${digitalChargeAmount}&cu=${getCurrencyCode(shopConfig)}`;
      QRCode.toDataURL(upiUri, { width: 220, margin: 1 })
        .then(setUpiQrUrl)
        .catch(() => setUpiQrUrl(''));
    } else {
      setUpiQrUrl('');
    }
  }, [digitalChargeAmount, shopConfig]);

  // Sync Customer Display
  const pushDisplayState = useCallback(
    async (statusOverride?: 'idle' | 'active' | 'completed', lastBillNumber?: string) => {
      const payload: CustomerDisplayPayload & { timestamp: number; id: string } = {
        id: terminalId,
        terminalId,
        shopName: shopConfig?.legal_name || 'SIKKADESK RETAIL',
        currencySymbol: getCurrencySymbol(shopConfig),
        currencyCode: getCurrencyCode(shopConfig),
        locale: shopConfig?.locale || 'en-IN',
        upiId: shopConfig?.upi_id || '',
        customerName: customerName.trim() || undefined,
        cart: cart.map(c => ({
          product_name: c.product_name,
          size_label: c.size_label,
          color_label: c.color_label,
          qty: c.qty,
          unit_price: c.unit_price,
        })),
        subtotal,
        taxAmount,
        taxLabel: shopConfig?.tax_label || 'Tax',
        discount: discountAmount,
        grandTotal,
        paymentMethod,
        upiAmount: digitalChargeAmount,
        status: statusOverride || (cart.length > 0 ? 'active' : 'idle'),
        lastBillNumber,
        timestamp: Date.now(),
      };

      try {
        if (!displayChannelRef.current) {
          displayChannelRef.current = new BroadcastChannel(`counterly_display_${terminalId}`);
        }
        displayChannelRef.current.postMessage(payload);
      } catch {
        // ignore
      }

      try {
        localStorage.setItem(`counterly_display_state_${terminalId}`, JSON.stringify(payload));
        await db.customer_display_state.put(payload);
        // Also mirror to 'default' for single-counter setups opened without query parameter
        localStorage.setItem('counterly_display_state_default', JSON.stringify({ ...payload, id: 'default' }));
        await db.customer_display_state.put({ ...payload, id: 'default' });
      } catch {
        // ignore
      }

      fetch(`/api/display/${encodeURIComponent(terminalId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    },
    [
      terminalId,
      shopConfig,
      customerName,
      cart,
      subtotal,
      taxAmount,
      discountAmount,
      grandTotal,
      paymentMethod,
      digitalChargeAmount,
    ]
  );

  useEffect(() => {
    pushDisplayState();
  }, [pushDisplayState]);

  useEffect(() => {
    const ch = new BroadcastChannel(`counterly_display_${terminalId}`);
    displayChannelRef.current = ch;
    ch.onmessage = e => {
      if (e.data?.type === 'REQUEST_STATE') {
        pushDisplayState();
      }
    };
    return () => {
      ch.close();
      displayChannelRef.current = null;
    };
  }, [terminalId, pushDisplayState]);

  // Variants Lookup Map
  const variantsByProduct = useMemo(() => {
    const m = new Map<string, ProductVariant[]>();
    variants.forEach(v => {
      const list = m.get(v.product_id) || [];
      list.push(v);
      m.set(v.product_id, list);
    });
    return m;
  }, [variants]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach(c => m.set(c.id.toLowerCase(), c.name));
    return m;
  }, [categories]);

  // Filtered Products Grid
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter(p => {
      if (selectedCategory !== 'all' && p.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      if (p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q))) {
        return true;
      }
      const pVars = variantsByProduct.get(p.id) || [];
      return pVars.some(
        v =>
          v.sku.toLowerCase().includes(q) ||
          v.barcode.toLowerCase().includes(q) ||
          v.size_label.toLowerCase().includes(q) ||
          v.color_label.toLowerCase().includes(q)
      );
    });
  }, [products, variantsByProduct, selectedCategory, searchQuery]);

  // Account label for institutional module
  const activeAccount = useMemo(() => {
    if (!shopConfig?.enabled_modules?.institutional_accounts) return null;
    return schools.find(s => s.id === selectedAccountId) || null;
  }, [shopConfig, schools, selectedAccountId]);

  // Add Variant to Cart
  const addVariantToCart = (product: Product, variant: ProductVariant) => {
    if (variant.stock_qty <= 0) {
      if (shopConfig?.sound_feedback) playBeep('warn');
      showToast(`${product.name} (${variant.size_label} · ${variant.color_label}) is out of stock`);
      return;
    }

    const multiplier = activeAccount?.multiplier && activeAccount.multiplier > 0 ? activeAccount.multiplier : 1;
    const unitPrice = roundMoney(variant.price * multiplier);

    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.variant_id === variant.id);
      if (existingIdx >= 0) {
        const current = prev[existingIdx];
        if (current.qty >= variant.stock_qty) {
          if (shopConfig?.sound_feedback) playBeep('warn');
          showToast(`Only ${variant.stock_qty} units in stock`);
          return prev;
        }
        const next = [...prev];
        next[existingIdx] = { ...current, qty: current.qty + 1 };
        return next;
      }

      return [
        ...prev,
        {
          variant_id: variant.id,
          product_id: product.id,
          product_name: product.name,
          size_id: variant.id,
          size_label: variant.size_label,
          color_label: variant.color_label,
          sku: variant.sku,
          barcode: variant.barcode,
          school_id: activeAccount?.id || 'retail_counter',
          school_code: activeAccount?.code || 'RTL',
          school_name: activeAccount?.name || 'Walk-in Retail',
          unit_price: unitPrice,
          unit_cost: variant.cost_price ?? product.cost_price ?? 0,
          tax_rate: typeof variant.tax_rate === 'number' ? variant.tax_rate : product.tax_rate,
          qty: 1,
          available_stock: variant.stock_qty,
        },
      ];
    });

    if (shopConfig?.sound_feedback) playBeep('tap');
  };

  // Handle clicking product tile
  const handleProductClick = (product: Product) => {
    const pVars = variantsByProduct.get(product.id) || [];
    if (pVars.length === 0) {
      // Legacy / unvarianted product fallback
      const syntheticVariant: ProductVariant = {
        id: `var_${product.id}_os`,
        product_id: product.id,
        size_label: 'One Size',
        color_label: 'Standard',
        sku: product.sku_prefix || 'ITEM',
        barcode: product.id,
        price: product.base_price,
        stock_qty: product.stock || 0,
        low_stock_threshold: product.low_stock_threshold || 5,
      };
      addVariantToCart(product, syntheticVariant);
      return;
    }

    if (pVars.length === 1) {
      addVariantToCart(product, pVars[0]);
      return;
    }

    setPickerProduct(product);
  };

  // Barcode / SKU Enter Scanner Handler
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const clean = searchQuery.trim().toLowerCase();
    if (!clean) return;

    const matchedVariant = variants.find(
      v => v.barcode.toLowerCase() === clean || v.sku.toLowerCase() === clean
    );
    if (matchedVariant) {
      const prod = products.find(p => p.id === matchedVariant.product_id);
      if (prod) {
        addVariantToCart(prod, matchedVariant);
        if (shopConfig?.sound_feedback) playBeep('success');
        setSearchQuery('');
        showToast(`Added ${prod.name} (${matchedVariant.size_label} · ${matchedVariant.color_label})`);
        return;
      }
    }

    // If exactly 1 product matches search text and it has 1 variant, quick add
    if (filteredProducts.length === 1) {
      handleProductClick(filteredProducts[0]);
      setSearchQuery('');
    }
  };

  const updateCartQty = (idx: number, delta: number) => {
    setCart(prev => {
      const item = prev[idx];
      if (!item) return prev;
      const nextQty = item.qty + delta;
      if (nextQty <= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      if (item.available_stock > 0 && nextQty > item.available_stock) {
        if (shopConfig?.sound_feedback) playBeep('warn');
        showToast(`Only ${item.available_stock} available in stock`);
        return prev;
      }
      const next = [...prev];
      next[idx] = { ...item, qty: nextQty };
      return next;
    });
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customItemName.trim();
    const price = roundMoney(parseFloat(customItemPrice) || 0);
    if (!name || price <= 0) {
      showToast('Enter item description and valid price');
      return;
    }

    setCart(prev => [
      ...prev,
      {
        product_id: `custom_${Date.now()}`,
        product_name: name,
        size_id: null,
        size_label: 'Custom',
        color_label: null,
        school_id: activeAccount?.id || 'retail_counter',
        school_code: activeAccount?.code || 'RTL',
        school_name: activeAccount?.name || 'Walk-in Retail',
        unit_price: price,
        qty: 1,
        available_stock: 9999,
      },
    ]);

    setCustomItemName('');
    setCustomItemPrice('');
    setIsCustomItemOpen(false);
    if (shopConfig?.sound_feedback) playBeep('tap');
  };

  // Park / Hold Cart
  const handleParkCart = () => {
    if (cart.length === 0) return;
    const held: ParkedBill = {
      id: `hold_${Date.now()}`,
      parked_at: new Date().toISOString(),
      cart,
      school_id: activeAccount?.id || 'retail_counter',
      school_code: activeAccount?.code || 'RTL',
      school_name: activeAccount?.name || 'Walk-in Retail',
      customer_name: customerName,
      customer_phone: customerPhone,
      discount_val: discountVal,
      discount_type: discountType,
      notes,
      total: grandTotal,
    };
    setParkedBills(prev => [held, ...prev]);
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountVal('');
    setNotes('');
    setCashTendered('');
    showToast('Sale placed on hold');
  };

  const handleResumeParked = (held: ParkedBill) => {
    setCart(held.cart);
    setCustomerName(held.customer_name || '');
    setCustomerPhone(held.customer_phone || '');
    setDiscountVal(held.discount_val || '');
    setDiscountType(held.discount_type || 'flat');
    setNotes(held.notes || '');
    setParkedBills(prev => prev.filter(p => p.id !== held.id));
    setIsParkedModalOpen(false);
    showToast('Held sale resumed');
  };

  // Complete Sale & Checkout
  const handleCheckout = async () => {
    if (cart.length === 0 || isSubmitting) return;

    if (discountExceedsCashierLimit) {
      setIsDiscountOverrideOpen(true);
      return;
    }

    if (paymentMethod === 'split') {
      const splitSum = roundMoney(
        (parseFloat(splitAmounts.cash) || 0) +
          (parseFloat(splitAmounts.card) || 0) +
          (parseFloat(splitAmounts.upi) || 0) +
          (parseFloat(splitAmounts.credit) || 0)
      );
      if (Math.abs(splitSum - netPayable) > 0.05) {
        showToast(
          `Split total (${formatMoney(splitSum, shopConfig)}) must equal ${formatMoney(
            netPayable,
            shopConfig
          )}`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const cfg = shopConfig || (await db.shop_config.toArray())[0];
      const prefix = cfg?.bill_prefix || 'INV-';
      const seq = cfg?.bill_sequence || 1001;
      const billNumber = `${prefix}${seq}`;
      const nowIso = new Date().toISOString();

      const isPaid =
        netPayable === 0 ||
        (paymentMethod !== 'credit' &&
          !(paymentMethod === 'split' && (parseFloat(splitAmounts.credit) || 0) > 0));

      const productCostLookup = new Map<string, number>();
      products.forEach(p => {
        if (typeof p.cost_price === 'number') productCostLookup.set(p.id, p.cost_price);
      });

      const newBill: Bill = {
        id: `bill_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        bill_number: billNumber,
        created_at: nowIso,
        currency_code: getCurrencyCode(cfg),
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        bill_type: activeAccount ? 'b2b' : 'retail',
        school_id: activeAccount?.id || 'retail_counter',
        school_name: activeAccount?.name || 'Walk-in Retail',
        subtotal,
        discount_amount: discountAmount,
        discount_type: discountType,
        tax_amount: taxAmount,
        tax_label: cfg?.tax_label || 'Tax',
        total: grandTotal,
        store_credit_used: appliedStoreCredit > 0 ? appliedStoreCredit : undefined,
        payment_method: paymentMethod,
        payment_details:
          paymentMethod === 'split'
            ? {
                cash: parseFloat(splitAmounts.cash) || 0,
                card: parseFloat(splitAmounts.card) || 0,
                upi: parseFloat(splitAmounts.upi) || 0,
                credit: parseFloat(splitAmounts.credit) || 0,
              }
            : {
                [paymentMethod === 'cash'
                  ? 'cash'
                  : paymentMethod === 'card'
                  ? 'card'
                  : paymentMethod === 'credit'
                  ? 'credit'
                  : 'upi']: netPayable,
              },
        notes: notes.trim() || undefined,
        is_paid: isPaid,
        paid_at: isPaid ? nowIso : null,
        status: 'completed',
        billed_by_id: currentUser?.id,
        billed_by_name: currentUser?.name,
        items: cart.map((item, index) => ({
          id: `bi_${Date.now()}_${index}`,
          product_id: item.product_id,
          product_name: item.product_name,
          variant_id: item.variant_id,
          size_id: item.size_id,
          size_label: item.size_label,
          color_label: item.color_label,
          sku: item.sku,
          barcode: item.barcode,
          school_id: item.school_id,
          school_code: item.school_code,
          school_name: item.school_name,
          qty: item.qty,
          unit_price: item.unit_price,
          unit_cost: item.unit_cost ?? productCostLookup.get(item.product_id) ?? 0,
          tax_rate: typeof item.tax_rate === 'number' ? item.tax_rate : Number(cfg?.tax_rate || 0),
          tax_amount: lineTaxes[index] ?? 0,
          discount_amount: 0,
          subtotal: roundMoney(item.unit_price * item.qty),
        })),
      };

      await db.bills.add(newBill);

      // Update variant & product stock levels
      for (const item of cart) {
        if (item.variant_id) {
          const v = await db.variants.get(item.variant_id);
          if (v) {
            const prevQty = v.stock_qty;
            const nextQty = Math.max(0, prevQty - item.qty);
            await db.variants.update(v.id, { stock_qty: nextQty });
            await db.inventory_movements.add({
              id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              product_id: item.product_id,
              variant_id: v.id,
              product_name: item.product_name,
              size_label: [item.size_label, item.color_label].filter(Boolean).join(' · '),
              type: 'sale',
              qty: -item.qty,
              previous_stock: prevQty,
              new_stock: nextQty,
              notes: `Sale ${billNumber}`,
              created_at: nowIso,
              reference_bill_id: newBill.id,
            });
          }
        }
      }

      // Bump receipt sequence
      if (cfg) {
        await db.shop_config.update(cfg.id, { bill_sequence: seq + 1 });
      }

      // Upsert customer record & deduct redeemed store credit if used
      let targetCustomerId = matchedCustomer?.id;
      if (customerPhone.trim() || customerName.trim()) {
        const cleanPh = customerPhone.trim().replace(/\D/g, '');
        const existingCust =
          (cleanPh
            ? customers.find(c => c.phone.replace(/\D/g, '') === cleanPh)
            : undefined) || matchedCustomer;

        if (existingCust) {
          targetCustomerId = existingCust.id;
          await db.customers.update(existingCust.id, {
            name: customerName.trim() || existingCust.name,
            last_visit_at: nowIso,
          });
        } else {
          const newCustId = `cust_${Date.now()}`;
          targetCustomerId = newCustId;
          await db.customers.add({
            id: newCustId,
            name: customerName.trim() || 'Retail Customer',
            phone: customerPhone.trim() || 'N/A',
            last_visit_at: nowIso,
          });
        }
      }

      if (appliedStoreCredit > 0 && targetCustomerId) {
        const custRec = await db.customers.get(targetCustomerId);
        if (custRec) {
          const creditEntry: CustomerCreditEntry = {
            id: `cred_${Date.now()}`,
            amount: appliedStoreCredit,
            type: 'redeem',
            note: `Redeemed on invoice ${billNumber}`,
            created_at: nowIso,
            bill_number: billNumber,
          };
          await db.customers.update(custRec.id, {
            store_credit_balance: roundMoney(
              Math.max(0, (custRec.store_credit_balance || 0) - appliedStoreCredit)
            ),
            credit_transactions: [creditEntry, ...(custRec.credit_transactions || [])],
          });
        }
      }

      if (cfg?.sound_feedback) playBeep('success');

      // Broadcast completion to customer display
      await pushDisplayState('completed', billNumber);

      // Auto-print Bluetooth ESC/POS if paired
      const shouldBlePrint =
        bluetoothPrinter.isConnected() &&
        ((paymentMethod === 'cash' && cfg?.auto_print_cash) ||
          (paymentMethod === 'upi' && cfg?.auto_print_upi));
      if (shouldBlePrint && cfg) {
        bluetoothPrinter.printData(generateEscPosReceipt(newBill, cfg)).catch(() => {});
      }

      // Clear active cart & reset checkout state
      setCart([]);
      setDiscountVal('');
      setDiscountOverrideApproved(false);
      setCustomerName('');
      setCustomerPhone('');
      setUseStoreCredit(false);
      setNotes('');
      setCashTendered('');
      setSplitAmounts({ cash: '', card: '', upi: '', credit: '' });

      await loadRegisterData();
      onBillCreated(newBill);
      onOpenReceipt(newBill);
      showToast(`Sale ${billNumber} completed`);
    } catch (err) {
      console.error('Checkout error:', err);
      showToast('Failed to complete sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cashTenderedNum = parseFloat(cashTendered) || 0;
  const cashChangeDue = cashTenderedNum > netPayable ? roundMoney(cashTenderedNum - netPayable) : 0;

  const pickerVariants = useMemo(() => {
    if (!pickerProduct) return [];
    return variantsByProduct.get(pickerProduct.id) || [];
  }, [pickerProduct, variantsByProduct]);

  const pickerColors = useMemo(() => {
    const colors = Array.from(new Set(pickerVariants.map(v => v.color_label || 'Standard')));
    return colors;
  }, [pickerVariants]);

  const [activePickerColor, setActivePickerColor] = useState<string>('All');
  useEffect(() => {
    if (pickerProduct) {
      setActivePickerColor('All');
    }
  }, [pickerProduct]);

  const showAlterations = Boolean(shopConfig?.enabled_modules?.alterations);
  const showInstitutionalAccounts = Boolean(shopConfig?.enabled_modules?.institutional_accounts);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 px-4 py-2 rounded-lg shadow-lg text-xs font-semibold">
          {toastMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: SCANNER, CATEGORIES & PRODUCT GRID */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Top Register Controls */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Scan barcode, enter SKU, or search products (F1)..."
                  className="w-full h-10 pl-10 pr-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCustomItemOpen(true)}
                  className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Custom Item</span>
                </button>

                {parkedBills.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsParkedModalOpen(true)}
                    className="h-10 px-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span className="tabular-nums">Held ({parkedBills.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsExchangeModalOpen(true)}
                  className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  title="Exchange or swap size/item from past receipt"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Exchange</span>
                </button>

                {showAlterations && (
                  <button
                    type="button"
                    onClick={() => setIsAlterationModalOpen(true)}
                    className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Alterations</span>
                  </button>
                )}
              </div>
            </div>

            {/* Category Tabs & Optional Institutional Account Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  All Items
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {showInstitutionalAccounts && schools.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                  <select
                    value={selectedAccountId}
                    onChange={e => setSelectedAccountId(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium text-zinc-800 dark:text-zinc-200"
                  >
                    <option value="retail_counter">Walk-in Retail</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>
                        [{s.code}] {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-3">
              <Layers className="w-8 h-8 text-zinc-400 mx-auto" />
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {products.length === 0 ? 'No catalog items yet' : 'No matching items'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                {products.length === 0
                  ? 'Add products with size and color variants or load starter samples from Catalog.'
                  : 'Try clearing your search filter or scan another SKU barcode.'}
              </p>
              <button
                type="button"
                onClick={() => setIsAddProductOpen(true)}
                className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
              >
                + Add Product
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map(prod => {
                const pVars = variantsByProduct.get(prod.id) || [];
                const totalStock = pVars.length
                  ? pVars.reduce((s, v) => s + v.stock_qty, 0)
                  : prod.stock || 0;
                const minPrice = pVars.length
                  ? Math.min(...pVars.map(v => v.price))
                  : prod.base_price;
                const catName = categoryMap.get(prod.category.toLowerCase()) || prod.category;
                const isOut = totalStock <= 0;

                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleProductClick(prod)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[112px] cursor-pointer ${
                      isOut
                        ? 'bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 opacity-60'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-950 dark:hover:border-zinc-400'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-50 line-clamp-2 leading-snug">
                        {prod.name}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {catName}
                        {pVars.length > 1 ? ` · ${pVars.length} variants` : ''}
                      </div>
                    </div>

                    <div className="pt-3 flex items-baseline justify-between gap-2">
                      <span className="text-sm font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50">
                        {formatMoney(minPrice, shopConfig)}
                      </span>
                      <span
                        className={`text-[11px] font-mono tabular-nums ${
                          isOut
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {isOut ? 'Out' : `${totalStock} left`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: ACTIVE SALE CART & TENDER */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 space-y-4 lg:sticky lg:top-20">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">Current Sale</h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                {cart.reduce((s, c) => s + c.qty, 0)} item(s) · Receipt {shopConfig?.bill_prefix || 'INV-'}
                {shopConfig?.bill_sequence || 1001}
              </p>
            </div>

            {cart.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleParkCart}
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1 cursor-pointer"
                  title="Hold cart for later"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Hold</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 cursor-pointer"
                  title="Clear cart"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Customer Lookup Row */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <User className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="Customer phone"
                  className="w-full h-9 pl-8 pr-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-950 dark:text-zinc-50 focus:outline-none"
                />
              </div>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Customer name (optional)"
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-950 dark:text-zinc-50 focus:outline-none"
              />
            </div>

            {matchedCustomer && availableStoreCredit > 0 && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-xs">
                <div>
                  <span className="text-emerald-800 dark:text-emerald-300 font-medium">
                    Store Credit:{' '}
                  </span>
                  <strong className="font-mono tabular-nums text-emerald-900 dark:text-emerald-200">
                    {formatMoney(availableStoreCredit, shopConfig)}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => setUseStoreCredit(prev => !prev)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                    useStoreCredit
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950'
                  }`}
                >
                  {useStoreCredit ? 'Credit Applied' : 'Apply Credit'}
                </button>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
            {cart.length === 0 ? (
              <div className="py-10 text-center space-y-1.5">
                <ReceiptText className="w-7 h-7 text-zinc-300 dark:text-zinc-700 mx-auto" />
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Scan a barcode or tap an item to start
                </p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={`${item.product_id}_${item.variant_id || idx}`} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-50 truncate">
                      {item.product_name}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {[item.size_label, item.color_label].filter(Boolean).join(' · ')} ·{' '}
                      {formatMoney(item.unit_price, shopConfig)}
                      {typeof item.tax_rate === 'number' && shopConfig?.tax_type !== 'none'
                        ? ` · ${item.tax_rate}% Tax`
                        : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateCartQty(idx, -1)}
                      className="w-6 h-6 rounded-md border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-mono font-semibold tabular-nums">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(idx, 1)}
                      className="w-6 h-6 rounded-md border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="w-16 text-right font-mono text-xs font-bold tabular-nums shrink-0">
                    {formatMoney(item.unit_price * item.qty, shopConfig)}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1 text-zinc-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Discount & Totals */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
                Discount
              </span>
              <div className="flex items-center flex-1 gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountVal}
                  onChange={e => setDiscountVal(e.target.value)}
                  placeholder="0"
                  className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-mono tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => setDiscountType(prev => (prev === 'flat' ? 'percent' : 'flat'))}
                  className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold cursor-pointer shrink-0"
                >
                  {discountType === 'flat' ? getCurrencySymbol(shopConfig) : '%'}
                </button>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">{formatMoney(subtotal, shopConfig)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                  <span>Discount</span>
                  <span className="font-mono tabular-nums">-{formatMoney(discountAmount, shopConfig)}</span>
                </div>
              )}
              {shopConfig?.tax_type !== 'none' && (taxAmount > 0 || Number(shopConfig?.tax_rate || 0) > 0) && (
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                  <span>
                    {getTaxSummaryLabel(shopConfig)}
                    {shopConfig?.tax_type === 'inclusive' ? ' (incl.)' : ''}
                  </span>
                  <span className="font-mono tabular-nums">{formatMoney(taxAmount, shopConfig)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <span className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                  {appliedStoreCredit > 0 ? 'Net Payable' : 'Total'}
                </span>
                <span className="text-2xl font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50">
                  {formatMoney(netPayable, shopConfig)}
                </span>
              </div>
              {appliedStoreCredit > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                  <span>Store Credit Applied (of {formatMoney(grandTotal, shopConfig)})</span>
                  <span className="font-mono tabular-nums">-{formatMoney(appliedStoreCredit, shopConfig)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Tender Selector */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-5 gap-1.5">
              {(
                [
                  { id: 'cash', label: 'Cash', icon: Banknote },
                  { id: 'card', label: 'Card', icon: CreditCard },
                  { id: 'upi', label: getCurrencyCode(shopConfig) === 'INR' ? 'UPI' : 'Digital', icon: QrCode },
                  { id: 'credit', label: 'Credit', icon: ReceiptText },
                  { id: 'split', label: 'Split', icon: ArrowRightLeft },
                ] as const
              ).map(m => {
                const Icon = m.icon;
                const active = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-2 px-1 rounded-lg border text-[11px] font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                      active
                        ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                        : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {paymentMethod === 'cash' && netPayable > 0 && (
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-[11px] font-medium text-zinc-500 shrink-0">Tendered</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashTendered}
                    onChange={e => setCashTendered(e.target.value)}
                    placeholder={String(netPayable)}
                    className="w-full h-7 px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono tabular-nums"
                  />
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-zinc-500 block">Change Due</span>
                  <span className="text-xs font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatMoney(cashChangeDue, shopConfig)}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === 'split' && (
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                {(['cash', 'card', 'upi', 'credit'] as const).map(k => (
                  <div key={k}>
                    <label className="text-[10px] uppercase font-semibold text-zinc-500 block mb-0.5">
                      {getPaymentMethodLabel(k, shopConfig)}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={splitAmounts[k]}
                      onChange={e => setSplitAmounts(prev => ({ ...prev, [k]: e.target.value }))}
                      placeholder="0.00"
                      className="w-full h-7 px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono tabular-nums"
                    />
                  </div>
                ))}
              </div>
            )}

            {upiQrUrl && digitalChargeAmount > 0 && (
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <img src={upiQrUrl} alt="Payment QR" className="w-14 h-14 rounded-lg bg-white p-1 border border-zinc-200" />
                  <div>
                    <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-50">
                      Scan to Pay {formatMoney(digitalChargeAmount, shopConfig)}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500">{shopConfig?.upi_id}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStandeeQrModal(true)}
                  className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  title="Show large QR"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Complete Sale CTA */}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={cart.length === 0 || isSubmitting}
            className="w-full h-11 rounded-xl bg-zinc-950 dark:bg-zinc-100 hover:opacity-90 disabled:opacity-40 text-white dark:text-zinc-950 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-opacity"
          >
            <Check className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Completing Sale...'
                : cart.length > 0
                ? `Complete Sale · ${formatMoney(netPayable, shopConfig)} (F9)`
                : 'Add items to checkout'}
            </span>
          </button>
        </div>
      </div>

      {/* Size × Color Variant Picker Modal */}
      {pickerProduct && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-5 sm:p-6 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                  {pickerProduct.name}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Select a Size &amp; Color variant to add to sale
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerProduct(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pickerColors.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {['All', ...pickerColors].map(col => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setActivePickerColor(col)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border ${
                      activePickerColor === col
                        ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                        : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto">
              {pickerVariants
                .filter(v => activePickerColor === 'All' || v.color_label === activePickerColor)
                .map(v => {
                  const out = v.stock_qty <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={out}
                      onClick={() => {
                        addVariantToCart(pickerProduct, v);
                        setPickerProduct(null);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        out
                          ? 'opacity-45 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 cursor-not-allowed'
                          : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-950 dark:hover:border-zinc-300'
                      }`}
                    >
                      <div className="text-xs font-bold text-zinc-950 dark:text-zinc-50">
                        {v.size_label} · {v.color_label}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 mt-0.5 truncate">{v.sku}</div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-xs font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50">
                          {formatMoney(v.price, shopConfig)}
                        </span>
                        <span className="text-[11px] font-mono tabular-nums text-zinc-500">
                          {out ? 'Out' : `${v.stock_qty} qty`}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Custom Item Modal */}
      {isCustomItemOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddCustomItem}
            className="bg-white dark:bg-zinc-900 rounded-2xl max-w-sm w-full p-5 border border-zinc-200 dark:border-zinc-800 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">Add Custom Charge</h3>
              <button
                type="button"
                onClick={() => setIsCustomItemOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Item / Service Name
              </label>
              <input
                type="text"
                required
                value={customItemName}
                onChange={e => setCustomItemName(e.target.value)}
                placeholder="e.g. Gift Wrapping or Express Alteration"
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Price ({getCurrencySymbol(shopConfig)})
              </label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={customItemPrice}
                onChange={e => setCustomItemPrice(e.target.value)}
                placeholder="10.00"
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-mono tabular-nums"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCustomItemOpen(false)}
                className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
              >
                Add to Sale
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Held Carts Modal */}
      {isParkedModalOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-5 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">Held Sales</h3>
              <button
                type="button"
                onClick={() => setIsParkedModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {parkedBills.map(held => (
                <div
                  key={held.id}
                  className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-50">
                      {held.customer_name || held.customer_phone || 'Walk-in Customer'}
                    </div>
                    <div className="text-[11px] text-zinc-500 tabular-nums">
                      {held.cart.length} item(s) · {formatMoney(held.total, shopConfig)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResumeParked(held)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
                  >
                    Resume
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Payment QR Standee */}
      {showStandeeQrModal && upiQrUrl && (
        <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-sm w-full p-6 border border-zinc-200 dark:border-zinc-800 text-center space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-zinc-950 dark:text-zinc-50">
                {shopConfig?.legal_name || 'SIKKADESK RETAIL'}
              </span>
              <button
                type="button"
                onClick={() => setShowStandeeQrModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img src={upiQrUrl} alt="Standee QR" className="w-52 h-52 mx-auto rounded-xl bg-white p-2 border border-zinc-200" />
            <div className="text-2xl font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50">
              {formatMoney(digitalChargeAmount, shopConfig)}
            </div>
            <button
              type="button"
              onClick={() => setShowStandeeQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onProductSaved={loadRegisterData}
      />

      <ExchangeReturnModal
        isOpen={isExchangeModalOpen}
        onClose={() => setIsExchangeModalOpen(false)}
        onComplete={loadRegisterData}
      />

      {showAlterations && (
        <AdvanceAlterationModal
          isOpen={isAlterationModalOpen}
          onClose={() => setIsAlterationModalOpen(false)}
          schools={schools}
          initialPhone={customerPhone}
          initialCustomerName={customerName}
        />
      )}

      <ManagerOverrideModal
        isOpen={isDiscountOverrideOpen}
        onClose={() => setIsDiscountOverrideOpen(false)}
        onAuthorized={() => {
          setDiscountOverrideApproved(true);
          setIsDiscountOverrideOpen(false);
          setTimeout(() => handleCheckout(), 50);
        }}
        actionTitle="Shift Lead Discount Approval"
        actionDescription="Discount exceeds counter associate limit. Enter 6-digit Shift Lead or Admin PIN to proceed."
      />
    </div>
  );
};
