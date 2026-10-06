import React, { useState } from 'react';
import { 
  Lock, 
  KeyRound, 
  Copy, 
  Check, 
  ShieldAlert, 
  Download, 
  MessageCircle, 
  Wrench, 
  AlertCircle, 
  CheckCircle2, 
  Zap 
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

interface LicenseExpiredLockoutProps {
  license: LicenseState;
  onLicenseUpdated: () => void;
}

export const LicenseExpiredLockout: React.FC<LicenseExpiredLockoutProps> = ({
  license,
  onLicenseUpdated,
}) => {
  const [inputKey, setInputKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedMid, setCopiedMid] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(license.machineId);
    setCopiedMid(true);
    setTimeout(() => setCopiedMid(false), 2000);
  };

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setErrorMessage('Please enter an activation key.');
      return;
    }

    setActivating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = activateLicenseKey(inputKey, license.storeName);
      if (res.success) {
        setSuccessMessage(res.message);
        setInputKey('');
        setTimeout(() => {
          onLicenseUpdated();
        }, 1000);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to activate key');
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

  const handleWhatsAppVendor = () => {
    const cleanPhone = VENDOR_CONTACT_PHONE.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Hello ${VENDOR_BRAND_NAME},\nI need to renew/activate my Counterly POS subscription.\nStore: ${license.storeName || 'Retail Store'}\nHardware ID: ${license.machineId}\nStatus: ${license.status}`
    );
    window.open(`https://api.whatsapp.com/send/?phone=${cleanPhone}&text=${msg}`, '_blank');
  };

  const isClockTampered = license.status === 'clock_tampered';

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl border border-stone-200 shadow-2xl p-6 sm:p-8 space-y-5 animate-in zoom-in-95 duration-200">
        
        {/* Header Icon & Title */}
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 mx-auto flex items-center justify-center">
            {isClockTampered ? <ShieldAlert className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <h1 className="text-lg font-bold text-stone-900 tracking-tight">
            {isClockTampered ? 'System Date Discrepancy Detected' : 'License Subscription Expired'}
          </h1>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {isClockTampered
              ? 'Your device clock has been shifted backwards. Please restore the actual current date/time to resume billing.'
              : license.isTrial
              ? 'Your 14-day free trial has concluded. Upgrade online or enter an offline key to resume counter billing.'
              : 'Your store annual subscription has concluded. Enter a renewal key or pay online to reactivate.'}
          </p>
        </div>

        {/* Machine ID Copy Card */}
        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-600">
            <span className="font-medium">Hardware Terminal ID</span>
            <span className="text-[11px] text-stone-400">Unique to this PC</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white px-3 py-2 rounded-lg border border-stone-200 font-mono text-xs font-bold text-stone-900 tracking-wider select-all shadow-xs">
              {license.machineId}
            </div>
            <button
              type="button"
              onClick={handleCopyMachineId}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg text-xs font-semibold text-stone-700 hover:text-stone-900 transition-colors cursor-pointer shadow-xs"
            >
              {copiedMid ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setIsCheckoutModalOpen(true)}
            className="py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Instant Online Unlock</span>
          </button>

          <button
            type="button"
            onClick={handleWhatsAppVendor}
            className="py-2.5 px-4 bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>WhatsApp Support</span>
          </button>
        </div>

        {/* Activation Key Form */}
        <form onSubmit={handleActivate} className="space-y-3 pt-3 border-t border-stone-200">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-stone-700" />
              <span>Enter Activation / Renewal Key</span>
            </label>
            <span className="text-[11px] text-stone-400">Offline certificate</span>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="space-y-2">
            <input
              type="text"
              placeholder="e.g. CNTR-PRO-20271231-XXXX-XXXX"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-bold uppercase tracking-wider text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />

            <button
              type="submit"
              disabled={activating || !inputKey.trim()}
              className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              {activating ? 'Validating Certificate...' : 'Unlock Terminal Now'}
            </button>
          </div>
        </form>

        {/* Safety Export Guarantee & Vendor Tool */}
        <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleEmergencyBackup}
            disabled={isExporting}
            className="flex items-center gap-1.5 text-stone-500 hover:text-stone-900 font-medium transition-colors cursor-pointer"
            title="Download full JSON export of all your bills, inventory, and database"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Downloading...' : 'Export Store Backup'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsVendorModalOpen(true)}
            className="flex items-center gap-1 text-stone-500 hover:text-stone-900 font-medium cursor-pointer"
          >
            <Wrench className="w-3 h-3" />
            <span>Vendor Mode</span>
          </button>
        </div>
      </div>

      {/* Vendor Key Generator Modal */}
      <VendorLicenseGeneratorModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        prefillMachineId={license.machineId}
        prefillStoreName={license.storeName}
      />

      {/* Instant Checkout Modal */}
      <InstantLicenseCheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        license={license}
        onLicenseActivated={() => {
          setIsCheckoutModalOpen(false);
          onLicenseUpdated();
        }}
      />
    </div>
  );
};
