import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Printer, 
  Bluetooth, 
  Save, 
  Building2, 
  Database,
  CloudDownload,
  CloudUpload,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Table,
  KeyRound,
  AlertTriangle,
  X,
  Sparkles,
  Users,
  ShieldCheck,
  UserPlus,
  Download,
  Upload,
  HardDrive,
  FolderTree,
  FileSpreadsheet,
  Percent,
  Calendar,
  Info,
  MessageCircle
} from 'lucide-react';
import { db, wipeAllLocalData, hardResetEntireApp, purgeLegacyMockData, DEFAULT_CATEGORIES } from '../db/db';
import { type ShopConfig, ROLE_INFO, type Category, type GstSchemeType } from '../types';
import { useAuth } from '../context/AuthContext';
import { bluetoothPrinter, playBeep } from '../lib/printer';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  introspectAllSupabaseTables, 
  detectKeyType,
  pushLocalDataToSupabase,
  type SupabaseConfig,
  type IntrospectionResult
} from '../lib/supabase';
import { SupabaseImportModal } from './SupabaseImportModal';
import { StaffManagerModal } from './StaffManagerModal';
import { CategoryManagerModal } from './CategoryManagerModal';
import { GstCompositionReportModal } from './GstCompositionReportModal';
import { OnboardingWizardModal } from './OnboardingWizardModal';
import { InstantLicenseCheckoutModal } from './InstantLicenseCheckoutModal';
import { 
  getLicenseStatus, 
  activateLicenseKey, 
  downloadEmergencySafetyBackup,
  VENDOR_BRAND_NAME, 
  VENDOR_CONTACT_PHONE 
} from '../lib/licensing';
import { type LicenseState } from '../types';
import { VendorLicenseGeneratorModal } from './VendorLicenseGeneratorModal';
import { Zap } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { users, currentUser } = useAuth();
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [bleConnected, setBleConnected] = useState(false);
  const [bleDeviceName, setBleDeviceName] = useState('');
  const [isBleTesting, setIsBleTesting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isGstModalOpen, setIsGstModalOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'store' | 'gst' | 'printers' | 'staff' | 'supabase' | 'backup' | 'license'>('store');
  const [isPushingSupabase, setIsPushingSupabase] = useState(false);
  const [pushStatusMsg, setPushStatusMsg] = useState<string | null>(null);



  // License State
  const [license, setLicense] = useState<LicenseState>(() => getLicenseStatus());
  const [licenseInputKey, setLicenseInputKey] = useState('');
  const [isActivatingLicense, setIsActivatingLicense] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseSuccess, setLicenseSuccess] = useState<string | null>(null);
  const [copiedMachineId, setCopiedMachineId] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isEmergencyExporting, setIsEmergencyExporting] = useState(false);

  // Form state
  const [legalName, setLegalName] = useState('');
  const [shopTagline, setShopTagline] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [upiId, setUpiId] = useState('');
  const [printerWidth, setPrinterWidth] = useState<32 | 48>(48);
  const [autoPrintCash, setAutoPrintCash] = useState(true);
  const [autoPrintUpi, setAutoPrintUpi] = useState(true);
  const [soundFeedback, setSoundFeedback] = useState(true);
  const [billPrefix, setBillPrefix] = useState('SG-2026-');
  const [billSequence, setBillSequence] = useState(1001);
  const [gstScheme, setGstScheme] = useState<GstSchemeType>('composition');
  const [bankName, setBankName] = useState('State Bank of India');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [stateName, setStateName] = useState('Rajasthan');
  const [stateCode, setStateCode] = useState('08');

  // Supabase State
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [testResult, setTestResult] = useState<IntrospectionResult | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Wipe Modal State (in-app modal, no window.confirm)
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [preserveSupabase, setPreserveSupabase] = useState(true);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const loadConfig = async () => {
    try {
      const configs = await db.shop_config.toArray();
      if (configs.length > 0) {
        const c = configs[0];
        setConfig(c);
        setLegalName(c.legal_name);
        setShopTagline(c.shop_tagline);
        setShopAddress(c.shop_address);
        setShopPhone(c.shop_phone);
        setGstin(c.gstin);
        setUpiId(c.upi_id);
        setPrinterWidth(c.printer_width || 48);
        setAutoPrintCash(c.auto_print_cash ?? true);
        setAutoPrintUpi(c.auto_print_upi ?? true);
        setSoundFeedback(c.sound_feedback ?? true);
        setBillPrefix(c.bill_prefix || 'SG-2026-');
        setBillSequence(c.bill_sequence || 1001);
        setGstScheme(c.gst_scheme || 'composition');
        setBankName(c.bank_name || 'State Bank of India');
        setBankAccountNo(c.bank_account_no || '');
        setBankIfsc(c.bank_ifsc || '');
        setBankBranch(c.bank_branch || '');
        setStateName(c.state_name || 'Rajasthan');
        setStateCode(c.state_code || '08');
      }

      setBleConnected(bluetoothPrinter.isConnected());
      setBleDeviceName(bluetoothPrinter.getDeviceName());

      // Load Supabase config
      const sCfg = getSupabaseConfig();
      setSupabaseUrl(sCfg.url);
      setSupabaseAnonKey(sCfg.anonKey);
      setAutoSync(sCfg.autoSync);

      // Load Categories
      let cats = await db.categories.toArray();
      if (cats.length === 0) {
        await db.categories.bulkAdd(DEFAULT_CATEGORIES);
        cats = await db.categories.toArray();
      }
      setCategories(cats.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSaveConfig = async () => {
    if (!config) return;
    try {
      const updated: ShopConfig = {
        ...config,
        legal_name: legalName.trim(),
        shop_tagline: shopTagline.trim(),
        shop_address: shopAddress.trim(),
        shop_phone: shopPhone.trim(),
        gstin: gstin.trim(),
        upi_id: upiId.trim(),
        printer_width: printerWidth,
        auto_print_cash: autoPrintCash,
        auto_print_upi: autoPrintUpi,
        sound_feedback: soundFeedback,
        bill_prefix: billPrefix.trim(),
        bill_sequence: Number(billSequence),
        gst_scheme: gstScheme,
        bank_name: bankName.trim(),
        bank_account_no: bankAccountNo.trim(),
        bank_ifsc: bankIfsc.trim(),
        bank_branch: bankBranch.trim(),
        state_name: stateName.trim(),
        state_code: stateCode.trim(),
      };

      await db.shop_config.update(config.id, updated);
      setConfig(updated);

      // Save Supabase settings
      const sCfg: SupabaseConfig = {
        url: supabaseUrl.trim(),
        anonKey: supabaseAnonKey.trim(),
        autoSync,
        lastSyncedAt: getSupabaseConfig().lastSyncedAt,
      };
      saveSupabaseConfig(sCfg);

      showToast('Settings saved successfully!');
    } catch (err) {
      console.error('Failed to save settings:', err);
      showToast('Error saving settings');
    }
  };

  // Immediate scheme toggle and persistence
  const handleGstSchemeChange = async (newScheme: GstSchemeType) => {
    setGstScheme(newScheme);
    if (config) {
      try {
        const updated: ShopConfig = { ...config, gst_scheme: newScheme };
        await db.shop_config.update(config.id, { gst_scheme: newScheme });
        setConfig(updated);
        showToast(
          newScheme === 'regular'
            ? 'GST Scheme set to Regular GST (Tax Invoice)'
            : newScheme === 'none'
            ? 'GST Scheme set to Unregistered (Retail Cash Memo)'
            : 'GST Scheme set to Composition Scheme (1%)'
        );
      } catch (err) {
        console.error('Failed to update GST scheme:', err);
      }
    }
  };

  // Test Supabase Connection & Introspect Tables
  const handleTestSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      showToast('Please enter Supabase Project URL and Key');
      return;
    }

    // Save current fields first
    const sCfg: SupabaseConfig = {
      url: supabaseUrl.trim(),
      anonKey: supabaseAnonKey.trim(),
      autoSync,
      lastSyncedAt: getSupabaseConfig().lastSyncedAt,
    };
    saveSupabaseConfig(sCfg);

    setIsTestingSupabase(true);
    setTestResult(null);

    try {
      const res = await introspectAllSupabaseTables(supabaseUrl, supabaseAnonKey);
      setTestResult(res);
      if (res.success) {
        showToast('Supabase connected!');
      } else {
        showToast('Supabase connection issue');
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: (err as Error)?.message || 'Connection failed',
        keyType: detectKeyType(supabaseAnonKey),
        allTables: [],
        suggestedMapping: {},
      });
    } finally {
      setIsTestingSupabase(false);
    }
  };

  // Push all local data to Supabase for safe keeping
  const handlePushToSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      showToast('Please enter your Supabase URL and Key first.');
      return;
    }

    setIsPushingSupabase(true);
    setPushStatusMsg('Connecting and preparing local records...');
    try {
      const res = await pushLocalDataToSupabase((step, count) => {
        setPushStatusMsg(`Uploading ${count} ${step} to Supabase Cloud...`);
      });

      if (res.success) {
        showToast(res.message);
        setPushStatusMsg(res.message);
        // Refresh last synced date
        loadConfig();
      } else {
        showToast(res.message);
        setPushStatusMsg(`Upload notice: ${res.message}`);
      }
    } catch (err: any) {
      console.error('Push to Supabase error:', err);
      showToast(err.message || 'Push failed');
      setPushStatusMsg(`Error: ${err.message || 'Failed to upload'}`);
    } finally {
      setIsPushingSupabase(false);
    }
  };

  // Wipe All Local Data & Hard Reset (Executed via in-app modal)
  const handleExecuteWipe = async () => {
    setIsWiping(true);
    try {
      await hardResetEntireApp(preserveSupabase);
      await wipeAllLocalData();
      await purgeLegacyMockData();
      showToast('All local data wiped! Clean slate ready.');
      setIsWipeModalOpen(false);
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error('Wipe data error:', err);
      showToast('Failed to wipe data');
    } finally {
      setIsWiping(false);
    }
  };

  // Connect BLE Printer
  const handleConnectBle = async () => {
    try {
      setIsBleTesting(true);
      await bluetoothPrinter.connect();
      setBleConnected(bluetoothPrinter.isConnected());
      setBleDeviceName(bluetoothPrinter.getDeviceName());
      showToast(`Connected to ${bluetoothPrinter.getDeviceName()}!`);
    } catch (err: unknown) {
      console.error('BLE connection error:', err);
      showToast((err as Error)?.message || 'Failed to connect printer');
    } finally {
      setIsBleTesting(false);
    }
  };

  // Disconnect BLE
  const handleDisconnectBle = async () => {
    await bluetoothPrinter.disconnect();
    setBleConnected(false);
    setBleDeviceName('');
    showToast('Printer disconnected');
  };

  // Test Print via BLE
  const handleTestPrintBle = async () => {
    if (!bluetoothPrinter.isConnected()) {
      showToast('Please connect to thermal printer first.');
      return;
    }

    try {
      setIsBleTesting(true);
      const testText = `\x1B@\x1Ba\x01\x1BE\x01${legalName || 'SARASWATI GARMENTS'}\x1BE\x00\nTHERMAL PRINTER TEST OK\n--------------------------------\nDate: ${new Date().toLocaleTimeString('en-IN')}\nStatus: Ready for Billing\n\n\n\x1DV\x42\x00`;
      const data = new TextEncoder().encode(testText);
      await bluetoothPrinter.printData(data);
      showToast('Test ticket printed successfully!');
    } catch (err: unknown) {
      console.error('Test print failed:', err);
      showToast('Print failed: ' + (err as Error)?.message);
    } finally {
      setIsBleTesting(false);
    }
  };

  // Audio test
  const handleTestAudio = () => {
    playBeep('success');
    showToast('Audio beep played');
  };

  // One-click full database backup export
  const handleExportBackup = async () => {
    try {
      const backupData = {
        appName: 'Counterly POS',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        schools: await db.schools.toArray(),
        products: await db.products.toArray(),
        size_groups: await db.size_groups.toArray(),
        sizes: await db.sizes.toArray(),
        price_list: await db.price_list.toArray(),
        stocks: await db.stocks.toArray(),
        bills: await db.bills.toArray(),
        advance_orders: await db.advance_orders.toArray(),
        students: await db.students.toArray(),
        shop_config: await db.shop_config.toArray(),
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `counterly_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      showToast('Database backup downloaded successfully!');
    } catch (err) {
      console.error('Backup error:', err);
      showToast('Failed to export backup');
    }
  };

  // Restore from backup JSON
  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed.schools && !parsed.products && !parsed.bills) {
        showToast('Invalid backup file format');
        return;
      }

      if (parsed.schools && Array.isArray(parsed.schools)) {
        await db.schools.clear();
        await db.schools.bulkAdd(parsed.schools);
      }
      if (parsed.products && Array.isArray(parsed.products)) {
        await db.products.clear();
        await db.products.bulkAdd(parsed.products);
      }
      if (parsed.size_groups && Array.isArray(parsed.size_groups)) {
        await db.size_groups.clear();
        await db.size_groups.bulkAdd(parsed.size_groups);
      }
      if (parsed.sizes && Array.isArray(parsed.sizes)) {
        await db.sizes.clear();
        await db.sizes.bulkAdd(parsed.sizes);
      }
      if (parsed.price_list && Array.isArray(parsed.price_list)) {
        await db.price_list.clear();
        await db.price_list.bulkAdd(parsed.price_list);
      }
      if (parsed.stocks && Array.isArray(parsed.stocks)) {
        await db.stocks.clear();
        await db.stocks.bulkAdd(parsed.stocks);
      }
      if (parsed.bills && Array.isArray(parsed.bills)) {
        await db.bills.clear();
        await db.bills.bulkAdd(parsed.bills);
      }
      if (parsed.advance_orders && Array.isArray(parsed.advance_orders)) {
        await db.advance_orders.clear();
        await db.advance_orders.bulkAdd(parsed.advance_orders);
      }

      showToast('Backup restored successfully!');
      loadConfig();
    } catch (err) {
      console.error('Restore error:', err);
      showToast('Failed to parse and restore backup file');
    } finally {
      e.target.value = '';
    }
  };

  const currentKeyType = detectKeyType(supabaseAnonKey);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1D1D1F] text-white px-5 py-2 rounded-xl shadow-lg border border-[#333336] font-semibold text-xs animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Top Header Card with Tabs */}
      <div className="bg-white rounded-3xl border border-[#E5E5E7] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E5E7]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-xl text-[#1D1D1F] tracking-tight">Shop &amp; System Settings</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] uppercase tracking-wide">
                  {activeTab}
                </span>
              </div>
              <p className="text-xs text-[#86868B] mt-0.5">
                Receipt branding, hardware, staff PINs, two-way Supabase cloud sync, and offline backups
              </p>
            </div>
          </div>

          <button
            onClick={handleSaveConfig}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1D1D1F] hover:bg-[#333336] text-white rounded-xl text-xs font-extrabold transition-all shadow-xs shrink-0 self-start sm:self-center cursor-pointer active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save All Settings</span>
          </button>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-1.5 mt-4 p-1.5 bg-[#F5F5F7] rounded-2xl border border-[#E5E5E7] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('store')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'store'
                ? 'bg-[#1D1D1F] text-white shadow-xs'
                : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/80'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Store &amp; Receipts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gst')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'gst'
                ? 'bg-[#1D1D1F] text-white shadow-xs'
                : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/80'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>GST</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('printers')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'printers'
                ? 'bg-[#1D1D1F] text-white shadow-xs'
                : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/80'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Printers &amp; Audio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-[#1D1D1F] text-white shadow-xs'
                : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/80'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Team &amp; Roles</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('supabase')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'supabase'
                ? 'bg-[#1D1D1F] text-white shadow-xs'
                : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/80'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud Sync (Supabase)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-[#1D1D1F] text-white shadow-xs'
                : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/80'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Backups &amp; Reset</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLicense(getLicenseStatus());
              setActiveTab('license');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'license'
                ? 'bg-[#1D1D1F] text-white shadow-xs'
                : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/80'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>License &amp; Plan</span>
          </button>
        </div>
      </div>


      {/* TAB 1: STORE & RECEIPTS */}
      {activeTab === 'store' && (
        <div className="space-y-5">
          {/* Shop Profile Section */}
          <div className="bg-white rounded-2xl border border-[#E5E5E7] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#1D1D1F] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Shop Information (Printed on Receipts)
              </h2>
              <button
                type="button"
                onClick={() => setIsOnboardingModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-[#E5E5E7] text-[#1D1D1F] text-xs font-bold transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0071E3]" />
                <span>Re-run Store Setup Wizard</span>
              </button>
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#86868B] block mb-1">
                  Shop / Legal Name
                </label>
                <input
                  type="text"
                  value={legalName}
                  onChange={e => setLegalName(e.target.value)}
                  placeholder="SARASWATI GARMENTS"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#86868B] block mb-1">
                  Tagline / Subtitle
                </label>
                <input
                  type="text"
                  value={shopTagline}
                  onChange={e => setShopTagline(e.target.value)}
                  placeholder="School Uniforms, Footwear & Accessories"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#86868B] block mb-1">
                  Shop Address
                </label>
                <input
                  type="text"
                  value={shopAddress}
                  onChange={e => setShopAddress(e.target.value)}
                  placeholder="14-16 Market Complex, Station Road"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-white text-[#1D1D1F]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#86868B] block mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={shopPhone}
                  onChange={e => setShopPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-white text-[#1D1D1F]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#86868B] block mb-1 flex items-center justify-between">
                  <span>GSTIN Number (Optional)</span>
                  <span className="text-[10px] text-[#1D1D1F] font-bold bg-[#F5F5F7] px-1.5 py-0.5 rounded border border-[#E5E5E7]">
                    {gstScheme === 'regular'
                      ? 'Regular GST'
                      : gstScheme === 'none'
                      ? 'Unregistered'
                      : 'Composition (1%)'}
                  </span>
                </label>
                <input
                  type="text"
                  value={gstin}
                  onChange={e => setGstin(e.target.value.toUpperCase())}
                  placeholder="Enter GSTIN (e.g. 15-character)"
                  maxLength={15}
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-white text-[#1D1D1F]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#86868B] block mb-1 flex items-center justify-between">
                  <span>Shop UPI ID (For Counter QR)</span>
                  <span className="text-[10px] text-[#1D1D1F] font-bold">Live GPay / PhonePe QR</span>
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  placeholder="saraswatigarments@okhdfcbank"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-white"
                />
              </div>
            </div>
          </div>

          {/* Numbering & Sequence */}
          <div className="bg-white rounded-2xl border border-[#E5E5E7] p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#1D1D1F]">
              Bill Numbering Series
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#86868B] block mb-1">
                  Bill Prefix
                </label>
                <input
                  type="text"
                  value={billPrefix}
                  onChange={e => setBillPrefix(e.target.value)}
                  placeholder="SG-2026-"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-white text-[#1D1D1F]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#86868B] block mb-1">
                  Current Sequence Counter
                </label>
                <input
                  type="number"
                  value={billSequence}
                  onChange={e => setBillSequence(Number(e.target.value))}
                  placeholder="1001"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-white text-[#1D1D1F]"
                />
              </div>
            </div>
          </div>

          {/* Product Categories Section */}
          <div className="bg-white rounded-2xl border border-[#E5E5E7] p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E5E7]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs shrink-0">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-extrabold text-[#1D1D1F]">
                      Product Categories
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7]">
                      {categories.length} Categories
                    </span>
                  </div>
                  <p className="text-xs text-[#86868B] mt-0.5">
                    Classification categories for school uniforms, footwear, accessories, and billing filters.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] hover:bg-[#E5E5E7] text-xs font-bold text-[#1D1D1F] flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer self-start sm:self-center"
              >
                <FolderTree className="w-3.5 h-3.5 text-[#1D1D1F]" />
                <span>Manage Categories</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-0.5">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#F5F5F7] hover:bg-[#E5E5E7] border border-[#E5E5E7] text-xs font-bold text-[#1D1D1F] capitalize flex items-center gap-2 transition-all shadow-2xs cursor-pointer group"
                  title="Click to edit category in manager"
                >
                  <span className="w-2 h-2 rounded-full bg-[#1D1D1F] group-hover:scale-110 transition-transform" />
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: GST */}
      {activeTab === 'gst' && (
        <div className="bg-white rounded-2xl border border-[#E5E5E7] p-5 shadow-xs space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E5E7]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-[#1D1D1F]">GST</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7]">
                  {gstScheme === 'regular'
                    ? 'Regular GST (Tax Invoice)'
                    : gstScheme === 'none'
                    ? 'Unregistered (Cash Memo)'
                    : 'Composition (1%)'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsGstModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#1D1D1F] hover:bg-[#333336] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer self-start sm:self-center"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>
                {gstScheme === 'regular'
                  ? 'GSTR Sales Helper'
                  : gstScheme === 'none'
                  ? 'Sales Summary'
                  : 'CMP-08 Return Helper'}
              </span>
            </button>
          </div>

          {/* GSTIN & Scheme Selection */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#86868B] block mb-1">
                GSTIN
              </label>
              <input
                type="text"
                value={gstin}
                onChange={e => setGstin(e.target.value.toUpperCase())}
                placeholder="Enter GSTIN (e.g. 15-character)"
                maxLength={15}
                className="w-full sm:max-w-md h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-mono font-bold uppercase focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-white text-[#1D1D1F]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#86868B] block mb-2">
                GST Registration Scheme
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleGstSchemeChange('composition')}
                  className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                    gstScheme === 'composition'
                      ? 'border-[#1D1D1F] bg-[#1D1D1F]/5 ring-1 ring-[#1D1D1F] shadow-xs'
                      : 'border-[#E5E5E7] bg-white hover:border-[#1D1D1F]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-extrabold text-[#1D1D1F]">
                      Composition Scheme (1%)
                    </span>
                    {gstScheme === 'composition' && (
                      <CheckCircle2 className="w-4 h-4 text-[#1D1D1F] shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#86868B] mt-1.5 leading-relaxed">
                    Issues <strong>Bill of Supply</strong>. CMP-08 quarterly statement for composite turnover.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleGstSchemeChange('regular')}
                  className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                    gstScheme === 'regular'
                      ? 'border-[#1D1D1F] bg-[#1D1D1F]/5 ring-1 ring-[#1D1D1F] shadow-xs'
                      : 'border-[#E5E5E7] bg-white hover:border-[#1D1D1F]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-extrabold text-[#1D1D1F]">
                      Regular GST Dealer
                    </span>
                    {gstScheme === 'regular' && (
                      <CheckCircle2 className="w-4 h-4 text-[#1D1D1F] shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#86868B] mt-1.5 leading-relaxed">
                    Issues formal <strong>Tax Invoice</strong> with itemized GST breakdown.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleGstSchemeChange('none')}
                  className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                    gstScheme === 'none'
                      ? 'border-[#1D1D1F] bg-[#1D1D1F]/5 ring-1 ring-[#1D1D1F] shadow-xs'
                      : 'border-[#E5E5E7] bg-white hover:border-[#1D1D1F]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-extrabold text-[#1D1D1F]">
                      Unregistered / Non-GST
                    </span>
                    {gstScheme === 'none' && (
                      <CheckCircle2 className="w-4 h-4 text-[#1D1D1F] shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#86868B] mt-1.5 leading-relaxed">
                    Issues standard <strong>Retail Cash Memo</strong> without tax breakdown or statutory text.
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Institutional / School Bulk Supply Bank Details (For A4 Invoices) */}
          <div className="pt-2 border-t border-[#E5E5E7] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1D1D1F]">
                  Bank Details for Bulk Supply (A4 Invoices)
                </h3>
                <p className="text-[11px] text-[#86868B]">
                  Printed on A4 invoices for schools and dealers to settle payments via NEFT/RTGS
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[#86868B] block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="e.g. State Bank of India"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#86868B] block mb-1">Account Number</label>
                <input
                  type="text"
                  value={bankAccountNo}
                  onChange={e => setBankAccountNo(e.target.value)}
                  placeholder="Bank Account Number"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-mono font-bold bg-white text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#86868B] block mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={bankIfsc}
                  onChange={e => setBankIfsc(e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-mono font-bold uppercase bg-white text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#86868B] block mb-1">Branch Name</label>
                <input
                  type="text"
                  value={bankBranch}
                  onChange={e => setBankBranch(e.target.value)}
                  placeholder="Branch location"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#1D1D1F]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-4 py-2 rounded-xl bg-[#1D1D1F] hover:bg-[#333336] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save GST & Bank Settings</span>
              </button>
            </div>
          </div>

          {/* Return Schedule */}
          <div className="pt-2 border-t border-[#E5E5E7]">
            <div className="text-xs font-bold text-[#86868B] mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#1D1D1F]" />
                <span>Quarterly Schedule (CMP-08)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsGstModalOpen(true)}
                className="text-xs font-bold text-[#1D1D1F] hover:underline cursor-pointer"
              >
                View Returns &rarr;
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] flex flex-col justify-between">
                <span className="text-xs font-bold text-[#1D1D1F]">Q1 (Apr–Jun)</span>
                <span className="text-[11px] text-[#86868B] mt-1">Due: <strong>18 July</strong></span>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] flex flex-col justify-between">
                <span className="text-xs font-bold text-[#1D1D1F]">Q2 (Jul–Sep)</span>
                <span className="text-[11px] text-[#86868B] mt-1">Due: <strong>18 October</strong></span>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] flex flex-col justify-between">
                <span className="text-xs font-bold text-[#1D1D1F]">Q3 (Oct–Dec)</span>
                <span className="text-[11px] text-[#86868B] mt-1">Due: <strong>18 January</strong></span>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] flex flex-col justify-between">
                <span className="text-xs font-bold text-[#1D1D1F]">Q4 (Jan–Mar)</span>
                <span className="text-[11px] text-[#86868B] mt-1">Due: <strong>18 April</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRINTERS & AUDIO */}
      {activeTab === 'printers' && (
        <div className="bg-white rounded-2xl border border-[#E5E5E7] p-5 shadow-xs space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#1D1D1F] flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5" />
            Thermal POS Printer Settings
          </h2>

          <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-[#1D1D1F]">
                  Bluetooth Thermal Printer Status:
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                  bleConnected ? 'bg-[#1D1D1F] text-white' : 'bg-[#E5E5E7] text-[#86868B]'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${bleConnected ? 'bg-emerald-400' : 'bg-[#86868B]'}`} />
                  {bleConnected ? `Connected (${bleDeviceName})` : 'Disconnected'}
                </span>
              </div>
              <p className="text-xs text-[#86868B] mt-1">
                Supports all standard ESC/POS 58mm / 80mm wireless Bluetooth thermal receipt printers
              </p>
            </div>

            <div className="flex items-center gap-2">
              {bleConnected ? (
                <>
                  <button
                    type="button"
                    onClick={handleTestPrintBle}
                    disabled={isBleTesting}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#E5E5E7] text-xs font-bold text-[#1D1D1F] hover:bg-[#F5F5F7]"
                  >
                    {isBleTesting ? 'Testing...' : 'Test Print'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectBle}
                    className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 hover:bg-red-100"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectBle}
                  disabled={isBleTesting}
                  className="px-4 py-2 rounded-xl bg-[#1D1D1F] text-white text-xs font-extrabold hover:bg-[#333336] shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>{isBleTesting ? 'Searching...' : 'Connect Printer'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#86868B] block mb-1">
                Paper Width (Columns)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPrinterWidth(32)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    printerWidth === 32
                      ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                      : 'bg-[#F5F5F7] text-[#1D1D1F] border-[#E5E5E7]'
                  }`}
                >
                  58mm (32 chars)
                </button>
                <button
                  type="button"
                  onClick={() => setPrinterWidth(48)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    printerWidth === 48
                      ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                      : 'bg-[#F5F5F7] text-[#1D1D1F] border-[#E5E5E7]'
                  }`}
                >
                  80mm (48 chars)
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#86868B] block mb-1">
                Sound Feedback &amp; Audio Beeps
              </label>
              <div className="flex items-center justify-between p-2 rounded-xl border border-[#E5E5E7] bg-[#F5F5F7]">
                <span className="text-xs font-semibold text-[#1D1D1F]">Touch / Tap Beeps</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestAudio}
                    className="text-[11px] text-[#1D1D1F] font-bold hover:underline"
                  >
                    Test Beep
                  </button>
                  <input
                    type="checkbox"
                    checked={soundFeedback}
                    onChange={e => setSoundFeedback(e.target.checked)}
                    className="w-4 h-4 accent-[#1D1D1F]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TEAM & ROLES */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-2xl border border-[#E5E5E7] p-5 shadow-xs space-y-5">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#F5F5F7] border border-[#E5E5E7] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold text-[#1D1D1F]">
                    Team Roles &amp; Shift PINs
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#1D1D1F] border border-[#E5E5E7]">
                    {users.length} Team Members
                  </span>
                </div>
                <p className="text-xs text-[#86868B] mt-0.5">
                  Set up Store Admin, Shift Lead, and Counter Associate accounts, 6-digit shift PINs, and standard discount allowances.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {users.map(u => {
                    const meta = ROLE_INFO[u.role];
                    return (
                      <span
                        key={u.id}
                        className="px-2 py-0.5 rounded-lg bg-white border border-[#E5E5E7] text-[11px] font-bold text-[#1D1D1F] flex items-center gap-1.5 shadow-2xs"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${meta?.dotClass || 'bg-slate-400'}`} />
                        <span>{u.name}</span>
                        <span className="text-[9px] uppercase font-semibold text-[#86868B]">({meta?.shortLabel || u.role})</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsStaffModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[#1D1D1F] hover:bg-[#333336] text-white text-xs font-extrabold transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Manage Team &amp; Roles</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: CLOUD SYNC & SUPABASE (TWO-WAY SYNC) */}
      {activeTab === 'supabase' && (
        <div className="space-y-5">
          {/* Two-Way Cloud Sync Action Hub */}
          <div className="bg-white rounded-2xl border border-[#E5E5E7] p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-extrabold text-[#1D1D1F] flex items-center gap-2">
                <Cloud className="w-4 h-4 text-[#1D1D1F]" />
                <span>Two-Way Cloud Synchronization</span>
              </h2>
              <p className="text-xs text-[#86868B] mt-0.5">
                Keep your local counter in sync with your cloud Supabase database. You can both upload local sales records to the cloud and pull catalog data from the cloud.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: Push Local to Supabase */}
              <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#E5E5E7] flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-[#1D1D1F] font-extrabold text-xs">
                    <CloudUpload className="w-4 h-4" />
                    <span>Push to Cloud (Safe Keeping)</span>
                  </div>
                  <p className="text-xs text-[#86868B] mt-1">
                    Upload all your local schools, uniform items, size groups, prices, stocks, and sales bills to Supabase for off-site safe keeping.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handlePushToSupabase}
                    disabled={isPushingSupabase}
                    className="w-full py-2.5 rounded-xl bg-[#1D1D1F] hover:bg-[#333336] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <CloudUpload className={`w-3.5 h-3.5 ${isPushingSupabase ? 'animate-bounce' : ''}`} />
                    <span>{isPushingSupabase ? 'Uploading to Supabase...' : 'Push Local Data to Supabase'}</span>
                  </button>
                  {pushStatusMsg && (
                    <div className="mt-2 text-[11px] text-[#1D1D1F] font-semibold text-center">
                      {pushStatusMsg}
                    </div>
                  )}
                </div>
              </div>

              {/* Option B: Pull from Supabase */}
              <div className="p-4 rounded-2xl bg-white border border-[#E5E5E7] flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-[#1D1D1F] font-extrabold text-xs">
                    <CloudDownload className="w-4 h-4 text-[#1D1D1F]" />
                    <span>Pull from Cloud (Catalog Import)</span>
                  </div>
                  <p className="text-xs text-[#86868B] mt-1">
                    Scan your Supabase database, inspect tables, map custom column names, or import fresh rates and schools directly into this counter.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="w-full py-2.5 rounded-xl bg-white border border-[#E5E5E7] hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <CloudDownload className="w-3.5 h-3.5" />
                    <span>Open Database Importer</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Supabase Configuration Details */}
          <div className="bg-white rounded-2xl border border-[#E5E5E7] p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E5E7]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-[#1D1D1F] flex items-center gap-2">
                    <span>Supabase Connection Settings</span>
                    {supabaseAnonKey && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white text-[#1D1D1F] border border-[#E5E5E7] flex items-center gap-1">
                        <KeyRound className="w-3 h-3" />
                        <span>{currentKeyType}</span>
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-[#86868B]">
                    Configure your project credentials and verify cloud connectivity
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestSupabase}
                disabled={isTestingSupabase || !supabaseUrl || !supabaseAnonKey}
                className="px-3 py-2 rounded-xl bg-white border border-[#E5E5E7] text-xs font-bold text-[#1D1D1F] hover:bg-[#F5F5F7] disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer self-start sm:self-center"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-spin' : ''}`} />
                <span>{isTestingSupabase ? 'Connecting...' : 'Test Connection'}</span>
              </button>
            </div>

            {/* Test Result Message */}
            {testResult && (
              <div className={`p-3.5 rounded-xl text-xs space-y-2 border ${
                testResult.success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
                  : 'bg-red-50 border-red-200 text-red-950'
              }`}>
                <div className="flex items-start gap-2 font-semibold">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">{testResult.message}</div>
                    {testResult.errorDetail && (
                      <div className="text-[11px] font-mono text-red-700 mt-1 whitespace-pre-wrap">
                        {testResult.errorDetail}
                      </div>
                    )}
                  </div>
                </div>

                {testResult.allTables && testResult.allTables.length > 0 && (
                  <div className="pt-2 border-t border-[#E5E5E7]">
                    <div className="font-bold text-[11px] text-[#1D1D1F] mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Table className="w-3.5 h-3.5" />
                        <span>Detected Tables in your Supabase DB:</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {testResult.allTables.map(tbl => (
                        <span
                          key={tbl.name}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#E5E5E7] text-[11px] font-mono font-bold text-[#1D1D1F] shadow-2xs flex items-center gap-1"
                        >
                          <span>{tbl.name}</span>
                          <span className="text-[#86868B] font-normal">({tbl.rowCount} rows)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Supabase URL & Key Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#86868B] block mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={e => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzproject.supabase.co"
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-white text-[#1D1D1F]"
                />
                <span className="text-[10px] text-[#86868B] mt-0.5 block">
                  Found in Supabase Settings → API
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-[#86868B] block mb-1 flex items-center justify-between">
                  <span>Supabase API Key</span>
                  <span className="text-[10px] text-[#1D1D1F] font-semibold">
                    Use Public anon key
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={supabaseAnonKey}
                    onChange={e => setSupabaseAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    className="w-full h-9 pl-3 pr-10 rounded-xl border border-[#E5E5E7] text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-[#1D1D1F] bg-white text-[#1D1D1F]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F]"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {currentKeyType.includes('service_role') && (
                  <div className="mt-1.5 p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-[11px] font-semibold flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Security Notice:</strong> You are using a secret <code>service_role</code> key. Because this terminal runs in client browsers, using your project's <code>anon (public)</code> key with Row Level Security (RLS) is strongly recommended for store operations.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#1D1D1F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={e => setAutoSync(e.target.checked)}
                  className="w-4 h-4 accent-[#1D1D1F]"
                />
                <span>Automatically sync new bills &amp; sales to Supabase in background when online</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: LOCAL BACKUPS & DANGER ZONE */}
      {activeTab === 'backup' && (
        <div className="space-y-5">
          {/* Local Offline Database Backup & Restore Card */}
          <div className="bg-white rounded-2xl border border-[#E5E5E7] p-5 shadow-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shrink-0 shadow-xs">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#1D1D1F] flex items-center gap-1.5">
                  <span>Local Offline Backup &amp; Disaster Recovery (.json)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#1D1D1F] border border-[#E5E5E7]">
                    Zero Cloud Required
                  </span>
                </h2>
                <p className="text-xs text-[#86868B] mt-0.5">
                  Save a complete offline backup file directly onto your counter PC. You can restore from this file anytime with no internet connection.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-4 py-2.5 rounded-xl bg-white border border-[#E5E5E7] hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Local Backup (.json)</span>
              </button>

              <label className="px-4 py-2.5 rounded-xl bg-[#1D1D1F] hover:bg-[#333336] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Restore from Backup File</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Clean Slate & Reset Card */}
          <div className="bg-red-50 rounded-2xl border border-red-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-red-950 flex items-center gap-1.5">
                  <span>Danger Zone: Clean Slate Reset</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-200 text-red-900">
                    Zero Data Reset
                  </span>
                </h2>
                <p className="text-xs text-red-800 mt-0.5">
                  Permanently delete all locally stored schools, uniform items, sizes, rates, and past bills from your browser.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsWipeModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold transition-colors shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Wipe All Data</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 7: LICENSE & SUBSCRIPTION PLAN */}
      {activeTab === 'license' && (
        <div className="space-y-6">
          {/* Active Terminal & Subscription Overview */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-stone-900 text-white flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-stone-900">
                      Software License &amp; Active Plan
                    </h2>
                    <span className="text-xs text-stone-400" aria-hidden="true">·</span>
                    <span className={`text-xs font-semibold ${license.isValid ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {license.isTrial
                        ? `14-Day Free Pilot (${license.daysRemaining}d remaining)`
                        : `${license.tier.toUpperCase()} Edition (${license.daysRemaining}d active)`}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Valid Until:{' '}
                    <strong className="text-stone-900 font-mono">
                      {license.expiresAt
                        ? new Date(license.expiresAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Never (Lifetime Perpetual)'}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Instant Upgrade / Renew</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cleanPhone = VENDOR_CONTACT_PHONE.replace(/\D/g, '');
                    const msg = encodeURIComponent(
                      `Hello ${VENDOR_BRAND_NAME},\nI would like to activate/renew license.\nStore: ${legalName || license.storeName}\nHardware ID: ${license.machineId}`
                    );
                    window.open(`https://api.whatsapp.com/send/?phone=${cleanPhone}&text=${msg}`, '_blank');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp Support</span>
                </button>
              </div>
            </div>

            {/* Hardware ID Card */}
            <div className="p-4 bg-stone-50/60 rounded-xl border border-stone-200 space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-600">
                <span className="font-medium">Hardware Terminal ID (Device Fingerprint)</span>
                <span className="text-[11px] text-stone-400 font-mono">SHA-256 Entropy Locked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white px-3 py-2 rounded-lg border border-stone-200 font-mono text-xs font-bold text-stone-900 tracking-wider select-all shadow-xs">
                  {license.machineId}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(license.machineId);
                    setCopiedMachineId(true);
                    setTimeout(() => setCopiedMachineId(false), 2000);
                  }}
                  className="px-3.5 py-2 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg text-xs font-semibold text-stone-700 hover:text-stone-900 transition-colors cursor-pointer shadow-xs"
                >
                  {copiedMachineId ? 'Copied' : 'Copy ID'}
                </button>
              </div>
            </div>

            {/* License Activation Form */}
            <div className="p-4 bg-white rounded-xl border border-stone-200 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-stone-900">
                  Activate or Renew Signed License Key
                </h3>
                <span className="text-[11px] text-stone-400">Offline certificate</span>
              </div>

              {licenseError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{licenseError}</span>
                </div>
              )}

              {licenseSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{licenseSuccess}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="e.g. CNTR-PRO-20271231-XXXX-XXXX"
                  value={licenseInputKey}
                  onChange={e => setLicenseInputKey(e.target.value.toUpperCase())}
                  className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-bold uppercase tracking-wider text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
                <button
                  type="button"
                  disabled={isActivatingLicense || !licenseInputKey.trim()}
                  onClick={() => {
                    if (!licenseInputKey.trim()) return;
                    setIsActivatingLicense(true);
                    setLicenseError(null);
                    setLicenseSuccess(null);
                    try {
                      const res = activateLicenseKey(licenseInputKey, legalName || 'Retail Store');
                      if (res.success) {
                        setLicenseSuccess(res.message);
                        setLicenseInputKey('');
                        setLicense(getLicenseStatus());
                        showToast('License successfully activated!');
                      } else {
                        setLicenseError(res.message);
                      }
                    } catch (err: any) {
                      setLicenseError(err.message || 'Activation failed');
                    } finally {
                      setIsActivatingLicense(false);
                    }
                  }}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                >
                  {isActivatingLicense ? 'Verifying...' : 'Activate Offline Key'}
                </button>
              </div>
            </div>

            {/* Plan Edition Catalog Comparison */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
                Commercial Edition Tiers
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className={`p-4 rounded-xl border flex flex-col justify-between ${license.tier === 'starter' ? 'border-stone-900 dark:border-zinc-100 bg-stone-50/70 dark:bg-zinc-800/80' : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-stone-900 dark:text-zinc-100">Starter POS</span>
                      {license.tier === 'starter' && <span className="text-[10px] text-stone-500 dark:text-zinc-400 font-medium">Active</span>}
                    </div>
                    <div className="text-sm font-bold font-mono text-stone-900 dark:text-zinc-100">₹3,999<span className="text-xs text-stone-400 dark:text-zinc-500 font-normal"> / yr</span></div>
                    <ul className="text-[11px] text-stone-600 dark:text-zinc-400 space-y-1 pt-2 border-t border-stone-100 dark:border-zinc-800">
                      <li>· Single Billing Station</li>
                      <li>· Thermal 80mm &amp; 58mm</li>
                      <li>· Stock Inventory</li>
                      <li>· Daily Cash Memo</li>
                    </ul>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border relative flex flex-col justify-between ${license.tier === 'pro' ? 'border-stone-900 dark:border-zinc-100 bg-stone-50/70 dark:bg-zinc-800/80' : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-stone-900 dark:text-zinc-100">Pro Uniform</span>
                      <span className="text-[10px] text-stone-500 dark:text-zinc-400 font-medium">{license.tier === 'pro' ? 'Active' : 'Recommended'}</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-stone-900 dark:text-zinc-100">₹6,999<span className="text-xs text-stone-400 dark:text-zinc-500 font-normal"> / yr</span></div>
                    <ul className="text-[11px] text-stone-600 dark:text-zinc-400 space-y-1 pt-2 border-t border-stone-100 dark:border-zinc-800">
                      <li>· All Starter Features</li>
                      <li>· School Rate Matrix</li>
                      <li>· Barcode Generator</li>
                      <li>· Dual Display + UPI</li>
                      <li>· GST 1% CMP-08</li>
                    </ul>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex flex-col justify-between ${license.tier === 'enterprise' ? 'border-stone-900 dark:border-zinc-100 bg-stone-50/70 dark:bg-zinc-800/80' : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-stone-900 dark:text-zinc-100">Enterprise</span>
                      {license.tier === 'enterprise' && <span className="text-[10px] text-stone-500 dark:text-zinc-400 font-medium">Active</span>}
                    </div>
                    <div className="text-sm font-bold font-mono text-stone-900 dark:text-zinc-100">₹11,999<span className="text-xs text-stone-400 dark:text-zinc-500 font-normal"> / yr</span></div>
                    <ul className="text-[11px] text-stone-600 dark:text-zinc-400 space-y-1 pt-2 border-t border-stone-100 dark:border-zinc-800">
                      <li>· 2 to 10 Counters</li>
                      <li>· Real-Time Terminal Sync</li>
                      <li>· Multi-PIN Shift Logs</li>
                      <li>· Priority Migration</li>
                    </ul>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex flex-col justify-between ${license.tier === 'lifetime' ? 'border-stone-900 dark:border-zinc-100 bg-stone-50/70 dark:bg-zinc-800/80' : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-stone-900 dark:text-zinc-100">Lifetime</span>
                      {license.tier === 'lifetime' && <span className="text-[10px] text-stone-500 dark:text-zinc-400 font-medium">Active</span>}
                    </div>
                    <div className="text-sm font-bold font-mono text-stone-900 dark:text-zinc-100">₹18,999<span className="text-xs text-stone-400 dark:text-zinc-500 font-normal"> once</span></div>
                    <ul className="text-[11px] text-stone-600 dark:text-zinc-400 space-y-1 pt-2 border-t border-stone-100 dark:border-zinc-800">
                      <li>· Perpetual License</li>
                      <li>· Zero Annual Renewal</li>
                      <li>· All Features Offline</li>
                      <li>· Direct Support</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Vendor Management Bar */}
            <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
              <button
                type="button"
                onClick={async () => {
                  setIsEmergencyExporting(true);
                  try {
                    await downloadEmergencySafetyBackup();
                    showToast('Data exported successfully!');
                  } catch (e) {
                    showToast('Failed to export data');
                  } finally {
                    setIsEmergencyExporting(false);
                  }
                }}
                className="text-xs text-stone-500 hover:text-stone-900 font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isEmergencyExporting ? 'Exporting...' : 'Emergency Safety Data Export'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsVendorModalOpen(true)}
                className="text-xs font-medium text-stone-600 hover:text-stone-900 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Vendor Key Generator</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor License Generator Modal */}
      <VendorLicenseGeneratorModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        prefillMachineId={license.machineId}
        prefillStoreName={legalName || license.storeName}
      />

      {/* Wipe Confirmation In-App Modal (No window.confirm) */}
      {isWipeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-red-200 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button
                onClick={() => setIsWipeModalOpen(false)}
                className="text-[#86868B] hover:text-[#1D1D1F]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="font-extrabold text-lg text-[#1D1D1F]">Wipe All Local Data &amp; Start Clean?</h3>
              <p className="text-xs text-[#86868B] mt-1.5">
                This will completely delete all locally stored schools, uniform items, sizes, prices, and bills from your browser.
              </p>
            </div>

            <label className="flex items-center gap-2 p-3 bg-[#F5F5F7] border border-[#E5E5E7] rounded-xl text-xs font-medium text-[#1D1D1F] cursor-pointer">
              <input
                type="checkbox"
                checked={preserveSupabase}
                onChange={e => setPreserveSupabase(e.target.checked)}
                className="w-4 h-4 accent-[#1D1D1F]"
              />
              <span>Keep Supabase URL &amp; API Key settings</span>
            </label>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsWipeModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E5E5E7] text-xs font-bold text-[#86868B] hover:bg-[#F5F5F7]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteWipe}
                disabled={isWiping}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isWiping ? 'Wiping Database...' : 'Yes, Wipe Everything'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Management & PIN Modal */}
      <StaffManagerModal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
      />

      {/* Supabase Import & Schema Mapper Modal */}
      <SupabaseImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={() => {
          setIsImportModalOpen(false);
          loadConfig();
          showToast('Data imported from Supabase!');
        }}
      />

      {/* Product Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          loadConfig();
        }}
      />

      {/* GST CMP-08 Quarterly Composition Statement Modal */}
      <GstCompositionReportModal
        isOpen={isGstModalOpen}
        onClose={() => setIsGstModalOpen(false)}
        config={config}
      />

      {/* Re-run Onboarding Setup Wizard Modal */}
      <OnboardingWizardModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        onCompleted={() => {
          setIsOnboardingModalOpen(false);
          loadConfig();
          showToast('Store setup completed successfully!');
        }}
      />

      {/* Instant License Checkout Modal */}
      <InstantLicenseCheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        license={license}
        onLicenseActivated={() => {
          setIsCheckoutModalOpen(false);
          setLicense(getLicenseStatus());
          showToast('License upgraded & activated!');
        }}
      />
    </div>
  );
};


