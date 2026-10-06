import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  CreditCard, 
  QrCode, 
  ShieldCheck, 
  ArrowRight, 
  X, 
  Zap, 
  Copy, 
  Check, 
  RefreshCw, 
  Shield, 
  ArrowLeft, 
  CheckCheck,
  Building2,
  Cpu
} from 'lucide-react';
import { 
  activateLicenseKey, 
  VENDOR_BRAND_NAME, 
  VENDOR_CONTACT_PHONE 
} from '../lib/licensing';
import { type LicenseState, type LicenseTier } from '../types';
import { playBeep } from '../lib/printer';

interface InstantLicenseCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  license: LicenseState;
  onLicenseActivated: () => void;
}

interface PlanOption {
  id: LicenseTier;
  title: string;
  tagline: string;
  price: number;
  originalPrice: number;
  period: string;
  popular?: boolean;
  features: string[];
}

const PLANS: PlanOption[] = [
  {
    id: 'starter',
    title: 'Starter POS',
    tagline: 'Single billing station for general apparel & retail',
    price: 3999,
    originalPrice: 5999,
    period: '/ year',
    features: [
      'Single Counter Station',
      '80mm & 58mm ESC/POS Thermal Print',
      'Inventory Stock Tracking',
      'Daily Cash & Register Closing',
    ],
  },
  {
    id: 'pro',
    title: 'Pro Uniform Edition',
    tagline: 'Dedicated for School Uniform Retailers & Wholesalers',
    price: 6999,
    originalPrice: 9999,
    period: '/ year',
    popular: true,
    features: [
      'All Starter Features Included',
      'School Rate Books & Size Multipliers',
      'Multi-School Single Cart Billing',
      '50×25mm Barcode Label Generator',
      'Dual Customer Display + Dynamic UPI',
      'Advance Alteration & Tailoring Slips',
      'GST 1% CMP-08 & GSTR-1 Excel Exports',
    ],
  },
  {
    id: 'enterprise',
    title: 'Enterprise Multi-Counter',
    tagline: 'High-volume stores with 2 to 10 billing counters',
    price: 11999,
    originalPrice: 15999,
    period: '/ year',
    features: [
      'All Pro Uniform Edition Features',
      'Multi-Counter Real-Time Sync',
      'Unlimited Shift PIN Staff Accounts',
      'Priority Data Migration & Backup',
      'Dedicated CA Export Templates',
    ],
  },
  {
    id: 'lifetime',
    title: 'Lifetime Perpetual',
    tagline: 'One-time investment, perpetual offline license forever',
    price: 18999,
    originalPrice: 24999,
    period: 'one-time',
    features: [
      'Non-Expiring Offline License Key',
      'All Current & Future Features',
      'Lifetime Free Updates',
      'Priority Support',
    ],
  },
];

export const InstantLicenseCheckoutModal: React.FC<InstantLicenseCheckoutModalProps> = ({
  isOpen,
  onClose,
  license,
  onLicenseActivated,
}) => {
  const [selectedTier, setSelectedTier] = useState<LicenseTier>('pro');
  const [paymentStep, setPaymentStep] = useState<'select_plan' | 'pay' | 'success'>('select_plan');
  const [paymentMethod, setPaymentMethod] = useState<'upi_qr' | 'razorpay' | 'stripe'>('upi_qr');
  const [utrNumber, setUtrNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [isWebhookListening, setIsWebhookListening] = useState(false);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [activatedKeyOutput, setActivatedKeyOutput] = useState<string>('');

  const currentPlan = PLANS.find((p) => p.id === selectedTier) || PLANS[1];

  // Reset or create order on step change
  useEffect(() => {
    if (isOpen && paymentStep === 'pay') {
      createOrderOnServer();
    }
  }, [isOpen, paymentStep, selectedTier]);

  // Webhook Long Polling simulation when on pay step
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && paymentStep === 'pay' && activeOrderId) {
      setIsWebhookListening(true);
      timer = setInterval(async () => {
        try {
          const resp = await fetch(`/api/subscription/order-status?orderId=${activeOrderId}`);
          const data = await resp.json();
          if (data.status === 'paid' && data.licenseKey) {
            handleAutoUnlockClient(data.licenseKey);
          }
        } catch (e) {
          // silent ignore
        }
      }, 4000);
    }
    return () => {
      clearInterval(timer);
      setIsWebhookListening(false);
    };
  }, [isOpen, paymentStep, activeOrderId]);

  if (!isOpen) return null;

  // 1. Create order on server
  const createOrderOnServer = async () => {
    try {
      const resp = await fetch('/api/subscription/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: license.machineId,
          tier: selectedTier,
          storeName: license.storeName || 'Counterly POS Store',
        }),
      });
      const data = await resp.json();
      if (data.orderId) {
        setActiveOrderId(data.orderId);
      }
    } catch (err) {
      console.error('Failed to create order on server:', err);
    }
  };

  // 3. Client auto-unlock upon receiving key from server
  const handleAutoUnlockClient = (key: string) => {
    try {
      const res = activateLicenseKey(key, license.storeName);
      if (res.success) {
        playBeep('success');
        setActivatedKeyOutput(key);
        setPaymentStep('success');
        setIsWebhookListening(false);
        onLicenseActivated();
      } else {
        setVerificationError(res.message);
      }
    } catch (err: any) {
      setVerificationError(err.message || 'Failed to apply license');
    }
  };

  // 4. Trigger Webhook Simulation / Direct Verification
  const handleTriggerVerificationOrWebhook = async (isWebhookSim = false) => {
    setIsVerifying(true);
    setVerificationError(null);

    try {
      if (isWebhookSim && activeOrderId) {
        const hookResp = await fetch('/api/subscription/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'payment.captured',
            orderId: activeOrderId,
            machineId: license.machineId,
            payload: {
              payment: {
                entity: {
                  id: `pay_${Date.now()}`,
                  notes: { orderId: activeOrderId },
                },
              },
            },
          }),
        });

        const hookData = await hookResp.json();
        if (hookData.licenseKey) {
          handleAutoUnlockClient(hookData.licenseKey);
          return;
        }
      }

      // Direct verify endpoint
      const resp = await fetch('/api/subscription/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: activeOrderId,
          machineId: license.machineId,
          tier: selectedTier,
          utr: utrNumber.trim() || undefined,
        }),
      });

      const data = await resp.json();
      if (data.success && data.licenseKey) {
        handleAutoUnlockClient(data.licenseKey);
      } else {
        setVerificationError(data.message || 'Verification could not be confirmed.');
      }
    } catch (err: any) {
      setVerificationError(err.message || 'Network error during verification');
    } finally {
      setIsVerifying(false);
    }
  };

  const vendorUpiId = 'saraswatigarments@upi';
  const orderTag = activeOrderId || `order_${license.machineId}`;
  const upiPayload = `upi://pay?pa=${vendorUpiId}&pn=${encodeURIComponent(VENDOR_BRAND_NAME)}&am=${currentPlan.price}&cu=INR&tn=${encodeURIComponent(`Counterly_${currentPlan.id.toUpperCase()}_${orderTag}`)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiPayload)}`;

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(vendorUpiId);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/70 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors">
        
        {/* Minimalist Top Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs">
              <Zap className="w-4 h-4 text-amber-300 dark:text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Software License Checkout
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Instant hardware activation &amp; automated signature delivery
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* STEP 1: Select Plan Tier */}
          {paymentStep === 'select_plan' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Choose Your Software Edition
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Target Terminal ID: <strong className="font-mono text-zinc-900 dark:text-zinc-200">{license.machineId}</strong>
                  </p>
                </div>
                <div className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  Step 1 of 2
                </div>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLANS.map((plan) => {
                  const isSelected = selectedTier === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedTier(plan.id)}
                      className={`relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50/80 dark:bg-zinc-800/80 shadow-xs'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      {plan.popular && (
                        <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-semibold rounded-md uppercase tracking-wider">
                          Recommended
                        </span>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{plan.title}</span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 line-through font-mono">₹{plan.originalPrice}</span>
                        </div>

                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-50">₹{plan.price}</span>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">{plan.period}</span>
                        </div>

                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">{plan.tagline}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                          <CheckCircle2 className={`w-3.5 h-3.5 ${isSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}`} />
                          <span>{plan.features[0]}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Payment & Verification */}
          {paymentStep === 'pay' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setPaymentStep('select_plan')}
                  className="flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Plan</span>
                </button>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Total Payable: <strong className="font-mono text-zinc-900 dark:text-zinc-100">₹{currentPlan.price}</strong>
                </div>
              </div>

              {/* Payment Terminal Options */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* QR Code Container */}
                <div className="md:col-span-6 bg-zinc-50 dark:bg-zinc-950/60 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center space-y-3">
                  <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Scan with BHIM / GPay / PhonePe / Paytm
                  </span>

                  <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-xs">
                    <img
                      src={qrCodeUrl}
                      alt="UPI Payment QR"
                      className="w-44 h-44 object-contain rounded-lg"
                    />
                  </div>

                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 font-mono">
                      <span>{vendorUpiId}</span>
                      <button
                        onClick={handleCopyVpa}
                        className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors text-zinc-500 cursor-pointer"
                        title="Copy VPA"
                      >
                        {copiedVpa ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Auto-detects transaction upon payment confirmation</p>
                  </div>
                </div>

                {/* UTR Verification Bay */}
                <div className="md:col-span-6 space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Verify Transaction Reference / UTR
                    </h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Enter the 12-digit UPI UTR number from your payment app for instant signature unlocking.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
                      12-Digit UTR Number
                    </label>
                    <input
                      type="text"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      placeholder="e.g. 428190123456"
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 transition-all"
                    />
                  </div>

                  {verificationError && (
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-lg text-[11px] text-rose-700 dark:text-rose-300">
                      {verificationError}
                    </div>
                  )}

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleTriggerVerificationOrWebhook(false)}
                      disabled={isVerifying}
                      className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isVerifying ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Verify UTR &amp; Unlock License</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTriggerVerificationOrWebhook(true)}
                      className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Simulate Payment Webhook Capture
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS CONFIRMATION */}
          {paymentStep === 'success' && (
            <div className="text-center py-6 space-y-5 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {currentPlan.title} Activated Successfully
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Terminal hardware ID <strong className="font-mono text-zinc-900 dark:text-zinc-200">{license.machineId}</strong> is now licensed and unlocked.
                </p>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-left space-y-2 max-w-md mx-auto">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Cryptographic Key Output</span>
                <div className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 break-all bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  {activatedKeyOutput || license.licenseKey || 'KEYS-VERIFIED-ACTIVATED'}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Launch POS Register
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {paymentStep === 'select_plan' && (
          <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Offline RSA Cryptographic Activation</span>
            </div>

            <button
              type="button"
              onClick={() => setPaymentStep('pay')}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold cursor-pointer shadow-xs"
            >
              <span>Proceed to Payment</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
