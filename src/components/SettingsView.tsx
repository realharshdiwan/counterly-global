import React, { useState, useEffect } from 'react';
import {
  Building2,
  Printer,
  Users,
  Sliders,
  Bluetooth,
  Save,
  Monitor,
  KeyRound,
  Download,
  Upload,
  Trash2,
  X,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { db, wipeAllLocalData } from '../db/db';
import {
  CURRENCY_PRESETS,
  getCurrencySymbol,
} from '../lib/locale';
import {
  type ShopConfig,
  type TaxLabel,
  type StoreModules,
  type LicenseState,
  ROLE_INFO,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { bluetoothPrinter, playBeep } from '../lib/printer';
import {
  getLicenseStatus,
  downloadEmergencySafetyBackup,
  getOrCreateMachineFingerprint,
  getBackupReminderStatus,
  STORAGE_CHECKOUT_URL_KEY,
} from '../lib/licensing';
import { StaffManagerModal } from './StaffManagerModal';
import { OnboardingWizardModal } from './OnboardingWizardModal';
import { LicenseManagerModal } from './LicenseManagerModal';

export const SettingsView: React.FC = () => {
  const { users, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'store' | 'hardware' | 'team' | 'modules'>('store');
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [license, setLicense] = useState<LicenseState>(() => getLicenseStatus());
  const [backupStatus, setBackupStatus] = useState(() => getBackupReminderStatus());

  // Store & Tax fields
  const [legalName, setLegalName] = useState('');
  const [shopTagline, setShopTagline] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [localeCode, setLocaleCode] = useState('en-IN');
  const [taxType, setTaxType] = useState<'none' | 'inclusive' | 'exclusive'>('none');
  const [taxLabel, setTaxLabel] = useState<TaxLabel>('GST');
  const [taxRate, setTaxRate] = useState('0');
  const [taxId, setTaxId] = useState('');
  const [upiId, setUpiId] = useState('');
  const [billPrefix, setBillPrefix] = useState('INV-');
  const [billSequence, setBillSequence] = useState('1001');
  const [termsConditions, setTermsConditions] = useState('');
  const [checkoutPaymentUrl, setCheckoutPaymentUrl] = useState('');

  // Hardware fields
  const [printerWidth, setPrinterWidth] = useState<32 | 48>(48);
  const [autoPrintCash, setAutoPrintCash] = useState(true);
  const [autoPrintUpi, setAutoPrintUpi] = useState(true);
  const [soundFeedback, setSoundFeedback] = useState(true);
  const [bleConnected, setBleConnected] = useState(false);
  const [bleDeviceName, setBleDeviceName] = useState('');
  const [isBleBusy, setIsBleBusy] = useState(false);

  // Opt-in modules
  const [modules, setModules] = useState<StoreModules>({
    alterations: false,
    institutional_accounts: false,
  });

  // Modals & status
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2600);
  };

  const loadConfig = async () => {
    try {
      const configs = await db.shop_config.toArray();
      if (configs.length > 0) {
        const c = configs[0];
        setConfig(c);
        setLegalName(c.legal_name || '');
        setShopTagline(c.shop_tagline || '');
        setShopAddress(c.shop_address || '');
        setShopPhone(c.shop_phone || '');
        setCurrencyCode(c.currency_code || 'INR');
        setCurrencySymbol(c.currency_symbol || '₹');
        setLocaleCode(c.locale || 'en-IN');
        setTaxType(c.tax_type || 'none');
        setTaxLabel(c.tax_label || 'GST');
        setTaxRate(String(c.tax_rate ?? 0));
        setTaxId(c.gstin || '');
        setUpiId(c.upi_id || '');
        setBillPrefix(c.bill_prefix || 'INV-');
        setBillSequence(String(c.bill_sequence || 1001));
        setTermsConditions(c.terms_conditions || '');
        setCheckoutPaymentUrl(
          c.checkout_payment_url || localStorage.getItem(STORAGE_CHECKOUT_URL_KEY) || ''
        );
        setPrinterWidth(c.printer_width || 48);
        setAutoPrintCash(c.auto_print_cash ?? true);
        setAutoPrintUpi(c.auto_print_upi ?? true);
        setSoundFeedback(c.sound_feedback ?? true);
        setModules(
          c.enabled_modules || {
            alterations: false,
            institutional_accounts: false,
          }
        );
      }
      setBleConnected(bluetoothPrinter.isConnected());
      setBleDeviceName(bluetoothPrinter.getDeviceName());
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handlePresetChange = (code: string) => {
    const preset = CURRENCY_PRESETS.find(p => p.code === code);
    if (!preset) return;
    setCurrencyCode(preset.code);
    setCurrencySymbol(preset.symbol);
    setLocaleCode(preset.locale);
    setTaxLabel(preset.defaultTaxLabel);
    if (preset.code === 'INR' && taxId.trim()) {
      setTaxType(prev => (prev === 'none' ? 'inclusive' : prev));
      setTaxRate(prev => (!prev || prev === '0' ? '5' : prev));
    } else {
      setTaxRate(String(preset.defaultTaxRate));
      setTaxType(preset.defaultTaxType);
    }
  };

  const handleTaxIdChange = (val: string) => {
    const hadGstin = taxId.trim().length > 0;
    const nextTrimmed = val.trim();
    setTaxId(val);
    if (!hadGstin && nextTrimmed.length > 0 && taxType === 'none') {
      setTaxLabel('GST');
      setTaxType('inclusive');
      setTaxRate(prev => (!prev || prev === '0' ? '5' : prev));
    } else if (hadGstin && nextTrimmed.length === 0) {
      setTaxType('none');
      setTaxRate('0');
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!config) return;
    setIsSaving(true);
    try {
      const updated: Partial<ShopConfig> = {
        legal_name: legalName.trim() || 'SIKKADESK RETAIL',
        shop_tagline: shopTagline.trim(),
        shop_address: shopAddress.trim(),
        shop_phone: shopPhone.trim(),
        currency_code: currencyCode,
        currency_symbol: currencySymbol,
        locale: localeCode,
        tax_type: taxType,
        tax_label: taxLabel,
        tax_rate: taxType === 'none' ? 0 : Math.max(0, parseFloat(taxRate) || 0),
        gstin: taxId.trim().toUpperCase(),
        gst_scheme: taxId.trim() && taxLabel === 'GST' && taxType !== 'none' ? 'regular' : 'none',
        upi_id: upiId.trim(),
        bill_prefix: billPrefix.trim() || 'INV-',
        bill_sequence: Math.max(1, parseInt(billSequence, 10) || 1001),
        terms_conditions: termsConditions.trim(),
        checkout_payment_url: checkoutPaymentUrl.trim() || undefined,
        printer_width: printerWidth,
        auto_print_cash: autoPrintCash,
        auto_print_upi: autoPrintUpi,
        sound_feedback: soundFeedback,
        enabled_modules: modules,
      };
      if (checkoutPaymentUrl.trim()) {
        localStorage.setItem(STORAGE_CHECKOUT_URL_KEY, checkoutPaymentUrl.trim());
      } else {
        localStorage.removeItem(STORAGE_CHECKOUT_URL_KEY);
      }
      await db.shop_config.update(config.id, updated);
      await loadConfig();
      if (soundFeedback) playBeep('success');
      showToast('Settings saved');
    } catch {
      showToast('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleModule = async (key: keyof StoreModules) => {
    if (!config) return;
    const nextModules = { ...modules, [key]: !modules[key] };
    setModules(nextModules);
    await db.shop_config.update(config.id, { enabled_modules: nextModules });
    await loadConfig();
    showToast(
      `${key === 'alterations' ? 'Tailoring & Alterations' : 'Institutional Accounts'} ${
        nextModules[key] ? 'enabled' : 'disabled'
      }`
    );
  };

  const handleConnectBle = async () => {
    setIsBleBusy(true);
    try {
      await bluetoothPrinter.connect();
      setBleConnected(true);
      setBleDeviceName(bluetoothPrinter.getDeviceName());
      showToast('Thermal printer connected');
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Bluetooth connection cancelled');
    } finally {
      setIsBleBusy(false);
    }
  };

  const handleDisconnectBle = async () => {
    await bluetoothPrinter.disconnect();
    setBleConnected(false);
    setBleDeviceName('');
    showToast('Printer disconnected');
  };

  const handleOpenCustomerDisplay = () => {
    const tid = getOrCreateMachineFingerprint();
    const url = `${window.location.origin}/?mode=customer_display&terminal=${encodeURIComponent(tid)}`;
    window.open(url, '_blank');
  };

  const handleImportJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        const data = parsed.data || parsed;
        if (Array.isArray(data.categories)) await db.categories.bulkPut(data.categories);
        if (Array.isArray(data.products)) await db.products.bulkPut(data.products);
        if (Array.isArray(data.variants)) await db.variants.bulkPut(data.variants);
        if (Array.isArray(data.bills)) await db.bills.bulkPut(data.bills);
        if (Array.isArray(data.schools)) await db.schools.bulkPut(data.schools);
        if (Array.isArray(data.advance_orders)) await db.advance_orders.bulkPut(data.advance_orders);
        if (Array.isArray(data.customers)) await db.customers.bulkPut(data.customers);
        if (Array.isArray(data.inventory_movements)) await db.inventory_movements.bulkPut(data.inventory_movements);
        if (Array.isArray(data.cash_drawer_entries)) await db.cash_drawer_entries.bulkPut(data.cash_drawer_entries);
        if (Array.isArray(data.shift_closes)) await db.shift_closes.bulkPut(data.shift_closes);
        if (Array.isArray(data.shop_config) && data.shop_config[0]) {
          await db.shop_config.put(data.shop_config[0]);
        }
        await loadConfig();
        showToast('Backup restored successfully');
      } catch {
        showToast('Invalid backup JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleWipeData = async () => {
    setIsWiping(true);
    try {
      await wipeAllLocalData();
      await loadConfig();
      setIsWipeModalOpen(false);
      showToast('Store catalog and invoices cleared');
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 px-4 py-2 rounded-lg shadow-lg text-xs font-semibold">
          {toastMessage}
        </div>
      )}

      {/* Top Settings Header & 4-Tab Nav */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
              Store Settings
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Configure tax &amp; currency, thermal hardware, staff PINs, and optional store modules
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsOnboardingModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer w-fit"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Run Setup Wizard</span>
          </button>
        </div>

        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 w-fit overflow-x-auto">
          {(
            [
              { id: 'store', label: 'Store & Tax', icon: Building2 },
              { id: 'hardware', label: 'Hardware & Printing', icon: Printer },
              { id: 'team', label: 'Team & PINs', icon: Users },
              { id: 'modules', label: 'Modules & License', icon: Sliders },
            ] as const
          ).map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel 1: Store & Tax */}
      {activeTab === 'store' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Store Legal Name
              </label>
              <input
                type="text"
                value={legalName}
                onChange={e => setLegalName(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Tagline / Subtitle
              </label>
              <input
                type="text"
                value={shopTagline}
                onChange={e => setShopTagline(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={shopPhone}
                onChange={e => setShopPhone(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Store Address
              </label>
              <input
                type="text"
                value={shopAddress}
                onChange={e => setShopAddress(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Currency &amp; Region
              </label>
              <select
                value={currencyCode}
                onChange={e => handlePresetChange(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              >
                {CURRENCY_PRESETS.map(p => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Tax Calculation
              </label>
              <select
                value={taxType}
                onChange={e => setTaxType(e.target.value as 'none' | 'inclusive' | 'exclusive')}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              >
                <option value="exclusive">Exclusive (Added at Checkout)</option>
                <option value="inclusive">Inclusive (Included in Price)</option>
                <option value="none">No Tax</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Tax Label
              </label>
              <select
                value={taxLabel}
                onChange={e => setTaxLabel(e.target.value as TaxLabel)}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              >
                <option value="GST">GST</option>
                <option value="Tax">Tax</option>
                <option value="VAT">VAT</option>
                <option value="Sales Tax">Sales Tax</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Tax Rate (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                disabled={taxType === 'none'}
                value={taxType === 'none' ? '0' : taxRate}
                onChange={e => setTaxRate(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono tabular-nums disabled:opacity-50"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                GSTIN / Tax ID
              </label>
              <input
                type="text"
                value={taxId}
                onChange={e => handleTaxIdChange(e.target.value.toUpperCase())}
                placeholder="e.g. 29ABCDE1234F1Z5"
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono uppercase"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Leave blank for no tax; enter GSTIN to enable GST.
              </p>
            </div>
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Store UPI ID (for QR)
              </label>
              <input
                type="text"
                value={upiId}
                onChange={e => setUpiId(e.target.value)}
                placeholder="e.g. store@okaxis"
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Receipt Prefix
              </label>
              <input
                type="text"
                value={billPrefix}
                onChange={e => setBillPrefix(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Next Receipt Number
              </label>
              <input
                type="number"
                value={billSequence}
                onChange={e => setBillSequence(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Receipt Return &amp; Exchange Footer
              </label>
              <input
                type="text"
                value={termsConditions}
                onChange={e => setTermsConditions(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Online License Checkout URL (Optional)
              </label>
              <input
                type="url"
                value={checkoutPaymentUrl}
                onChange={e => setCheckoutPaymentUrl(e.target.value)}
                placeholder="https://buy.stripe.com/..."
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Store & Tax Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Panel 2: Hardware & Printing */}
      {activeTab === 'hardware' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                Bluetooth Thermal Printer
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {bleConnected
                  ? `Connected to ${bleDeviceName}`
                  : 'Pair an ESC/POS Bluetooth thermal printer for instant receipts'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {bleConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnectBle}
                  className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 font-semibold cursor-pointer"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectBle}
                  disabled={isBleBusy}
                  className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>{isBleBusy ? 'Pairing...' : 'Pair Printer'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Thermal Paper Width
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPrinterWidth(48)}
                  className={`py-2.5 rounded-lg border font-semibold cursor-pointer ${
                    printerWidth === 48
                      ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                      : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  80mm (48 cols)
                </button>
                <button
                  type="button"
                  onClick={() => setPrinterWidth(32)}
                  className={`py-2.5 rounded-lg border font-semibold cursor-pointer ${
                    printerWidth === 32
                      ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent'
                      : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  58mm (32 cols)
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer">
                <span className="font-medium">Auto-print Cash sales on paired printer</span>
                <input
                  type="checkbox"
                  checked={autoPrintCash}
                  onChange={e => setAutoPrintCash(e.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer">
                <span className="font-medium">Play audio feedback on scans &amp; checkout</span>
                <input
                  type="checkbox"
                  checked={soundFeedback}
                  onChange={e => setSoundFeedback(e.target.checked)}
                />
              </label>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
                <Monitor className="w-4 h-4" />
                <span>Customer-Facing Pole Display</span>
              </div>
              <p className="text-zinc-500 mt-0.5">
                Launch a live counter display scoped to this terminal ({getOrCreateMachineFingerprint()})
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCustomerDisplay}
              className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-semibold cursor-pointer shrink-0"
            >
              Open Customer Display
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => handleSaveSettings()}
              disabled={isSaving}
              className="px-5 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Hardware Preferences</span>
            </button>
          </div>
        </div>
      )}

      {/* Panel 3: Team & PINs */}
      {activeTab === 'team' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                Counter Staff &amp; 6-Digit PINs
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Active operator: {currentUser?.name || 'Admin'} · Discount limits enforced per associate
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsStaffModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
            >
              Manage Team &amp; PINs
            </button>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map(u => {
              const roleMeta = ROLE_INFO[u.role];
              return (
                <div key={u.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-zinc-950 dark:text-zinc-50">{u.name}</div>
                    <div className="text-zinc-500 mt-0.5">
                      {roleMeta.label} · {u.active ? 'Active' : 'Disabled'}
                    </div>
                  </div>
                  <div className="text-right font-mono text-zinc-500">
                    {u.role === 'cashier'
                      ? `Max Disc: ${u.max_discount_percent ?? 10}% / ${getCurrencySymbol(config)}${
                          u.max_discount_amount ?? 500
                        }`
                      : 'Full Override'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Panel 4: Modules & License */}
      {activeTab === 'modules' && (
        <div className="space-y-5">
          {/* Opt-in Specialty Modules */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                Opt-In Store Modules
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Keep your register lean by enabling specialty workflows only if your store uses them.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-zinc-950 dark:text-zinc-50">
                    Tailoring &amp; Alterations
                  </div>
                  <p className="text-zinc-500 mt-0.5">
                    Adds the Alterations desk button in Register for garment hemming, deposits, and pickup tickets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleModule('alterations')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 ${
                    modules.alterations
                      ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                      : 'border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {modules.alterations ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-zinc-950 dark:text-zinc-50">
                    School &amp; Institutional Accounts
                  </div>
                  <p className="text-zinc-500 mt-0.5">
                    Adds contract price multipliers and account selectors in Catalog and Register.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleModule('institutional_accounts')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 ${
                    modules.institutional_accounts
                      ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                      : 'border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {modules.institutional_accounts ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          </div>

          {/* Software License */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-zinc-950 dark:text-zinc-50" />
                <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                  Terminal Software License
                </h3>
              </div>
              <p className="text-xs text-zinc-500 font-mono">
                {license.isTrial
                  ? `14-Day Pilot (${license.daysRemaining}d remaining)`
                  : `${license.tier.toUpperCase()} (${license.daysRemaining}d remaining)`}{' '}
                · Terminal ID: {license.machineId}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsLicenseModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer shrink-0"
            >
              Manage License Key
            </button>
          </div>

          {/* Backups & Reset */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                  Local Backup &amp; Restore
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Export or restore your entire catalog, variants, invoices, customers, shifts, and store settings as JSON.
                </p>
              </div>
              <div className="text-[11px] font-mono text-zinc-500 shrink-0">
                {backupStatus.lastBackupAt
                  ? `Last backup: ${new Date(backupStatus.lastBackupAt).toLocaleDateString()} (${backupStatus.hoursSince}h ago)`
                  : 'No backup exported yet'}
              </div>
            </div>

            {backupStatus.isOverdue && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200">
                Daily Backup Reminder: Export a fresh store backup every 24 hours to safeguard local register records.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <button
                type="button"
                onClick={async () => {
                  await downloadEmergencySafetyBackup();
                  setBackupStatus(getBackupReminderStatus());
                  showToast('Store JSON backup downloaded');
                }}
                className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON Backup</span>
              </button>

              <label className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <Upload className="w-3.5 h-3.5" />
                <span>Restore JSON Backup</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJsonBackup}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setIsWipeModalOpen(true)}
                className="px-3.5 py-2 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5 cursor-pointer ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Store Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <StaffManagerModal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
      />

      <OnboardingWizardModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        onCompleted={loadConfig}
      />

      <LicenseManagerModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
        license={license}
        onLicenseUpdated={() => setLicense(getLicenseStatus())}
      />

      {isWipeModalOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                Reset All Local Store Data?
              </h3>
              <button
                type="button"
                onClick={() => setIsWipeModalOpen(false)}
                className="p-1 text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              This clears all products, variants, categories, invoices, and movement history on this terminal. Your store configuration and staff PINs remain intact.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsWipeModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isWiping}
                onClick={handleWipeData}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer"
              >
                {isWiping ? 'Resetting...' : 'Reset Store Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
