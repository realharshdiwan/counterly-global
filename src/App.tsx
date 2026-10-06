/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth, type AppTab } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/Header';
import { QuickBill } from './components/QuickBill';
import { PriceManager } from './components/PriceManager';
import { InventoryManager } from './components/InventoryManager';
import { SchoolsManager } from './components/SchoolsManager';
import { BillsHistory } from './components/BillsHistory';
import { SettingsView } from './components/SettingsView';
import { ReceiptModal } from './components/ReceiptModal';
import { PinLoginScreen } from './components/PinLoginScreen';
import { ManagerOverrideModal } from './components/ManagerOverrideModal';
import { CustomerDisplayView } from './components/CustomerDisplayView';
import { EReceiptVerificationView } from './components/EReceiptVerificationView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { LicenseBanner } from './components/LicenseBanner';
import { LicenseManagerModal } from './components/LicenseManagerModal';
import { LicenseExpiredLockout } from './components/LicenseExpiredLockout';
import { OnboardingWizardModal } from './components/OnboardingWizardModal';
import { ProductLandingPage } from './components/ProductLandingPage';
import { getLicenseStatus } from './lib/licensing';
import { db, initializeDatabase } from './db/db';
import { type Bill, type ShopConfig, type LicenseState } from './types';

interface MainLayoutProps {
  onSwitchToLanding: () => void;
  license: LicenseState;
  refreshLicense: () => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
}

function MainLayout({
  onSwitchToLanding,
  license,
  refreshLicense,
  isOnboardingOpen,
  setIsOnboardingOpen
}: MainLayoutProps) {
  const { currentUser, isLocked, lockScreen } = useAuth();
  const [activeTab, setActiveTab] = useState<AppTab>('billing');
  const [selectedBillForReceipt, setSelectedBillForReceipt] = useState<Bill | null>(null);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [appRefreshKey, setAppRefreshKey] = useState(0);

  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);

  // Manager Override Modal state (for cashiers accessing locked tabs)
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [targetRestrictedTab, setTargetRestrictedTab] = useState<AppTab | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const configs = await db.shop_config.toArray();
        if (configs.length > 0) {
          setShopConfig(configs[0]);
        }
      } catch (err) {
        console.error('Failed to load shop config in main layout:', err);
      }
    }
    loadConfig();

    // Re-verify license periodically every 30 seconds
    const licenseInterval = setInterval(() => {
      refreshLicense();
    }, 30000);
    return () => clearInterval(licenseInterval);
  }, [refreshLicense]);

  // Keyboard shortcut: Ctrl+L / Cmd+L to lock screen / switch shift
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        lockScreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lockScreen]);

  const handleBillCreated = (newBill: Bill) => {
    // Reload shop config if sequence was bumped
    db.shop_config.toArray().then(cfgs => {
      if (cfgs.length > 0) setShopConfig(cfgs[0]);
    });
  };

  const handleOpenReceipt = (bill: Bill) => {
    setSelectedBillForReceipt(bill);
  };

  const handleRequestManagerOverride = (tab: AppTab) => {
    setTargetRestrictedTab(tab);
    setOverrideModalOpen(true);
  };

  const handleOverrideAuthorized = () => {
    if (targetRestrictedTab) {
      setActiveTab(targetRestrictedTab);
      setTargetRestrictedTab(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-zinc-950 flex flex-col text-[#1D1D1F] dark:text-zinc-100 transition-colors">
      {/* 6-Digit PIN Keypad Screen (when locked) */}
      {isLocked && <PinLoginScreen />}

      {/* Expiry / Lockout Overlay if license or trial expired */}
      {!license.isValid && (
        <LicenseExpiredLockout
          license={license}
          onLicenseUpdated={refreshLicense}
        />
      )}

      {/* Top Warning Banner if trial/subscription expires soon */}
      <LicenseBanner
        license={license}
        onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
      />

      {/* Top Application Header with active staff badge & license indicator */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBluetoothModal={() => setActiveTab('settings')}
        onRequestManagerOverride={handleRequestManagerOverride}
        license={license}
        onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
        onSwitchToLanding={onSwitchToLanding}
      />

      {/* Main Content Area */}
      <main key={appRefreshKey} className="flex-1 pb-16 lg:pb-8">
        {activeTab === 'billing' && (
          <QuickBill
            onBillCreated={handleBillCreated}
            onOpenReceipt={handleOpenReceipt}
          />
        )}

        {activeTab === 'prices' && <PriceManager />}

        {activeTab === 'inventory' && <InventoryManager />}

        {activeTab === 'schools' && (
          <SchoolsManager
            onSelectSchoolForBilling={() => setActiveTab('billing')}
            onViewSchoolPrices={() => setActiveTab('prices')}
          />
        )}

        {activeTab === 'bills' && (
          <BillsHistory onOpenReceipt={handleOpenReceipt} />
        )}

        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Receipt Modal (Browser Print / Bluetooth Thermal Print / WhatsApp Slip) */}
      {selectedBillForReceipt && (
        <ReceiptModal
          bill={selectedBillForReceipt}
          config={shopConfig}
          onClose={() => setSelectedBillForReceipt(null)}
        />
      )}

      {/* License & Subscription Plan Modal */}
      <LicenseManagerModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
        license={license}
        onLicenseUpdated={refreshLicense}
      />

      {/* First-Run Onboarding Setup Wizard */}
      <OnboardingWizardModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onCompleted={() => {
          setIsOnboardingOpen(false);
          setAppRefreshKey(k => k + 1);
          db.shop_config.toArray().then(cfgs => {
            if (cfgs.length > 0) setShopConfig(cfgs[0]);
          });
        }}
      />

      {/* Manager Override Modal (for restricted actions) */}
      <ManagerOverrideModal
        isOpen={overrideModalOpen}
        onClose={() => {
          setOverrideModalOpen(false);
          setTargetRestrictedTab(null);
        }}
        onAuthorized={handleOverrideAuthorized}
        actionTitle="Shift Lead Confirmation Required"
        actionDescription={`Enter 6-digit Shift Lead or Store Admin PIN to open ${
          targetRestrictedTab ? targetRestrictedTab.toUpperCase() : 'requested'
        } section.`}
      />

      {/* Connectivity Status Indicator */}
      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);

  // License & Subscription state
  const [license, setLicense] = useState<LicenseState>(() => getLicenseStatus());

  // Smart Hybrid Routing: New visitors see Landing Page; configured stores see POS counter
  const [viewMode, setViewMode] = useState<'landing' | 'pos'>(() => {
    if (typeof window === 'undefined') return 'pos';
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'landing') return 'landing';
    if (params.get('view') === 'pos') return 'pos';
    // If store setup is already completed, go straight to POS
    const isCompleted = localStorage.getItem('counterly_onboarding_completed') === 'true';
    return isCompleted ? 'pos' : 'landing';
  });

  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  const refreshLicense = () => {
    setLicense(getLicenseStatus());
  };

  const [isCustomerDisplayMode, setIsCustomerDisplayMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('mode') === 'customer_display' ||
      params.get('mode') === 'standee' ||
      window.location.hash.includes('customer-display') ||
      window.location.hash.includes('standee')
    );
  });

  const [verifyBillNumber, setVerifyBillNumber] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('verify') || null;
  });

  useEffect(() => {
    const checkMode = () => {
      const params = new URLSearchParams(window.location.search);
      const isMode = (
        params.get('mode') === 'customer_display' ||
        params.get('mode') === 'standee' ||
        window.location.hash.includes('customer-display') ||
        window.location.hash.includes('standee')
      );
      setIsCustomerDisplayMode(isMode);
      setVerifyBillNumber(params.get('verify') || null);

      if (params.get('view') === 'landing') setViewMode('landing');
      if (params.get('view') === 'pos') setViewMode('pos');
    };

    window.addEventListener('hashchange', checkMode);
    window.addEventListener('popstate', checkMode);
    return () => {
      window.removeEventListener('hashchange', checkMode);
      window.removeEventListener('popstate', checkMode);
    };
  }, []);

  useEffect(() => {
    async function init() {
      try {
        await initializeDatabase();
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsInitializing(false);
      }
    }
    init();
  }, []);

  if (verifyBillNumber) {
    return (
      <EReceiptVerificationView
        billNumber={verifyBillNumber}
        onBackToApp={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('verify');
          window.history.pushState({}, '', url.pathname);
          setVerifyBillNumber(null);
        }}
      />
    );
  }

  if (isCustomerDisplayMode) {
    return <CustomerDisplayView />;
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center font-bold text-2xl shadow-xs animate-pulse">
          C
        </div>
        <p className="font-semibold text-sm text-[#1D1D1F] mt-3">
          Counterly POS
        </p>
        <p className="text-xs text-[#86868B] mt-1">
          Initializing Counterly POS...
        </p>
      </div>
    );
  }

  // Render Product Landing Page for new visitors or when explicitly switched
  if (viewMode === 'landing') {
    return (
      <ProductLandingPage
        onLaunchPOS={() => {
          setViewMode('pos');
          // If onboarding wasn't completed, trigger wizard
          if (localStorage.getItem('counterly_onboarding_completed') !== 'true') {
            setIsOnboardingOpen(true);
          }
        }}
        license={license}
        onLicenseUpdated={refreshLicense}
      />
    );
  }

  return (
    <AuthProvider>
      <MainLayout
        onSwitchToLanding={() => setViewMode('landing')}
        license={license}
        refreshLicense={refreshLicense}
        isOnboardingOpen={isOnboardingOpen}
        setIsOnboardingOpen={setIsOnboardingOpen}
      />
    </AuthProvider>
  );
}

