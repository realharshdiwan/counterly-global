import React, { useState, useEffect, useMemo } from 'react';
import { 
  RotateCcw, 
  Search, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Printer, 
  Package, 
  ReceiptText,
  CreditCard,
  Coins,
  QrCode,
  Maximize2
} from 'lucide-react';
import QRCode from 'qrcode';
import { db } from '../db/db';
import { 
  type Bill, 
  type BillItem, 
  type Product, 
  type SizeItem, 
  type PriceEntry, 
  type ProductStock, 
  type ShopConfig, 
  type PaymentMethod 
} from '../types';
import { bluetoothPrinter, playBeep } from '../lib/printer';
import { useAuth } from '../context/AuthContext';

interface ExchangeReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  preselectedBill?: Bill | null;
}

export const ExchangeReturnModal: React.FC<ExchangeReturnModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  preselectedBill,
}) => {
  const { currentUser } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<SizeItem[]>([]);
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [stocks, setStocks] = useState<ProductStock[]>([]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);

  // Search Bill state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(preselectedBill || null);
  const [selectedItemToReturn, setSelectedItemToReturn] = useState<BillItem | null>(null);
  
  // Exchange Target
  const [targetSizeId, setTargetSizeId] = useState<string>('');
  const [exchangeReason, setExchangeReason] = useState<string>('Size fitting issue');
  const [paymentMode, setPaymentMode] = useState<PaymentMethod>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [exchangeCompletedBill, setExchangeCompletedBill] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [exchangeUpiQr, setExchangeUpiQr] = useState<string>('');
  const [showStandeeQr, setShowStandeeQr] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (preselectedBill) {
      setSelectedBill(preselectedBill);
      if (preselectedBill.items.length > 0) {
        setSelectedItemToReturn(preselectedBill.items[0]);
      }
    }
  }, [preselectedBill]);

  const loadData = async () => {
    try {
      const [allBills, prodList, szList, prList, stList, cfgList] = await Promise.all([
        db.bills.reverse().sortBy('created_at'),
        db.products.toArray(),
        db.sizes.toArray(),
        db.price_list.toArray(),
        db.stocks.toArray(),
        db.shop_config.toArray(),
      ]);

      setBills(allBills.filter(b => b.status !== 'voided'));
      setProducts(prodList);
      setSizes(szList);
      setPrices(prList);
      setStocks(stList);
      if (cfgList.length > 0) setShopConfig(cfgList[0]);
    } catch (err) {
      console.error('Failed to load exchange data:', err);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Find product & available sizes for the returned item
  const itemProduct = useMemo(() => {
    if (!selectedItemToReturn) return null;
    return products.find(p => p.id === selectedItemToReturn.product_id);
  }, [selectedItemToReturn, products]);

  const availableSizes = useMemo(() => {
    if (!itemProduct || !itemProduct.size_group_id) return [];
    const matchedSizes = sizes.filter(s => s.size_group_id === itemProduct.size_group_id);
    matchedSizes.sort((a, b) => a.sort_order - b.sort_order);
    return matchedSizes;
  }, [itemProduct, sizes]);

  // Set default target size when returned item changes
  useEffect(() => {
    if (availableSizes.length > 0 && !targetSizeId) {
      const nextSize = availableSizes.find(s => s.id !== selectedItemToReturn?.size_id) || availableSizes[0];
      setTargetSizeId(nextSize.id);
    }
  }, [availableSizes, selectedItemToReturn]);

  // Calculate target item rate
  const targetPrice = useMemo(() => {
    if (!selectedBill || !selectedItemToReturn || !targetSizeId) return 0;
    const schId = selectedItemToReturn.school_id || selectedBill.school_id;
    const foundPrice = prices.find(
      pr => pr.school_id === schId && pr.product_id === selectedItemToReturn.product_id && pr.size_id === targetSizeId
    );
    return foundPrice ? foundPrice.price : selectedItemToReturn.unit_price;
  }, [selectedBill, selectedItemToReturn, targetSizeId, prices]);

  const returnCreditAmount = selectedItemToReturn ? selectedItemToReturn.unit_price : 0;
  const priceDifference = targetPrice - returnCreditAmount; // Positive = collect from customer, Negative = refund customer

  // Generate dynamic UPI QR whenever payment is UPI and there is an extra difference to collect
  useEffect(() => {
    if (priceDifference > 0 && paymentMode === 'upi') {
      const upiVpa = shopConfig?.upi_id || '9876543210@upi';
      const payeeName = encodeURIComponent(shopConfig?.legal_name || 'SARASWATI GARMENTS');
      const billRef = selectedBill ? encodeURIComponent(selectedBill.bill_number) : 'EXCHANGE';
      const upiString = `upi://pay?pa=${upiVpa}&pn=${payeeName}&am=${priceDifference}&cu=INR&tn=Exchange+Diff+${billRef}`;
      
      QRCode.toDataURL(upiString, { width: 260, margin: 1 })
        .then(url => setExchangeUpiQr(url))
        .catch(err => console.error('Failed to generate exchange UPI QR:', err));
    } else {
      setExchangeUpiQr('');
    }
  }, [priceDifference, paymentMode, shopConfig, selectedBill]);

  if (!isOpen) return null;

  // Auto-select bill on exact barcode scan or exact match
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    const clean = val.trim().toLowerCase();
    if (clean) {
      const match = bills.find(b => b.bill_number.toLowerCase() === clean);
      if (match) {
        setSelectedBill(match);
        if (match.items.length > 0) {
          setSelectedItemToReturn(match.items[0]);
        }
        showToast(`Bill #${match.bill_number} scanned & loaded`);
      }
    }
  };

  // Search filtered bills
  const searchedBills = bills.filter(b => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.bill_number.toLowerCase().includes(q) ||
      (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
      (b.customer_phone && b.customer_phone.includes(q))
    );
  }).slice(0, 5);

  const handleExecuteExchange = async () => {
    if (!selectedBill || !selectedItemToReturn || !targetSizeId) {
      showToast('Please select all exchange items');
      return;
    }

    const targetSizeObj = sizes.find(s => s.id === targetSizeId);
    if (!targetSizeObj) return;

    setIsProcessing(true);

    try {
      const nowIso = new Date().toISOString();
      
      // Calculate true sequential exchange voucher number (e.g. EXC-2026-1001, EXC-2026-1002)
      const existingReturnsCount = await db.inventory_movements.where('type').equals('return').count();
      const exchangeSeq = 1001 + existingReturnsCount;
      const exchangeNo = `EXC-2026-${String(exchangeSeq).padStart(4, '0')}`;

      // 1. Restore Stock of Returned Size (+1)
      const returnStockKey = `${selectedItemToReturn.product_id}_${selectedItemToReturn.size_id || 'free'}`;
      const returnStockRecord = await db.stocks.get(returnStockKey);
      const returnCurrentQty = returnStockRecord ? returnStockRecord.quantity : 0;
      const returnNewQty = returnCurrentQty + 1;

      if (returnStockRecord) {
        await db.stocks.update(returnStockRecord.id, { quantity: returnNewQty });
      }

      await db.inventory_movements.add({
        id: `mov_ex_ret_${Date.now()}`,
        product_id: selectedItemToReturn.product_id,
        product_name: selectedItemToReturn.product_name,
        size_label: selectedItemToReturn.size_label || 'Free',
        type: 'return',
        qty: 1,
        previous_stock: returnCurrentQty,
        new_stock: returnNewQty,
        notes: `Exchanged Size Return from Bill ${selectedBill.bill_number}`,
        created_at: nowIso,
        reference_bill_id: selectedBill.id,
      });

      // 2. Reduce Stock of Issued Size (-1)
      const issueStockKey = `${selectedItemToReturn.product_id}_${targetSizeId}`;
      const issueStockRecord = await db.stocks.get(issueStockKey);
      const issueCurrentQty = issueStockRecord ? issueStockRecord.quantity : 0;
      const issueNewQty = Math.max(0, issueCurrentQty - 1);

      if (issueStockRecord) {
        await db.stocks.update(issueStockRecord.id, { quantity: issueNewQty });
      }

      await db.inventory_movements.add({
        id: `mov_ex_iss_${Date.now()}`,
        product_id: selectedItemToReturn.product_id,
        product_name: selectedItemToReturn.product_name,
        size_label: targetSizeObj.label,
        type: 'sale',
        qty: -1,
        previous_stock: issueCurrentQty,
        new_stock: issueNewQty,
        notes: `Exchanged Size Issued for Bill ${selectedBill.bill_number}`,
        created_at: nowIso,
        reference_bill_id: selectedBill.id,
      });

      const exchangeData = {
        exchangeNo,
        date: nowIso,
        originalBillNo: selectedBill.bill_number,
        customerName: selectedBill.customer_name,
        customerPhone: selectedBill.customer_phone,
        returnedItem: {
          name: selectedItemToReturn.product_name,
          size: selectedItemToReturn.size_label,
          price: selectedItemToReturn.unit_price,
        },
        issuedItem: {
          name: selectedItemToReturn.product_name,
          size: targetSizeObj.label,
          price: targetPrice,
        },
        difference: priceDifference,
        paymentMode,
        cashier: currentUser?.name || 'Counter Staff',
      };

      setExchangeCompletedBill(exchangeData);
      showToast(`Exchange ${exchangeNo} completed successfully!`);
      if (onComplete) onComplete();
    } catch (err) {
      console.error('Exchange error:', err);
      showToast('Error executing exchange');
    } finally {
      setIsProcessing(false);
    }
  };

  // Print Thermal Exchange Receipt
  const handlePrintExchange = async () => {
    if (!exchangeCompletedBill) return;
    const shopName = shopConfig?.legal_name || 'SARASWATI GARMENTS';

    try {
      if (bluetoothPrinter.isConnected()) {
        const text = `\x1B@\x1Ba\x01\x1BE\x01${shopName}\x1BE\x00\nGARMENT SIZE EXCHANGE SLIP\nRef: ${exchangeCompletedBill.exchangeNo}\nOriginal Bill: ${exchangeCompletedBill.originalBillNo}\nDate: ${new Date(exchangeCompletedBill.date).toLocaleDateString('en-IN')}\n--------------------------------\n\x1Ba\x00RETURNED ITEM (+Stock):\n- ${exchangeCompletedBill.returnedItem.name} (${exchangeCompletedBill.returnedItem.size})\n  Credit Value: Rs.${exchangeCompletedBill.returnedItem.price}\n\nISSUED ITEM (-Stock):\n- ${exchangeCompletedBill.issuedItem.name} (${exchangeCompletedBill.issuedItem.size})\n  New Price: Rs.${exchangeCompletedBill.issuedItem.price}\n--------------------------------\n\x1BE\x01PRICE DIFFERENCE: Rs.${exchangeCompletedBill.difference}\x1BE\x00\nMode: ${exchangeCompletedBill.paymentMode.toUpperCase()}\nBilled By: ${exchangeCompletedBill.cashier}\n\nThank you for shopping!\n\n\n\x1DV\x42\x00`;
        const data = new TextEncoder().encode(text);
        await bluetoothPrinter.printData(data);
        showToast('Exchange slip printed via Thermal Printer!');
      } else {
        window.print();
        showToast('Print dialog opened');
      }
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Failed to print');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-xl border border-[#E5E5E7] animate-in zoom-in-95 max-h-[90vh] flex flex-col my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E7]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-[#1D1D1F]">Garment Size Exchange Desk</h2>
              <p className="text-xs text-[#86868B]">
                Swap uniform sizes, adjust inventory stock, and calculate price difference
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

        {toastMessage && (
          <div className="mt-3 p-2.5 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-bold text-center">
            {toastMessage}
          </div>
        )}

        {exchangeCompletedBill ? (
          /* SUCCESS SLIP VIEW */
          <div className="py-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-[#1D1D1F]">
                Size Exchange Successfully Processed!
              </h3>
              <p className="text-xs text-[#86868B] mt-1">
                Ref Slip No: <strong>{exchangeCompletedBill.exchangeNo}</strong>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#E5E5E7] text-left text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between border-b border-[#E5E5E7] pb-1.5">
                <span className="text-[#86868B]">Returned Item:</span>
                <span className="font-bold text-[#1D1D1F]">
                  {exchangeCompletedBill.returnedItem.name} ({exchangeCompletedBill.returnedItem.size})
                </span>
              </div>

              <div className="flex justify-between border-b border-[#E5E5E7] pb-1.5">
                <span className="text-[#86868B]">Newly Issued Item:</span>
                <span className="font-extrabold text-[#1D1D1F]">
                  {exchangeCompletedBill.issuedItem.name} ({exchangeCompletedBill.issuedItem.size})
                </span>
              </div>

              <div className="flex justify-between font-extrabold text-sm pt-1">
                <span>Price Difference:</span>
                <span>
                  {exchangeCompletedBill.difference === 0
                    ? '₹0 (Even Swap)'
                    : exchangeCompletedBill.difference > 0
                    ? `+₹${exchangeCompletedBill.difference} Collected`
                    : `-₹${Math.abs(exchangeCompletedBill.difference)} Refunded`}
                </span>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#E5E5E7] text-xs font-bold text-[#86868B] hover:bg-[#F5F5F7] cursor-pointer"
              >
                Close Desk
              </button>

              <button
                onClick={handlePrintExchange}
                className="px-5 py-2 rounded-xl bg-[#1D1D1F] text-white text-xs font-extrabold hover:bg-[#333336] transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Exchange Slip</span>
              </button>
            </div>
          </div>
        ) : (
          /* ACTIVE EXCHANGE WORKFLOW */
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            
            {/* 1. Locate Original Bill */}
            {!selectedBill ? (
              <div className="space-y-3">
                <label className="text-xs font-bold text-[#1D1D1F] block flex items-center justify-between">
                  <span>Find Original Bill (Scan Barcode or Search):</span>
                  <span className="text-[10px] text-[#86868B] font-normal">Barcode scanner ready</span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    placeholder="Scan receipt barcode or enter bill number (e.g. SG-2026-1001)..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#E5E5E7] text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-white text-[#1D1D1F]"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  {searchedBills.map(b => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setSelectedBill(b);
                        if (b.items.length > 0) setSelectedItemToReturn(b.items[0]);
                      }}
                      className="w-full p-3 rounded-2xl border border-[#E5E5E7] hover:border-[#1D1D1F] hover:bg-[#F5F5F7] transition-all flex items-center justify-between text-left text-xs cursor-pointer"
                    >
                      <div>
                        <span className="font-extrabold text-[#1D1D1F]">{b.bill_number}</span>
                        <span className="text-[#86868B] ml-2">
                          {new Date(b.created_at).toLocaleDateString('en-IN')}
                        </span>
                        <div className="text-[11px] text-[#86868B] mt-0.5">
                          {b.school_name} · {b.customer_name || 'Walk-in'} ({b.items.length} items)
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-extrabold text-sm text-[#1D1D1F]">₹{b.total}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected Bill Banner */}
                <div className="p-3 rounded-2xl bg-[#F5F5F7] border border-[#E5E5E7] flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#86868B]">Original Bill: </span>
                    <strong className="text-[#1D1D1F]">{selectedBill.bill_number}</strong>
                    <span className="text-[#86868B] ml-2">
                      ({selectedBill.school_name} · {selectedBill.customer_name || 'Customer'})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBill(null);
                      setSelectedItemToReturn(null);
                    }}
                    className="text-xs font-bold text-[#1D1D1F] hover:underline cursor-pointer"
                  >
                    Change Bill
                  </button>
                </div>

                {/* 2. Pick Item to Return */}
                <div>
                  <label className="text-xs font-extrabold text-[#1D1D1F] uppercase tracking-wider block mb-2">
                    1. Select Garment to Return:
                  </label>
                  <div className="space-y-2">
                    {selectedBill.items.map(item => {
                      const isSelected = selectedItemToReturn?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedItemToReturn(item);
                            setTargetSizeId('');
                          }}
                          className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between text-xs cursor-pointer ${
                            isSelected
                              ? 'bg-white border-[#1D1D1F] shadow-sm ring-1 ring-[#1D1D1F]/30'
                              : 'bg-[#F5F5F7] border-[#E5E5E7] hover:bg-[#E5E5E7]'
                          }`}
                        >
                          <div>
                            <span className="font-extrabold text-[#1D1D1F] block">{item.product_name}</span>
                            <span className="text-[11px] text-[#86868B]">
                              Size: <strong>{item.size_label || 'Free'}</strong> · Qty: {item.qty}
                            </span>
                          </div>
                          <div className="text-right font-extrabold text-sm text-[#1D1D1F]">
                            ₹{item.unit_price}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Pick Replacement Size */}
                {selectedItemToReturn && (
                  <div className="p-4 rounded-2xl bg-white border border-[#E5E5E7] space-y-3 shadow-2xs">
                    <label className="text-xs font-extrabold text-[#1D1D1F] uppercase tracking-wider block">
                      2. Select New Size to Issue:
                    </label>

                    {availableSizes.length > 0 ? (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {availableSizes.map(sz => {
                          const isSelected = targetSizeId === sz.id;
                          return (
                            <button
                              key={sz.id}
                              type="button"
                              onClick={() => setTargetSizeId(sz.id)}
                              className={`h-11 rounded-xl border text-xs font-extrabold transition-all flex flex-col items-center justify-center cursor-pointer ${
                                isSelected
                                  ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-xs'
                                  : 'bg-[#F5F5F7] text-[#1D1D1F] border-[#E5E5E7] hover:border-[#1D1D1F]'
                              }`}
                            >
                              <span>{sz.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-[#86868B]">
                        This product is Free Size (No size variants).
                      </p>
                    )}

                    {/* Price Difference Summary Bar */}
                    <div className="mt-3 p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[#86868B]">Returned: </span>
                        <span className="font-bold text-[#1D1D1F]">
                          {selectedItemToReturn.size_label} (₹{returnCreditAmount})
                        </span>
                        <span className="mx-2">→</span>
                        <span className="text-[#86868B]">New: </span>
                        <span className="font-extrabold text-[#1D1D1F]">
                          {sizes.find(s => s.id === targetSizeId)?.label || 'Selected'} (₹{targetPrice})
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-[#86868B] block">Difference:</span>
                        <span className="text-sm font-extrabold text-[#1D1D1F]">
                          {priceDifference === 0
                            ? '₹0 (Even)'
                            : priceDifference > 0
                            ? `+₹${priceDifference} Collect`
                            : `-₹${Math.abs(priceDifference)} Refund`}
                        </span>
                      </div>
                    </div>

                    {priceDifference > 0 && (
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#86868B]">Difference Payment Mode:</span>
                          <div className="flex items-center gap-1.5">
                            {(['cash', 'upi', 'card'] as PaymentMethod[]).map(pm => (
                              <button
                                key={pm}
                                type="button"
                                onClick={() => setPaymentMode(pm)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold capitalize border transition-all cursor-pointer ${
                                  paymentMode === pm
                                    ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-2xs'
                                    : 'bg-[#F5F5F7] text-[#1D1D1F] border-[#E5E5E7]'
                                }`}
                              >
                                {pm}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Live Dynamic UPI QR for Exchange Difference */}
                        {paymentMode === 'upi' && exchangeUpiQr && (
                          <div className="p-3.5 rounded-2xl bg-white border border-[#E5E5E7] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 bg-white border border-[#E5E5E7] rounded-xl shadow-xs">
                                <img src={exchangeUpiQr} alt="Exchange UPI QR" className="w-24 h-24 object-contain" />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-[#1D1D1F] font-extrabold text-xs">
                                  <QrCode className="w-3.5 h-3.5" />
                                  <span>Dynamic Exchange QR</span>
                                </div>
                                <div className="text-sm font-black text-[#1D1D1F]">
                                  Amount: ₹{priceDifference}
                                </div>
                                <div className="text-[10px] font-mono text-[#86868B]">
                                  UPI ID: {shopConfig?.upi_id || '9876543210@upi'}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setShowStandeeQr(true)}
                              className="px-3 py-1.5 rounded-xl bg-[#F5F5F7] hover:bg-[#E5E5E7] text-[#1D1D1F] text-xs font-bold border border-[#E5E5E7] flex items-center gap-1.5 self-stretch sm:self-auto justify-center cursor-pointer"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                              <span>Standee Mode</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!exchangeCompletedBill && (
          <div className="pt-4 border-t border-[#E5E5E7] flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#E5E5E7] text-xs font-bold text-[#86868B] hover:bg-[#F5F5F7] cursor-pointer"
            >
              Cancel
            </button>

            {selectedBill && selectedItemToReturn && (
              <button
                onClick={handleExecuteExchange}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-[#1D1D1F] text-white text-xs font-extrabold hover:bg-[#333336] transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>{isProcessing ? 'Processing...' : 'Complete Size Exchange'}</span>
              </button>
            )}
          </div>
        )}

      </div>

      {/* Standee Fullscreen QR Modal for Counter Tablets */}
      {showStandeeQr && exchangeUpiQr && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl space-y-4 animate-in zoom-in-95 border-4 border-[#1D1D1F]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-[#1D1D1F] tracking-wider">
                {shopConfig?.legal_name || 'SARASWATI GARMENTS'}
              </span>
              <button
                onClick={() => setShowStandeeQr(false)}
                className="text-[#86868B] hover:text-[#1D1D1F] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="font-extrabold text-base text-[#1D1D1F]">
              Scan &amp; Pay Exchange Difference
            </h3>

            <div className="p-3 bg-white border-2 border-dashed border-[#E5E5E7] rounded-2xl flex justify-center">
              <img src={exchangeUpiQr} alt="UPI QR Standee" className="w-56 h-56 object-contain" />
            </div>

            <div className="p-3 rounded-2xl bg-[#F5F5F7] border border-[#E5E5E7]">
              <div className="text-xs text-[#86868B]">Amount to Pay:</div>
              <div className="text-3xl font-mono font-black text-[#1D1D1F]">
                ₹{priceDifference}
              </div>
              <div className="text-[11px] font-mono text-[#86868B] mt-1">
                UPI: {shopConfig?.upi_id || '9876543210@upi'}
              </div>
            </div>

            <p className="text-[11px] text-[#86868B]">
              Supports GPay, PhonePe, Paytm, BHIM &amp; Banking UPI apps
            </p>

            <button
              onClick={() => setShowStandeeQr(false)}
              className="w-full py-2.5 rounded-xl bg-[#1D1D1F] text-white font-extrabold text-xs hover:bg-[#333336] cursor-pointer"
            >
              Done / Return to Counter
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
