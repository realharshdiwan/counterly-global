/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth, type AppTab } from './context/AuthContext';
import { Header } from './components/Header';
import { QuickBill } from './components/QuickBill';
import { CatalogManager } from './components/CatalogManager';
import { BillsHistory } from './components/BillsHistory';
import { SettingsView } from './components/SettingsView';
import { ReceiptModal } from './components/ReceiptModal';
import { PinLoginScreen } from './components/PinLoginScreen';
import { ManagerOverrideModal } from './components/ManagerOverrideModal';
import { CustomerDisplayView } from './components/CustomerDisplayView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { LicenseBanner } from './components/LicenseBanner';
import { LicenseManagerModal } from './components/LicenseManagerModal';
import { LicenseExpiredLockout } from './components/LicenseExpiredLockout';
import { OnboardingWizardModal } from './components/OnboardingWizardModal';
import { ProductLandingPage } from './components/ProductLandingPage';
import { VendorPortalView } from './components/VendorPortalView';
import { GuidedSandboxBanner } from './components/GuidedSandboxBanner';
import { getLicenseStatus } from './lib/licensing';
import {
  db,
  initializeDatabase,
  launchInteractiveSandbox,
  exitSandboxToLiveStore,
} from './db/db';
import { type Bill, type ShopConfig, type LicenseState, type CustomerProfile } from './types';

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
  setIsOnboardingOpen,
}: MainLayoutProps) {
  const { isLocked, lockScreen } = useAuth();
  const [activeTab, setActiveTab] = useState<AppTab>('billing');
  const [selectedBillForReceipt, setSelectedBillForReceipt] = useState<Bill | null>(null);
  const [registerCustomer, setRegisterCustomer] = useState<CustomerProfile | null>(null);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [appRefreshKey, setAppRefreshKey] = useState(0);

  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [targetRestrictedTab, setTargetRestrictedTab] = useState<AppTab | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const configs = await db.shop_config.toArray();
        if (configs.length > 0) setShopConfig(configs[0]);
      } catch (err) {
        console.error('Failed to load shop config in main layout:', err);
      }
    }
    loadConfig();

    const licenseInterval = setInterval(() => {
      refreshLicense();
    }, 30000);
    return () => clearInterval(licenseInterval);
  }, [refreshLicense]);

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

  const handleBillCreated = () => {
    db.shop_config.toArray().then(cfgs => {
      if (cfgs.length > 0) setShopConfig(cfgs[0]);
    });
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
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-zinc-950 flex flex-col text-zinc-950 dark:text-zinc-50 transition-colors">
      {isLocked && <PinLoginScreen />}

      {!license.isValid && (
        <LicenseExpiredLockout license={license} onLicenseUpdated={refreshLicense} />
      )}

      <LicenseBanner
        license={license}
        onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
      />

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBluetoothModal={() => setActiveTab('settings')}
        onRequestManagerOverride={handleRequestManagerOverride}
        license={license}
        onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
        onSwitchToLanding={onSwitchToLanding}
      />

      <GuidedSandboxBanner
        onNavigateTab={setActiveTab}
        refreshSignal={appRefreshKey}
        onSwitchToLiveStore={async () => {
          await exitSandboxToLiveStore();
          setSelectedBillForReceipt(null);
          setRegisterCustomer(null);
          setActiveTab('billing');
          const cfgs = await db.shop_config.toArray();
          if (cfgs.length > 0) setShopConfig(cfgs[0]);
          setAppRefreshKey(k => k + 1);
          setIsOnboardingOpen(true);
        }}
      />

      <main key={appRefreshKey} className="flex-1 pb-16 lg:pb-8">
        {activeTab === 'billing' && (
          <QuickBill
            onBillCreated={handleBillCreated}
            onOpenReceipt={bill => setSelectedBillForReceipt(bill)}
            preselectedCustomer={registerCustomer}
            onClearPreselectedCustomer={() => setRegisterCustomer(null)}
          />
        )}

        {activeTab === 'catalog' && (
          <CatalogManager onNavigateToRegister={() => setActiveTab('billing')} />
        )}

        {activeTab === 'bills' && (
          <BillsHistory
            onOpenReceipt={bill => setSelectedBillForReceipt(bill)}
            onNavigateToRegister={cust => {
              if (cust) setRegisterCustomer(cust);
              setActiveTab('billing');
            }}
          />
        )}

        {activeTab === 'settings' && <SettingsView />}
      </main>

      {selectedBillForReceipt && (
        <ReceiptModal
          bill={selectedBillForReceipt}
          config={shopConfig}
          onClose={() => setSelectedBillForReceipt(null)}
        />
      )}

      <LicenseManagerModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
        license={license}
        onLicenseUpdated={refreshLicense}
      />

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

      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [license, setLicense] = useState<LicenseState>(() => getLicenseStatus());

  const [viewMode, setViewMode] = useState<'landing' | 'pos' | 'vendor'>(() => {
    if (typeof window === 'undefined') return 'pos';
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'vendor' || window.location.hash.includes('vendor')) return 'vendor';
    if (params.get('view') === 'landing') return 'landing';
    if (params.get('view') === 'pos') return 'pos';
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

  const viewModeRef = useRef<'landing' | 'pos' | 'vendor'>(viewMode);
  viewModeRef.current = viewMode;
  const prevViewRef = useRef<'landing' | 'pos'>('landing');

  useEffect(() => {
    const syncUrl = (target: 'landing' | 'pos' | 'vendor') => {
      try {
        window.history.pushState({}, '', `?view=${target}`);
      } catch {
        // ignore sandboxed iframe history errors
      }
    };

    const openVendor = () => {
      if (viewModeRef.current !== 'vendor') {
        prevViewRef.current = viewModeRef.current === 'pos' ? 'pos' : 'landing';
        setViewMode('vendor');
        syncUrl('vendor');
      }
    };

    const toggleVendor = () => {
      if (viewModeRef.current === 'vendor') {
        const target = prevViewRef.current;
        setViewMode(target);
        syncUrl(target);
      } else {
        openVendor();
      }
    };

    const checkMode = () => {
      const params = new URLSearchParams(window.location.search);
      const isMode =
        params.get('mode') === 'customer_display' ||
        params.get('mode') === 'standee' ||
        window.location.hash.includes('customer-display') ||
        window.location.hash.includes('standee');
      setIsCustomerDisplayMode(isMode);
      if (params.get('view') === 'vendor' || window.location.hash.includes('vendor')) {
        setViewMode('vendor');
      } else if (params.get('view') === 'landing') {
        setViewMode('landing');
      } else if (params.get('view') === 'pos') {
        setViewMode('pos');
      }
    };

    const handleVendorShortcut = (e: KeyboardEvent) => {
      const isF8 = e.code === 'F8' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      const isAltShiftV = e.altKey && e.shiftKey && e.code === 'KeyV';
      const isCtrlAltV = (e.ctrlKey || e.metaKey) && e.altKey && e.code === 'KeyV';
      const isCtrlShiftDot = (e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'Period';

      if (isF8 || isAltShiftV || isCtrlAltV || isCtrlShiftDot) {
        e.preventDefault();
        e.stopPropagation();
        toggleVendor();
      }
    };

    window.addEventListener('hashchange', checkMode);
    window.addEventListener('popstate', checkMode);
    window.addEventListener('counterly:open-vendor', openVendor);
    document.addEventListener('keydown', handleVendorShortcut, true);
    return () => {
      window.removeEventListener('hashchange', checkMode);
      window.removeEventListener('popstate', checkMode);
      window.removeEventListener('counterly:open-vendor', openVendor);
      document.removeEventListener('keydown', handleVendorShortcut, true);
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

  if (isCustomerDisplayMode) {
    return <CustomerDisplayView />;
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center font-bold text-2xl">
          S
        </div>
        <p className="font-semibold text-sm text-zinc-950 dark:text-zinc-50 mt-3">
          SikkaDesk POS
        </p>
        <p className="text-xs text-zinc-500 mt-1">Initializing local database...</p>
      </div>
    );
  }

  if (viewMode === 'vendor') {
    return (
      <VendorPortalView
        onBackToLanding={() => {
          window.history.pushState({}, '', '?view=landing');
          setViewMode('landing');
        }}
        onLaunchPOS={() => {
          window.history.pushState({}, '', '?view=pos');
          setViewMode('pos');
        }}
      />
    );
  }

  if (viewMode === 'landing') {
    return (
      <ProductLandingPage
        onLaunchPOS={() => {
          setViewMode('pos');
          if (localStorage.getItem('counterly_onboarding_completed') !== 'true') {
            setIsOnboardingOpen(true);
          }
        }}
        onLaunchSandbox={async () => {
          await launchInteractiveSandbox();
          setIsOnboardingOpen(false);
          setViewMode('pos');
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
