import React, { useState, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  Copy,
  Check,
  ShieldAlert,
  Download,
  Mail,
  MessageCircle,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  verifyAndActivateOnline,
  downloadEmergencySafetyBackup,
  COUNTERLY_PACKAGES,
  getCheckoutPaymentUrl,
  openPurchaseEmailRequest,
  openPurchaseWhatsAppRequest,
  type CounterlyPackageOption,
} from '../lib/licensing';
import { db } from '../db/db';
import { type LicenseState, type ShopConfig } from '../types';

interface LicenseExpiredLockoutProps {
  license: LicenseState;
  onLicenseUpdated: () => void;
}

export const LicenseExpiredLockout: React.FC<LicenseExpiredLockoutProps> = ({
  license,
  onLicenseUpdated,
}) => {
  const [selectedPkg, setSelectedPkg] = useState<CounterlyPackageOption>(COUNTERLY_PACKAGES[1]);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedMid, setCopiedMid] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    db.shop_config
      .toArray()
      .then(cfgs => {
        if (cfgs[0]) setShopConfig(cfgs[0]);
      })
      .catch(() => {});
  }, []);

  const checkoutUrl = getCheckoutPaymentUrl(shopConfig);

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(license.machineId);
    setCopiedMid(true);
    setTimeout(() => setCopiedMid(false), 2000);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setErrorMessage('Please enter an activation key.');
      return;
    }

    setActivating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await verifyAndActivateOnline(inputKey, license.storeName);
      if (res.success) {
        setSuccessMessage(res.message);
        setInputKey('');
        setTimeout(() => {
          onLicenseUpdated();
        }, 900);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Failed to activate key');
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

  const isClockTampered = license.status === 'clock_tampered';

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-7 space-y-5 my-auto">
        <div className="text-center space-y-2">
          <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
            {isClockTampered ? <ShieldAlert className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <h1 className="text-lg font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
            {isClockTampered ? 'System Clock Discrepancy' : 'License Renewal Required'}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isClockTampered
              ? 'Your device clock was rolled back. Restore the correct date and time to resume counter billing.'
              : license.isTrial
              ? 'Your 14-day pilot has ended. Purchase an annual plan or enter a license key to resume.'
              : 'Your annual software license has expired. Purchase renewal or enter a renewal key to continue.'}
          </p>
        </div>

        <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-medium">Hardware Terminal ID</span>
            <button
              type="button"
              onClick={handleCopyMachineId}
              className="flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
            >
              {copiedMid ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedMid ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="font-mono text-xs font-semibold text-zinc-950 dark:text-zinc-50 select-all">
            {license.machineId}
          </div>
        </div>

        {!isClockTampered && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              {COUNTERLY_PACKAGES.map(pkg => {
                const active = selectedPkg.id === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPkg(pkg)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer ${
                      active
                        ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100'
                    }`}
                  >
                    <div className="text-[11px] font-bold leading-tight">{pkg.name}</div>
                    <div className="text-xs font-mono font-bold tabular-nums mt-0.5">{pkg.priceLabel}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {checkoutUrl && (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[150px] py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Pay Online</span>
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
                className="flex-1 min-w-[130px] py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email Order</span>
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
                className="flex-1 min-w-[130px] py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Order</span>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleActivate} className="space-y-3">
          <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Enter Renewal / Activation Key</span>
          </label>

          {errorMessage && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <input
            type="text"
            placeholder="CNTR-PRO-20271231-XXXX-XXXX"
            value={inputKey}
            onChange={e => setInputKey(e.target.value.toUpperCase())}
            className="w-full h-10 px-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono font-semibold uppercase text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          />

          <button
            type="submit"
            disabled={activating || !inputKey.trim()}
            className="w-full py-2.5 bg-zinc-950 dark:bg-zinc-100 hover:opacity-90 disabled:opacity-40 text-white dark:text-zinc-950 rounded-lg text-xs font-semibold transition-opacity cursor-pointer"
          >
            {activating ? 'Verifying Key...' : 'Unlock Terminal'}
          </button>
        </form>

        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleEmergencyBackup}
            disabled={isExporting}
            className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export Store Backup'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
