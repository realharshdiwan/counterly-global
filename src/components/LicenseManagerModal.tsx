import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Laptop,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Mail,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';
import {
  verifyAndActivateOnline,
  downloadEmergencySafetyBackup,
  VENDOR_BRAND_NAME,
  COUNTERLY_PACKAGES,
  getCheckoutPaymentUrl,
  openPurchaseEmailRequest,
  openPurchaseWhatsAppRequest,
  type CounterlyPackageOption,
} from '../lib/licensing';
import { db } from '../db/db';
import { type LicenseState, type ShopConfig } from '../types';

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
  const [selectedPkg, setSelectedPkg] = useState<CounterlyPackageOption>(COUNTERLY_PACKAGES[1]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState<string | null>(null);
  const [copiedMid, setCopiedMid] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    db.shop_config
      .toArray()
      .then(cfgs => {
        if (cfgs[0]) setShopConfig(cfgs[0]);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const checkoutUrl = getCheckoutPaymentUrl(shopConfig);

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(license.machineId);
    setCopiedMid(true);
    setTimeout(() => setCopiedMid(false), 2000);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setActivationError('Please enter your annual license key.');
      return;
    }

    setActivating(true);
    setActivationError(null);
    setActivationSuccess(null);

    try {
      const res = await verifyAndActivateOnline(inputKey, license.storeName || 'Retail Store');
      if (res.success) {
        setActivationSuccess(res.message);
        setInputKey('');
        setTimeout(() => {
          onLicenseUpdated();
        }, 900);
      } else {
        setActivationError(res.message);
      }
    } catch (err: unknown) {
      setActivationError((err as Error)?.message || 'Failed to verify license key.');
    } finally {
      setActivating(false);
    }
  };

  const handleEmergencyBackup = async () => {
    setIsExporting(true);
    try {
      await downloadEmergencySafetyBackup();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                Terminal License &amp; Purchase
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Purchase plan or enter your annual CNTR activation key
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Terminal Machine ID */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5" />
                Hardware Terminal ID
              </span>
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {license.tier.toUpperCase()} ·{' '}
                {license.isTrial ? `${license.daysRemaining}d Pilot` : `${license.daysRemaining}d Active`}
              </span>
            </div>

            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 select-all">
                {license.machineId}
              </span>
              <button
                type="button"
                onClick={handleCopyMachineId}
                className="flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 cursor-pointer"
              >
                {copiedMid ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedMid ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Share this ID with {VENDOR_BRAND_NAME} so your activation key binds to this counter terminal.
            </p>
          </div>

          {/* Purchase / Plan Selector */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Select Plan or Hardware Bundle
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {COUNTERLY_PACKAGES.map(pkg => {
                const active = selectedPkg.id === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPkg(pkg)}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100'
                    }`}
                  >
                    <div className="text-xs font-bold">{pkg.name}</div>
                    <div className="text-sm font-mono font-bold tabular-nums mt-0.5">{pkg.priceLabel}</div>
                    <div className="text-[10px] opacity-80 mt-1 leading-snug">{pkg.summary}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {checkoutUrl && (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[160px] py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Pay Online &amp; Checkout</span>
                </a>
              )}
              <button
                type="button"
                onClick={() =>
                  openPurchaseEmailRequest({
                    packageOption: selectedPkg,
                    machineId: license.machineId,
                    storeName: shopConfig?.legal_name || license.storeName,
                  })
                }
                className="flex-1 min-w-[140px] py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Request Key via Email</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  openPurchaseWhatsAppRequest({
                    packageOption: selectedPkg,
                    machineId: license.machineId,
                    storeName: shopConfig?.legal_name || license.storeName,
                  })
                }
                className="flex-1 min-w-[140px] py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Request via WhatsApp</span>
              </button>
            </div>
          </div>

          {/* License Key Input */}
          <form onSubmit={handleActivate} className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <div>
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1.5">
                Already Have a License Key?
              </label>
              <input
                type="text"
                value={inputKey}
                onChange={e => setInputKey(e.target.value.toUpperCase())}
                placeholder="CNTR-PRO-YYYYMMDD-XXXX-XXXX"
                className="w-full h-10 px-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg font-mono text-xs font-semibold text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 uppercase"
              />
            </div>

            {activationError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{activationError}</span>
              </div>
            )}

            {activationSuccess && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{activationSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={activating || !inputKey.trim()}
              className="w-full py-2.5 bg-zinc-950 dark:bg-zinc-100 hover:opacity-90 text-white dark:text-zinc-950 rounded-lg text-xs font-semibold transition-opacity cursor-pointer disabled:opacity-40"
            >
              {activating ? 'Verifying Key...' : 'Activate License Key'}
            </button>
          </form>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleEmergencyBackup}
              disabled={isExporting}
              className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Exporting...' : 'Export Store Data (.json)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
