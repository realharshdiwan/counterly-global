import React, { useState } from 'react';
import { 
  Building2, 
  Printer, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Scan, 
  Layers, 
  X, 
  Plus, 
  Receipt,
  Volume2,
  Lock,
  Store,
  CheckCheck,
  Sparkles,
  ShieldCheck,
  Laptop,
  Shirt,
  Scissors,
  Footprints,
  ShoppingBag
} from 'lucide-react';
import { db } from '../db/db';
import { type ShopConfig, type GstSchemeType, type UserProfile, type StoreBusinessType } from '../types';
import { playBeep } from '../lib/printer';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

interface DefaultSchoolPreset {
  code: string;
  name: string;
  selected: boolean;
}

const INITIAL_PRESET_SCHOOLS: DefaultSchoolPreset[] = [
  { code: 'DPS', name: 'Delhi Public School (DPS)', selected: true },
  { code: 'STX', name: "St. Xavier's Senior Secondary", selected: true },
  { code: 'KV', name: 'Kendriya Vidyalaya (KV)', selected: true },
  { code: 'DAV', name: 'DAV Public School', selected: true },
];

const STORE_TYPE_OPTIONS: { id: StoreBusinessType; title: string; subtitle: string; icon: any }[] = [
  { 
    id: 'apparel', 
    title: 'Retail Garments & Apparel', 
    subtitle: 'Shirts, Jeans, T-Shirts, Dresses, Suits', 
    icon: Shirt 
  },
  { 
    id: 'boutique', 
    title: 'Boutique & Tailoring', 
    subtitle: 'Custom Stitching, Alterations, Sarees', 
    icon: Scissors 
  },
  { 
    id: 'footwear', 
    title: 'Footwear & Accessories', 
    subtitle: 'Shoes, Sandals, Bags, Belts', 
    icon: Footprints 
  },
  { 
    id: 'uniform', 
    title: 'School Uniforms', 
    subtitle: 'School Rate Books, Grade Badges', 
    icon: Store 
  },
  { 
    id: 'general', 
    title: 'General Retail Counter', 
    subtitle: 'Multi-category retail billing', 
    icon: ShoppingBag 
  },
];

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  onCompleted,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // STEP 1: Store Branding, Type & Identity
  const [storeType, setStoreType] = useState<StoreBusinessType>('apparel');
  const [storeName, setStoreName] = useState('SARASWATI GARMENTS');
  const [tagline, setTagline] = useState('Retail Garments & Fashion Apparel');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [address, setAddress] = useState('Shop No. 12, Main Market Complex');
  const [upiId, setUpiId] = useState('saraswatigarments@upi');
  const [gstScheme, setGstScheme] = useState<GstSchemeType>('composition');
  const [gstin, setGstin] = useState('');

  // STEP 2: Hardware Peripherals
  const [printerWidth, setPrinterWidth] = useState<32 | 48>(48);
  const [autoPrintCash, setAutoPrintCash] = useState(true);
  const [autoPrintUpi, setAutoPrintUpi] = useState(true);
  const [soundFeedback, setSoundFeedback] = useState(true);
  const [scannedTestBarcode, setScannedTestBarcode] = useState('');
  const [hasTestedPrinter, setHasTestedPrinter] = useState(false);
  const [hasTestedAudio, setHasTestedAudio] = useState(false);

  // STEP 3: Catalog Setup
  const [catalogChoice, setCatalogChoice] = useState<'preset' | 'blank'>('preset');
  const [schoolsList, setSchoolsList] = useState<DefaultSchoolPreset[]>(INITIAL_PRESET_SCHOOLS);
  const [customSchoolName, setCustomSchoolName] = useState('');
  const [customSchoolCode, setCustomSchoolCode] = useState('');

  // STEP 4: Staff PINs
  const [adminPin, setAdminPin] = useState('123456');
  const [cashierPin, setCashierPin] = useState('111111');

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleTestSound = () => {
    playBeep('success');
    setHasTestedAudio(true);
  };

  const handleTestPrinterReceipt = () => {
    playBeep('success');
    setHasTestedPrinter(true);
  };

  const handleBarcodeChange = (val: string) => {
    setScannedTestBarcode(val);
    if (val.trim().length >= 4) {
      playBeep('success');
    }
  };

  const handleAddCustomSchool = () => {
    if (!customSchoolName.trim()) return;
    const code = customSchoolCode.trim().toUpperCase() || customSchoolName.slice(0, 3).toUpperCase();
    setSchoolsList(prev => [...prev, { code, name: customSchoolName.trim(), selected: true }]);
    setCustomSchoolName('');
    setCustomSchoolCode('');
  };

  const handleToggleSchool = (index: number) => {
    setSchoolsList(prev =>
      prev.map((s, idx) => (idx === index ? { ...s, selected: !s.selected } : s))
    );
  };

  const handleFinishOnboarding = async () => {
    setIsSaving(true);
    try {
      const existingConfigs = await db.shop_config.toArray();
      const updatedConfig: ShopConfig = {
        id: existingConfigs[0]?.id || '1',
        legal_name: storeName.trim() || 'SARASWATI GARMENTS',
        shop_tagline: tagline.trim(),
        shop_phone: phone.trim(),
        shop_address: address.trim(),
        store_type: storeType,
        upi_id: upiId.trim(),
        gstin: gstin.trim(),
        gst_scheme: gstScheme,
        printer_width: printerWidth,
        auto_print_cash: autoPrintCash,
        auto_print_upi: autoPrintUpi,
        sound_feedback: soundFeedback,
        bill_prefix: 'SG-',
        bill_sequence: existingConfigs[0]?.bill_sequence || 1001,
        tax_type: existingConfigs[0]?.tax_type || 'none',
        tax_rate: existingConfigs[0]?.tax_rate || 0,
      };

      if (existingConfigs.length > 0 && existingConfigs[0].id) {
        await db.shop_config.update(existingConfigs[0].id, updatedConfig);
      } else {
        await db.shop_config.add(updatedConfig);
      }

      // Update Staff PINs
      const userList = await db.users.toArray();
      const adminStaff = userList.find((s: UserProfile) => s.role === 'admin');
      if (adminStaff && adminStaff.id) {
        await db.users.update(adminStaff.id, { pin: adminPin });
      }
      const cashierStaff = userList.find((s: UserProfile) => s.role === 'cashier');
      if (cashierStaff && cashierStaff.id) {
        await db.users.update(cashierStaff.id, { pin: cashierPin });
      }

      // If store type is school uniform or preset requested, seed school rates
      if (storeType === 'uniform' || catalogChoice === 'preset') {
        const selectedSchools = schoolsList.filter(s => s.selected);
        for (const s of selectedSchools) {
          const exists = await db.schools.where('code').equals(s.code).first();
          if (!exists) {
            await db.schools.add({
              id: `school_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              name: s.name,
              code: s.code,
              multiplier: 1.0,
              active: true,
            });
          }
        }
      }

      // Seed starter General Retail Counter if none exists
      const genSchoolExists = await db.schools.where('code').equals('GEN').first();
      if (!genSchoolExists) {
        await db.schools.add({
          id: 'sch_general',
          name: 'General Retail Counter',
          code: 'GEN',
          multiplier: 1.0,
          active: true,
        });
      }

      localStorage.setItem('counterly_onboarding_completed', 'true');
      onCompleted();
    } catch (err) {
      console.error('Failed to save onboarding configuration:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const steps = [
    { num: 1, code: '01', title: 'Store Type', sub: 'Branding & Type', icon: Store },
    { num: 2, code: '02', title: 'Hardware Box', sub: 'ESC/POS & Test Bay', icon: Printer },
    { num: 3, code: '03', title: 'Catalog Setup', sub: 'Catalog & Matrices', icon: Layers },
    { num: 4, code: '04', title: 'Shift Security', sub: 'Staff PINs & Launch', icon: Lock },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-950/80 dark:bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-3xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors">
        
        {/* Apple/Framer Minimalist Header */}
        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center font-black text-base shadow-sm">
              C
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-zinc-950 dark:text-white tracking-tight">
                  Counterly Store Setup
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono font-semibold text-zinc-600 dark:text-zinc-300">
                  Step {currentStep} of 4
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Configure your retail counter in under 2 minutes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
            aria-label="Close Setup Wizard"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Framer Segmented Step Navigation Bar */}
        <div className="px-6 py-3 bg-zinc-50/70 dark:bg-zinc-950/60 border-b border-zinc-100 dark:border-zinc-800/80 overflow-x-auto">
          <div className="grid grid-cols-4 gap-2 min-w-[560px]">
            {steps.map((step) => {
              const isActive = currentStep === step.num;
              const isCompleted = currentStep > step.num;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setCurrentStep(step.num as any)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-zinc-800 border-zinc-950 dark:border-zinc-100 shadow-sm text-zinc-950 dark:text-white'
                      : isCompleted
                      ? 'bg-zinc-100/80 dark:bg-zinc-850/80 border-transparent text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800'
                      : 'bg-transparent border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] font-bold opacity-60">{step.code}</span>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      isActive
                        ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                        : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                    }`}>
                      {isCompleted ? <Check className="w-2.5 h-2.5" /> : step.num}
                    </div>
                  </div>
                  <div className="text-xs font-bold truncate">{step.title}</div>
                  <div className="text-[10px] opacity-70 truncate font-normal">{step.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Wizard Step Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
          
          {/* STEP 1: STORE TYPE & BRANDING */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h3 className="text-base font-extrabold text-zinc-950 dark:text-white tracking-tight">
                  1. Choose Your Retail Store Category
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Tailors default product sizes, barcode labels, and counter layout to your exact business type.
                </p>
              </div>

              {/* Store Type Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {STORE_TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = storeType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setStoreType(opt.id);
                        if (opt.id === 'apparel') setTagline('Retail Garments & Fashion Apparel');
                        if (opt.id === 'boutique') setTagline('Designer Boutique & Custom Tailoring');
                        if (opt.id === 'footwear') setTagline('Footwear & Leather Accessories');
                        if (opt.id === 'uniform') setTagline('School Uniforms & Academic Apparel');
                        if (opt.id === 'general') setTagline('Universal Retail Store');
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                        isSelected
                          ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-950 dark:border-zinc-100 shadow-md'
                          : 'bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className="w-5 h-5" />
                        {isSelected && <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />}
                      </div>
                      <div>
                        <div className="text-xs font-extrabold">{opt.title}</div>
                        <p className="text-[10px] opacity-75 font-normal leading-snug mt-0.5">{opt.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Store Identity Inputs */}
              <div className="pt-2 space-y-4 border-t border-zinc-100 dark:border-zinc-800">
                <h4 className="text-xs font-extrabold text-zinc-950 dark:text-white uppercase tracking-wider">
                  Store Identity &amp; Receipts
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                      Store Name *
                    </label>
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="SARASWATI GARMENTS"
                      className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                      Tagline / Subtitle
                    </label>
                    <input
                      type="text"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="Retail Garments & Fashion Apparel"
                      className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                      Contact Phone *
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                      Shop UPI ID (Dynamic QR) *
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="store@upi"
                      className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: HARDWARE & DIAGNOSTICS */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h3 className="text-base font-extrabold text-zinc-950 dark:text-white tracking-tight">
                  2. Hardware Peripherals &amp; Test Station
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Select your thermal receipt paper format and test optical barcode scanner &amp; audio alerts.
                </p>
              </div>

              {/* Printer Size Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPrinterWidth(48)}
                  className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    printerWidth === 48
                      ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-950 dark:border-zinc-100 shadow-md'
                      : 'bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-xs">80mm Standard (3-Inch)</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      printerWidth === 48 ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-950' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                    }`}>
                      48 Columns
                    </span>
                  </div>
                  <p className="text-xs opacity-80 leading-relaxed font-normal">
                    Optimal for high-volume billing counters with automatic thermal paper cutter.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPrinterWidth(32)}
                  className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    printerWidth === 32
                      ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-950 dark:border-zinc-100 shadow-md'
                      : 'bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-xs">58mm Compact (2-Inch)</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      printerWidth === 32 ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-950' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                    }`}>
                      32 Columns
                    </span>
                  </div>
                  <p className="text-xs opacity-80 leading-relaxed font-normal">
                    Designed for compact mobile Bluetooth thermal belt printers.
                  </p>
                </button>
              </div>

              {/* Hardware Test Station */}
              <div className="p-5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Interactive Hardware Test Station
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                    Plug &amp; Play Driverless
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Audio Chime Test */}
                  <button
                    type="button"
                    onClick={handleTestSound}
                    className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 text-left hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Volume2 className="w-4 h-4 text-zinc-800 dark:text-zinc-200" />
                      <span className="text-xs font-bold text-zinc-950 dark:text-white">Audio Chime</span>
                    </div>
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {hasTestedAudio ? '✓ Chime Sound Tested' : 'Click to test chime'}
                    </span>
                  </button>

                  {/* Print Slip Test */}
                  <button
                    type="button"
                    onClick={handleTestPrinterReceipt}
                    className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 text-left hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Printer className="w-4 h-4 text-zinc-800 dark:text-zinc-200" />
                      <span className="text-xs font-bold text-zinc-950 dark:text-white">Printer Slip</span>
                    </div>
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {hasTestedPrinter ? '✓ ESC/POS Active' : 'Simulate thermal print'}
                    </span>
                  </button>

                  {/* Barcode Test Input */}
                  <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 text-left shadow-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Scan className="w-4 h-4 text-zinc-800 dark:text-zinc-200" />
                      <span className="text-xs font-bold text-zinc-950 dark:text-white">Barcode Scanner</span>
                    </div>
                    <input
                      type="text"
                      value={scannedTestBarcode}
                      onChange={(e) => handleBarcodeChange(e.target.value)}
                      placeholder="Scan sticker barcode..."
                      className="w-full bg-zinc-50 dark:bg-zinc-800/80 px-2 py-1 rounded text-[11px] font-mono font-bold focus:outline-none text-zinc-950 dark:text-white border border-zinc-200 dark:border-zinc-700 mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CATALOG SETUP */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h3 className="text-base font-extrabold text-zinc-950 dark:text-white tracking-tight">
                  3. Catalog &amp; Rate Book Starter
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Configure starter catalog presets tailored for <strong className="font-bold text-zinc-900 dark:text-zinc-100">{STORE_TYPE_OPTIONS.find(o => o.id === storeType)?.title}</strong>.
                </p>
              </div>

              {/* Store Type-Specific Preset Box */}
              {storeType === 'uniform' ? (
                <div className="space-y-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    School Rate Matrices
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {schoolsList.map((school, idx) => (
                      <div
                        key={school.code}
                        onClick={() => handleToggleSchool(idx)}
                        className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          school.selected
                            ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-950 dark:border-zinc-100 shadow-sm'
                            : 'bg-zinc-50 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                            school.selected
                              ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white'
                              : 'border border-zinc-300 dark:border-zinc-600'
                          }`}>
                            {school.selected && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-xs font-bold">{school.name}</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold opacity-70">[{school.code}]</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100">
                      General Retail Counter Enabled
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Counterly will create a default <strong className="font-mono text-zinc-900 dark:text-zinc-100">[GEN] General Retail Counter</strong> price book. You can add items with size curves (S, M, L, XL or 28, 30, 32, 34) anytime from the Inventory &amp; Price manager.
                  </p>
                </div>
              )}

              {/* Add Custom School Bar (if uniform mode) */}
              {storeType === 'uniform' && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                    Add Local School Catalog
                  </span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={customSchoolName}
                      onChange={(e) => setCustomSchoolName(e.target.value)}
                      placeholder="School Name (e.g. Modern Academy)"
                      className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
                    />
                    <input
                      type="text"
                      value={customSchoolCode}
                      onChange={(e) => setCustomSchoolCode(e.target.value)}
                      placeholder="CODE (MA)"
                      className="w-full sm:w-28 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold uppercase text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomSchool}
                      className="px-4 py-2 bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Add School
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: STAFF SECURITY & FINISH */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h3 className="text-base font-extrabold text-zinc-950 dark:text-white tracking-tight">
                  4. Staff Shift Security PINs
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Configure 6-digit access PINs for manager authorizations and cashier counter shifts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="p-5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-zinc-950 dark:text-zinc-100" />
                    <label className="text-xs font-extrabold text-zinc-950 dark:text-white block">
                      Store Admin PIN (Full Control)
                    </label>
                  </div>
                  <input
                    type="password"
                    maxLength={6}
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono text-center text-lg font-black tracking-widest text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
                  />
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                    Unlocks catalog price changes, bill voids, and settings adjustments.
                  </p>
                </div>

                <div className="p-5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-zinc-950 dark:text-zinc-100" />
                    <label className="text-xs font-extrabold text-zinc-950 dark:text-white block">
                      Cashier Shift PIN (Billing Only)
                    </label>
                  </div>
                  <input
                    type="password"
                    maxLength={6}
                    value={cashierPin}
                    onChange={(e) => setCashierPin(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono text-center text-lg font-black tracking-widest text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
                  />
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                    Restricted cashier account for fast customer checkout without price edits.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Apple/Framer Minimalist Footer Controls */}
        <div className="px-6 py-4 bg-zinc-50/80 dark:bg-zinc-950/80 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishOnboarding}
                disabled={isSaving}
                className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-extrabold transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                <span>{isSaving ? 'Configuring Counter...' : 'Launch POS Billing Counter'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
