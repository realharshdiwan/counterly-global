import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Layers,
  ReceiptText,
  Settings,
  Printer,
  Lock,
  Sun,
  Moon,
  KeyRound,
} from 'lucide-react';
import { bluetoothPrinter } from '../lib/printer';
import { useAuth, type AppTab } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ROLE_INFO, type LicenseState } from '../types';

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
  onSwitchToLanding,
}) => {
  const { currentUser, lockScreen, canAccessTab } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isBleConnected, setIsBleConnected] = useState<boolean>(false);

  useEffect(() => {
    const checkBle = () => {
      setIsBleConnected(bluetoothPrinter.isConnected());
    };
    checkBle();
    const t = setInterval(checkBle, 2500);
    return () => clearInterval(t);
  }, []);

  const handleTabClick = (tab: AppTab) => {
    if (canAccessTab(tab)) {
      setActiveTab(tab);
    } else if (onRequestManagerOverride) {
      onRequestManagerOverride(tab);
    }
  };

  const currentRoleMeta = currentUser ? ROLE_INFO[currentUser.role] : null;

  const navItems: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'billing', label: 'Register', icon: ShoppingBag },
    { id: 'catalog', label: 'Catalog', icon: Layers },
    { id: 'bills', label: 'Invoices', icon: ReceiptText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Clean Brand Wordmark */}
        <button
          type="button"
          onClick={e => {
            if (e.shiftKey) {
              window.dispatchEvent(new CustomEvent('counterly:open-vendor'));
            } else if (onSwitchToLanding) {
              onSwitchToLanding();
            }
          }}
          className="font-bold text-lg tracking-tight text-zinc-950 dark:text-zinc-50 hover:opacity-75 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
          title="View product overview and hardware bundles"
        >
          SikkaDesk
        </button>

        {/* Zone 2: 4-Tab Segmented Workspace Nav */}
        <nav
          aria-label="Primary Workspace"
          className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200/70 dark:border-zinc-800 overflow-x-auto"
        >
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const allowed = canAccessTab(item.id);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabClick(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-2xs'
                    : !allowed
                    ? 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-white/70 dark:hover:bg-zinc-800/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
                {!allowed && <Lock className="w-3 h-3 shrink-0 opacity-70" />}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Essential Hardware, Theme & Staff Lock */}
        <div className="flex items-center gap-2 shrink-0">
          {license && (license.isTrial || license.daysRemaining <= 14) && (
            <button
              type="button"
              onClick={onOpenLicenseModal}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Manage annual software license"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="tabular-nums">
                {license.isTrial ? `Pilot · ${license.daysRemaining}d` : `${license.daysRemaining}d left`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenBluetoothModal}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isBleConnected
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
            title={isBleConnected ? 'Thermal printer connected' : 'Configure thermal printer'}
          >
            <Printer className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden lg:inline">{isBleConnected ? 'Printer Ready' : 'Printer'}</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle Theme"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-zinc-600" />
            )}
          </button>

          {currentUser && (
            <button
              type="button"
              onClick={lockScreen}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Lock counter or switch staff PIN (Ctrl+L)"
            >
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 max-w-[90px] truncate">
                {currentUser.name.split(' ')[0]}
              </span>
              <span className="hidden xl:inline text-[11px] text-zinc-500 dark:text-zinc-400">
                · {currentRoleMeta?.shortLabel || currentUser.role}
              </span>
              <Lock className="w-3 h-3 text-zinc-400 shrink-0" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
