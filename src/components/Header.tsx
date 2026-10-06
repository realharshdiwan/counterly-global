import React, { useEffect, useState } from 'react';
import { 
  Tag, 
  Package, 
  ReceiptText, 
  Settings, 
  Printer, 
  TrendingUp, 
  School as SchoolIcon,
  Lock,
  PlusCircle,
  Radio,
  Sun,
  Moon
} from 'lucide-react';
import { db } from '../db/db';
import { bluetoothPrinter } from '../lib/printer';
import { useAuth, type AppTab } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { PWAInstallButton } from './PWAInstallButton';
import { ROLE_INFO, type LicenseState, type StoreBusinessType } from '../types';
import { KeyRound, Sparkles, ShieldCheck } from 'lucide-react';
import { getCatalogTabMeta } from '../lib/catalogLabels';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  onOpenBluetoothModal?: () => void;
  onRequestManagerOverride?: (targetTab: AppTab) => void;
  license?: LicenseState;
  onOpenLicenseModal?: () => void;
  onSwitchToLanding?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  setActiveTab, 
  onOpenBluetoothModal,
  onRequestManagerOverride,
  license,
  onOpenLicenseModal,
  onSwitchToLanding
}) => {


  const { currentUser, lockScreen, canAccessTab } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [todayTotal, setTodayTotal] = useState<number>(0);
  const [todayBillsCount, setTodayBillsCount] = useState<number>(0);
  const [isBleConnected, setIsBleConnected] = useState<boolean>(false);
  const [shopName, setShopName] = useState<string>('Saraswati Garments');
  const [storeType, setStoreType] = useState<StoreBusinessType | undefined>('apparel');

  // Load today's sales metrics & shop name from IndexedDB
  useEffect(() => {
    async function loadTodayStats() {
      try {
        const [allBills, configs] = await Promise.all([
          db.bills.toArray(),
          db.shop_config.toArray(),
        ]);

        if (configs.length > 0) {
          if (configs[0].legal_name) setShopName(configs[0].legal_name);
          setStoreType(configs[0].store_type);
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const todayBills = allBills.filter(b => {
          const d = new Date(b.created_at);
          return d >= startOfDay && b.status !== 'voided';
        });

        const sum = todayBills.reduce((acc, b) => acc + (b.total || 0), 0);
        setTodayTotal(sum);
        setTodayBillsCount(todayBills.length);
      } catch (err) {
        console.error('Error fetching today stats:', err);
      }
    }

    loadTodayStats();
    const interval = setInterval(loadTodayStats, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkBle = () => {
      setIsBleConnected(bluetoothPrinter.isConnected());
    };
    const t = setInterval(checkBle, 2000);
    return () => clearInterval(t);
  }, []);

  const handleTabClick = (tab: AppTab) => {
    if (canAccessTab(tab)) {
      setActiveTab(tab);
    } else {
      if (onRequestManagerOverride) {
        onRequestManagerOverride(tab);
      }
    }
  };

  const currentRoleMeta = currentUser ? ROLE_INFO[currentUser.role] : null;
  const catalogTabMeta = getCatalogTabMeta(storeType);
  const CatalogIcon = catalogTabMeta.icon;

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-[#E5E5E7] dark:border-zinc-800 shadow-2xs transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 h-15 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Standalone Brand Wordmark & Landing Switcher */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onSwitchToLanding}
            className="font-bold text-xl tracking-tight text-[#1D1D1F] dark:text-zinc-100 select-none hover:opacity-80 transition-opacity cursor-pointer flex items-center gap-1.5"
            title="Click to view Product Website, Hardware Kits & Pricing"
          >
            <span>Counterly</span>
            <span className="hidden xl:inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-[#F5F5F7] dark:bg-zinc-800 text-[#86868B] dark:text-zinc-400 border border-[#E5E5E7] dark:border-zinc-700">
              POS
            </span>
          </button>
        </div>


        {/* Navigation Tabs - Apple Segmented Control */}
        <nav className="flex items-center gap-1 bg-[#E8E8ED]/80 dark:bg-zinc-800/80 p-1 rounded-xl border border-[#E5E5E7]/50 dark:border-zinc-700/50">
          <button
            onClick={() => handleTabClick('billing')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'billing'
                ? 'bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                : 'text-[#1D1D1F] dark:text-zinc-300 hover:bg-white/80 dark:hover:bg-zinc-700/80'
            }`}
            title="Create New Customer Bill (POS)"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Bill</span>
          </button>

          <button
            onClick={() => handleTabClick('prices')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'prices'
                ? 'bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                : !canAccessTab('prices')
                ? 'text-[#86868B] dark:text-zinc-500 hover:text-[#515154]'
                : 'text-[#1D1D1F] dark:text-zinc-300 hover:bg-white/80 dark:hover:bg-zinc-700/80'
            }`}
            title={!canAccessTab('prices') ? 'Requires Shift Lead PIN' : 'School Price Book'}
          >
            <Tag className="w-4 h-4" />
            <span className="hidden sm:inline">Prices</span>
            {!canAccessTab('prices') && <Lock className="w-3 h-3 text-[#86868B]" />}
          </button>

          <button
            onClick={() => handleTabClick('inventory')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                : !canAccessTab('inventory')
                ? 'text-[#86868B] dark:text-zinc-500 hover:text-[#515154]'
                : 'text-[#1D1D1F] dark:text-zinc-300 hover:bg-white/80 dark:hover:bg-zinc-700/80'
            }`}
            title={!canAccessTab('inventory') ? 'Requires Shift Lead PIN' : 'Stock & Inventory'}
          >
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Stock</span>
            {!canAccessTab('inventory') && <Lock className="w-3 h-3 text-[#86868B]" />}
          </button>

          <button
            onClick={() => handleTabClick('schools')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'schools'
                ? 'bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                : !canAccessTab('schools')
                ? 'text-[#86868B] dark:text-zinc-500 hover:text-[#515154]'
                : 'text-[#1D1D1F] dark:text-zinc-300 hover:bg-white/80 dark:hover:bg-zinc-700/80'
            }`}
            title={!canAccessTab('schools') ? 'Requires Shift Lead PIN' : catalogTabMeta.title}
          >
            <CatalogIcon className="w-4 h-4" />
            <span className="hidden md:inline">{catalogTabMeta.label}</span>
            {!canAccessTab('schools') && <Lock className="w-3 h-3 text-[#86868B]" />}
          </button>

          <button
            onClick={() => handleTabClick('bills')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'bills'
                ? 'bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                : 'text-[#1D1D1F] dark:text-zinc-300 hover:bg-white/80 dark:hover:bg-zinc-700/80'
            }`}
            title="Sales Invoices Register & Past Bills History"
          >
            <ReceiptText className="w-4 h-4" />
            <span className="hidden md:inline">Invoices</span>
          </button>

          <button
            onClick={() => handleTabClick('settings')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                : !canAccessTab('settings')
                ? 'text-[#86868B] dark:text-zinc-500 hover:text-[#515154]'
                : 'text-[#515154] dark:text-zinc-300 hover:text-[#1D1D1F] hover:bg-white/80 dark:hover:bg-zinc-700/80'
            }`}
            title={!canAccessTab('settings') ? 'Requires Store Admin PIN' : 'Settings & Thermal Printer'}
          >
            <Settings className="w-4 h-4" />
            {!canAccessTab('settings') && <Lock className="w-3 h-3 text-[#86868B]" />}
          </button>
        </nav>

        {/* Right Utility Section */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Today's Sales Live Register Pulse */}
          <div 
            className="hidden lg:flex items-center gap-2 bg-[#F5F5F7] border border-[#E5E5E7] px-3 py-1.5 rounded-xl select-none"
            title="Today's Total Cash/UPI Sales & Paid Bills"
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#1D1D1F]" />
            <div className="flex items-baseline gap-1 text-xs">
              <span className="font-bold text-[#1D1D1F] tabular-nums">
                ₹{todayTotal.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-[#86868B] font-medium">
                ({todayBillsCount} bills)
              </span>
            </div>
          </div>

          {/* Desktop PWA Install Button */}
          <PWAInstallButton />

          {/* Theme Toggle Button (Light / Dark Mode) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title={resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-zinc-600" />
            )}
          </button>

          {/* License & Active Plan Indicator Button */}
          {license && (
            <button
              type="button"
              onClick={onOpenLicenseModal}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer select-none ${
                license.isTrial
                  ? 'bg-stone-100 text-stone-800 border-stone-200 hover:bg-stone-200/70'
                  : license.daysRemaining <= 10
                  ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                  : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
              }`}
              title="View License Status, Machine ID, and Renewal Keys"
            >
              <KeyRound className="w-3.5 h-3.5 text-stone-600" />
              <span className="text-[11px]">
                {license.isTrial
                  ? `Pilot · ${license.daysRemaining}d`
                  : `${license.tier.toUpperCase()}`}
              </span>
            </button>
          )}

          {/* Bluetooth Thermal Printer Quick Toggle / Status */}

          <button
            type="button"
            onClick={onOpenBluetoothModal}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none ${
              isBleConnected
                ? 'bg-[#E8E8ED] text-[#1D1D1F] border-[#D2D2D7]'
                : 'bg-white text-[#515154] border-[#E5E5E7] hover:bg-[#F5F5F7]'
            }`}
            title={isBleConnected ? 'Thermal Bluetooth Printer Connected' : 'Connect Thermal Bluetooth Printer'}
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px] font-semibold">
              {isBleConnected ? 'Printer Online' : 'Printer'}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                isBleConnected ? 'bg-[#34C759] animate-pulse' : 'bg-slate-300'
              }`}
            />
          </button>

          {/* Active Staff Profile & Quick Lock Switcher */}
          {currentUser && (
            <button
              type="button"
              onClick={lockScreen}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-[#E5E5E7] bg-white hover:bg-[#F5F5F7] transition-all text-left group cursor-pointer select-none"
              title="Click to lock POS screen or switch staff shift"
            >
              <div className="w-6 h-6 rounded-lg bg-[#1D1D1F] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  currentUser.name.charAt(0)
                )}
              </div>

              <div className="hidden sm:flex flex-col leading-none">
                <span className="font-bold text-xs text-[#1D1D1F] truncate max-w-[90px]">
                  {currentUser.name.split(' ')[0]}
                </span>
                <span className="text-[10px] font-medium text-[#86868B] mt-0.5">
                  {currentRoleMeta?.shortLabel || currentUser.role}
                </span>
              </div>

              <Lock className="w-3 h-3 text-[#86868B] group-hover:text-[#1D1D1F] transition-colors shrink-0 ml-0.5" />
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
