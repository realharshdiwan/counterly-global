import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Sparkles, 
  Printer, 
  QrCode, 
  Layers, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  Laptop, 
  FileSpreadsheet, 
  Tag, 
  ChevronRight, 
  MessageCircle, 
  HardDrive, 
  Package, 
  Lock, 
  Scan, 
  Receipt, 
  X, 
  Sliders,
  Sun,
  Moon
} from 'lucide-react';
import { VENDOR_BRAND_NAME, VENDOR_CONTACT_PHONE } from '../lib/licensing';
import { InstantLicenseCheckoutModal } from './InstantLicenseCheckoutModal';
import { useTheme } from '../context/ThemeContext';
import { type LicenseState } from '../types';

interface ProductLandingPageProps {
  onLaunchPOS: () => void;
  license: LicenseState;
  onLicenseUpdated: () => void;
}

export const ProductLandingPage: React.FC<ProductLandingPageProps> = ({
  onLaunchPOS,
  license,
  onLicenseUpdated,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<'starter' | 'pro' | 'enterprise' | 'lifetime'>('pro');

  // Interactive Live Demo Matrix State
  const [demoSchool, setDemoSchool] = useState<'DPS' | 'STX' | 'KV'>('DPS');
  const [demoItem, setDemoItem] = useState<'shirt' | 'skirt' | 'pant' | 'blazer'>('shirt');
  const [demoSize, setDemoSize] = useState<number>(32);
  const [isSampleReceiptOpen, setIsSampleReceiptOpen] = useState(false);
  const [isSampleBarcodeOpen, setIsSampleBarcodeOpen] = useState(false);

  // Live Price Matrix Calculation Formula
  const basePrices: Record<string, number> = {
    shirt: 280,
    skirt: 340,
    pant: 390,
    blazer: 850,
  };

  const schoolMultipliers: Record<string, number> = {
    DPS: 1.15,
    STX: 1.10,
    KV: 1.00,
  };

  const sizeIncrement = (demoSize - 26) * 15;
  const calculatedDemoPrice = Math.round((basePrices[demoItem] + Math.max(0, sizeIncrement)) * schoolMultipliers[demoSchool]);

  const handleWhatsAppConsultation = (topic = 'POS Software Demo') => {
    const cleanPhone = VENDOR_CONTACT_PHONE.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Hello ${VENDOR_BRAND_NAME},\nI am interested in ${topic} for my uniform/apparel retail shop. Please share details and pricing.`
    );
    window.open(`https://api.whatsapp.com/send/?phone=${cleanPhone}&text=${msg}`, '_blank');
  };

  const handleBuyPlan = (tier: 'starter' | 'pro' | 'enterprise' | 'lifetime') => {
    setSelectedPlanForCheckout(tier);
    setIsCheckoutOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-zinc-900 dark:selection:bg-zinc-100 selection:text-white dark:selection:text-zinc-900 transition-colors duration-200">
      
      {/* 1. TOP ANNOUNCEMENT TICKER */}
      <div className="bg-zinc-900 dark:bg-zinc-900/90 text-zinc-200 py-2 px-4 text-center text-xs font-medium flex items-center justify-center gap-2 border-b border-zinc-800">
        <span className="px-2 py-0.5 rounded-md bg-zinc-800 dark:bg-zinc-800 text-[10px] font-semibold tracking-wide text-zinc-300">
          2026 Edition
        </span>
        <span>High-speed offline POS engineered for academic apparel and uniform stores.</span>
        <button
          onClick={onLaunchPOS}
          className="text-white hover:underline font-semibold ml-1 cursor-pointer inline-flex items-center gap-0.5"
        >
          <span>Try Free Pilot</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. STICKY TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Brand Wordmark */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-sm shadow-xs">
              C
            </div>
            <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-white">
              Counterly
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <a href="#demo" className="hover:text-zinc-950 dark:hover:text-white transition-colors">Rate Matrix</a>
            <a href="#features" className="hover:text-zinc-950 dark:hover:text-white transition-colors">Features</a>
            <a href="#hardware" className="hover:text-zinc-950 dark:hover:text-white transition-colors">Hardware Box</a>
            <a href="#pricing" className="hover:text-zinc-950 dark:hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-zinc-950 dark:hover:text-white transition-colors">FAQ</a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title={resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark / Negative Mode'}
              aria-label="Toggle Theme"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-zinc-600" />
              )}
            </button>

            <button
              onClick={() => handleWhatsAppConsultation('Sales Inquiry')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer shadow-xs"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>WhatsApp Demo</span>
            </button>

            <button
              onClick={onLaunchPOS}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <span>Launch POS Register</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 3. HERO SECTION */}
      <section className="pt-16 pb-20 px-6 max-w-5xl mx-auto text-center space-y-7">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs text-xs text-zinc-600 dark:text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-200">Sub-50ms Offline Billing</span>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span>Zero Cloud Latency</span>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span>Direct Thermal Print</span>
        </div>

        <div className="space-y-4 max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50 leading-[1.1] text-balance">
            The Rush-Hour POS for Academic Uniform &amp; Apparel Stores
          </h1>
          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto font-normal leading-relaxed text-balance">
            Eliminate counter queues during peak admission seasons. Manage multi-school rate books, automatic size-to-price multipliers, Code128 barcodes, and dynamic UPI checkout with 100% offline reliability.
          </p>
        </div>

        {/* Hero CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onLaunchPOS}
            className="w-full sm:w-auto px-7 py-3 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <span>Launch Free 14-Day Pilot in Browser</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleWhatsAppConsultation('Hardware Appliance Box')}
            className="w-full sm:w-auto px-6 py-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 rounded-xl text-xs font-medium flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Package className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            <span>Order Turnkey Hardware Box</span>
          </button>
        </div>

        {/* Proof Metrics Grid */}
        <div className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
          <div className="p-4 bg-white dark:bg-zinc-900/80 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
            <div className="text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-100 tabular-nums">0.05s</div>
            <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">Speed-Key Checkout</div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Sub-50ms local response</p>
          </div>

          <div className="p-4 bg-white dark:bg-zinc-900/80 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
            <div className="text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-100 tabular-nums">100%</div>
            <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">Offline Autonomous</div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Zero internet lag or drops</p>
          </div>

          <div className="p-4 bg-white dark:bg-zinc-900/80 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
            <div className="text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-100 tabular-nums">80 / 58mm</div>
            <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">Thermal Printing</div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">USB, Bluetooth BLE &amp; ESC/POS</p>
          </div>

          <div className="p-4 bg-white dark:bg-zinc-900/80 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
            <div className="text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-100 tabular-nums">CMP-08</div>
            <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">1% GST Composition</div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">1-Click CA Excel &amp; GSTR-1</p>
          </div>
        </div>
      </section>

      {/* 4. INTERACTIVE LIVE DEMO MATRIX */}
      <section id="demo" className="py-16 px-6 max-w-5xl mx-auto">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                Interactive Pricing Sandbox
              </span>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                School Uniform Rate Calculator
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSampleReceiptOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>Sample Thermal Slip</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSampleBarcodeOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>Barcode Sticker</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Selectors */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
                  1. Select School Master
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'DPS', label: 'Delhi Public School' },
                    { id: 'STX', label: "St. Xavier's High" },
                    { id: 'KV', label: 'Kendriya Vidyalaya' },
                  ].map(s => (
                    <button
                      key={s.id}
                      onClick={() => setDemoSchool(s.id as any)}
                      className={`p-2.5 rounded-lg border text-xs font-medium transition-all text-left cursor-pointer ${
                        demoSchool === s.id
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs'
                          : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-750'
                      }`}
                    >
                      <span className="font-mono text-[10px] block opacity-70">[{s.id}]</span>
                      <span className="truncate block font-semibold">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
                  2. Select Uniform Item
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'shirt', label: 'Shirt' },
                    { id: 'pant', label: 'Trouser' },
                    { id: 'skirt', label: 'Skirt' },
                    { id: 'blazer', label: 'Blazer' },
                  ].map(g => (
                    <button
                      key={g.id}
                      onClick={() => setDemoItem(g.id as any)}
                      className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all text-center cursor-pointer ${
                        demoItem === g.id
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs'
                          : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-750'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
                  3. Select Size (Incremental Sizing Curve)
                </label>
                <div className="flex gap-2">
                  {[26, 28, 30, 32, 34, 36, 38].map(sz => (
                    <button
                      key={sz}
                      onClick={() => setDemoSize(sz)}
                      className={`flex-1 py-2 rounded-lg border text-xs font-mono font-semibold transition-all cursor-pointer ${
                        demoSize === sz
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs'
                          : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-750'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Calculated Output Card */}
            <div className="lg:col-span-5 bg-zinc-50 dark:bg-zinc-950/60 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">CALCULATED RATE</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold font-mono">Sub-50ms</span>
              </div>

              <div className="space-y-0.5">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  [{demoSchool}] {demoItem.toUpperCase()} (Size {demoSize})
                </div>
                <div className="text-3xl font-bold text-zinc-950 dark:text-zinc-50 font-mono tabular-nums">
                  ₹{calculatedDemoPrice}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Dynamic multiplier resolved from {demoSchool} rate matrix
                </div>
              </div>

              {/* Barcode Tag Preview */}
              <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 font-mono text-center space-y-0.5 select-none shadow-2xs">
                <div className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100">{demoSchool} UNIFORM</div>
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">₹{calculatedDemoPrice} (SZ {demoSize})</div>
                <div className="text-[10px] tracking-widest text-zinc-400 dark:text-zinc-500">||| | |||| | ||| ||||</div>
              </div>

              <button
                onClick={onLaunchPOS}
                className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <span>Open Full POS Register</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. ARCHITECTURAL FEATURES */}
      <section id="features" className="py-20 bg-white dark:bg-zinc-900/50 border-y border-zinc-200/80 dark:border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Core Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 dark:text-zinc-50 tracking-tight">
              Why Specialty Apparel Retailers Choose Counterly
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
              Generic retail POS tools fail with school matrices, size curves, and peak rush billing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-zinc-50/70 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                School Uniform Rate Books
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Maintain independent price books per institution with automatic size curve increments across shirts, trousers, skirts, and blazers.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-zinc-50/70 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center shadow-xs">
                <Tag className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                Vector Barcode Sticker Generator
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Generate clean Code128 vector barcode stickers on 50×25mm thermal label rolls or 24-label A4 sheets without extra software.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-zinc-50/70 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center shadow-xs">
                <QrCode className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                Dual Display &amp; Dynamic UPI
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Transform any tablet or secondary monitor into an interactive customer checkout display with dynamic UPI QR payment.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-zinc-50/70 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                Alteration &amp; Advance Slips
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Issue tailored alteration tokens and advance booking receipts with customer phone search and remaining balance at pickup.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-zinc-50/70 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center shadow-xs">
                <Printer className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                Direct ESC/POS Thermal Printing
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Raw thermal support for 80mm and 58mm cutters. Auto paper cut, cash drawer kickout, and 1-click WhatsApp receipt dispatch.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-zinc-50/70 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center shadow-xs">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                6-Digit PIN Shift Security
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Rapid cashier shift switching with 6-digit PINs. Enforce discount thresholds, hide wholesale costs, and log staff registers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. TURNKEY HARDWARE APPLIANCE SHOWCASE */}
      <section id="hardware" className="py-20 px-6 max-w-6xl mx-auto">
        <div className="bg-zinc-950 text-white rounded-2xl p-8 sm:p-12 shadow-xl space-y-8 border border-zinc-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800">
            <div className="space-y-1.5">
              <span className="text-xs font-mono font-medium text-zinc-400 uppercase tracking-wider">
                Turnkey Counter Bundle
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                The Counterly Hardware Appliance Box
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
                Plug-and-play counter kit pre-loaded with your uniform catalog and configured printer drivers.
              </p>
            </div>

            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 shrink-0 text-right">
              <span className="text-xs text-zinc-400 block">Complete Setup from</span>
              <span className="text-3xl font-bold font-mono text-white">₹28,500</span>
              <span className="text-[11px] text-emerald-400 font-medium block mt-0.5">Includes 1-Yr Pro License</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <Laptop className="w-5 h-5 text-zinc-300" />
              <h4 className="font-semibold text-xs">Touch POS Terminal</h4>
              <p className="text-xs text-zinc-400">11.6" / 15.6" capacitive touchscreen with metal stand.</p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <Printer className="w-5 h-5 text-zinc-300" />
              <h4 className="font-semibold text-xs">80mm Thermal Printer</h4>
              <p className="text-xs text-zinc-400">260mm/s auto-cutter USB + Bluetooth ESC/POS printer.</p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <Scan className="w-5 h-5 text-zinc-300" />
              <h4 className="font-semibold text-xs">Laser Barcode Scanner</h4>
              <p className="text-xs text-zinc-400">Hands-free auto-sensing USB optical reader with stand.</p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <HardDrive className="w-5 h-5 text-zinc-300" />
              <h4 className="font-semibold text-xs">Barcode Label Printer</h4>
              <p className="text-xs text-zinc-400">50×25mm thermal sticker printer + 2,000 blank labels.</p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-800">
            <div className="text-xs text-zinc-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Doorstep installation, uniform catalog migration &amp; 1-year replacement warranty</span>
            </div>

            <button
              onClick={() => handleWhatsAppConsultation('Hardware POS Box Inquiry')}
              className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-zinc-100 text-zinc-950 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>WhatsApp Hardware Inquiry</span>
            </button>
          </div>
        </div>
      </section>

      {/* 7. TRANSPARENT PRICING GRID */}
      <section id="pricing" className="py-20 bg-white dark:bg-zinc-900/50 border-t border-zinc-200/80 dark:border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Commercial Editions
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 dark:text-zinc-50 tracking-tight">
              Simple Plans for Every Retail Counter
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
              No hidden cloud fees. 100% offline functionality guaranteed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Plan 1: Starter */}
            <div className="p-6 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Starter POS</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Single terminal standard retail billing</p>
                <div className="pt-2">
                  <div className="text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-50">₹3,999</div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">/ year per store</span>
                </div>
                <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Single Billing Counter</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> 80/58mm Thermal Print</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Inventory Tracking</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Daily Cash Register</li>
                </ul>
              </div>
              <button
                onClick={() => handleBuyPlan('starter')}
                className="w-full py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Buy Starter Edition
              </button>
            </div>

            {/* Plan 2: Pro (Featured) */}
            <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border-2 border-zinc-900 dark:border-zinc-100 flex flex-col justify-between space-y-6 relative shadow-md">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-semibold uppercase tracking-wider">
                Recommended
              </span>
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Pro Uniform Edition</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Dedicated for uniform &amp; apparel retailers</p>
                <div className="pt-2">
                  <div className="text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-50">₹6,999</div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">/ year per store</span>
                </div>
                <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> School Rate Matrices</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> 50×25mm Barcode Labels</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Dual Customer Display</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Advance &amp; Alteration Slips</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> GST CMP-08 &amp; GSTR-1</li>
                </ul>
              </div>
              <button
                onClick={() => handleBuyPlan('pro')}
                className="w-full py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold transition-colors shadow-xs cursor-pointer"
              >
                Buy Pro Edition
              </button>
            </div>

            {/* Plan 3: Enterprise */}
            <div className="p-6 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Enterprise</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">2 to 10 multi-counter rush store sync</p>
                <div className="pt-2">
                  <div className="text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-50">₹11,999</div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">/ year per store</span>
                </div>
                <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Multi-Counter Live Sync</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Unlimited Cashier PINs</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Cloud Database Mirror</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Dedicated Account Lead</li>
                </ul>
              </div>
              <button
                onClick={() => handleBuyPlan('enterprise')}
                className="w-full py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Buy Enterprise
              </button>
            </div>

            {/* Plan 4: Lifetime */}
            <div className="p-6 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Lifetime Perpetual</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">One-time fee, zero renewals forever</p>
                <div className="pt-2">
                  <div className="text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-50">₹18,999</div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">one-time lifetime</span>
                </div>
                <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Non-Expiring Offline Key</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> All Current &amp; Future Feats</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Lifetime Updates</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Priority Remote Setup</li>
                </ul>
              </div>
              <button
                onClick={() => handleBuyPlan('lifetime')}
                className="w-full py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Buy Lifetime
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FREQUENTLY ASKED QUESTIONS */}
      <section id="faq" className="py-20 px-6 max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-zinc-50">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Everything you need to know about switching your store to Counterly.
          </p>
        </div>

        <div className="space-y-3 text-xs sm:text-sm">
          <div className="p-5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1.5 shadow-2xs">
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Does Counterly work 100% offline without internet?</h4>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Yes. All price books, customer records, inventory, and bills are stored locally in IndexedDB inside your browser. You can create thousands of invoices with zero internet connectivity.
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1.5 shadow-2xs">
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Can I import my existing school uniform price books from Excel?</h4>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Yes. Counterly includes a built-in 1-click Excel/CSV importer and a pre-loaded catalog starter for popular uniform schools. You can import your entire rate matrix in under 2 minutes.
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1.5 shadow-2xs">
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">What printers and scanners are supported?</h4>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Any standard ESC/POS 80mm or 58mm thermal receipt printer (USB, Bluetooth BLE, Network) and any standard USB/Bluetooth HID laser barcode scanner.
            </p>
          </div>
        </div>
      </section>

      {/* 9. MINIMALIST FOOTER */}
      <footer className="bg-zinc-950 text-white py-12 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white text-zinc-950 flex items-center justify-center font-bold text-sm">
              C
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white">
                {VENDOR_BRAND_NAME}
              </span>
              <p className="text-xs text-zinc-400">
                Universal Retail POS &amp; Academic Uniform Systems
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => handleWhatsAppConsultation('General Question')}
              className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Support: {VENDOR_CONTACT_PHONE}
            </button>

            <button
              onClick={onLaunchPOS}
              className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-950 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Launch POS Counter
            </button>
          </div>
        </div>
      </footer>

      {/* Checkout Modal */}
      <InstantLicenseCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        license={license}
        onLicenseActivated={() => {
          setIsCheckoutOpen(false);
          onLicenseUpdated();
        }}
      />

      {/* Sample Thermal Slip Modal */}
      {isSampleReceiptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-zinc-900 dark:text-zinc-100">
                ESC/POS 80mm Sample Ticket
              </span>
              <button
                onClick={() => setIsSampleReceiptOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl font-mono text-[11px] text-center space-y-1.5 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-800 select-none">
              <div className="font-bold text-xs uppercase">SARASWATI GARMENTS</div>
              <div className="text-[10px] text-zinc-600 dark:text-zinc-400">School Uniforms &amp; Retail Garments</div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Ph: +91 98765 43210 · GSTIN: Unregistered</div>
              <div className="border-t border-dashed border-zinc-300 dark:border-zinc-700 my-2" />
              <div className="text-[10px] font-bold">BILL OF SUPPLY (CASH MEMO)</div>
              <div className="text-[9px] text-zinc-400">Bill: SG-2026-1042 · 06-Oct-2026 11:32 AM</div>
              <div className="text-[10px] font-semibold text-left pt-1">School: Delhi Public School (DPS)</div>
              <div className="border-t border-dashed border-zinc-300 dark:border-zinc-700 my-2" />
              
              <div className="space-y-1 text-left text-[10px]">
                <div className="flex justify-between">
                  <span>1. [DPS] Half Shirt (Sz 32) × 2</span>
                  <span className="font-bold">₹700.00</span>
                </div>
                <div className="flex justify-between">
                  <span>2. [DPS] Trouser Navy (Sz 30) × 1</span>
                  <span className="font-bold">₹450.00</span>
                </div>
                <div className="flex justify-between">
                  <span>3. [DPS] School Belt (Free) × 1</span>
                  <span className="font-bold">₹90.00</span>
                </div>
              </div>

              <div className="border-t border-dashed border-zinc-300 dark:border-zinc-700 my-2" />
              <div className="flex justify-between text-xs font-bold">
                <span>TOTAL AMOUNT:</span>
                <span>₹1,240.00</span>
              </div>
              <div className="text-[10px] text-zinc-600 dark:text-zinc-400 text-left pt-1">Payment: UPI (PAID)</div>
              <div className="border-t border-dashed border-zinc-300 dark:border-zinc-700 my-2" />
              <div className="text-[9px] text-zinc-400">
                7-Day Uniform Size Exchange Policy<br/>
                Thank You for Shopping With Us!
              </div>
            </div>

            <button
              onClick={() => setIsSampleReceiptOpen(false)}
              className="w-full py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* Sample Barcode Sticker Modal */}
      {isSampleBarcodeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-zinc-900 dark:text-zinc-100">
                50×25mm Thermal Sticker
              </span>
              <button
                onClick={() => setIsSampleBarcodeOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-xl flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
              <div className="w-[180px] h-[100px] bg-white text-zinc-900 p-2.5 rounded border border-zinc-300 font-mono text-center flex flex-col justify-between select-none shadow-xs">
                <div className="text-[9px] font-bold text-zinc-900 truncate">DELHI PUBLIC SCHOOL</div>
                <div className="text-[11px] font-bold text-zinc-900">HALF SHIRT (SZ 32)</div>
                <div className="text-xs tracking-widest font-mono text-black font-bold py-0.5">
                  ||||| | ||| |||| | |||||
                </div>
                <div className="text-[9px] font-semibold text-zinc-800 flex justify-between px-1">
                  <span>SG-DPS-1002</span>
                  <span className="font-bold text-[10px]">MRP: ₹350</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center">
              Prints crisp Code128 vector bars compatible with all standard laser barcode scanners.
            </p>

            <button
              onClick={() => setIsSampleBarcodeOpen(false)}
              className="w-full py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
