import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Shirt,
  Scissors,
  Footprints,
  ShoppingBag,
  Store,
  AlertCircle,
  Lock,
  ShieldCheck,
  Printer,
  Volume2,
  Scan,
} from 'lucide-react';
import { db, seedStarterRetailCatalog } from '../db/db';
import { CURRENCY_PRESETS } from '../lib/locale';
import {
  type ShopConfig,
  type UserProfile,
  type StoreBusinessType,
  type TaxLabel,
} from '../types';
import { playBeep } from '../lib/printer';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

const STORE_TYPE_OPTIONS: {
  id: StoreBusinessType;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'apparel', title: 'Apparel & Fashion', subtitle: 'Tops, denim, outerwear', icon: Shirt },
  { id: 'footwear', title: 'Footwear & Bags', subtitle: 'Shoes, sneakers, leather', icon: Footprints },
  { id: 'boutique', title: 'Boutique & Studio', subtitle: 'Curated wear & tailoring', icon: Scissors },
  { id: 'general', title: 'General Retail', subtitle: 'Multi-category store', icon: ShoppingBag },
  { id: 'uniform', title: 'School Uniforms', subtitle: 'Institutional accounts', icon: Store },
];

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  onCompleted,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Store & Locale
  const [storeType, setStoreType] = useState<StoreBusinessType>('apparel');
  const [storeName, setStoreName] = useState('SIKKADESK RETAIL');
  const [tagline, setTagline] = useState('Apparel, Footwear & Boutique');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [taxType, setTaxType] = useState<'none' | 'exclusive' | 'inclusive'>('none');
  const [taxLabel, setTaxLabel] = useState<TaxLabel>('GST');
  const [taxRate, setTaxRate] = useState('0');
  const [gstin, setGstin] = useState('');

  // Step 2: Modules & Hardware
  const [enableAlterations, setEnableAlterations] = useState(false);
  const [enableInstitutional, setEnableInstitutional] = useState(false);
  const [printerWidth, setPrinterWidth] = useState<32 | 48>(48);
  const [soundFeedback, setSoundFeedback] = useState(true);
  const [scannedTestBarcode, setScannedTestBarcode] = useState('');
  const [testedAudio, setTestedAudio] = useState(false);

  // Step 3: Catalog & PINs
  const [seedStarter, setSeedStarter] = useState(true);
  const [adminPin, setAdminPin] = useState('123456');
  const [cashierPin, setCashierPin] = useState('111111');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSelectStoreType = (id: StoreBusinessType) => {
    setStoreType(id);
    setEnableAlterations(id === 'boutique' || id === 'uniform');
    setEnableInstitutional(id === 'uniform');

    if (id === 'apparel') setTagline('Apparel & Fashion Store');
    else if (id === 'footwear') setTagline('Footwear & Accessories');
    else if (id === 'boutique') setTagline('Boutique & Custom Fitting');
    else if (id === 'uniform') setTagline('School & Institutional Apparel');
    else setTagline('Retail Store');
  };

  const handleCurrencyChange = (code: string) => {
    setCurrencyCode(code);
    const preset = CURRENCY_PRESETS.find(p => p.code === code);
    if (preset) {
      setTaxLabel(preset.defaultTaxLabel);
      if (preset.code === 'INR' && gstin.trim()) {
        setTaxType('inclusive');
        setTaxRate(prev => (!prev || prev === '0' ? '5' : prev));
      } else {
        setTaxRate(String(preset.defaultTaxRate));
        setTaxType(preset.defaultTaxType);
      }
    }
  };

  const handleGstinChange = (val: string) => {
    const hadGstin = gstin.trim().length > 0;
    const nextTrimmed = val.trim();
    setGstin(val);
    if (!hadGstin && nextTrimmed.length > 0 && taxType === 'none') {
      setTaxLabel('GST');
      setTaxType('inclusive');
      setTaxRate(prev => (!prev || prev === '0' ? '5' : prev));
    } else if (hadGstin && nextTrimmed.length === 0) {
      setTaxType('none');
      setTaxRate('0');
    }
  };

  const handleNextStep = () => {
    setErrorMsg(null);
    if (currentStep === 1 && !storeName.trim()) {
      setErrorMsg('Please enter your store name to continue.');
      return;
    }
    setCurrentStep(prev => (prev + 1) as 1 | 2 | 3);
  };

  const handleFinish = async () => {
    if (adminPin.length !== 6 || cashierPin.length !== 6) {
      setErrorMsg('Both Admin and Associate PINs must be 6 digits.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const preset = CURRENCY_PRESETS.find(p => p.code === currencyCode) || CURRENCY_PRESETS[0];
      const existingConfigs = await db.shop_config.toArray();
      const current = existingConfigs[0];

      const updatedConfig: ShopConfig = {
        id: current?.id || 'cfg_default',
        legal_name: storeName.trim(),
        shop_tagline: tagline.trim(),
        shop_phone: phone.trim(),
        shop_address: address.trim(),
        store_type: storeType,
        currency_code: preset.code,
        currency_symbol: preset.symbol,
        locale: preset.locale,
        tax_label: taxLabel,
        tax_type: taxType,
        tax_rate: taxType === 'none' ? 0 : Math.max(0, parseFloat(taxRate) || 0),
        gstin: gstin.trim().toUpperCase(),
        gst_scheme: gstin.trim() && taxLabel === 'GST' && taxType !== 'none' ? 'regular' : 'none',
        upi_id: current?.upi_id || '',
        printer_width: printerWidth,
        auto_print_cash: true,
        auto_print_upi: true,
        sound_feedback: soundFeedback,
        bill_prefix: current?.bill_prefix || 'INV-',
        bill_sequence: current?.bill_sequence || 1001,
        enabled_modules: {
          alterations: enableAlterations,
          institutional_accounts: enableInstitutional,
        },
        terms_conditions: current?.terms_conditions || '7-day exchange with original receipt and tags intact.',
      };

      if (current?.id) {
        await db.shop_config.update(current.id, updatedConfig);
      } else {
        await db.shop_config.add(updatedConfig);
      }

      const userList = await db.users.toArray();
      const adminStaff = userList.find((s: UserProfile) => s.role === 'admin');
      if (adminStaff?.id) await db.users.update(adminStaff.id, { pin: adminPin });
      const cashierStaff = userList.find((s: UserProfile) => s.role === 'cashier');
      if (cashierStaff?.id) await db.users.update(cashierStaff.id, { pin: cashierPin });

      if (seedStarter) {
        await seedStarterRetailCatalog();
      }

      localStorage.setItem('counterly_onboarding_completed', 'true');
      onCompleted();
    } catch (err) {
      console.error('Onboarding save failed:', err);
      setErrorMsg('Could not save store configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const steps = [
    { num: 1, title: 'Store & Locale', sub: 'Type, currency & tax' },
    { num: 2, title: 'Modules & Hardware', sub: 'Optional tools & printer' },
    { num: 3, title: 'Catalog & PINs', sub: 'Starter items & access' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-950/75 backdrop-blur-md">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
              Set Up SikkaDesk POS
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Step {currentStep} of 3 · Takes under a minute
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
            aria-label="Close setup wizard"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3-Step Segmented Progress */}
        <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 grid grid-cols-3 gap-2">
          {steps.map(step => {
            const isActive = currentStep === step.num;
            const isDone = currentStep > step.num;
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => {
                  if (step.num <= currentStep) setCurrentStep(step.num as 1 | 2 | 3);
                }}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-colors ${
                  isActive
                    ? 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-950 dark:text-zinc-50'
                    : isDone
                    ? 'text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-white/60 dark:hover:bg-zinc-900/60'
                    : 'text-zinc-400 dark:text-zinc-600'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    isActive
                      ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                      : isDone
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : step.num}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{step.title}</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate hidden sm:block">
                    {step.sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  1. Retail Store Vertical
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Sets default categories and optional modules for your counter.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-3">
                  {STORE_TYPE_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const selected = storeType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectStoreType(opt.id)}
                        className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                          selected
                            ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                            : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold leading-tight">{opt.title}</div>
                          <div className="text-[11px] opacity-70 mt-0.5 leading-tight">{opt.subtitle}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                    Store Name *
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    placeholder="e.g. Vastra Apparel Studio"
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                    Receipt Subtitle
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={e => setTagline(e.target.value)}
                    placeholder="Apparel & Accessories"
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                    Currency &amp; Region
                  </label>
                  <select
                    value={currencyCode}
                    onChange={e => handleCurrencyChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    {CURRENCY_PRESETS.map(p => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                      Tax Mode
                    </label>
                    <select
                      value={taxType}
                      onChange={e => setTaxType(e.target.value as 'none' | 'exclusive' | 'inclusive')}
                      className="w-full h-10 px-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-950 dark:text-zinc-50"
                    >
                      <option value="exclusive">Exclusive ({taxLabel})</option>
                      <option value="inclusive">Inclusive ({taxLabel})</option>
                      <option value="none">No Tax</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                      Tax Rate %
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      disabled={taxType === 'none'}
                      value={taxType === 'none' ? '0' : taxRate}
                      onChange={e => setTaxRate(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm tabular-nums text-zinc-950 dark:text-zinc-50 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                    GSTIN (Optional — enables GST)
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={e => handleGstinChange(e.target.value.toUpperCase())}
                    placeholder="Leave blank for no tax (e.g. 29ABCDE1234F1Z5)"
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-mono uppercase text-zinc-950 dark:text-zinc-50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                    Store Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98450 12345"
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-950 dark:text-zinc-50"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                    Store Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="42 Commercial Street, Bengaluru"
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-950 dark:text-zinc-50"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  Optional Store Modules
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Keep your register focused. Only turn on specialized workflows if your shop needs them.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => setEnableAlterations(v => !v)}
                    className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      enableAlterations
                        ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-950 dark:text-zinc-50">
                        Tailoring &amp; Alterations
                      </span>
                      <span
                        className={`text-[11px] font-medium ${
                          enableAlterations ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'
                        }`}
                      >
                        {enableAlterations ? 'Enabled' : 'Off'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Track hemming, custom stitching tickets, deposits, and pickup dates.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEnableInstitutional(v => !v)}
                    className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      enableInstitutional
                        ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-950 dark:text-zinc-50">
                        School &amp; Institutional Accounts
                      </span>
                      <span
                        className={`text-[11px] font-medium ${
                          enableInstitutional ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'
                        }`}
                      >
                        {enableInstitutional ? 'Enabled' : 'Off'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Enable school directories, B2B institutional accounts, and fit history.
                    </p>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  Receipt Printer &amp; Peripherals
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrinterWidth(48)}
                    className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      printerWidth === 48
                        ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                        : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold flex items-center gap-1.5">
                        <Printer className="w-3.5 h-3.5" />
                        80mm Desktop Thermal
                      </span>
                      <span className="text-[11px] opacity-70 font-mono">48 cols</span>
                    </div>
                    <p className="text-xs opacity-75 mt-1">Standard countertop receipt printers with auto-cutter.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrinterWidth(32)}
                    className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      printerWidth === 32
                        ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                        : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold flex items-center gap-1.5">
                        <Printer className="w-3.5 h-3.5" />
                        58mm Compact Thermal
                      </span>
                      <span className="text-[11px] opacity-70 font-mono">32 cols</span>
                    </div>
                    <p className="text-xs opacity-75 mt-1">Portable Bluetooth or space-saving counter printers.</p>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      playBeep('success');
                      setTestedAudio(true);
                      setSoundFeedback(true);
                    }}
                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-left flex items-center justify-between cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                      <Volume2 className="w-4 h-4 text-zinc-500" />
                      <span>Test Scanner Audio Beep</span>
                    </div>
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      {testedAudio ? 'Tested' : 'Tap to test'}
                    </span>
                  </button>

                  <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center gap-2">
                    <Scan className="w-4 h-4 text-zinc-500 shrink-0" />
                    <input
                      type="text"
                      value={scannedTestBarcode}
                      onChange={e => {
                        setScannedTestBarcode(e.target.value);
                        if (e.target.value.length >= 4) playBeep('success');
                      }}
                      placeholder="Scan a barcode here to test..."
                      className="w-full bg-transparent text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  Initial Catalog Data
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => setSeedStarter(true)}
                    className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      seedStarter
                        ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                        : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">Load Sample Retail Products</div>
                    <p className="text-xs opacity-75 mt-1">
                      Adds 4 ready-to-sell items with Size × Color variants and barcodes so you can test checkout immediately.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSeedStarter(false)}
                    className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      !seedStarter
                        ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                        : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">Start with Empty Catalog</div>
                    <p className="text-xs opacity-75 mt-1">
                      Clean slate ready for CSV import or manual product creation.
                    </p>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50 mb-3">
                  Staff Access PINs (6 Digits)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Store Admin PIN</span>
                    </div>
                    <input
                      type="password"
                      maxLength={6}
                      value={adminPin}
                      onChange={e => setAdminPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full h-11 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-center text-lg font-bold tracking-widest text-zinc-950 dark:text-zinc-50"
                    />
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Full catalog, stock, pricing, team, and settings access.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      <Lock className="w-4 h-4" />
                      <span>Counter Associate PIN</span>
                    </div>
                    <input
                      type="password"
                      maxLength={6}
                      value={cashierPin}
                      onChange={e => setCashierPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full h-11 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-center text-lg font-bold tracking-widest text-zinc-950 dark:text-zinc-50"
                    />
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Fast checkout, receipts, and customer lookup only.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setCurrentStep(prev => (prev - 1) as 1 | 2 | 3);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Open Register'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
