import React, { useState } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  Laptop, 
  Copy, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Wrench, 
  Download,
  MessageCircle,
  Layers,
  Zap,
  Cpu,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { 
  activateLicenseKey, 
  downloadEmergencySafetyBackup,
  VENDOR_BRAND_NAME, 
  VENDOR_CONTACT_PHONE 
} from '../lib/licensing';
import { type LicenseState } from '../types';
import { VendorLicenseGeneratorModal } from './VendorLicenseGeneratorModal';
import { InstantLicenseCheckoutModal } from './InstantLicenseCheckoutModal';

interface LicenseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  license: LicenseState;
  onLicenseUpdated: () => void;
}

export const LicenseManagerModal: React.FC<LicenseManagerModalProps> = ({
  isOpen,
  onClose,
  license,
  onLicenseUpdated,
}) => {
  const [inputKey, setInputKey] = useState('');
  const [storeNameInput, setStoreNameInput] = useState(license.storeName || '');
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState<string | null>(null);
  const [copiedMid, setCopiedMid] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(license.machineId);
    setCopiedMid(true);
    setTimeout(() => setCopiedMid(false), 2000);
  };

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setActivationError('Please enter a valid license key.');
      return;
    }

    setActivating(true);
    setActivationError(null);
    setActivationSuccess(null);

    try {
      const res = activateLicenseKey(inputKey, storeNameInput);
      if (res.success) {
        setActivationSuccess(res.message);
        setInputKey('');
        setTimeout(() => {
          onLicenseUpdated();
        }, 1000);
      } else {
        setActivationError(res.message);
      }
    } catch (err: any) {
      setActivationError(err.message || 'Failed to activate license');
    } finally {
      setActivating(false);
    }
  };

  const handleEmergencyBackup = async () => {
    setIsExporting(true);
    try {
      await downloadEmergencySafetyBackup();
    } catch (err) {
      console.error('Backup error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleWhatsAppHelp = () => {
    const cleanPhone = VENDOR_CONTACT_PHONE.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Hello ${VENDOR_BRAND_NAME},\nI need assistance with my Counterly POS License for Terminal ID: ${license.machineId}`
    );
    window.open(`https://api.whatsapp.com/send/?phone=${cleanPhone}&text=${msg}`, '_blank');
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/70 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs">
                <KeyRound className="w-4 h-4 text-amber-300 dark:text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  License &amp; Terminal Management
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Hardware terminal signature &amp; offline key activation
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

          {/* Modal Content */}
          <div className="p-6 overflow-y-auto space-y-6">
            
            {/* Terminal Hardware Signature Box */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    Terminal Hardware ID
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
                  license.isTrial
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}>
                  {license.tier.toUpperCase()} · {license.isTrial ? `${license.daysRemaining}d Pilot` : 'Active'}
                </span>
              </div>

              <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-wider">
                  {license.machineId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyMachineId}
                  className="flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                >
                  {copiedMid ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMid ? 'Copied' : 'Copy ID'}</span>
                </button>
              </div>

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Provide this Hardware Terminal ID to {VENDOR_BRAND_NAME} to receive your signed offline activation key.
              </p>
            </div>

            {/* Instant Online Upgrade CTA */}
            <div className="p-4 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white space-y-3 shadow-sm border border-zinc-800 dark:border-zinc-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span className="text-xs font-bold uppercase tracking-wide">Instant Online Renewal / Upgrade</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-semibold">Automated UPI / Cards</span>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Upgrade or renew directly in-app. Select a plan, scan the dynamic UPI QR, and your license unlocks automatically.
              </p>

              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(true)}
                className="w-full py-2 bg-white text-zinc-950 hover:bg-zinc-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Open Instant Checkout &amp; Plans</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Manual Offline Key Activation Form */}
            <form onSubmit={handleActivate} className="space-y-4 pt-1">
              <div>
                <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">
                  Enter Offline License Key
                </label>
                <input
                  type="text"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="e.g. COUNTERLY-PRO-XXXX-XXXX-XXXX"
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 transition-all uppercase"
                />
              </div>

              {activationError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{activationError}</span>
                </div>
              )}

              {activationSuccess && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{activationSuccess}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={activating}
                  className="flex-1 py-2.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {activating ? 'Activating Key...' : 'Activate Offline Key'}
                </button>

                <button
                  type="button"
                  onClick={handleWhatsAppHelp}
                  className="px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Contact Vendor via WhatsApp"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </form>

            {/* Offline Safety Export & Developer Vendor Tool */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleEmergencyBackup}
                disabled={isExporting}
                className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? 'Exporting...' : 'Export Offline Safety Backup (.json)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsVendorModalOpen(true)}
                className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
                title="Vendor Key Generator Tool"
              >
                <Wrench className="w-3 h-3" />
                <span>Vendor Keygen</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Vendor Keygen Modal */}
      <VendorLicenseGeneratorModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
      />

      {/* Checkout Modal */}
      <InstantLicenseCheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        license={license}
        onLicenseActivated={() => {
          setIsCheckoutModalOpen(false);
          onLicenseUpdated();
        }}
      />
    </>
  );
};
