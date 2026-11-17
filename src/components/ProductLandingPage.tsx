import React, { useState, useRef } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Mail,
  MessageCircle,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  X,
  AlertCircle,
} from 'lucide-react';
import heroBoutiqueCounterImg from '../assets/images/hero_boutique_counter_1794904343202.jpg';
import hardwareTurnkeyKitImg from '../assets/images/hardware_turnkey_kit_1794904358684.jpg';
import barcodeTagHangtagImg from '../assets/images/barcode_tag_hangtag_1794904343759.jpg';
import {
  VENDOR_BRAND_NAME,
  VENDOR_CONTACT_PHONE,
  VENDOR_SUPPORT_EMAIL,
  VENDOR_WHATSAPP_NUMBER,
  COUNTERLY_PACKAGES,
  getCheckoutPaymentUrl,
  openPurchaseEmailRequest,
  openPurchaseWhatsAppRequest,
  verifyAndActivateOnline,
  type CounterlyPackageOption,
} from '../lib/licensing';
import { useTheme } from '../context/ThemeContext';
import { type LicenseState } from '../types';
import { EditorialStudioPhoto, HeroAsciiRestBackdrop } from './AsciiArtEngine';

interface ProductLandingPageProps {
  onLaunchPOS: () => void;
  onLaunchSandbox?: () => void;
  license: LicenseState;
  onLicenseUpdated: () => void;
}

type WorkflowStepId = 'ring' | 'print' | 'close';

interface WorkflowStepSpec {
  id: WorkflowStepId;
  tabLabel: string;
  title: string;
  summary: string;
  specLabel: string;
  rows: Array<{ label: string; value: string; emphasis?: boolean }>;
}

const WORKFLOW_STEPS: WorkflowStepSpec[] = [
  {
    id: 'ring',
    tabLabel: '01. Ring',
    title: 'Scan Size × Color variants without cloud latency',
    summary:
      'Ring garments and footwear straight from local IndexedDB storage, accept instant UPI QR or cash, apply cashier-capped discounts, and track per-SKU margin immediately.',
    specLabel: 'Variant Matrix · Sample Basket',
    rows: [
      { label: 'TEE-OBS-M · Heavyweight Crew Tee (M / Obsidian)', value: '₹799' },
      { label: 'DNM-IND-32 · Selvedge Tapered Denim (32 / Indigo)', value: '₹1,899' },
      { label: 'Gross Margin (Weighted) · GST Optional (0% until GSTIN)', value: '55.9% net', emphasis: true },
    ],
  },
  {
    id: 'print',
    tabLabel: '02. Print',
    title: 'Direct 80mm thermal slips and Code128 MRP hangtags',
    summary:
      'Send ESC/POS print jobs directly over USB or Web Bluetooth to TVS-E, Epson, TSC, or Retsol printers, or batch-print 50×25mm MRP sticker rolls and 24-up A4 sheets.',
    specLabel: 'Print Output · Browser ESC/POS',
    rows: [
      { label: 'Counter Receipt · 80mm & 58mm Thermal Roll', value: 'USB / BT' },
      { label: 'Barcode Hangtags · Code128 MRP & Size (50×25mm)', value: '1,000 / roll' },
      { label: 'Sheet Export · 24-Up Printable A4 Tag Grid', value: 'Ready offline', emphasis: true },
    ],
  },
  {
    id: 'close',
    tabLabel: '03. Close',
    title: 'Partial returns, cash drops, and verified daily Z-reports',
    summary:
      'Refund individual lines to cash, UPI, or store credit with automatic restocking, log mid-shift safe drops, and download your daily JSON store backup.',
    specLabel: 'Shift Z-Report · Drawer Reconciliation',
    rows: [
      { label: 'Opening Float + Net Cash Sales (19 bills)', value: '₹42,650' },
      { label: 'Mid-Shift Safe Drop & 1 Cash Return', value: '-₹12,500' },
      { label: 'Expected Cash in Register · 24h JSON Saved', value: '₹30,150', emphasis: true },
    ],
  },
];

const PRACTICAL_FAQS = [
  {
    question: 'We still use paper bill books or Excel—how hard is it to move our items in?',
    answer:
      'You can upload your existing Excel/CSV item sheet in one click (name, size, colour, barcode, purchase cost, and selling price) or start with an empty counter and add items as customers buy them. You can also test everything inside the Guided Sandbox first without touching your real stock.',
  },
  {
    question: 'What happens if shop Wi-Fi drops or a customer is waiting during an outage?',
    answer:
      'SikkaDesk saves your bills, stock counts, and customer khata locally inside your counter browser, so billing, UPI QR codes, and thermal printing never wait for internet. Once every 24 hours it reminds you to save a one-click store backup file.',
  },
  {
    question: 'Do I need a GSTIN number right away, or can I issue simple non-GST bills?',
    answer:
      'New stores start tax-free out of the box so you can print clean non-GST retail bills immediately. Whenever you are ready, enter your 15-digit GSTIN in Store Settings and GST billing turns on automatically across thermal slips and A4 invoices.',
  },
  {
    question: 'Which thermal bill printers, barcode tag printers, and scanners work with it?',
    answer:
      'Any standard 80mm or 58mm USB/Bluetooth receipt printer (TVS-E, Epson, Retsol, Rugtek) works cleanly, along with plug-and-play USB barcode scanners. For price tags, print 50×25mm sticker rolls on TSC/thermal tag printers or 24-up MRP sheets on any A4 office printer.',
  },
  {
    question: 'If we upgrade or change our shop computer later, do we lose old bills and customer dues?',
    answer:
      'Never. Export your full store JSON snapshot from Settings onto a pen drive or cloud folder anytime, and restore it on a new laptop or counter terminal in seconds—complete with your bill history, customer store credit, and remaining stock.',
  },
];

export const ProductLandingPage: React.FC<ProductLandingPageProps> = ({
  onLaunchPOS,
  onLaunchSandbox,
  license,
  onLicenseUpdated,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const tapCountRef = useRef<{ count: number; timer: number | null }>({ count: 0, timer: null });

  // Interactive 3-Step Workflow & Practical FAQ State
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<WorkflowStepId>('ring');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Purchase & Terminal Activation Modal State
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedOrderPkg, setSelectedOrderPkg] = useState<CounterlyPackageOption>(COUNTERLY_PACKAGES[1]);
  const [copiedMid, setCopiedMid] = useState(false);
  const [orderKeyInput, setOrderKeyInput] = useState('');
  const [orderActivating, setOrderActivating] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const checkoutUrl = getCheckoutPaymentUrl();
  const currentWorkflow =
    WORKFLOW_STEPS.find(step => step.id === activeWorkflowStep) || WORKFLOW_STEPS[0];

  const handleSecretVendorTap = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      window.dispatchEvent(new CustomEvent('counterly:open-vendor'));
      return;
    }
    tapCountRef.current.count += 1;
    if (tapCountRef.current.timer) window.clearTimeout(tapCountRef.current.timer);
    if (tapCountRef.current.count >= 5) {
      tapCountRef.current.count = 0;
      window.dispatchEvent(new CustomEvent('counterly:open-vendor'));
      return;
    }
    tapCountRef.current.timer = window.setTimeout(() => {
      tapCountRef.current.count = 0;
    }, 1800);
  };

  const openOrderModal = (pkgId: CounterlyPackageOption['id']) => {
    const found = COUNTERLY_PACKAGES.find(p => p.id === pkgId) || COUNTERLY_PACKAGES[1];
    setSelectedOrderPkg(found);
    setOrderError(null);
    setOrderSuccess(null);
    setOrderModalOpen(true);
  };

  const handleActivateFromLanding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderKeyInput.trim()) return;
    setOrderActivating(true);
    setOrderError(null);
    setOrderSuccess(null);
    try {
      const res = await verifyAndActivateOnline(orderKeyInput, license.storeName || 'Retail Store');
      if (res.success) {
        setOrderSuccess(res.message);
        setOrderKeyInput('');
        onLicenseUpdated();
        setTimeout(() => {
          setOrderModalOpen(false);
          onLaunchPOS();
        }, 900);
      } else {
        setOrderError(res.message);
      }
    } catch (err: unknown) {
      setOrderError((err as Error)?.message || 'Failed to verify key');
    } finally {
      setOrderActivating(false);
    }
  };

  return (
    <div
      id="top"
      className="min-h-screen bg-[#F6F6F4] dark:bg-zinc-950 text-[#141413] dark:text-zinc-100 transition-colors duration-200 selection:bg-[#1D4ED8] selection:text-white"
    >
      {/* Top Bar Contract: Strict 3-Zone Header (Single Wordmark | 4 Single-Line Links | 1 Primary CTA) */}
      <header className="sticky top-0 z-40 bg-[#F6F6F4]/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-[#D8D8D2] dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-editorial text-xl font-semibold tracking-tight text-[#141413] dark:text-zinc-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] rounded"
          >
            SikkaDesk
          </a>

          <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[#52524E] dark:text-zinc-400">
            <a
              href="#workbench"
              className="hover:text-[#141413] dark:hover:text-zinc-50 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Overview
            </a>
            <a
              href="#capabilities"
              className="hover:text-[#141413] dark:hover:text-zinc-50 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Workflow
            </a>
            <a
              href="#hardware"
              className="hover:text-[#141413] dark:hover:text-zinc-50 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Hardware Kit
            </a>
            <a
              href="#pricing"
              className="hover:text-[#141413] dark:hover:text-zinc-50 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Pricing
            </a>
          </nav>

          <button
            type="button"
            onClick={onLaunchPOS}
            className="px-4 py-2 rounded-lg bg-[#141413] dark:bg-zinc-100 hover:opacity-90 text-[#F6F6F4] dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
          >
            <span>Open POS Register</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <main>
        {/* Section 1: Bold Editorial Hero Over Full-Color ascii.rest Scene + Boutique Counter Showcase */}
        <section id="workbench" className="pb-16">
          <div className="relative overflow-hidden bg-[#05080f] text-white pt-16 sm:pt-24 pb-28 sm:pb-32 px-6">
            <HeroAsciiRestBackdrop className="absolute inset-0 z-0" />

            <div className="relative z-10 max-w-3xl mx-auto text-center space-y-7">
              <div className="space-y-4">
                <p className="text-[13px] font-medium text-zinc-200">
                  Built for Indian clothing, footwear &amp; retail shops
                </p>
                <h1 className="font-extrabold text-[clamp(2.85rem,5.5vw,4.75rem)] tracking-[-0.035em] leading-[0.98] text-white text-balance">
                  Simple counter billing for busy retail shops.
                </h1>
                <p className="text-base sm:text-lg text-zinc-200 leading-relaxed max-w-xl mx-auto">
                  Bill sizes and colours in seconds, take cash or UPI QR payments, print thermal bills and barcode price tags, and tally your daily cash box—even if your shop Wi-Fi goes down.
                </p>
              </div>

              {/* Primary Decision Block */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                {onLaunchSandbox ? (
                  <button
                    type="button"
                    onClick={onLaunchSandbox}
                    className="px-6 py-3 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-[13px] font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05080f]"
                  >
                    <span>Try Interactive Sandbox</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onLaunchPOS}
                    className="px-6 py-3 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-[13px] font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    <span>Start 14-Day Free Pilot</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={onLaunchSandbox ? onLaunchPOS : () => openOrderModal('turnkey_box')}
                  className="px-5 py-3 rounded-lg border border-white/25 bg-zinc-950/50 backdrop-blur-sm hover:bg-zinc-900/75 text-white text-xs sm:text-[13px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  {onLaunchSandbox ? 'Start 14-Day Free Pilot' : 'Order Hardware Kit'}
                </button>
              </div>

              {/* Quiet Unboxed Metadata */}
              <div className="pt-5 border-t border-white/15 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs text-zinc-300 max-w-2xl mx-auto">
                <span>Works without Wi-Fi</span>
                <span aria-hidden="true">·</span>
                <span>Instant UPI QR &amp; Cash</span>
                <span aria-hidden="true">·</span>
                <span>Thermal Bills &amp; Price Tags</span>
                <span aria-hidden="true">·</span>
                <span>GST Only If Needed</span>
              </div>
            </div>
          </div>

          {/* Clean Boutique Counter Photography Showcase + 4-KPI Strip */}
          <div className="relative z-10 max-w-7xl mx-auto px-6 -mt-14 sm:-mt-16">
            <div className="space-y-0 border border-[#D8D8D2] dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-lg">
              <EditorialStudioPhoto
                src={heroBoutiqueCounterImg}
                alt="Independent apparel boutique counter running SikkaDesk POS terminal with 80mm thermal receipt printer and folded garments"
                fallbackTitle="SikkaDesk Boutique Checkout Station"
                fallbackNote="15.6-inch capacitive touch register and 80mm thermal receipt printer on a mineral stone retail counter."
                className="aspect-[16/9] max-h-[480px] w-full"
                photoOverlay={
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex items-end p-6 sm:p-8 pointer-events-none">
                    <p className="font-editorial text-lg sm:text-xl font-medium text-white max-w-xl leading-snug">
                      Built for real counter space—where receipts print cleanly even when store Wi-Fi drops.
                    </p>
                  </div>
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#D8D8D2] dark:divide-zinc-800 border-t border-[#D8D8D2] dark:border-zinc-800">
                <div className="p-5 sm:p-6 space-y-1">
                  <div className="font-mono text-xl font-bold text-[#141413] dark:text-zinc-50 tabular-nums">
                    100%
                  </div>
                  <div className="text-xs font-semibold text-[#141413] dark:text-zinc-200">
                    Offline Checkout
                  </div>
                  <p className="text-xs text-[#52524E] dark:text-zinc-400">
                    Local ledger runs with zero cloud lag.
                  </p>
                </div>
                <div className="p-5 sm:p-6 space-y-1">
                  <div className="font-mono text-xl font-bold text-[#141413] dark:text-zinc-50 tabular-nums">
                    Size × Color
                  </div>
                  <div className="text-xs font-semibold text-[#141413] dark:text-zinc-200">
                    Variant Margin &amp; Tax
                  </div>
                  <p className="text-xs text-[#52524E] dark:text-zinc-400">
                    Track unit cost and tax on every SKU.
                  </p>
                </div>
                <div className="p-5 sm:p-6 space-y-1">
                  <div className="font-mono text-xl font-bold text-[#141413] dark:text-zinc-50 tabular-nums">
                    80 / 58mm
                  </div>
                  <div className="text-xs font-semibold text-[#141413] dark:text-zinc-200">
                    ESC/POS &amp; Hangtags
                  </div>
                  <p className="text-xs text-[#52524E] dark:text-zinc-400">
                    Thermal receipts and 50×25mm labels.
                  </p>
                </div>
                <div className="p-5 sm:p-6 space-y-1">
                  <div className="font-mono text-xl font-bold text-[#141413] dark:text-zinc-50 tabular-nums">
                    24-Hour
                  </div>
                  <div className="text-xs font-semibold text-[#141413] dark:text-zinc-200">
                    Shift Z-Reports &amp; Backups
                  </div>
                  <p className="text-xs text-[#52524E] dark:text-zinc-400">
                    Daily JSON snapshots and drawer close.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Tabbed 3-Step Workflow Preview & Hangtag Craft */}
        <section
          id="capabilities"
          className="py-16 px-6 max-w-7xl mx-auto border-t border-[#D8D8D2] dark:border-zinc-800 space-y-10"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <p className="text-[13px] font-medium text-[#52524E] dark:text-zinc-400">
                Daily store workflow
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] text-[#141413] dark:text-zinc-50 text-balance">
                Everything a boutique counter needs, nothing extra.
              </h2>
            </div>
            {onLaunchSandbox && (
              <button
                type="button"
                onClick={onLaunchSandbox}
                className="px-4 py-2 rounded-lg bg-[#141413] dark:bg-zinc-100 text-[#F6F6F4] dark:text-zinc-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 hover:opacity-90 self-start md:self-auto"
              >
                <span>Launch Guided Sandbox</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Column: Interactive 3-Step Workflow Switcher */}
            <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-[#D8D8D2] dark:border-zinc-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                {/* Segmented Step Selector */}
                <div
                  role="tablist"
                  aria-label="SikkaDesk daily workflow steps"
                  className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#F6F6F4] dark:bg-zinc-950 border border-[#D8D8D2] dark:border-zinc-800"
                >
                  {WORKFLOW_STEPS.map(step => {
                    const isActive = step.id === activeWorkflowStep;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveWorkflowStep(step.id)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-[#141413] dark:bg-zinc-100 text-[#F6F6F4] dark:text-zinc-950'
                            : 'text-[#52524E] dark:text-zinc-400 hover:text-[#141413] dark:hover:text-zinc-100'
                        }`}
                      >
                        {step.tabLabel}
                      </button>
                    );
                  })}
                </div>

                {/* Active Step Copy */}
                <div className="space-y-2">
                  <h3 className="font-editorial text-xl sm:text-2xl font-semibold text-[#141413] dark:text-zinc-50 text-balance">
                    {currentWorkflow.title}
                  </h3>
                  <p className="text-sm text-[#52524E] dark:text-zinc-400 leading-relaxed max-w-xl">
                    {currentWorkflow.summary}
                  </p>
                </div>
              </div>

              {/* Compact Specimen Panel */}
              <div className="rounded-xl bg-[#F6F6F4] dark:bg-zinc-950 border border-[#D8D8D2] dark:border-zinc-800 p-4 sm:p-5 space-y-3">
                <div className="text-[11px] font-mono text-[#52524E] dark:text-zinc-400">
                  {currentWorkflow.specLabel}
                </div>
                <div className="divide-y divide-[#D8D8D2] dark:divide-zinc-800 border-t border-[#D8D8D2] dark:border-zinc-800 text-xs font-mono tabular-nums">
                  {currentWorkflow.rows.map(row => (
                    <div
                      key={row.label}
                      className="py-2.5 flex items-center justify-between gap-4"
                    >
                      <span
                        className={
                          row.emphasis
                            ? 'font-semibold text-[#141413] dark:text-zinc-100'
                            : 'text-[#52524E] dark:text-zinc-400'
                        }
                      >
                        {row.label}
                      </span>
                      <span
                        className={`shrink-0 font-semibold ${
                          row.emphasis
                            ? 'text-[#1D4ED8] dark:text-sky-400'
                            : 'text-[#141413] dark:text-zinc-200'
                        }`}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Clean Cotton Hangtags Studio Photo */}
            <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-[#D8D8D2] dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col justify-between">
              <EditorialStudioPhoto
                src={barcodeTagHangtagImg}
                alt="Printed cotton clothing hangtags with Code128 barcodes resting on folded raw denim"
                fallbackTitle="Code128 Hangtags & Shelf Labels"
                fallbackNote="50×25mm thermal barcode stickers and 24-up A4 sheets printed directly from browser."
                className="aspect-[4/3] w-full border-b border-[#D8D8D2] dark:border-zinc-800"
              />
              <div className="p-6 space-y-1.5">
                <div className="text-xs font-mono text-[#52524E] dark:text-zinc-400">
                  Code128 Barcode Tag Studio
                </div>
                <h3 className="font-editorial text-lg font-semibold text-[#141413] dark:text-zinc-50">
                  50×25mm thermal rolls &amp; 24-up A4 sheets
                </h3>
                <p className="text-xs text-[#52524E] dark:text-zinc-400 leading-relaxed">
                  Print crisp scannable hangtags and shoebox stickers straight from your catalog.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Turnkey Counter Hardware Bundle */}
        <section
          id="hardware"
          className="py-16 px-6 max-w-7xl mx-auto border-t border-[#D8D8D2] dark:border-zinc-800"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch bg-white dark:bg-zinc-900 border border-[#D8D8D2] dark:border-zinc-800 rounded-2xl overflow-hidden">
            {/* Left Column: Studio Hardware Flat-Lay */}
            <EditorialStudioPhoto
              src={hardwareTurnkeyKitImg}
              alt="Complete SikkaDesk turnkey hardware bundle: 15.6 inch touchscreen terminal, 80mm thermal printer, 2D desktop scanner, and 50x25mm barcode label printer"
              fallbackTitle="SikkaDesk Turnkey Hardware Box"
              fallbackNote="15.6-inch touch terminal, 80mm receipt printer, 2D scanner, and label printer."
              className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-[#D8D8D2] dark:border-zinc-800 min-h-[320px] lg:min-h-[440px]"
            />

            {/* Right Column: Concise 4-Device Manifest & Bundle Order */}
            <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-2.5">
                <div className="text-xs font-mono text-[#52524E] dark:text-zinc-400">
                  Turnkey Hardware Box
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] text-[#141413] dark:text-zinc-50 text-balance">
                  Plug in, power on, start scanning.
                </h2>
                <p className="text-xs sm:text-sm text-[#52524E] dark:text-zinc-400 leading-relaxed">
                  Delivered pre-configured with SikkaDesk POS Pro and tested thermal drivers.
                </p>
              </div>

              <div className="divide-y divide-[#D8D8D2] dark:divide-zinc-800 border-y border-[#D8D8D2] dark:border-zinc-800 text-xs">
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="font-semibold text-[#141413] dark:text-zinc-100">
                    15.6" Touch POS Terminal
                  </span>
                  <span className="text-[#52524E] dark:text-zinc-400">Aluminum stand</span>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="font-semibold text-[#141413] dark:text-zinc-100">
                    80mm Thermal Printer
                  </span>
                  <span className="text-[#52524E] dark:text-zinc-400">USB &amp; Bluetooth</span>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="font-semibold text-[#141413] dark:text-zinc-100">
                    2D Desktop Scanner
                  </span>
                  <span className="text-[#52524E] dark:text-zinc-400">Hands-free stand</span>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="font-semibold text-[#141413] dark:text-zinc-100">
                    50×25mm Label Printer
                  </span>
                  <span className="text-[#52524E] dark:text-zinc-400">1,000 starter tags</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div>
                  <div className="font-mono text-2xl font-bold text-[#141413] dark:text-zinc-50 tabular-nums">
                    ₹18,999
                  </div>
                  <div className="text-[11px] text-[#52524E] dark:text-zinc-400">
                    Includes 1-Yr Pro License
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openOrderModal('turnkey_box')}
                  className="px-5 py-2.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-sky-400 dark:hover:bg-sky-300 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  <span>Order Turnkey Bundle</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: 5-Question Practical FAQ for Paper & Excel Switchers */}
        <section className="py-16 px-6 max-w-7xl mx-auto border-t border-[#D8D8D2] dark:border-zinc-800">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 space-y-2.5">
              <p className="text-[13px] font-medium text-[#52524E] dark:text-zinc-400">
                Practical answers
              </p>
              <h2 className="text-2xl font-extrabold tracking-[-0.025em] text-[#141413] dark:text-zinc-50 text-balance">
                Questions shop owners ask before switching from paper bills.
              </h2>
              <p className="text-xs sm:text-sm text-[#52524E] dark:text-zinc-400 leading-relaxed">
                Straight answers on moving items out of Excel, running without internet, GSTIN rules, and counter printers.
              </p>
            </div>

            <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-[#D8D8D2] dark:border-zinc-800 rounded-2xl divide-y divide-[#D8D8D2] dark:divide-zinc-800 overflow-hidden">
              {PRACTICAL_FAQS.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={faq.question}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-[#F6F6F4]/70 dark:hover:bg-zinc-950/60 cursor-pointer transition-colors"
                    >
                      <span className="text-sm font-semibold text-[#141413] dark:text-zinc-100">
                        {faq.question}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#52524E] dark:text-zinc-400 shrink-0 transition-transform duration-150 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 text-xs sm:text-sm text-[#52524E] dark:text-zinc-400 leading-relaxed">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 5: Straightforward Annual Licensing */}
        <section
          id="pricing"
          className="py-16 px-6 max-w-7xl mx-auto border-t border-[#D8D8D2] dark:border-zinc-800 space-y-10"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <p className="text-[13px] font-medium text-[#52524E] dark:text-zinc-400">
                Simple annual pricing
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] text-[#141413] dark:text-zinc-50 text-balance">
                Own your counter stack without per-bill commissions.
              </h2>
            </div>
            <p className="text-xs text-[#52524E] dark:text-zinc-400">
              Try free for 14 days in your browser—no card or UPI mandate required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 border border-[#D8D8D2] dark:border-zinc-800 rounded-2xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[#D8D8D2] dark:divide-zinc-800 bg-white dark:bg-zinc-900">
            <div className="p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="text-xs font-medium text-[#52524E] dark:text-zinc-400">
                  Single Counter
                </div>
                <div className="font-mono text-3xl font-bold text-[#141413] dark:text-zinc-50 tabular-nums">
                  ₹1,499 <span className="text-sm font-normal text-[#52524E] dark:text-zinc-400">/ yr</span>
                </div>
                <ul className="space-y-2 text-xs text-[#52524E] dark:text-zinc-400 pt-4 border-t border-[#D8D8D2] dark:border-zinc-800">
                  <li>1 POS Register Terminal</li>
                  <li>Unlimited Size × Color SKUs</li>
                  <li>80mm Bills, UPI QR &amp; MRP Labels</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => openOrderModal('single_counter')}
                className="w-full py-2.5 rounded-lg border border-[#D8D8D2] dark:border-zinc-700 hover:bg-[#ECECE8] dark:hover:bg-zinc-800 text-xs font-semibold text-[#141413] dark:text-zinc-100 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                Buy Single Counter
              </button>
            </div>

            <div className="p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-[#F6F6F4] dark:bg-zinc-950/60 border-t-2 border-t-[#1D4ED8] dark:border-t-sky-400 md:border-t-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#141413] dark:text-zinc-100">
                    Multi-Counter Pro
                  </span>
                  <span className="font-medium text-[#1D4ED8] dark:text-sky-400">
                    Recommended
                  </span>
                </div>
                <div className="font-mono text-3xl font-bold text-[#141413] dark:text-zinc-50 tabular-nums">
                  ₹2,999 <span className="text-sm font-normal text-[#52524E] dark:text-zinc-400">/ yr</span>
                </div>
                <ul className="space-y-2 text-xs text-[#52524E] dark:text-zinc-300 pt-4 border-t border-[#D8D8D2] dark:border-zinc-800">
                  <li>Up to 5 Counter Terminals</li>
                  <li>Customer Display Sync &amp; GST Reports</li>
                  <li>Priority Onboarding &amp; WhatsApp Support</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => openOrderModal('multi_pro')}
                className="w-full py-2.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-sky-400 dark:hover:bg-sky-300 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                Buy / Request Pro Key
              </button>
            </div>

            <div className="p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="text-xs font-medium text-[#52524E] dark:text-zinc-400">
                  Turnkey Hardware Bundle
                </div>
                <div className="font-mono text-3xl font-bold text-[#141413] dark:text-zinc-50 tabular-nums">
                  ₹18,999 <span className="text-sm font-normal text-[#52524E] dark:text-zinc-400">kit</span>
                </div>
                <ul className="space-y-2 text-xs text-[#52524E] dark:text-zinc-400 pt-4 border-t border-[#D8D8D2] dark:border-zinc-800">
                  <li>15.6" Terminal + 80mm &amp; Label Printers</li>
                  <li>Hands-Free 2D Desktop Scanner</li>
                  <li>1-Year Pro License Included</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => openOrderModal('turnkey_box')}
                className="w-full py-2.5 rounded-lg border border-[#D8D8D2] dark:border-zinc-700 hover:bg-[#ECECE8] dark:hover:bg-zinc-800 text-xs font-semibold text-[#141413] dark:text-zinc-100 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                Order Hardware Box
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Structured 4-Column Trust Footer (Preserves 5-Tap / Shift+Click Vendor Portal Trigger) */}
      <footer className="border-t border-[#D8D8D2] dark:border-zinc-800 bg-[#ECECE8] dark:bg-zinc-950 pt-12 pb-8 px-6">
        <div className="max-w-7xl mx-auto space-y-10 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* Column 1: Brand Identity & Physical Office Trust Anchor */}
            <div className="lg:col-span-4 space-y-3">
              <div onClick={handleSecretVendorTap} className="select-none space-y-1.5 w-fit">
                <div className="font-editorial font-semibold text-lg text-[#141413] dark:text-zinc-100">
                  {VENDOR_BRAND_NAME}
                </div>
                <p className="text-[#52524E] dark:text-zinc-400 leading-relaxed max-w-xs">
                  Offline-first counter billing, barcode price tagging, and daily cash reconciliation built for Indian apparel, footwear, and retail stores.
                </p>
              </div>
              <div className="text-[11px] text-[#52524E] dark:text-zinc-400 space-y-0.5 pt-1">
                <div className="font-semibold text-[#141413] dark:text-zinc-200">
                  Bengaluru Support Desk
                </div>
                <div>Indiranagar, Bengaluru 560038 · Mon–Sat, 10 AM – 7 PM IST</div>
              </div>
            </div>

            {/* Column 2: Product & Trial Links */}
            <div className="lg:col-span-2 space-y-3">
              <div className="font-semibold text-[#141413] dark:text-zinc-100">Product</div>
              <ul className="space-y-2 text-[#52524E] dark:text-zinc-400">
                <li>
                  <a
                    href="#workbench"
                    className="hover:text-[#141413] dark:hover:text-zinc-100 hover:underline underline-offset-4"
                  >
                    Overview
                  </a>
                </li>
                <li>
                  <a
                    href="#capabilities"
                    className="hover:text-[#141413] dark:hover:text-zinc-100 hover:underline underline-offset-4"
                  >
                    Daily Workflow
                  </a>
                </li>
                <li>
                  <a
                    href="#hardware"
                    className="hover:text-[#141413] dark:hover:text-zinc-100 hover:underline underline-offset-4"
                  >
                    Hardware Kit
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="hover:text-[#141413] dark:hover:text-zinc-100 hover:underline underline-offset-4"
                  >
                    Annual Pricing
                  </a>
                </li>
                {onLaunchSandbox && (
                  <li>
                    <button
                      type="button"
                      onClick={onLaunchSandbox}
                      className="hover:text-[#141413] dark:hover:text-zinc-100 hover:underline underline-offset-4 cursor-pointer text-left"
                    >
                      Try Live Sandbox
                    </button>
                  </li>
                )}
              </ul>
            </div>

            {/* Column 3: Direct Merchant Support & Hardware Orders */}
            <div className="lg:col-span-3 space-y-3">
              <div className="font-semibold text-[#141413] dark:text-zinc-100">
                Sales &amp; Counter Support
              </div>
              <div className="space-y-2 text-[#52524E] dark:text-zinc-400">
                <a
                  href={`tel:${VENDOR_CONTACT_PHONE.replace(/[^+\d]/g, '')}`}
                  className="flex items-center gap-2 hover:text-[#141413] dark:hover:text-zinc-100 hover:underline underline-offset-4 font-mono tabular-nums"
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{VENDOR_CONTACT_PHONE}</span>
                </a>
                <a
                  href={`mailto:${VENDOR_SUPPORT_EMAIL}`}
                  className="flex items-center gap-2 hover:text-[#141413] dark:hover:text-zinc-100 hover:underline underline-offset-4"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span>{VENDOR_SUPPORT_EMAIL}</span>
                </a>
                <a
                  href={`https://api.whatsapp.com/send/?phone=${VENDOR_WHATSAPP_NUMBER}&text=${encodeURIComponent(
                    'Hello SikkaDesk Support, I have a question about POS setup or hardware.'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-[#141413] dark:hover:text-zinc-100 hover:underline underline-offset-4"
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>WhatsApp Support Desk</span>
                </a>
              </div>
              <p className="text-[11px] text-[#52524E] dark:text-zinc-400 pt-1 leading-relaxed">
                14-day free browser pilot · 1-year carry-in warranty on SikkaDesk hardware bundles.
              </p>
            </div>

            {/* Column 4: Data Ownership & Counter Controls */}
            <div className="lg:col-span-3 space-y-3">
              <div className="font-semibold text-[#141413] dark:text-zinc-100 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Your Store Data Stays Local</span>
              </div>
              <p className="text-[#52524E] dark:text-zinc-400 leading-relaxed">
                All bills, stock counts, and customer balances remain on your counter computer with instant JSON &amp; CSV backup exports.
              </p>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#D8D8D2] dark:border-zinc-800 bg-[#F6F6F4] dark:bg-zinc-900 text-[#141413] dark:text-zinc-200 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {resolvedTheme === 'dark' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>Light Paper</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-[#52524E]" />
                      <span>Dark Counter</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onLaunchPOS}
                  className="px-4 py-2 rounded-lg bg-[#141413] dark:bg-zinc-100 text-[#F6F6F4] dark:text-zinc-950 font-semibold cursor-pointer whitespace-nowrap shrink-0 hover:opacity-90"
                >
                  Open POS Register
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Hairline Assurance Row */}
          <div className="pt-6 border-t border-[#D8D8D2] dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-[#52524E] dark:text-zinc-400">
            <span>© 2026 {VENDOR_BRAND_NAME}. Built for Indian retail counters.</span>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span>Offline-Capable Billing</span>
              <span aria-hidden="true">·</span>
              <span>GSTIN Optional</span>
              <span aria-hidden="true">·</span>
              <span>Zero Per-Bill Commission</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Purchase & Terminal Activation Modal */}
      {orderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 border border-[#D8D8D2] dark:border-zinc-800 shadow-2xl space-y-5 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8D8D2] dark:border-zinc-800">
              <div>
                <h3 className="font-editorial text-lg font-semibold text-[#141413] dark:text-zinc-50">
                  Purchase &amp; Terminal Activation
                </h3>
                <p className="text-xs text-[#52524E] dark:text-zinc-400">
                  Pay online, send your Machine ID for key issuance, or try the live sandbox first
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOrderModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                aria-label="Close purchase modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {COUNTERLY_PACKAGES.map(pkg => {
                const active = selectedOrderPkg.id === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedOrderPkg(pkg)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                      active
                        ? 'border-[#141413] dark:border-zinc-100 bg-[#141413] dark:bg-zinc-100 text-white dark:text-zinc-950'
                        : 'border-[#D8D8D2] dark:border-zinc-800 bg-[#F6F6F4] dark:bg-zinc-950 text-[#141413] dark:text-zinc-100'
                    }`}
                  >
                    <div className="text-xs font-bold">{pkg.name}</div>
                    <div className="text-sm font-mono font-bold tabular-nums mt-0.5">
                      {pkg.priceLabel}
                    </div>
                    <div className="text-[11px] opacity-80 mt-1">{pkg.summary}</div>
                  </button>
                );
              })}
            </div>

            <div className="p-3 rounded-xl bg-[#F6F6F4] dark:bg-zinc-950 border border-[#D8D8D2] dark:border-zinc-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-[11px] text-[#52524E] dark:text-zinc-400 block">
                  Your Terminal Machine ID
                </span>
                <span className="font-mono font-bold select-all text-[#141413] dark:text-zinc-100">
                  {license.machineId}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(license.machineId);
                  setCopiedMid(true);
                  setTimeout(() => setCopiedMid(false), 1800);
                }}
                className="flex items-center gap-1 font-semibold text-[#141413] dark:text-zinc-200 cursor-pointer"
              >
                {copiedMid ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedMid ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {checkoutUrl && (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[160px] py-2.5 px-3 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Pay Online &amp; Checkout</span>
                </a>
              )}
              <button
                type="button"
                onClick={() =>
                  openPurchaseEmailRequest({
                    packageOption: selectedOrderPkg,
                    machineId: license.machineId,
                    storeName: license.storeName,
                  })
                }
                className="flex-1 min-w-[140px] py-2.5 px-3 rounded-lg border border-[#D8D8D2] dark:border-zinc-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#F6F6F4] dark:hover:bg-zinc-800"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Request via Email</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  openPurchaseWhatsAppRequest({
                    packageOption: selectedOrderPkg,
                    machineId: license.machineId,
                    storeName: license.storeName,
                  })
                }
                className="flex-1 min-w-[140px] py-2.5 px-3 rounded-lg border border-[#D8D8D2] dark:border-zinc-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#F6F6F4] dark:hover:bg-zinc-800"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Order</span>
              </button>
            </div>

            <form
              onSubmit={handleActivateFromLanding}
              className="pt-3 border-t border-[#D8D8D2] dark:border-zinc-800 space-y-2.5"
            >
              <label className="block text-xs font-semibold text-[#141413] dark:text-zinc-100">
                Already received your CNTR key?
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={orderKeyInput}
                  onChange={e => setOrderKeyInput(e.target.value.toUpperCase())}
                  placeholder="CNTR-PRO-YYYYMMDD-XXXX-XXXX"
                  className="flex-1 h-9 px-3 rounded-lg border border-[#D8D8D2] dark:border-zinc-800 bg-[#F6F6F4] dark:bg-zinc-950 font-mono text-xs uppercase text-[#141413] dark:text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={orderActivating || !orderKeyInput.trim()}
                  className="px-4 h-9 rounded-lg bg-[#141413] dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  {orderActivating ? 'Verifying...' : 'Activate'}
                </button>
              </div>
              {orderError && (
                <div className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{orderError}</span>
                </div>
              )}
              {orderSuccess && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{orderSuccess}</span>
                </div>
              )}
            </form>

            {onLaunchSandbox && (
              <div className="pt-2 flex items-center justify-between text-xs border-t border-[#D8D8D2] dark:border-zinc-800">
                <span className="text-[#52524E] dark:text-zinc-400">
                  Want to test before ordering?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOrderModalOpen(false);
                    onLaunchSandbox();
                  }}
                  className="font-semibold underline text-[#141413] dark:text-zinc-50 cursor-pointer"
                >
                  Try Live Sandbox First
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
