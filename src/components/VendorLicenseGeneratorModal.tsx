import React, { useState } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  Copy, 
  Check, 
  Send, 
  Building2, 
  Laptop, 
  Calendar, 
  CheckCircle2, 
  X, 
  Lock, 
  MessageCircle 
} from 'lucide-react';
import { 
  generateLicenseKey, 
  formatDateToKey, 
  generateWhatsAppLicenseDeliveryMessage, 
  VENDOR_BRAND_NAME,
  VENDOR_CONTACT_PHONE,
  VENDOR_MASTER_PIN
} from '../lib/licensing';
import { type LicenseTier } from '../types';

interface VendorLicenseGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillMachineId?: string;
  prefillStoreName?: string;
}

export const VendorLicenseGeneratorModal: React.FC<VendorLicenseGeneratorModalProps> = ({
  isOpen,
  onClose,
  prefillMachineId = '',
  prefillStoreName = '',
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [vendorPin, setVendorPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // Generation form
  const [targetMachineId, setTargetMachineId] = useState(prefillMachineId);
  const [isUniversalKey, setIsUniversalKey] = useState(false);
  const [storeName, setStoreName] = useState(prefillStoreName || 'Retail Customer');
  const [selectedTier, setSelectedTier] = useState<LicenseTier>('pro');
  const [durationMonths, setDurationMonths] = useState<number>(12);
  const [merchantPhone, setMerchantPhone] = useState('');

  // Generated Result
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [expirySummary, setExpirySummary] = useState<string>('');

  if (!isOpen) return null;

  const handleVerifyVendorPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (vendorPin === VENDOR_MASTER_PIN) {
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
      setVendorPin('');
    }
  };

  const handleGenerate = () => {
    let expDate: Date | null = null;
    if (durationMonths > 0) {
      expDate = new Date();
      expDate.setMonth(expDate.getMonth() + durationMonths);
    }

    const machineIdToUse = isUniversalKey ? 'UNIV' : (targetMachineId.trim() || 'MID-POS1-2026');
    const key = generateLicenseKey(selectedTier, expDate, machineIdToUse);

    const expStr = expDate
      ? expDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'PERPETUAL (Lifetime)';

    setGeneratedKey(key);
    setExpirySummary(expStr);
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyFullMessage = () => {
    if (!generatedKey) return;
    const msg = generateWhatsAppLicenseDeliveryMessage(
      storeName || 'Retail Store',
      isUniversalKey ? 'Universal (All Terminals)' : targetMachineId,
      generatedKey,
      selectedTier,
      expirySummary
    );
    navigator.clipboard.writeText(msg);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleSendWhatsApp = () => {
    if (!generatedKey) return;
    const msg = generateWhatsAppLicenseDeliveryMessage(
      storeName || 'Retail Store',
      isUniversalKey ? 'Universal (All Terminals)' : targetMachineId,
      generatedKey,
      selectedTier,
      expirySummary
    );

    const cleanPhone = merchantPhone.replace(/\D/g, '');
    const targetPhone = cleanPhone.length >= 10 ? `91${cleanPhone.slice(-10)}` : '';
    const encoded = encodeURIComponent(msg);

    const url = targetPhone
      ? `https://api.whatsapp.com/send/?phone=${targetPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send/?text=${encoded}`;

    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-xl rounded-2xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-900">
                Vendor &amp; Reseller License Portal
              </h2>
              <p className="text-xs text-stone-500">
                Issue cryptographically signed offline activation keys
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-stone-200/70 text-stone-400 hover:text-stone-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PIN Authentication Gate */}
        {!isAuthenticated ? (
          <form onSubmit={handleVerifyVendorPin} className="p-6 space-y-4">
            <div className="text-center py-4 space-y-2">
              <div className="w-12 h-12 rounded-xl bg-stone-100 border border-stone-200 text-stone-900 mx-auto flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-sm text-stone-900">Software Vendor Master Access</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Enter your 6-digit Master Reseller PIN to unlock the license key generator.
              </p>
            </div>

            <div>
              <input
                type="password"
                maxLength={6}
                autoFocus
                placeholder="Enter 6-Digit Master PIN"
                value={vendorPin}
                onChange={(e) => {
                  setVendorPin(e.target.value.replace(/\D/g, ''));
                  setPinError(false);
                }}
                className={`w-full text-center text-xl tracking-[0.4em] font-mono font-bold py-2.5 rounded-lg border ${
                  pinError
                    ? 'border-rose-400 bg-rose-50 text-rose-800'
                    : 'border-stone-200 bg-stone-50 text-stone-900'
                } focus:outline-none focus:ring-1 focus:ring-stone-900`}
              />
              {pinError && (
                <p className="text-xs font-medium text-rose-700 text-center mt-2">
                  Incorrect Master PIN. (Default vendor master PIN is 882299)
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-lg border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={vendorPin.length !== 6}
                className="flex-1 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Unlock Generator
              </button>
            </div>
          </form>
        ) : (
          /* Generator Form */
          <div className="p-6 overflow-y-auto space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Customer / Retail Store Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. Saraswati Garments & Uniforms"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-stone-700">
                    Target Machine ID (Hardware Fingerprint)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-stone-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUniversalKey}
                      onChange={(e) => setIsUniversalKey(e.target.checked)}
                      className="rounded accent-stone-900"
                    />
                    <span>Universal Key (Any Terminal)</span>
                  </label>
                </div>
                <div className="relative">
                  <Laptop className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    disabled={isUniversalKey}
                    placeholder="e.g. MID-9B2F-7A41"
                    value={isUniversalKey ? 'UNIVERSAL (ALL TERMINALS)' : targetMachineId}
                    onChange={(e) => setTargetMachineId(e.target.value.toUpperCase())}
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-bold uppercase text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    License Edition Tier
                  </label>
                  <select
                    value={selectedTier}
                    onChange={(e) => setSelectedTier(e.target.value as LicenseTier)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  >
                    <option value="starter">Starter POS Edition</option>
                    <option value="pro">Pro Uniform Edition</option>
                    <option value="enterprise">Enterprise Multi-Counter</option>
                    <option value="lifetime">Lifetime Perpetual</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    Duration Validity
                  </label>
                  <select
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  >
                    <option value={1}>1 Month (Monthly Trial)</option>
                    <option value={3}>3 Months (Quarterly)</option>
                    <option value={6}>6 Months (Half-Yearly)</option>
                    <option value={12}>1 Year (Annual Standard)</option>
                    <option value={24}>2 Years (Bi-Annual)</option>
                    <option value={0}>Lifetime Perpetual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Merchant WhatsApp Number (Optional for 1-Click Dispatch)
                </label>
                <div className="relative">
                  <MessageCircle className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={merchantPhone}
                    onChange={(e) => setMerchantPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Sign &amp; Generate Commercial License Key
              </button>
            </div>

            {/* Result Box */}
            {generatedKey && (
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-900">
                    Generated Cryptographic License Key
                  </span>
                  <span className="text-xs text-stone-500 font-mono">
                    Expires: {expirySummary}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-stone-200 font-mono text-xs font-bold text-stone-900 tracking-wider break-all select-all">
                  {generatedKey}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="py-2 px-3 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copied Key' : 'Copy Key'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send via WhatsApp</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
