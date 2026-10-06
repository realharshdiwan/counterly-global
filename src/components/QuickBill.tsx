import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  QrCode, 
  FileText, 
  Check, 
  X,
  School as SchoolIcon,
  Layers,
  ArrowRightLeft,
  PauseCircle,
  Play,
  RotateCcw,
  Sparkles,
  Smartphone,
  ShieldCheck,
  HelpCircle,
  MessageCircle,
  Clock,
  Maximize2,
  Barcode,
  Scissors,
  GraduationCap,
  UserCheck,
  User,
  Monitor,
  Banknote,
  CreditCard,
  Building2
} from 'lucide-react';
import { db } from '../db/db';
import { 
  type School, 
  type Product, 
  type SizeItem, 
  type ProductStock, 
  type CartItem, 
  type PaymentMethod, 
  type ShopConfig, 
  type Bill,
  type ParkedBill,
  type StudentProfile,
  type Category
} from '../types';
import { generateEscPosReceipt, bluetoothPrinter, playBeep } from '../lib/printer';
import { generateWhatsAppReceiptText, openWhatsAppReceipt } from '../lib/whatsapp';
import { syncBillToSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getCatalogTabMeta } from '../lib/catalogLabels';
import { AddProductModal } from './AddProductModal';
import { EditMultiRatesModal } from './EditMultiRatesModal';
import { SchoolModal } from './SchoolModal';
import { ExchangeReturnModal } from './ExchangeReturnModal';
import { BarcodeStickerModal } from './BarcodeStickerModal';
import { AdvanceAlterationModal } from './AdvanceAlterationModal';

interface QuickBillProps {
  onBillCreated: (bill: Bill) => void;
  onOpenReceipt: (bill: Bill) => void;
}

export const QuickBill: React.FC<QuickBillProps> = ({ onBillCreated, onOpenReceipt }) => {
  const { currentUser } = useAuth();
  // DB State
  const [schools, setSchools] = useState<School[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<SizeItem[]>([]);
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());
  const [stocksMap, setStocksMap] = useState<Map<string, ProductStock>>(new Map());
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isAlterationModalOpen, setIsAlterationModalOpen] = useState(false);

  // Student Profile & Fit Memory State
  const [matchedStudent, setMatchedStudent] = useState<StudentProfile | null>(null);
  const [studentNameVal, setStudentNameVal] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [studentHouse, setStudentHouse] = useState('');
  const [showStudentDetails, setShowStudentDetails] = useState(false);

  // Active Billing State
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showSchoolPicker, setShowSchoolPicker] = useState<boolean>(false);

  // 1) Park / Hold Bill state
  const [parkedBills, setParkedBills] = useState<ParkedBill[]>(() => {
    try {
      const saved = localStorage.getItem('nandalaya_parked_bills');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isParkedModalOpen, setIsParkedModalOpen] = useState(false);

  // Search & Filters
  const [schoolQuery, setSchoolQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<Category[]>([]);

  // Payment & Customer
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [splitAmounts, setSplitAmounts] = useState<{ cash: string; upi: string; credit: string }>({
    cash: '',
    upi: '',
    credit: '',
  });
  const [discountVal, setDiscountVal] = useState<string>('');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Institutional / B2B Supply Details
  const [billType, setBillType] = useState<'retail' | 'b2b'>('retail');
  const [buyerName, setBuyerName] = useState('');
  const [buyerGstin, setBuyerGstin] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [poNumber, setPoNumber] = useState('');

  // UI state
  const [isMobileBillOpen, setIsMobileBillOpen] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [showStandeeQrModal, setShowStandeeQrModal] = useState(false); // 7) Standee Mode
  const [isTabletFlipped, setIsTabletFlipped] = useState(false);
  const [upiQrUrl, setUpiQrUrl] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddSchoolOpen, setIsAddSchoolOpen] = useState(false);
  const [productForMultiRates, setProductForMultiRates] = useState<Product | null>(null);
  const [showCustomItemRow, setShowCustomItemRow] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('50');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const displayChannelRef = useRef<BroadcastChannel | null>(null);

  // Save parked bills to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('nandalaya_parked_bills', JSON.stringify(parkedBills));
    } catch (e) {
      console.error('Failed to save parked bills to storage', e);
    }
  }, [parkedBills]);

  // Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Load initial data from Dexie
  const loadDatabaseData = async () => {
    try {
      const [sList, pList, szList, prList, stList, cfgList, catList] = await Promise.all([
        db.schools.toArray(),
        db.products.toArray(),
        db.sizes.orderBy('sort_order').toArray(),
        db.price_list.toArray(),
        db.stocks.toArray(),
        db.shop_config.toArray(),
        db.categories.toArray(),
      ]);

      const activeSchools = sList.filter(s => s.active !== false);
      setSchools(activeSchools);
      setProducts(pList);
      setSizes(szList);
      setCategories(catList.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));

      if (cfgList.length > 0) {
        setShopConfig(cfgList[0]);
      }

      const pMap = new Map<string, number>();
      for (const pr of prList) {
        const key = `${pr.school_id}_${pr.product_id}_${pr.size_id || 'null'}`;
        pMap.set(key, pr.price);
      }
      setPriceMap(pMap);

      const sMap = new Map<string, ProductStock>();
      for (const st of stList) {
        sMap.set(st.id, st);
      }
      setStocksMap(sMap);
    } catch (err) {
      console.error('Failed to load DB in Bill view:', err);
    }
  };

  useEffect(() => {
    loadDatabaseData();
  }, []);

  // Student Profile & Fit Memory Lookup when customer phone is typed
  useEffect(() => {
    async function lookupStudent() {
      const cleanPhone = customerPhone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        try {
          const student = await db.students.where('parent_phone').equals(cleanPhone).first();
          if (student) {
            setMatchedStudent(student);
            if (!customerName && student.parent_name) setCustomerName(student.parent_name);
            if (student.student_name) setStudentNameVal(student.student_name);
            if (student.grade) setStudentGrade(student.grade);
            if (student.house_color) setStudentHouse(student.house_color);
            // If no school is selected, auto-select student's school
            if (!selectedSchool && student.school_id) {
              const matchedSch = schools.find(s => s.id === student.school_id);
              if (matchedSch) setSelectedSchool(matchedSch);
            }
          } else {
            setMatchedStudent(null);
          }
        } catch (err) {
          console.error('Student lookup error:', err);
        }
      } else {
        setMatchedStudent(null);
      }
    }

    lookupStudent();
  }, [customerPhone, schools, selectedSchool]);

  // 3) Permanent Keyboard Hotkey Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      // F1: Focus search
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // F2 or Ctrl+Enter: Save & Print
      if (e.key === 'F2' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (cart.length > 0 && !isSubmitting) {
          handleSaveAndPrint();
        }
        return;
      }

      // Escape: Close drawers / modals
      if (e.key === 'Escape') {
        setSelectedProductId(null);
        setShowSchoolPicker(false);
        setShowUpiModal(false);
        setShowStandeeQrModal(false);
        setIsParkedModalOpen(false);
        return;
      }

      // When NOT typing inside an input field:
      if (!isInput) {
        // 'P' or 'p': Park / Hold current bill
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          if (cart.length > 0) {
            handleParkCurrentBill();
          } else if (parkedBills.length > 0) {
            setIsParkedModalOpen(true);
          }
          return;
        }

        // '1' to '5': Quick payment mode selection
        if (['1', '2', '3', '4', '5'].includes(e.key)) {
          const modes: PaymentMethod[] = ['cash', 'upi', 'card', 'credit', 'split'];
          const targetMode = modes[parseInt(e.key) - 1];
          if (targetMode) {
            setPaymentMethod(targetMode);
            if (shopConfig?.sound_feedback) playBeep('tap');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Calculate Price for a given School, Product, and optional Size
  const getItemPrice = (product: Product, sizeId: string | null = null, sizeIndex = 0): number => {
    if (!selectedSchool) return product.base_price;

    const key = `${selectedSchool.id}_${product.id}_${sizeId || 'null'}`;
    const mappedPrice = priceMap.get(key);
    if (mappedPrice !== undefined) {
      return mappedPrice;
    }

    const mult = selectedSchool.multiplier || 1.0;
    const baseCalculated = Math.round((product.base_price * mult) / 5) * 5;
    return product.size_group_id && sizeId ? baseCalculated + sizeIndex * 10 : baseCalculated;
  };

  // Add Item to active cart for specific school (supports direct barcode scans)
  const handleAddItemForSchool = (product: Product, size: SizeItem | null, targetSchool: School) => {
    const sizeId = size ? size.id : null;
    const sizeLabel = size ? size.label : null;
    const key = `${targetSchool.id}_${product.id}_${sizeId || 'null'}`;
    const mappedPrice = priceMap.get(key);
    const mult = targetSchool.multiplier || 1.0;
    const baseCalculated = Math.round((product.base_price * mult) / 5) * 5;
    const unitPrice = mappedPrice !== undefined ? mappedPrice : baseCalculated;
    const availableStock = getItemStock(product.id, sizeId);

    setCart(prev => {
      const idx = prev.findIndex(
        item =>
          item.product_id === product.id &&
          item.size_id === sizeId &&
          item.school_id === targetSchool.id
      );

      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      } else {
        return [
          ...prev,
          {
            product_id: product.id,
            product_name: product.name,
            size_id: sizeId,
            size_label: sizeLabel,
            school_id: targetSchool.id,
            school_code: targetSchool.code,
            school_name: targetSchool.name,
            unit_price: unitPrice,
            qty: 1,
            available_stock: availableStock,
          },
        ];
      }
    });
  };

  // Global Hardware USB / Bluetooth Barcode Scanner Listener
  const barcodeScanBufferRef = useRef<{ buffer: string; lastCharTime: number }>({ buffer: '', lastCharTime: 0 });

  useEffect(() => {
    const handleBarcodeInput = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLastChar = now - barcodeScanBufferRef.current.lastCharTime;
      barcodeScanBufferRef.current.lastCharTime = now;

      if (e.key === 'Enter') {
        const rawCode = barcodeScanBufferRef.current.buffer.trim().toUpperCase();
        barcodeScanBufferRef.current.buffer = '';

        if (rawCode.length >= 3) {
          const parts = rawCode.split('-');
          let targetSch = selectedSchool;
          let prodPrefix = '';
          let szLabel = '';

          if (parts.length >= 2) {
            const foundSch = schools.find(s => s.code.toUpperCase() === parts[0]);
            if (foundSch) {
              targetSch = foundSch;
              setSelectedSchool(foundSch);
            }
            prodPrefix = parts[1];
            szLabel = parts.slice(2).join('-');
          } else {
            prodPrefix = rawCode;
          }

          const matchedProd = products.find(p => 
            p.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().startsWith(prodPrefix) ||
            p.name.toUpperCase().includes(rawCode)
          );

          if (matchedProd && targetSch) {
            let matchedSz: SizeItem | null = null;
            if (matchedProd.size_group_id && szLabel && szLabel !== 'FREE') {
              const pSizes = sizes.filter(s => s.size_group_id === matchedProd.size_group_id);
              matchedSz = pSizes.find(s => s.label.toUpperCase() === szLabel) || pSizes[0] || null;
            }

            playBeep('success');
            handleAddItemForSchool(matchedProd, matchedSz, targetSch);
            showToast(`Scanned [${targetSch.code}] ${matchedProd.name} ${matchedSz ? `(${matchedSz.label})` : ''} - Added to cart`);
            e.preventDefault();
            return;
          }
        }
      } else if (e.key.length === 1) {
        // If gap between keystrokes is too large (> 150ms), user is probably typing manually; reset buffer
        if (timeSinceLastChar > 150 && barcodeScanBufferRef.current.buffer.length > 0) {
          barcodeScanBufferRef.current.buffer = '';
        }
        barcodeScanBufferRef.current.buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleBarcodeInput);
    return () => window.removeEventListener('keydown', handleBarcodeInput);
  }, [schools, products, sizes, selectedSchool, priceMap, stocksMap]);

  // Get Stock for item
  const getItemStock = (productId: string, sizeId: string | null = null): number => {
    const stockKey = `${productId}_${sizeId || 'free'}`;
    const s = stocksMap.get(stockKey);
    return s ? s.quantity : 50;
  };

  // Filtered Schools list
  const filteredSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter(
      s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  }, [schools, schoolQuery]);

  // Filtered Products list
  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCategory !== 'all') {
      list = list.filter(p => p.category?.toLowerCase() === selectedCategory.toLowerCase());
    }
    const q = productQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, selectedCategory, productQuery]);

  // Selected Product object
  const activeProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Sizes for active product
  const activeProductSizes = useMemo(() => {
    if (!activeProduct || !activeProduct.size_group_id) return [];
    return sizes.filter(s => s.size_group_id === activeProduct.size_group_id);
  }, [activeProduct, sizes]);

  // Cart Qty helpers for current selected school
  const getProductCartCount = (productId: string): number => {
    return cart
      .filter(c => c.product_id === productId && (!selectedSchool || c.school_id === selectedSchool.id))
      .reduce((acc, c) => acc + c.qty, 0);
  };

  const getSizeCartCount = (productId: string, sizeId: string | null): number => {
    return (
      cart.find(
        c =>
          c.product_id === productId &&
          c.size_id === sizeId &&
          (!selectedSchool || c.school_id === selectedSchool.id)
      )?.qty || 0
    );
  };

  // Add Item to active cart
  const handleAddItem = (product: Product, size: SizeItem | null = null, sizeIndex = 0) => {
    if (!selectedSchool) {
      showToast('Please select a school first');
      return;
    }

    const sizeId = size ? size.id : null;
    const sizeLabel = size ? size.label : null;
    const unitPrice = getItemPrice(product, sizeId, sizeIndex);
    const availableStock = getItemStock(product.id, sizeId);

    if (availableStock <= 0) {
      showToast(`${product.name} ${sizeLabel ? `(${sizeLabel})` : ''} is out of stock`);
      return;
    }

    if (shopConfig?.sound_feedback) {
      playBeep('tap');
    }

    setCart(prev => {
      const idx = prev.findIndex(
        item =>
          item.product_id === product.id &&
          item.size_id === sizeId &&
          item.school_id === selectedSchool.id
      );

      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          qty: copy[idx].qty + 1,
        };
        return copy;
      } else {
        return [
          ...prev,
          {
            product_id: product.id,
            product_name: product.name,
            size_id: sizeId,
            size_label: sizeLabel,
            school_id: selectedSchool.id,
            school_code: selectedSchool.code,
            school_name: selectedSchool.name,
            unit_price: unitPrice,
            qty: 1,
            available_stock: availableStock,
          },
        ];
      }
    });

    // 5) Subtle stock warning (not dramatic)
    if (availableStock <= 3 && availableStock > 0) {
      showToast(`Stock notice: ${availableStock} left in ${product.name} ${sizeLabel ? `(${sizeLabel})` : ''}`);
    }
  };

  // Add custom / alteration / misc item
  const handleAddCustomItem = (itemName: string, price: number) => {
    if (!itemName || price <= 0) return;
    const tempId = `custom_${Date.now()}`;
    const schId = selectedSchool ? selectedSchool.id : 'general';
    const schCode = selectedSchool ? selectedSchool.code : 'MISC';
    const schName = selectedSchool ? selectedSchool.name : 'Custom / Misc';

    setCart(prev => [
      ...prev,
      {
        product_id: tempId,
        product_name: itemName,
        size_id: null,
        size_label: 'Misc',
        school_id: schId,
        school_code: schCode,
        school_name: schName,
        unit_price: price,
        qty: 1,
        available_stock: 999,
      },
    ]);
    setShowCustomItemRow(false);
    setCustomItemName('');
    setCustomItemPrice('50');
    if (shopConfig?.sound_feedback) playBeep('tap');
    showToast(`Added "${itemName}" (₹${price})`);
  };

  // Update Cart Item Quantity
  const handleUpdateQty = (index: number, delta: number) => {
    if (shopConfig?.sound_feedback) {
      playBeep('tap');
    }

    setCart(prev => {
      const copy = [...prev];
      const target = copy[index];
      const newQty = target.qty + delta;
      if (newQty <= 0) {
        copy.splice(index, 1);
      } else {
        copy[index] = { ...target, qty: newQty };
      }
      return copy;
    });
  };

  // Remove Cart Item
  const handleRemoveItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // Clear Cart
  const handleClearCart = () => {
    if (cart.length > 0) {
      setCart([]);
      setDiscountVal('');
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
      setSplitAmounts({ cash: '', upi: '', credit: '' });
      showToast('Bill cleared');
    }
  };

  // Calculate Subtotal, Discounts, and Grand Total
  const { subtotal, discountAmount, grandTotal, totalItemsCount } = useMemo(() => {
    const sub = cart.reduce((acc, item) => acc + item.unit_price * item.qty, 0);
    const count = cart.reduce((acc, item) => acc + item.qty, 0);

    const val = parseFloat(discountVal) || 0;
    let disc = 0;
    if (val > 0) {
      if (discountType === 'percent') {
        disc = Math.round((sub * Math.min(val, 100)) / 100);
      } else {
        disc = Math.min(val, sub);
      }
    }

    const total = Math.max(0, sub - disc);
    return {
      subtotal: sub,
      discountAmount: disc,
      grandTotal: total,
      totalItemsCount: count,
    };
  }, [cart, discountVal, discountType]);

  // 1) Park Current Active Bill
  const handleParkCurrentBill = () => {
    if (cart.length === 0) {
      showToast('Cannot park an empty bill');
      return;
    }

    const newParked: ParkedBill = {
      id: `park_${Date.now()}`,
      parked_at: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      cart: [...cart],
      school_id: selectedSchool?.id || null,
      school_code: selectedSchool?.code || null,
      school_name: selectedSchool?.name || null,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      discount_val: discountVal,
      discount_type: discountType,
      notes: notes.trim(),
      total: grandTotal,
    };

    setParkedBills(prev => [newParked, ...prev]);

    // Reset active cart so cashier can immediately serve next customer
    setCart([]);
    setDiscountVal('');
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setSplitAmounts({ cash: '', upi: '', credit: '' });
    setSelectedProductId(null);
    setIsMobileBillOpen(false);

    if (shopConfig?.sound_feedback) playBeep('tap');
    showToast(`Bill parked (${newParked.cart.length} items). Ready for next customer.`);
  };

  // Resume Parked Bill
  const handleResumeParkedBill = (parked: ParkedBill) => {
    if (cart.length > 0) {
      if (!window.confirm('Active bill has items. Replace active bill with the held bill?')) {
        return;
      }
    }

    setCart(parked.cart);
    if (parked.school_id) {
      const sch = schools.find(s => s.id === parked.school_id);
      if (sch) setSelectedSchool(sch);
    }
    setCustomerName(parked.customer_name);
    setCustomerPhone(parked.customer_phone);
    setDiscountVal(parked.discount_val);
    setDiscountType(parked.discount_type);
    setNotes(parked.notes);

    setParkedBills(prev => prev.filter(p => p.id !== parked.id));
    setIsParkedModalOpen(false);

    if (shopConfig?.sound_feedback) playBeep('tap');
    showToast('Held bill resumed!');
  };

  // Discard Parked Bill
  const handleDiscardParkedBill = (id: string) => {
    setParkedBills(prev => prev.filter(p => p.id !== id));
    showToast('Held bill removed');
  };

  // 2) Quick Discount Helpers (clean & un-messy)
  const applyQuickDiscount = (type: 'flat' | 'percent', val: number) => {
    setDiscountType(type);
    setDiscountVal(String(val));
    if (shopConfig?.sound_feedback) playBeep('tap');
  };

  const applyRoundOffDiscount = () => {
    const remainder = subtotal % 10;
    const roundDisc = remainder === 0 ? 10 : remainder;
    setDiscountType('flat');
    setDiscountVal(String(roundDisc));
    if (shopConfig?.sound_feedback) playBeep('tap');
  };

  // Unique schools present in the current cart
  const cartSchools = useMemo(() => {
    const schoolMap = new Map<string, { id: string; code: string; name: string; itemsCount: number; total: number }>();
    for (const item of cart) {
      const existing = schoolMap.get(item.school_id);
      if (existing) {
        existing.itemsCount += item.qty;
        existing.total += item.unit_price * item.qty;
      } else {
        schoolMap.set(item.school_id, {
          id: item.school_id,
          code: item.school_code || 'GEN',
          name: item.school_name || 'General',
          itemsCount: item.qty,
          total: item.unit_price * item.qty,
        });
      }
    }
    return Array.from(schoolMap.values());
  }, [cart]);

  // Group cart items by school
  const groupedCartItems = useMemo(() => {
    const groups: { schoolId: string; schoolCode: string; schoolName: string; items: { item: CartItem; originalIndex: number }[] }[] = [];
    const groupMap = new Map<string, typeof groups[0]>();

    cart.forEach((item, originalIndex) => {
      let g = groupMap.get(item.school_id);
      if (!g) {
        g = {
          schoolId: item.school_id,
          schoolCode: item.school_code || 'GEN',
          schoolName: item.school_name || 'General Uniform',
          items: [],
        };
        groupMap.set(item.school_id, g);
        groups.push(g);
      }
      g.items.push({ item, originalIndex });
    });

    return groups;
  }, [cart]);

  // Auto-fill split payment balance
  const handleAutoFillSplitRemainder = (field: 'cash' | 'upi' | 'credit') => {
    const c = parseFloat(splitAmounts.cash) || 0;
    const u = parseFloat(splitAmounts.upi) || 0;
    const cr = parseFloat(splitAmounts.credit) || 0;

    let otherTotal = 0;
    if (field === 'cash') otherTotal = u + cr;
    if (field === 'upi') otherTotal = c + cr;
    if (field === 'credit') otherTotal = c + u;

    const remainder = Math.max(0, grandTotal - otherTotal);
    setSplitAmounts(prev => ({
      ...prev,
      [field]: remainder > 0 ? String(remainder) : '',
    }));
  };

  // Generate UPI QR Code (for standard modal & Standee Mode)
  useEffect(() => {
    const upiVpa = shopConfig?.upi_id || '9876543210@upi';
    const payeeName = encodeURIComponent(shopConfig?.legal_name || 'SARASWATI GARMENTS');
    const amountToPay = paymentMethod === 'split' ? parseFloat(splitAmounts.upi) || grandTotal : grandTotal;

    if (amountToPay > 0) {
      const upiString = `upi://pay?pa=${upiVpa}&pn=${payeeName}&am=${amountToPay}&cu=INR&tn=Uniform+Bill`;
      QRCode.toDataURL(upiString, { width: 320, margin: 1 })
        .then(url => setUpiQrUrl(url))
        .catch(err => console.error('Failed to generate QR:', err));
    }
  }, [paymentMethod, splitAmounts.upi, grandTotal, shopConfig]);

  // Initialize persistent BroadcastChannel for Customer Display
  useEffect(() => {
    try {
      displayChannelRef.current = new BroadcastChannel('nandalaya_customer_display');
      
      displayChannelRef.current.onmessage = (event: MessageEvent) => {
        if (event.data?.type === 'REQUEST_STATE') {
          // Immediately broadcast current state to newly connected customer screen
          const upiAmountToPay = paymentMethod === 'split' ? parseFloat(splitAmounts.upi) || 0 : grandTotal;
          const payload = {
            shopName: shopConfig?.legal_name || 'SARASWATI GARMENTS',
            upiId: shopConfig?.upi_id || '9876543210@upi',
            studentName: studentNameVal || customerName,
            studentGrade: studentGrade,
            schoolName: selectedSchool?.name,
            cart: cart.map(c => ({
              product_name: c.product_name,
              size_label: c.size_label,
              school_name: c.school_name,
              school_code: c.school_code,
              qty: c.qty,
              unit_price: c.unit_price,
            })),
            subtotal,
            discount: discountAmount,
            grandTotal,
            paymentMethod,
            upiAmount: upiAmountToPay,
            status: cart.length > 0 ? ('active' as const) : ('idle' as const),
            timestamp: Date.now(),
          };
          displayChannelRef.current?.postMessage(payload);
          localStorage.setItem('nandalaya_customer_display_state', JSON.stringify(payload));
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel initialization error:', e);
    }

    return () => {
      if (displayChannelRef.current) {
        displayChannelRef.current.close();
      }
    };
  }, [cart, subtotal, discountAmount, grandTotal, paymentMethod, splitAmounts.upi, studentNameVal, studentGrade, customerName, selectedSchool, shopConfig]);

  // Real-time quad-redundancy sync with Customer-Facing Standee Display
  useEffect(() => {
    const upiAmountToPay = paymentMethod === 'split' ? parseFloat(splitAmounts.upi) || 0 : grandTotal;
    const payload = {
      id: 'active',
      shopName: shopConfig?.legal_name || 'SARASWATI GARMENTS',
      upiId: shopConfig?.upi_id || '9876543210@upi',
      studentName: studentNameVal || customerName,
      studentGrade: studentGrade,
      schoolName: selectedSchool?.name,
      cart: cart.map(c => ({
        product_name: c.product_name,
        size_label: c.size_label,
        school_name: c.school_name,
        school_code: c.school_code,
        qty: c.qty,
        unit_price: c.unit_price,
      })),
      subtotal,
      discount: discountAmount,
      grandTotal,
      paymentMethod,
      upiAmount: upiAmountToPay,
      status: cart.length > 0 ? ('active' as const) : ('idle' as const),
      timestamp: Date.now(),
    };

    // 1. BroadcastChannel
    try {
      if (displayChannelRef.current) {
        displayChannelRef.current.postMessage(payload);
      }
    } catch (err) {
      console.warn('Channel error:', err);
    }

    // 2. LocalStorage
    try {
      localStorage.setItem('nandalaya_customer_display_state', JSON.stringify(payload));
    } catch (err) {
      console.warn('Storage error:', err);
    }

    // 3. IndexedDB
    db.customer_display_state.put(payload).catch(err => {
      console.warn('IndexedDB display state error:', err);
    });

    // 4. Server-side in-memory REST relay (for multi-device / tablet / second screen)
    fetch('/api/customer-display', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(err => {
      // Ignore offline network errors
    });
  }, [cart, subtotal, discountAmount, grandTotal, paymentMethod, splitAmounts.upi, studentNameVal, studentGrade, customerName, selectedSchool, shopConfig]);

  // Open Customer-Facing Display in new window
  const handleOpenCustomerDisplay = () => {
    const url = window.location.origin + window.location.pathname + '?mode=customer_display#customer-display';
    const win = window.open(url, 'NandalayaCustomerDisplay', 'width=1024,height=768,menubar=no,toolbar=no');
    if (!win) {
      // If popup blocker blocked it, show instructions
      showToast('Pop-up was blocked. Please allow popups or navigate to ?mode=customer_display');
    } else {
      showToast('Customer Display launched!');
    }
  };

  // 8) WhatsApp Share Direct Handoff
  const handleDirectWhatsAppShare = () => {
    if (cart.length === 0) {
      showToast('Cannot send WhatsApp slip for an empty bill');
      return;
    }

    const uniqueSchoolNames = Array.from(new Set(cart.map(c => c.school_name).filter(Boolean)));
    const uniqueSchoolIds = Array.from(new Set(cart.map(c => c.school_id).filter(Boolean)));

    const estimateBill: Bill = {
      id: `est_${Date.now()}`,
      bill_number: 'ESTIMATE',
      created_at: new Date().toISOString(),
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      school_id: uniqueSchoolIds.join(', ') || (selectedSchool ? selectedSchool.id : ''),
      school_name: uniqueSchoolNames.join(', ') || (selectedSchool ? selectedSchool.name : 'Counter Sale'),
      schools: uniqueSchoolNames,
      subtotal,
      discount_amount: discountAmount,
      discount_type: discountType,
      total: grandTotal,
      payment_method: paymentMethod,
      payment_details: { [paymentMethod]: grandTotal },
      notes: notes.trim(),
      is_paid: true,
      paid_at: null,
      status: 'completed',
      items: cart.map((c, i) => ({
        id: `est_item_${i}`,
        product_id: c.product_id,
        product_name: c.product_name,
        size_id: c.size_id,
        size_label: c.size_label,
        school_id: c.school_id,
        school_code: c.school_code,
        school_name: c.school_name,
        qty: c.qty,
        unit_price: c.unit_price,
        discount_amount: 0,
        subtotal: c.unit_price * c.qty,
      })),
    };

    const text = generateWhatsAppReceiptText(estimateBill, shopConfig);
    openWhatsAppReceipt(customerPhone, text);
  };

  // Select School Handler
  const handleSelectSchool = (school: School) => {
    setSelectedSchool(school);
    setSelectedProductId(null);
    setShowSchoolPicker(false);
    if (shopConfig?.sound_feedback) playBeep('tap');
  };

  // Save Bill and Print
  const handleSaveAndPrint = async () => {
    if (cart.length === 0) {
      showToast('Cannot save an empty bill. Please add products.');
      return;
    }

    if (paymentMethod === 'split') {
      const c = parseFloat(splitAmounts.cash) || 0;
      const u = parseFloat(splitAmounts.upi) || 0;
      const cr = parseFloat(splitAmounts.credit) || 0;
      const totalEntered = c + u + cr;

      if (Math.abs(totalEntered - grandTotal) > 1) {
        showToast(`Split total (₹${totalEntered}) does not match bill total (₹${grandTotal})`);
        return;
      }
    }

    if (paymentMethod === 'credit' && !customerName && !customerPhone) {
      showToast('Please enter customer name or phone for Credit bills.');
      return;
    }

    setIsSubmitting(true);

    try {
      let nextSeq = 1001;
      if (shopConfig) {
        nextSeq = (shopConfig.bill_sequence || 1000) + 1;
        await db.shop_config.update(shopConfig.id, { bill_sequence: nextSeq });
      }

      const prefix = shopConfig?.bill_prefix || 'SG-2026-';
      const billNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;
      const billId = `bill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();

      const isPaid = paymentMethod !== 'credit' && (paymentMethod !== 'split' || !(parseFloat(splitAmounts.credit) > 0));

      const uniqueSchoolNames = Array.from(new Set(cart.map(c => c.school_name).filter(Boolean)));
      const uniqueSchoolIds = Array.from(new Set(cart.map(c => c.school_id).filter(Boolean)));

      const finalCustomerName = billType === 'b2b'
        ? (buyerName.trim() || (selectedSchool ? selectedSchool.name : 'Institutional Buyer'))
        : customerName.trim();

      const billRecord: Bill = {
        id: billId,
        bill_number: billNumber,
        created_at: nowIso,
        customer_name: finalCustomerName,
        customer_phone: customerPhone.trim(),
        customer_gstin: billType === 'b2b' && buyerGstin.trim() ? buyerGstin.trim().toUpperCase() : undefined,
        customer_address: billType === 'b2b' && buyerAddress.trim() ? buyerAddress.trim() : undefined,
        po_number: billType === 'b2b' && poNumber.trim() ? poNumber.trim() : undefined,
        bill_type: billType,
        school_id: uniqueSchoolIds.join(', ') || (selectedSchool ? selectedSchool.id : ''),
        school_name: uniqueSchoolNames.join(', ') || (selectedSchool ? selectedSchool.name : 'Counter Sale'),
        schools: uniqueSchoolNames,
        subtotal,
        discount_amount: discountAmount,
        discount_type: discountType,
        total: grandTotal,
        payment_method: paymentMethod,
        payment_details: paymentMethod === 'split' ? {
          cash: parseFloat(splitAmounts.cash) || 0,
          upi: parseFloat(splitAmounts.upi) || 0,
          credit: parseFloat(splitAmounts.credit) || 0,
        } : {
          [paymentMethod]: grandTotal,
        },
        notes: notes.trim(),
        is_paid: isPaid,
        paid_at: isPaid ? nowIso : null,
        status: 'completed',
        billed_by_id: currentUser?.id || 'usr_counter',
        billed_by_name: currentUser?.name || 'Counter Staff',
        items: cart.map((c, i) => ({
          id: `bi_${billId}_${i}`,
          product_id: c.product_id,
          product_name: c.product_name,
          size_id: c.size_id,
          size_label: c.size_label,
          school_id: c.school_id,
          school_code: c.school_code,
          school_name: c.school_name,
          qty: c.qty,
          unit_price: c.unit_price,
          discount_amount: 0,
          subtotal: c.unit_price * c.qty,
        })),
      };

      await db.bills.add(billRecord);

      // Async sync to Supabase if connected
      syncBillToSupabase(billRecord).catch(err => {
        console.warn('Background Supabase bill sync error:', err);
      });

      // Decrement inventory stock
      for (const item of cart) {
        const stockKey = `${item.product_id}_${item.size_id || 'free'}`;
        const currentStock = stocksMap.get(stockKey);
        const currentQty = currentStock ? currentStock.quantity : 20;
        const newQty = Math.max(0, currentQty - item.qty);

        if (currentStock) {
          await db.stocks.update(currentStock.id, { quantity: newQty });
        } else {
          await db.stocks.put({
            id: stockKey,
            product_id: item.product_id,
            size_id: item.size_id,
            size_label: item.size_label || 'Free Size',
            quantity: newQty,
            min_stock: 5,
          });
        }

        await db.inventory_movements.add({
          id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          product_id: item.product_id,
          product_name: item.product_name,
          size_label: item.size_label || 'Free',
          type: 'sale',
          qty: -item.qty,
          previous_stock: currentQty,
          new_stock: newQty,
          notes: `Sale Bill ${billNumber}`,
          created_at: nowIso,
          reference_bill_id: billId,
        });
      }

      // Auto-save/update Student Profile & Fit Memory
      const cleanPhone = customerPhone.replace(/\D/g, '');
      if (cleanPhone.length >= 10 && selectedSchool) {
        try {
          const pastSizesMap: Record<string, { size: string; date: string; school_code?: string }> = matchedStudent?.past_sizes || {};
          cart.forEach(c => {
            if (c.size_label) {
              pastSizesMap[c.product_name] = {
                size: c.size_label,
                date: nowIso,
                school_code: c.school_code || selectedSchool.code,
              };
            }
          });

          const studentRecord: StudentProfile = {
            id: matchedStudent?.id || `stu_${cleanPhone}`,
            parent_phone: cleanPhone,
            parent_name: customerName || matchedStudent?.parent_name,
            student_name: studentNameVal || matchedStudent?.student_name || 'Student',
            school_id: selectedSchool.id,
            school_name: selectedSchool.name,
            grade: studentGrade || matchedStudent?.grade,
            house_color: studentHouse || matchedStudent?.house_color,
            past_sizes: pastSizesMap,
            notes: notes || matchedStudent?.notes,
            updated_at: nowIso,
          };

          await db.students.put(studentRecord);
        } catch (stuErr) {
          console.error('Failed to auto-save student fit memory:', stuErr);
        }
      }

      // Reload stocks cache
      const freshStocks = await db.stocks.toArray();
      const freshMap = new Map<string, ProductStock>();
      freshStocks.forEach(s => freshMap.set(s.id, s));
      setStocksMap(freshMap);

      if (shopConfig?.sound_feedback) {
        playBeep('success');
      }

      // Bluetooth print if connected
      if (bluetoothPrinter.isConnected() && shopConfig) {
        try {
          const rawEscPos = generateEscPosReceipt(billRecord, shopConfig);
          await bluetoothPrinter.printData(rawEscPos);
          showToast(`${billNumber} printed via Bluetooth!`);
        } catch (bleErr) {
          console.error('Thermal print error:', bleErr);
          showToast(`${billNumber} saved (Thermal printer busy)`);
        }
      } else {
        showToast(`${billNumber} saved · ₹${grandTotal.toLocaleString('en-IN')}`);
      }

      onBillCreated(billRecord);
      onOpenReceipt(billRecord);

      // Notify Customer Display of successful payment completion
      const completedPayload = {
        shopName: shopConfig?.legal_name || 'SARASWATI GARMENTS',
        upiId: shopConfig?.upi_id || '9876543210@upi',
        studentName: studentNameVal || customerName,
        studentGrade: studentGrade,
        schoolName: selectedSchool?.name,
        cart: [],
        subtotal: 0,
        discount: 0,
        grandTotal: 0,
        paymentMethod,
        upiAmount: 0,
        status: 'completed' as const,
        lastBillNumber: billNumber,
        timestamp: Date.now(),
      };
      try {
        displayChannelRef.current?.postMessage(completedPayload);
        localStorage.setItem('nandalaya_customer_display_state', JSON.stringify(completedPayload));
      } catch (e) {
        console.error('Failed to broadcast completed bill to display:', e);
      }

      // Reset form
      setCart([]);
      setDiscountVal('');
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
      setSplitAmounts({ cash: '', upi: '', credit: '' });
      setSelectedProductId(null);
      setIsMobileBillOpen(false);
      setBuyerName('');
      setBuyerGstin('');
      setBuyerAddress('');
      setPoNumber('');
      setBillType('retail');
    } catch (err) {
      console.error('Failed to save bill:', err);
      showToast('Error saving bill. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const catalogMeta = getCatalogTabMeta(shopConfig?.store_type);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-3">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1D1D1F] text-white px-5 py-2.5 rounded-xl shadow-lg border border-[#333336] font-semibold text-sm flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 3) PERMANENT HOTKEY TOOLBAR */}
      <div className="bg-white border border-[#E5E5E7] rounded-xl px-3 py-1.5 shadow-2xs flex items-center justify-between gap-2 overflow-x-auto text-xs text-[#86868B]">
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-bold text-[10px] uppercase tracking-wider text-[#1D1D1F] hidden sm:inline">
            Hotkeys:
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#F5F5F7] border border-[#E5E5E7] text-[#1D1D1F] text-[10px] font-mono font-bold">F1</kbd>
            <span>Search</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#F5F5F7] border border-[#E5E5E7] text-[#1D1D1F] text-[10px] font-mono font-bold">F2</kbd>
            <span>Save &amp; Print</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#F5F5F7] border border-[#E5E5E7] text-[#1D1D1F] text-[10px] font-mono font-bold">P</kbd>
            <span>Park Bill</span>
          </span>
          <span className="hidden md:flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#F5F5F7] border border-[#E5E5E7] text-[#1D1D1F] text-[10px] font-mono font-bold">1–5</kbd>
            <span>Pay Mode</span>
          </span>
          <span className="hidden lg:flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#F5F5F7] border border-[#E5E5E7] text-[#1D1D1F] text-[10px] font-mono font-bold">Esc</kbd>
            <span>Close</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Barcode & Price Tag Sticker Generator */}
          <button
            onClick={() => setIsBarcodeModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] text-xs font-semibold hover:bg-[#E5E5E7] transition-colors shrink-0 cursor-pointer"
            title="Generate & Print 50x25mm Barcode Stickers"
          >
            <Barcode className="w-3.5 h-3.5 text-[#86868B]" />
            <span>Barcodes</span>
          </button>

          {/* Advance & Alterations Desk */}
          <button
            onClick={() => setIsAlterationModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] text-xs font-semibold hover:bg-[#E5E5E7] transition-colors shrink-0 cursor-pointer"
            title="Tailoring, Alterations & Advance Orders"
          >
            <Scissors className="w-3.5 h-3.5 text-[#86868B]" />
            <span>Alterations</span>
          </button>

          {/* Customer-Facing Standee Display Launcher */}
          <button
            onClick={handleOpenCustomerDisplay}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] text-xs font-semibold hover:bg-[#E5E5E7] transition-colors shrink-0 cursor-pointer"
            title="Launch live customer-facing display for secondary screen / tablet"
          >
            <Monitor className="w-3.5 h-3.5 text-[#1D1D1F]" />
            <span>Customer Screen</span>
          </button>

          {/* Size Exchange Desk Button */}
          <button
            onClick={() => setIsExchangeModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] text-xs font-semibold hover:bg-[#E5E5E7] transition-colors shrink-0 cursor-pointer"
            title="Size Exchange / Return Desk"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#1D1D1F]" />
            <span>Exchange</span>
          </button>

          {/* 1) Parked Bills Indicator */}
          {parkedBills.length > 0 && (
            <button
              onClick={() => setIsParkedModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] text-xs font-bold hover:bg-[#E8E8ED] transition-colors shrink-0"
              title="View held bills"
            >
              <PauseCircle className="w-3.5 h-3.5 text-[#1D1D1F]" />
              <span>{parkedBills.length} Held {parkedBills.length === 1 ? 'Bill' : 'Bills'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: School Selection + Products & Size Matrix */}
        <div className="lg:col-span-8 flex flex-col gap-4">

          {/* STEP 1: School Selection Strip / Card */}
          <section className="bg-white rounded-2xl border border-[#E5E5E7] p-4 sm:p-5 shadow-2xs transition-all duration-200">
            {!selectedSchool || showSchoolPicker ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#1D1D1F] text-white font-bold text-xs flex items-center justify-center">
                      1
                    </span>
                    <h2 className="font-bold text-base text-[#1D1D1F] dark:text-zinc-100">
                      {selectedSchool ? catalogMeta.switchLabel : catalogMeta.selectorLabel}
                    </h2>
                    {selectedSchool && (
                      <span className="text-xs text-[#86868B]">
                        (Selected: <strong className="text-[#1D1D1F] dark:text-zinc-200">{selectedSchool.code}</strong>)
                      </span>
                    )}
                  </div>

                  {/* School Search Input */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="w-4 h-4 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={schoolQuery}
                        onChange={e => setSchoolQuery(e.target.value)}
                        placeholder={catalogMeta.searchPlaceholder}
                        className="w-full h-9 pl-9 pr-7 rounded-xl border border-[#E5E5E7] dark:border-zinc-700 text-xs font-semibold focus:outline-none focus:border-[#1D1D1F] bg-[#F5F5F7] dark:bg-zinc-800 text-zinc-950 dark:text-white"
                      />
                      {schoolQuery && (
                        <button
                          onClick={() => setSchoolQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {selectedSchool && (
                      <button
                        type="button"
                        onClick={() => setShowSchoolPicker(false)}
                        className="h-9 px-3 rounded-xl border border-[#E5E5E7] text-[#515154] hover:bg-[#F5F5F7] text-xs font-semibold cursor-pointer"
                        title="Close picker"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* School Filter Chips */}
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1 pt-1">
                  {filteredSchools.map(sch => {
                    const isSelected = selectedSchool?.id === sch.id;
                    const hasItemsInCart = cart.some(c => c.school_id === sch.id);
                    return (
                      <button
                        key={sch.id}
                        onClick={() => handleSelectSchool(sch)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-xs'
                            : 'bg-white text-[#1D1D1F] border-[#E5E5E7] hover:border-[#D2D2D7] hover:bg-[#F5F5F7]'
                        }`}
                      >
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-[#E8E8ED] text-[#1D1D1F]'}`}>
                          {sch.code}
                        </span>
                        <span className="truncate max-w-[150px] sm:max-w-none">{sch.name}</span>
                        {hasItemsInCart && (
                          <span className="w-2 h-2 rounded-full bg-[#0071E3]" title="Has items in active bill" />
                        )}
                      </button>
                    );
                  })}
                  {filteredSchools.length === 0 && (
                    <div className="text-xs text-[#86868B] py-2">No schools found matching "{schoolQuery}"</div>
                  )}
                </div>
              </div>
            ) : (
              /* Compact Active School Bar when a school is selected */
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#1D1D1F] text-white font-bold text-xs flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] uppercase font-bold text-[#86868B]">School:</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#E8E8ED] text-[#1D1D1F] font-bold text-xs">
                          {selectedSchool.code}
                        </span>
                      </div>
                      <h2 className="font-bold text-base text-[#1D1D1F] leading-tight">
                        {selectedSchool.name}
                      </h2>
                    </div>
                  </div>
                </div>

                {/* Quick School Switcher Pills for Multi-School Billing */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <span className="text-xs font-semibold text-[#86868B] shrink-0 mr-0.5 hidden md:inline">
                    Quick Switch:
                  </span>
                  {schools.slice(0, 5).map(sch => {
                    const isCurrent = selectedSchool.id === sch.id;
                    const hasItems = cart.some(c => c.school_id === sch.id);
                    return (
                      <button
                        key={sch.id}
                        onClick={() => handleSelectSchool(sch)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border shrink-0 cursor-pointer ${
                          isCurrent
                            ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-xs'
                            : hasItems
                            ? 'bg-[#E8E8ED] text-[#1D1D1F] border-[#D2D2D7]'
                            : 'bg-white text-[#1D1D1F] border-[#E5E5E7] hover:border-[#D2D2D7] hover:bg-[#F5F5F7]'
                        }`}
                        title={`Switch catalog to ${sch.name}`}
                      >
                        <span>{sch.code}</span>
                        {hasItems && !isCurrent && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" />
                        )}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setShowSchoolPicker(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED] text-xs font-semibold border border-[#E5E5E7] shrink-0 cursor-pointer"
                    title="View all schools"
                  >
                    <ArrowRightLeft className="w-3 h-3 text-[#515154]" />
                    <span>Change School</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* STEP 2: Products & Instant Size Matrix */}
          {selectedSchool ? (
            <section 
              key={selectedSchool.id}
              className="bg-white rounded-2xl border border-[#E5E5E7] p-4 sm:p-5 shadow-2xs animate-in fade-in slide-in-from-top-4 duration-300"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#1D1D1F] text-white font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <h2 className="font-bold text-base text-[#1D1D1F]">
                      Uniforms for {selectedSchool.name}
                    </h2>
                    <span className="text-[11px] text-[#86868B]">
                      Tap product, then select size to add directly
                    </span>
                  </div>
                </div>

                {/* Product Search */}
                <div className="flex items-center gap-2">
                  <div className="relative w-52 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={productQuery}
                      onChange={e => setProductQuery(e.target.value)}
                      placeholder="Search item (Shirt, Pant...)"
                      className="w-full h-8 pl-8 pr-6 rounded-lg border border-[#E5E5E7] text-xs font-semibold focus:outline-none focus:border-[#1D1D1F] bg-[#F5F5F7]"
                    />
                    {productQuery && (
                      <button
                        onClick={() => setProductQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Category Segmented Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                      : 'bg-[#F5F5F7] text-[#515154] border-[#E5E5E7] hover:text-[#1D1D1F]'
                  }`}
                >
                  All Items
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                      selectedCategory.toLowerCase() === cat.id.toLowerCase()
                        ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                        : 'bg-[#F5F5F7] text-[#515154] border-[#E5E5E7] hover:text-[#1D1D1F]'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredProducts.map(prod => {
                  const countInCart = getProductCartCount(prod.id);
                  const isSelected = selectedProductId === prod.id;
                  const isFreeSize = !prod.size_group_id;
                  const basePrice = getItemPrice(prod, null);

                  return (
                    <button
                      key={prod.id}
                      onClick={() => {
                        if (isFreeSize) {
                          handleAddItem(prod, null);
                        } else {
                          setSelectedProductId(isSelected ? null : prod.id);
                        }
                      }}
                      className={`relative text-left p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between min-h-[88px] active:scale-[0.98] cursor-pointer ${
                        isSelected
                          ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-sm'
                          : 'bg-white text-[#1D1D1F] border-[#E5E5E7] hover:border-[#D2D2D7] hover:shadow-xs'
                      }`}
                    >
                      {countInCart > 0 && (
                        <span className="absolute -top-2 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#1D1D1F] text-white text-[11px] font-bold flex items-center justify-center border-2 border-white shadow-xs">
                          {countInCart}
                        </span>
                      )}

                      <div className="font-bold text-xs sm:text-sm leading-snug">
                        {prod.name}
                      </div>

                      {/* 4) Tabular Mono Numbers for Rates */}
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className={`text-[11px] font-mono tabular-nums font-semibold ${isSelected ? 'text-white/80' : 'text-[#86868B]'}`}>
                          {isFreeSize ? `₹${basePrice}` : 'Choose size'}
                        </span>
                        {isFreeSize && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-[#F5F5F7] text-[#1D1D1F]'}`}>
                            + Add
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* INLINE SIZE EXPANSION DRAWER */}
              {activeProduct && activeProduct.size_group_id && (
                <div className="mt-4 p-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#1D1D1F]">
                        {activeProduct.name} — Select Size
                      </span>
                      <span className="text-xs text-[#86868B] hidden sm:inline">
                        (for {selectedSchool.code})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setProductForMultiRates(activeProduct)}
                        className="text-xs text-[#0071E3] font-semibold hover:underline flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#E5E5E7]"
                        title="Edit multiple sizes and rates for this product"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Edit Rates &amp; Sizes</span>
                      </button>
                      <button
                        onClick={() => setSelectedProductId(null)}
                        className="text-[#86868B] hover:text-[#1D1D1F] p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Size Matrix Buttons with 4) Mono Numbers & 5) Visual Stock Warning */}
                  <div className="flex flex-wrap gap-2.5">
                    {activeProductSizes.map((sz, idx) => {
                      const price = getItemPrice(activeProduct, sz.id, idx);
                      const stock = getItemStock(activeProduct.id, sz.id);
                      const qtyInCart = getSizeCartCount(activeProduct.id, sz.id);
                      const isOutOfStock = stock <= 0;
                      const isLowStock = stock > 0 && stock <= 5;

                      return (
                        <button
                          key={sz.id}
                          disabled={isOutOfStock}
                          onClick={() => handleAddItem(activeProduct, sz, idx)}
                          className={`relative min-w-[78px] p-2.5 rounded-xl border text-center transition-transform active:scale-95 cursor-pointer ${
                            qtyInCart > 0
                              ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-xs'
                              : isOutOfStock
                              ? 'bg-[#F5F5F7] text-[#86868B] border-[#E5E5E7] cursor-not-allowed opacity-60'
                              : isLowStock
                              ? 'bg-amber-50/70 border-amber-200/90 text-[#1D1D1F] hover:border-amber-400'
                              : 'bg-white text-[#1D1D1F] border-[#E5E5E7] hover:border-[#1D1D1F] hover:bg-[#F5F5F7]'
                          }`}
                        >
                          <div className="font-bold text-base leading-none">
                            {sz.label}
                          </div>
                          
                          {/* Tabular Mono Rate */}
                          <div className={`text-xs font-mono tabular-nums font-semibold mt-1 ${qtyInCart > 0 ? 'text-white/80' : 'text-[#1D1D1F]'}`}>
                            ₹{price}
                          </div>

                          {/* 5) Subtle Stock Warning Indicator */}
                          <div className="text-[10px] mt-0.5">
                            {qtyInCart > 0 ? (
                              <span className="font-bold underline">Qty: {qtyInCart}</span>
                            ) : isOutOfStock ? (
                              <span className="text-[#86868B] font-semibold">Out</span>
                            ) : isLowStock ? (
                              <span className="text-amber-800 font-semibold px-1 py-0.2 rounded bg-amber-100/60">
                                Low: {stock}
                              </span>
                            ) : (
                              <span className="text-[#86868B] font-mono tabular-nums">Stk: {stock}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          ) : (
            /* Guide placeholder when no school is selected yet */
            <div className="bg-white rounded-2xl border border-dashed border-[#E5E5E7] p-8 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] text-[#1D1D1F] flex items-center justify-center mb-3">
                <SchoolIcon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-[#1D1D1F]">
                Select a school to display uniform catalog
              </h3>
              <p className="text-xs text-[#86868B] max-w-sm mt-1">
                Choose the school above to view its uniforms, sizes, and price book. You can add items for multiple schools in the same bill!
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Sticky Bill Slip / Receipt Builder */}
        <div className={`lg:col-span-4 ${isMobileBillOpen ? 'fixed inset-0 z-50 bg-black/40 backdrop-blur-xs p-3 sm:p-4 flex flex-col justify-end lg:static lg:bg-transparent lg:p-0' : 'hidden lg:flex flex-col gap-3 sticky top-20'}`}>
          <aside className="bg-white rounded-2xl border border-[#E5E5E7] p-3 sm:p-4 shadow-xl lg:shadow-xs flex flex-col gap-2.5 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 lg:animate-none">
            
            {/* Bill Header & Held Bills Action */}
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E7]">
              <div>
                <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                  Bill Slip
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <h3 className="font-bold text-sm sm:text-base text-[#1D1D1F] truncate max-w-[190px]">
                    {cartSchools.length > 1
                      ? 'Multi-School Bill'
                      : cartSchools.length === 1
                      ? cartSchools[0].name
                      : selectedSchool
                      ? selectedSchool.name
                      : 'Counter Bill'}
                  </h3>
                  {cartSchools.length > 1 && (
                    <span className="px-1.5 py-0.2 rounded-md bg-[#F5F5F7] border border-[#E5E5E7] text-[#1D1D1F] font-semibold text-[10px]">
                      {cartSchools.length} Schools
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#1D1D1F] bg-[#F5F5F7] px-2 py-0.5 rounded-md border border-[#E5E5E7] font-mono tabular-nums">
                  {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
                </span>
                {isMobileBillOpen && (
                  <button
                    onClick={() => setIsMobileBillOpen(false)}
                    className="lg:hidden text-[#86868B] hover:text-[#1D1D1F] p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Bill Items List (Always visible, clean, compact) */}
            <div className="flex flex-col gap-1.5 min-h-[80px] max-h-[190px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-6 text-center text-[#86868B] flex flex-col items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-[#F5F5F7] flex items-center justify-center text-[#86868B] mb-1.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-semibold text-[#1D1D1F]">Bill is empty</p>
                  <p className="text-[10px] text-[#86868B] mt-0.5">Select a school and tap sizes to add</p>
                </div>
              ) : (
                groupedCartItems.map(group => (
                  <div key={group.schoolId} className="space-y-1">
                    {/* School Subheader if multi-school */}
                    {cartSchools.length > 1 && (
                      <div className="flex items-center justify-between text-[10px] font-bold text-[#1D1D1F] bg-[#F5F5F7] px-2 py-0.5 rounded-md border border-[#E5E5E7] shadow-2xs">
                        <span className="flex items-center gap-1">
                          <span className="bg-[#1D1D1F] text-white px-1 py-0.2 rounded text-[9px] font-mono">
                            {group.schoolCode}
                          </span>
                          <span className="truncate max-w-[140px]">{group.schoolName}</span>
                        </span>
                        <span className="font-mono tabular-nums text-[#1D1D1F]">
                          {group.items.reduce((acc, it) => acc + it.item.qty, 0)} pcs
                        </span>
                      </div>
                    )}

                    {/* School Items */}
                    {group.items.map(({ item, originalIndex }) => (
                      <div
                        key={`${item.school_id}_${item.product_id}_${item.size_id || 'free'}`}
                        className="flex items-center justify-between gap-1.5 py-1 px-2 rounded-lg border border-[#E5E5E7] bg-white hover:bg-[#F5F5F7] shadow-2xs transition-all text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-xs text-[#1D1D1F] truncate flex items-center gap-1">
                            {cartSchools.length === 1 && item.school_code && (
                              <span className="text-[9px] font-bold text-[#1D1D1F] bg-[#F5F5F7] border border-[#E5E5E7] px-1 py-0.2 rounded">
                                {item.school_code}
                              </span>
                            )}
                            <span className="truncate">{item.product_name}</span>
                          </div>
                          <div className="text-[10px] text-[#86868B] flex items-center gap-1">
                            {item.size_label && (
                              <span className="font-semibold text-[#1D1D1F]">
                                Size {item.size_label}
                              </span>
                            )}
                            <span>·</span>
                            <span className="font-mono tabular-nums">₹{item.unit_price}</span>
                          </div>
                        </div>

                        {/* Quantity Selector */}
                        <div className="flex items-center gap-0.5 bg-[#F5F5F7] border border-[#E5E5E7] rounded-md p-0.5">
                          <button
                            onClick={() => handleUpdateQty(originalIndex, -1)}
                            className="w-4 h-4 rounded flex items-center justify-center text-[#1D1D1F] hover:bg-[#E5E5E7] font-bold text-xs"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="w-4 text-center font-mono font-bold text-xs text-[#1D1D1F] tabular-nums">
                            {item.qty}
                          </span>
                          <button
                            onClick={() => handleUpdateQty(originalIndex, 1)}
                            className="w-4 h-4 rounded flex items-center justify-center text-[#1D1D1F] hover:bg-[#E5E5E7] font-bold text-xs"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        {/* Line Total in Tabular Mono */}
                        <div className="text-right min-w-[44px]">
                          <div className="font-mono font-bold text-xs text-[#1D1D1F] tabular-nums">
                            ₹{item.unit_price * item.qty}
                          </div>
                        </div>

                        {/* Delete Item */}
                        <button
                          onClick={() => handleRemoveItem(originalIndex)}
                          className="text-[#86868B] hover:text-red-600 p-0.5"
                          title="Remove item"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Custom Charge / Alteration / Tailoring toggle */}
            <div className="pt-0.5">
              {!showCustomItemRow ? (
                <button
                  type="button"
                  onClick={() => setShowCustomItemRow(true)}
                  className="w-full py-1.5 px-3 rounded-lg bg-[#F5F5F7] hover:bg-[#E5E5E7] text-[#1D1D1F] font-semibold text-xs border border-dashed border-[#E5E5E7] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Alteration / Custom Charge</span>
                </button>
              ) : (
                <div className="p-2.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] flex flex-col gap-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#1D1D1F]">
                    <span>Custom / Alteration Item</span>
                    <button
                      type="button"
                      onClick={() => setShowCustomItemRow(false)}
                      className="text-[#86868B] hover:text-[#1D1D1F]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={customItemName}
                      onChange={e => setCustomItemName(e.target.value)}
                      placeholder="e.g. Alteration, Monogram"
                      className="flex-1 h-8 px-2 rounded-lg border border-[#E5E5E7] text-xs font-semibold bg-white focus:outline-none"
                    />
                    <div className="flex items-center bg-white border border-[#E5E5E7] rounded-lg px-1.5 w-20">
                      <span className="text-[11px] text-[#86868B]">₹</span>
                      <input
                        type="number"
                        min="1"
                        value={customItemPrice}
                        onChange={e => setCustomItemPrice(e.target.value)}
                        placeholder="50"
                        className="w-full h-8 px-1 text-xs font-mono font-bold focus:outline-none bg-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {[
                      { l: 'Alteration ₹50', n: 'Uniform Alteration', p: 50 },
                      { l: 'Monogram ₹30', n: 'Embroidery Monogram', p: 30 },
                      { l: 'Tailoring ₹100', n: 'Custom Tailoring', p: 100 },
                    ].map(preset => (
                      <button
                        type="button"
                        key={preset.l}
                        onClick={() => handleAddCustomItem(preset.n, preset.p)}
                        className="px-2 py-0.5 rounded bg-white hover:bg-[#E5E5E7] text-[10px] font-semibold text-[#1D1D1F] border border-[#E5E5E7] cursor-pointer"
                      >
                        {preset.l}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        handleAddCustomItem(
                          customItemName || 'Custom Item',
                          parseFloat(customItemPrice) || 50
                        )
                      }
                      className="ml-auto px-2.5 py-0.5 rounded bg-[#1D1D1F] text-white text-xs font-semibold cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method Selector with 7) Standee QR button */}
            <div className="pt-2 border-t border-[#E5E5E7]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[#1D1D1F] flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-[#1D1D1F] text-white text-[10px] font-bold flex items-center justify-center">
                    3
                  </span>
                  Payment Mode
                </span>
                
                {paymentMethod === 'upi' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowUpiModal(true)}
                      className="text-xs text-[#1D1D1F] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-[#F5F5F7] border border-transparent hover:border-[#E5E5E7] transition-colors cursor-pointer"
                      title="Quick QR Preview on Cashier Screen"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Preview QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTabletFlipped(false);
                        setShowStandeeQrModal(true);
                      }}
                      className="text-xs font-semibold text-white bg-[#1D1D1F] hover:bg-black px-2.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      title="Flip / Show Full-Screen QR on Tablet for Customer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Flip to Pay</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 5 Payment Methods */}
              <div className="grid grid-cols-5 gap-1 bg-[#F5F5F7] p-1 rounded-xl border border-[#E5E5E7]">
                {(['cash', 'upi', 'card', 'credit', 'split'] as PaymentMethod[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setPaymentMethod(mode)}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      paymentMethod === mode
                        ? 'bg-[#1D1D1F] text-white shadow-xs'
                        : 'text-[#86868B] hover:text-[#1D1D1F]'
                    }`}
                  >
                    {mode === 'upi' ? 'UPI' : mode === 'cash' ? 'Cash' : mode === 'card' ? 'Card' : mode === 'credit' ? 'Credit' : 'Split'}
                  </button>
                ))}
              </div>

              {/* Split Payment inputs if 'split' selected - Ultra-compact, space-efficient */}
              {paymentMethod === 'split' && (() => {
                const cVal = parseFloat(splitAmounts.cash) || 0;
                const uVal = parseFloat(splitAmounts.upi) || 0;
                const crVal = parseFloat(splitAmounts.credit) || 0;
                const allocated = cVal + uVal + crVal;
                const diff = grandTotal - allocated;
                const isBalanced = grandTotal > 0 && Math.abs(diff) < 0.01;

                return (
                  <div className="mt-1.5 p-2 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] flex flex-col gap-2 text-xs animate-in fade-in duration-100">
                    {/* Slim Header & Balance status */}
                    <div className="flex items-center justify-between text-xs font-semibold text-[#1D1D1F]">
                      <span>Split Breakdown</span>
                      {grandTotal > 0 && (
                        isBalanced ? (
                          <span className="text-xs font-semibold text-[#1D1D1F] bg-white px-2 py-0.5 rounded border border-[#E5E5E7] font-mono flex items-center gap-1">
                            <Check className="w-3 h-3 text-[#34C759]" />
                            <span>Balanced (₹{grandTotal})</span>
                          </span>
                        ) : diff > 0 ? (
                          <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 font-mono">
                            ₹{diff} left
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-300 font-mono">
                            +₹{Math.abs(diff)} excess
                          </span>
                        )
                      )}
                    </div>

                    {/* 3 Slim Horizontal Inputs Grid */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {/* Cash */}
                      <div className="bg-white rounded-lg p-1.5 border border-[#E5E5E7] flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-[#1D1D1F] px-0.5">
                          <span>Cash</span>
                          <button
                            type="button"
                            onClick={() => handleAutoFillSplitRemainder('cash')}
                            className="text-xs text-[#0071E3] hover:underline font-semibold"
                          >
                            Auto
                          </button>
                        </div>
                        <div className="flex items-center bg-[#F5F5F7] rounded px-1.5 py-1 border border-[#E5E5E7]">
                          <span className="text-xs text-[#86868B] font-mono font-bold mr-1">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={splitAmounts.cash}
                            onChange={e => setSplitAmounts(prev => ({ ...prev, cash: e.target.value }))}
                            placeholder="0"
                            className="w-full text-sm font-mono font-bold text-[#1D1D1F] bg-transparent focus:outline-none tabular-nums"
                          />
                        </div>
                      </div>

                      {/* UPI */}
                      <div className="bg-white rounded-lg p-1.5 border border-[#E5E5E7] flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-[#1D1D1F] px-0.5">
                          <span>UPI</span>
                          <button
                            type="button"
                            onClick={() => handleAutoFillSplitRemainder('upi')}
                            className="text-xs text-[#0071E3] hover:underline font-semibold"
                          >
                            Auto
                          </button>
                        </div>
                        <div className="flex items-center bg-[#F5F5F7] rounded px-1.5 py-1 border border-[#E5E5E7]">
                          <span className="text-xs text-[#86868B] font-mono font-bold mr-1">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={splitAmounts.upi}
                            onChange={e => setSplitAmounts(prev => ({ ...prev, upi: e.target.value }))}
                            placeholder="0"
                            className="w-full text-sm font-mono font-bold text-[#1D1D1F] bg-transparent focus:outline-none tabular-nums"
                          />
                        </div>
                      </div>

                      {/* Credit */}
                      <div className="bg-white rounded-lg p-1.5 border border-[#E5E5E7] flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-[#1D1D1F] px-0.5">
                          <span>Credit</span>
                          <button
                            type="button"
                            onClick={() => handleAutoFillSplitRemainder('credit')}
                            className="text-xs text-[#0071E3] hover:underline font-semibold"
                          >
                            Auto
                          </button>
                        </div>
                        <div className="flex items-center bg-[#F5F5F7] rounded px-1.5 py-1 border border-[#E5E5E7]">
                          <span className="text-xs text-[#86868B] font-mono font-bold mr-1">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={splitAmounts.credit}
                            onChange={e => setSplitAmounts(prev => ({ ...prev, credit: e.target.value }))}
                            placeholder="0"
                            className="w-full text-sm font-mono font-bold text-[#1D1D1F] bg-transparent focus:outline-none tabular-nums"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Slim Dynamic UPI QR chip if UPI > 0 */}
                    {uVal > 0 && (
                      <div className="flex items-center justify-between p-1.5 px-2 bg-white rounded-lg border border-[#E5E5E7] shadow-2xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <QrCode className="w-4 h-4 text-[#1D1D1F] shrink-0" />
                          <span className="text-xs font-bold text-[#1D1D1F] truncate">
                            UPI: <strong className="font-mono text-sm text-[#1D1D1F]">₹{uVal}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowUpiModal(true)}
                            className="px-2.5 py-1 rounded bg-[#F5F5F7] hover:bg-[#E5E5E7] text-[#1D1D1F] font-semibold text-xs border border-[#E5E5E7] transition-colors cursor-pointer"
                          >
                            QR
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowStandeeQrModal(true)}
                            className="px-2.5 py-1 rounded bg-[#1D1D1F] hover:bg-black text-white font-semibold text-xs transition-colors cursor-pointer"
                          >
                            Standee
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 2) Quick Discount Row & Customer Input */}
            <div className="space-y-2 pt-1 border-t border-[#E5E5E7]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-[#86868B] block mb-1">
                    Discount
                  </label>
                  <div className="flex items-center rounded-lg border border-[#E5E5E7] bg-white overflow-hidden">
                    <input
                      type="number"
                      min="0"
                      value={discountVal}
                      onChange={e => setDiscountVal(e.target.value)}
                      placeholder="0"
                      className="w-full h-8 px-2 text-xs font-mono font-bold text-[#1D1D1F] focus:outline-none"
                    />
                    <button
                      onClick={() => setDiscountType(prev => (prev === 'flat' ? 'percent' : 'flat'))}
                      className="px-2 h-8 bg-[#F5F5F7] text-xs font-bold text-[#1D1D1F] border-l border-[#E5E5E7] hover:bg-[#E5E5E7] cursor-pointer"
                      title="Toggle ₹ Flat or % Percent discount"
                    >
                      {discountType === 'flat' ? '₹' : '%'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#86868B] block mb-1">
                    Customer Phone
                  </label>

                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-mono text-[#86868B]">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="10-digit number"
                      className="w-full h-8 pl-9 pr-7 rounded-lg border border-[#E5E5E7] text-xs font-mono font-semibold text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#0071E3]"
                    />
                    {customerPhone.length >= 10 && (
                      <button
                        type="button"
                        onClick={handleDirectWhatsAppShare}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#0071E3] hover:text-[#0071E3]/80"
                        title="Open WhatsApp slip immediately"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Bill Category Switcher: Retail (B2C) vs Institutional B2B Supply */}
              <div className="pt-2.5 border-t border-[#E5E5E7] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#1D1D1F] flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#1D1D1F]" />
                    <span>Bill Category</span>
                  </span>
                  <span className="text-[10px] font-semibold text-[#86868B]">
                    {billType === 'retail' ? 'Individual Receipt' : 'A4 Tax Invoice'}
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-[#F5F5F7] p-1 rounded-xl border border-[#E5E5E7]">
                  <button
                    type="button"
                    onClick={() => setBillType('retail')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      billType === 'retail'
                        ? 'bg-[#1D1D1F] text-white shadow-xs'
                        : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/60'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Retail (B2C)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBillType('b2b');
                      if (!buyerName && selectedSchool) {
                        setBuyerName(selectedSchool.name);
                      }
                    }}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      billType === 'b2b'
                        ? 'bg-[#1D1D1F] text-white shadow-xs'
                        : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/60'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>B2B / Institution</span>
                  </button>
                </div>

                {/* If Retail (B2C), simple customer name input */}
                {billType === 'retail' && (
                  <div>
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Customer / Parent Name (optional)"
                      className="w-full h-8 px-2.5 rounded-lg border border-[#E5E5E7] text-xs font-semibold text-[#1D1D1F] bg-white focus:outline-none focus:ring-1 focus:ring-[#0071E3]"
                    />
                  </div>
                )}

                {/* If B2B / Institutional Supply, full buyer credentials card for A4 Sheet */}
                {billType === 'b2b' && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-[11px] font-bold text-black">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-slate-800" />
                        <span>Institutional Buyer (A4 Invoice Credentials)</span>
                      </span>
                      {selectedSchool && buyerName !== selectedSchool.name && (
                        <button
                          type="button"
                          onClick={() => setBuyerName(selectedSchool.name)}
                          className="text-[10px] text-[#0071E3] font-semibold hover:underline cursor-pointer"
                        >
                          Use "{selectedSchool.name}"
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                          Buyer / School / Entity Name *
                        </label>
                        <input
                          type="text"
                          value={buyerName}
                          onChange={e => setBuyerName(e.target.value)}
                          placeholder={selectedSchool ? selectedSchool.name : "e.g. St. Xavier's High School / Apex Uniforms"}
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                            Buyer GSTIN / UIN
                          </label>
                          <input
                            type="text"
                            maxLength={15}
                            value={buyerGstin}
                            onChange={e => setBuyerGstin(e.target.value.toUpperCase())}
                            placeholder="e.g. 08AAAAA0000A1Z5 (or Unregistered)"
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black uppercase"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                            P.O. / Work Order Ref Number
                          </label>
                          <input
                            type="text"
                            value={poNumber}
                            onChange={e => setPoNumber(e.target.value)}
                            placeholder="e.g. PO/2026/0412"
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-semibold text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                          Billing Address
                        </label>
                        <input
                          type="text"
                          value={buyerAddress}
                          onChange={e => setBuyerAddress(e.target.value)}
                          placeholder="e.g. Campus Road, Institutional Area, Sector 4"
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Student Fit Memory & House Color Assistant */}
              {customerPhone.length >= 10 && (
                <div className="p-2.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-[#1D1D1F]" />
                      <span className="text-xs font-bold text-[#1D1D1F]">
                        {matchedStudent ? `${matchedStudent.student_name} (${matchedStudent.grade || 'Student'})` : 'Student & House Fit Memory'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowStudentDetails(prev => !prev)}
                      className="text-[11px] font-semibold text-[#0071E3] hover:underline"
                    >
                      {showStudentDetails ? 'Hide' : matchedStudent ? 'Edit Fit' : '+ Add Details'}
                    </button>
                  </div>

                  {/* Past Fit Memory Pill Suggestions */}
                  {matchedStudent?.past_sizes && Object.keys(matchedStudent.past_sizes).length > 0 && !showStudentDetails && (
                    <div className="text-[11px] text-[#86868B] space-y-1 pt-1 border-t border-[#E5E5E7]">
                      <span className="font-semibold text-[#1D1D1F] block">Previous Fit History:</span>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(matchedStudent.past_sizes).map(([prod, rec]) => (
                          <span key={prod} className="px-1.5 py-0.5 rounded bg-white border border-[#E5E5E7] text-[10px] font-semibold text-[#1D1D1F]">
                            {prod}: <strong>Size {rec.size}</strong>
                          </span>
                        ))}
                      </div>
                      {matchedStudent.house_color && (
                        <div className="text-[10px] font-semibold text-[#1D1D1F] mt-1">
                          House: <span className="underline">{matchedStudent.house_color}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expandable Student Edit Form */}
                  {showStudentDetails && (
                    <div className="pt-2 border-t border-[#E5E5E7] grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-[#86868B] block mb-0.5">Student Name</label>
                        <input
                          type="text"
                          value={studentNameVal}
                          onChange={e => setStudentNameVal(e.target.value)}
                          placeholder="e.g. Aryan"
                          className="w-full h-7 px-2 rounded-lg border border-[#E5E5E7] text-xs font-semibold bg-white text-[#1D1D1F]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-[#86868B] block mb-0.5">Grade / Class</label>
                        <input
                          type="text"
                          value={studentGrade}
                          onChange={e => setStudentGrade(e.target.value)}
                          placeholder="Grade 6-B"
                          className="w-full h-7 px-2 rounded-lg border border-[#E5E5E7] text-xs font-semibold bg-white text-[#1D1D1F]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-[#86868B] block mb-0.5">House Color</label>
                        <select
                          value={studentHouse}
                          onChange={e => setStudentHouse(e.target.value)}
                          className="w-full h-7 px-2 rounded-lg border border-[#E5E5E7] text-xs font-semibold bg-white text-[#1D1D1F]"
                        >
                          <option value="">None</option>
                          <option value="Red House">Red House</option>
                          <option value="Blue House">Blue House</option>
                          <option value="Green House">Green House</option>
                          <option value="Yellow House">Yellow House</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2) Quick Discount Buttons (clean, compact, un-messy) */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] font-semibold text-[#86868B] mr-1">Quick:</span>
                <button
                  type="button"
                  onClick={applyRoundOffDiscount}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold border border-[#E5E5E7] text-[#1D1D1F] bg-white hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                  title="Round down bill to nearest ₹10"
                >
                  Round ₹10
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickDiscount('flat', 50)}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold border border-[#E5E5E7] text-[#1D1D1F] bg-white hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                >
                  −₹50
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickDiscount('flat', 100)}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold border border-[#E5E5E7] text-[#1D1D1F] bg-white hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                >
                  −₹100
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickDiscount('percent', 5)}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold border border-[#E5E5E7] text-[#1D1D1F] bg-white hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                >
                  5%
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickDiscount('percent', 10)}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold border border-[#E5E5E7] text-[#1D1D1F] bg-white hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                >
                  10%
                </button>
                {discountAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setDiscountVal('')}
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-red-600 hover:bg-red-50 ml-auto cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* 4) Grand Total Card with Tabular Mono Numbers */}
            <div className="p-3.5 rounded-xl bg-[#1D1D1F] text-white shadow-xs">
              <div className="flex justify-between items-center text-xs text-[#86868B] font-medium">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums text-white">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-xs text-emerald-400 font-semibold mt-1">
                  <span>Discount</span>
                  <span className="font-mono tabular-nums">−₹{discountAmount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-2 mt-2 border-t border-[#333336]">
                <span className="text-xs font-semibold text-[#86868B] uppercase tracking-wider">
                  Total Payable
                </span>
                <div className="font-mono font-bold text-2xl sm:text-3xl tracking-tight text-white tabular-nums">
                  ₹{grandTotal.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* 6) High Contrast Action Buttons */}
            <div className="space-y-2 pt-0.5">
              <button
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleSaveAndPrint}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xs transition-all duration-150 active:scale-[0.98] ${
                  cart.length === 0 || isSubmitting
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#1D1D1F] text-white hover:bg-black cursor-pointer'
                }`}
              >
                <Printer className="w-5 h-5" />
                <span>
                  {isSubmitting
                    ? 'Saving Bill...'
                    : cart.length > 0
                    ? `Save & Print · ₹${grandTotal.toLocaleString('en-IN')}`
                    : 'Save & Print'}
                </span>
                <span className="hidden sm:inline text-xs font-normal opacity-80">(F2)</span>
              </button>

              {/* 1) Park Bill & Clear Buttons */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={handleParkCurrentBill}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#F5F5F7] hover:bg-[#E5E5E7] text-[#1D1D1F] border border-[#E5E5E7] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
                  title="Hold this bill and serve the next customer"
                >
                  <PauseCircle className="w-4 h-4 text-[#1D1D1F]" />
                  <span>Park Bill (P)</span>
                </button>

                {cart.length > 0 && (
                  <button
                    onClick={handleClearCart}
                    className="py-2 px-3 rounded-xl border border-[#E5E5E7] text-[#86868B] hover:text-red-600 hover:border-red-200 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* MOBILE FLOATING BOTTOM BAR (screens < 1024px) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E5E5E7] p-3 shadow-lg flex items-center justify-between gap-3">
        <button
          onClick={() => setIsMobileBillOpen(prev => !prev)}
          className="flex-1 flex items-center justify-between text-left"
        >
          <div>
            <div className="text-[11px] font-semibold text-[#86868B]">
              {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'} in bill
              {cartSchools.length > 1 && ` (${cartSchools.length} schools)`}
            </div>
            <div className="text-xl font-mono font-bold text-[#1D1D1F] tabular-nums">
              ₹{grandTotal.toLocaleString('en-IN')}
            </div>
          </div>
          <span className="text-xs font-semibold text-[#1D1D1F] bg-[#F5F5F7] border border-[#E5E5E7] px-2.5 py-1 rounded-lg">
            {isMobileBillOpen ? 'Close Bill' : 'View Bill'}
          </span>
        </button>

        <button
          disabled={cart.length === 0 || isSubmitting}
          onClick={handleSaveAndPrint}
          className={`h-11 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs ${
            cart.length === 0 || isSubmitting
              ? 'bg-slate-200 text-slate-400'
              : 'bg-[#1D1D1F] text-white active:scale-95'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Save</span>
        </button>
      </div>

      {/* 1) HELD / PARKED BILLS DRAWER MODAL */}
      {isParkedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl border border-[#E5E5E7] animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E7]">
              <div className="flex items-center gap-2">
                <PauseCircle className="w-5 h-5 text-[#1D1D1F]" />
                <h3 className="font-bold text-base text-[#1D1D1F]">
                  Parked / Held Bills ({parkedBills.length})
                </h3>
              </div>
              <button
                onClick={() => setIsParkedModalOpen(false)}
                className="text-[#86868B] hover:text-[#1D1D1F] p-1 rounded-lg hover:bg-[#F5F5F7]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {parkedBills.length === 0 ? (
                <div className="py-12 text-center text-[#86868B] text-xs">
                  No bills are currently on hold.
                </div>
              ) : (
                parkedBills.map((parked, i) => (
                  <div
                    key={parked.id}
                    className="p-3.5 rounded-xl border border-[#E5E5E7] bg-[#F5F5F7] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#1D1D1F]">
                          {parked.customer_name || `Customer #${i + 1}`}
                        </span>
                        {parked.customer_phone && (
                          <span className="text-[11px] font-mono text-[#86868B]">
                            · {parked.customer_phone}
                          </span>
                        )}
                        <span className="text-[10px] text-[#86868B] flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{parked.parked_at}</span>
                        </span>
                      </div>

                      <div className="text-xs text-[#86868B] mt-1">
                        <span>{parked.school_name || 'Multi-School'}</span>
                        <span> · </span>
                        <span>{parked.cart.length} items</span>
                        <span> · </span>
                        <strong className="font-mono tabular-nums text-[#1D1D1F]">
                          ₹{parked.total.toLocaleString('en-IN')}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleResumeParkedBill(parked)}
                        className="px-3 py-1.5 rounded-lg bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume</span>
                      </button>
                      <button
                        onClick={() => handleDiscardParkedBill(parked.id)}
                        className="p-1.5 rounded-lg border border-[#E5E5E7] text-[#86868B] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Discard held bill"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-[#E5E5E7] flex justify-end">
              <button
                onClick={() => setIsParkedModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#F5F5F7] hover:bg-[#E5E5E7] text-[#1D1D1F] text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7) STANDEE MODE MODAL (Customer Facing High-Contrast QR Display with 180 Flip for rotating tablet) */}
      {showStandeeQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 text-center shadow-2xl border border-[#E5E5E7] animate-in zoom-in-95 ${isTabletFlipped ? 'rotate-180' : ''} transition-transform duration-300`}>
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E7]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#1D1D1F] text-white flex items-center justify-center font-bold text-sm">
                  S
                </div>
                <div className="text-left">
                  <div className="font-bold text-sm text-[#1D1D1F]">
                    {shopConfig?.legal_name || 'SARASWATI GARMENTS'}
                  </div>
                  <div className="text-[10px] text-[#86868B] font-semibold">Official Store</div>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsTabletFlipped(prev => !prev)}
                  className="px-2 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#E5E5E7] text-[#1D1D1F] font-semibold text-xs flex items-center gap-1 border border-[#E5E5E7] transition-colors"
                  title="Invert screen 180° for customer across the counter"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isTabletFlipped ? 'Reset' : 'Invert 180°'}</span>
                </button>
                <button
                  onClick={() => setShowStandeeQrModal(false)}
                  className="text-[#86868B] hover:text-[#1D1D1F] p-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="my-4">
              <div className="text-xs uppercase font-bold tracking-wider text-[#86868B] mb-1">
                Amount Payable
              </div>
              <div className="font-mono font-bold text-4xl sm:text-5xl text-[#1D1D1F] tabular-nums tracking-tight">
                ₹{grandTotal.toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-[#86868B] mt-1">
                {totalItemsCount} items · {cartSchools.map(s => s.code).join(', ')}
              </div>
            </div>

            {/* Standee Big High Contrast QR Code */}
            <div className="p-3 bg-white border-2 border-[#1D1D1F] rounded-2xl shadow-sm inline-block my-1">
              {upiQrUrl ? (
                <img src={upiQrUrl} alt="Standee UPI QR" className="w-60 h-60 mx-auto" />
              ) : (
                <div className="w-60 h-60 bg-[#F5F5F7] rounded-xl flex items-center justify-center text-xs text-[#86868B]">
                  Generating Standee QR...
                </div>
              )}
            </div>

            <div className="mt-2 space-y-1">
              <p className="text-xs font-semibold text-[#1D1D1F]">
                Scan with any UPI App (GPay / PhonePe / Paytm)
              </p>
              <p className="text-[11px] font-mono font-medium text-[#1D1D1F]">
                UPI ID: {shopConfig?.upi_id || '9876543210@upi'}
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowStandeeQrModal(false)}
                className="w-1/3 py-2.5 rounded-xl border border-[#E5E5E7] text-[#1D1D1F] font-semibold text-xs hover:bg-[#F5F5F7] transition-colors cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowStandeeQrModal(false);
                  handleSaveAndPrint();
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#1D1D1F] text-white font-semibold text-xs hover:bg-black shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Payment Done & Save Bill</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Counter Dynamic UPI QR Modal (standard) */}
      {showUpiModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-xl border border-[#E5E5E7] animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
                Counter Dynamic UPI
              </span>
              <button
                onClick={() => setShowUpiModal(false)}
                className="text-[#86868B] hover:text-[#1D1D1F] p-1 rounded-lg hover:bg-[#F5F5F7]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-[#86868B] mb-1">
              {cartSchools.length > 1 ? 'Multi-School Bill' : selectedSchool?.name || 'Counter Sale'}
            </div>
            <div className="text-2xl font-mono font-bold text-[#1D1D1F] mb-4 tabular-nums">
              ₹{grandTotal.toLocaleString('en-IN')}
            </div>

            {upiQrUrl ? (
              <div className="inline-block p-3 bg-white border-2 border-[#1D1D1F] rounded-2xl shadow-xs mb-3">
                <img src={upiQrUrl} alt="UPI QR" className="w-48 h-48 mx-auto" />
              </div>
            ) : (
              <div className="w-48 h-48 bg-[#F5F5F7] rounded-2xl mx-auto flex items-center justify-center mb-3 text-xs text-[#86868B]">
                Generating QR...
              </div>
            )}

            <p className="text-xs text-[#86868B]">
              Scan with GPay, PhonePe, Paytm, or BHIM
            </p>
            <p className="text-[11px] font-mono text-[#1D1D1F] font-medium mt-1">
              UPI ID: {shopConfig?.upi_id || '9876543210@upi'}
            </p>

            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                onClick={() => {
                  setShowUpiModal(false);
                  setShowStandeeQrModal(true);
                }}
                className="py-2.5 rounded-xl border border-[#1D1D1F] text-[#1D1D1F] font-semibold text-xs hover:bg-[#F5F5F7] transition-colors cursor-pointer"
              >
                Standee Mode
              </button>
              <button
                onClick={() => setShowUpiModal(false)}
                className="py-2.5 rounded-xl bg-[#1D1D1F] text-white font-semibold text-xs hover:bg-black transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal (on will) */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onProductSaved={() => {
          loadDatabaseData();
          showToast('Product added successfully!');
        }}
      />

      {/* Edit Multiple Sizes & Rates Modal */}
      {productForMultiRates && (
        <EditMultiRatesModal
          isOpen={!!productForMultiRates}
          onClose={() => setProductForMultiRates(null)}
          product={productForMultiRates}
          initialSchoolId={selectedSchool?.id}
          onRatesUpdated={() => {
            loadDatabaseData();
            showToast('Sizes and rates updated!');
          }}
        />
      )}

      {/* Add School Modal (on will directly from billing counter) */}
      <SchoolModal
        isOpen={isAddSchoolOpen}
        onClose={() => setIsAddSchoolOpen(false)}
        onSchoolSaved={(newSch) => {
          loadDatabaseData();
          setSelectedSchool(newSch);
          showToast(`School ${newSch.name} added & selected!`);
        }}
      />

      {/* Size Exchange Desk Modal */}
      <ExchangeReturnModal
        isOpen={isExchangeModalOpen}
        onClose={() => setIsExchangeModalOpen(false)}
        onComplete={() => {
          loadDatabaseData();
          showToast('Size exchange processed!');
        }}
      />

      {/* Barcode & Price Tag Sticker Generator Modal */}
      <BarcodeStickerModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        schools={schools}
        products={products}
        sizes={sizes}
        prices={Array.from(priceMap.entries()).map(([k, price]) => {
          const [school_id, product_id, size_id] = k.split('_');
          return {
            id: k,
            school_id,
            product_id,
            size_id: size_id === 'null' ? null : size_id,
            price,
          };
        })}
        initialSchoolId={selectedSchool?.id}
        initialProductId={selectedProductId || undefined}
      />

      {/* Advance Orders & Alterations Desk Modal */}
      <AdvanceAlterationModal
        isOpen={isAlterationModalOpen}
        onClose={() => setIsAlterationModalOpen(false)}
        schools={schools}
        initialPhone={customerPhone}
        initialCustomerName={customerName}
        onOrderUpdated={() => {
          loadDatabaseData();
        }}
      />
    </div>
  );
};
