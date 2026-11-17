import { db } from '../db/db';
import { type LicenseFeatures, type LicenseRecord, type LicenseState, type LicenseTier, type ShopConfig } from '../types';

const LICENSE_VERIFY_SALT = 'CNTR_SALES_PRO_SEC_2026_MASTER_SECRET';
const STORAGE_MACHINE_ID_KEY = 'counterly_machine_fingerprint_id';
const STORAGE_LICENSE_KEY = 'counterly_active_license_record';
const STORAGE_INSTALL_TS_KEY = 'counterly_app_install_timestamp';
const STORAGE_LAST_CLOCK_TS_KEY = 'counterly_last_system_clock_ts';
export const STORAGE_LAST_BACKUP_KEY = 'counterly_last_backup_at';
export const STORAGE_CHECKOUT_URL_KEY = 'counterly_checkout_url';

export const VENDOR_CONTACT_PHONE = '+91 80 4568 2100';
export const VENDOR_WHATSAPP_NUMBER = '918045682100';
export const VENDOR_SUPPORT_EMAIL = 'support@sikkadesk.in';
export const VENDOR_BRAND_NAME = 'SikkaDesk Systems';

export interface CounterlyPackageOption {
  id: 'single_counter' | 'multi_pro' | 'turnkey_box';
  name: string;
  priceLabel: string;
  tier: LicenseTier;
  summary: string;
}

export const COUNTERLY_PACKAGES: CounterlyPackageOption[] = [
  {
    id: 'single_counter',
    name: 'Single Counter',
    priceLabel: '₹1,499 / yr',
    tier: 'starter',
    summary: '1 POS Terminal · Annual License Key',
  },
  {
    id: 'multi_pro',
    name: 'Multi-Counter Pro',
    priceLabel: '₹2,999 / yr',
    tier: 'pro',
    summary: 'Up to 5 Counters · Customer Display & Alterations',
  },
  {
    id: 'turnkey_box',
    name: 'Turnkey Hardware Bundle',
    priceLabel: '₹18,999',
    tier: 'pro',
    summary: '15.6" Touch Terminal + 80mm Printer + Scanner + 1-Yr Pro',
  },
];

export function getCheckoutPaymentUrl(config?: ShopConfig | null): string {
  const fromConfig = config?.checkout_payment_url?.trim();
  if (fromConfig) return fromConfig;
  try {
    const fromStorage = localStorage.getItem(STORAGE_CHECKOUT_URL_KEY)?.trim();
    if (fromStorage) return fromStorage;
  } catch {
    // ignore
  }
  const fromEnv = (import.meta as unknown as { env?: Record<string, string> })?.env?.VITE_CHECKOUT_URL?.trim();
  return fromEnv || '';
}

export function buildPurchaseRequestMessage(opts: {
  packageOption: CounterlyPackageOption;
  machineId: string;
  storeName?: string;
}): string {
  const { packageOption, machineId, storeName } = opts;
  return [
    `Hello ${VENDOR_BRAND_NAME},`,
    `I would like to purchase / activate:`,
    `• Plan: ${packageOption.name} (${packageOption.priceLabel})`,
    `• Store Name: ${storeName?.trim() || 'Retail Store'}`,
    `• Terminal Machine ID: ${machineId}`,
    ``,
    `Please send payment confirmation & my CNTR activation key.`,
  ].join('\n');
}

export function openPurchaseEmailRequest(opts: {
  packageOption: CounterlyPackageOption;
  machineId: string;
  storeName?: string;
}) {
  const subject = `SikkaDesk Order: ${opts.packageOption.name} (${opts.machineId})`;
  const body = buildPurchaseRequestMessage(opts);
  window.location.href = `mailto:${VENDOR_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openPurchaseWhatsAppRequest(opts: {
  packageOption: CounterlyPackageOption;
  machineId: string;
  storeName?: string;
}) {
  const body = buildPurchaseRequestMessage(opts);
  window.open(
    `https://api.whatsapp.com/send/?phone=${VENDOR_WHATSAPP_NUMBER}&text=${encodeURIComponent(body)}`,
    '_blank'
  );
}

export const TIER_FEATURES: Record<LicenseTier, LicenseFeatures> = {
  starter: {
    multi_school: false,
    barcode_labels: true,
    advance_alterations: false,
    gst_reports: false,
    cloud_sync: false,
    customer_display: true,
    unlimited_bills: true,
  },
  pro: {
    multi_school: true,
    barcode_labels: true,
    advance_alterations: true,
    gst_reports: true,
    cloud_sync: true,
    customer_display: true,
    unlimited_bills: true,
  },
  enterprise: {
    multi_school: true,
    barcode_labels: true,
    advance_alterations: true,
    gst_reports: true,
    cloud_sync: true,
    customer_display: true,
    unlimited_bills: true,
  },
  lifetime: {
    multi_school: true,
    barcode_labels: true,
    advance_alterations: true,
    gst_reports: true,
    cloud_sync: true,
    customer_display: true,
    unlimited_bills: true,
  },
};

function fastHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  const positiveHash = (hash >>> 0).toString(16).toUpperCase();
  return positiveHash.padStart(8, '0');
}

function verifyChecksum(
  tier: string,
  expiresAtFormatted: string,
  targetMachineShort: string
): string {
  const raw = `${LICENSE_VERIFY_SALT}|${tier.toUpperCase()}|${expiresAtFormatted}|${targetMachineShort.toUpperCase()}`;
  const h1 = fastHash(raw);
  const h2 = fastHash(raw + '_ROUND2');
  return `${h1.slice(0, 2)}${h2.slice(0, 2)}`.toUpperCase();
}

export function getOrCreateMachineFingerprint(): string {
  try {
    const existing = localStorage.getItem(STORAGE_MACHINE_ID_KEY);
    if (existing && existing.startsWith('MID-') && existing.length >= 10) {
      return existing;
    }

    let canvasHash = '0000';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 30;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = '#f60';
        ctx.fillRect(10, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('SikkaDesk POS', 2, 15);
        canvasHash = fastHash(canvas.toDataURL()).slice(0, 4);
      }
    } catch {
      canvasHash = 'A9C1';
    }

    const screenEntropy = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const navEntropy = `${navigator.language}_${navigator.hardwareConcurrency || 4}`;
    const tzEntropy = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const rawId = `${screenEntropy}_${navEntropy}_${tzEntropy}_${canvasHash}_${Date.now()}`;
    const fullHash = fastHash(rawId);
    const subHash = fastHash(fullHash + '_MID');

    const formattedMid = `MID-${fullHash.slice(0, 4)}-${subHash.slice(0, 4)}`.toUpperCase();
    localStorage.setItem(STORAGE_MACHINE_ID_KEY, formattedMid);
    return formattedMid;
  } catch (err) {
    console.error('Error generating machine fingerprint:', err);
    return 'MID-POS1-2026';
  }
}

export function getMachineShortCode(machineId: string): string {
  const parts = machineId.split('-');
  return (parts[1] || 'UNIV').toUpperCase().slice(0, 4);
}

export function formatDateToKey(d: Date | null): string {
  if (!d) return '99991231';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function parseKeyDate(keyDateStr: string): Date {
  if (keyDateStr === '99991231' || keyDateStr.toUpperCase() === 'PERPETUAL') {
    return new Date('2099-12-31T23:59:59.999Z');
  }
  const y = parseInt(keyDateStr.slice(0, 4), 10);
  const m = parseInt(keyDateStr.slice(4, 6), 10) - 1;
  const d = parseInt(keyDateStr.slice(6, 8), 10);
  return new Date(y, m, d, 23, 59, 59, 999);
}

export function validateLicenseKey(
  licenseKey: string,
  currentMachineId: string
): {
  isValid: boolean;
  tier?: LicenseTier;
  expiresAt?: Date;
  isUniversal?: boolean;
  error?: string;
} {
  const clean = licenseKey.trim().toUpperCase();
  const parts = clean.split('-');

  if (parts.length !== 5 || parts[0] !== 'CNTR') {
    return { isValid: false, error: 'Invalid license format. Expected CNTR-TIER-YYYYMMDD-MID-XXXX' };
  }

  const [, tierCode, expCode, midShort, checksum] = parts;

  const validTiers: LicenseTier[] = ['starter', 'pro', 'enterprise', 'lifetime'];
  const matchedTier = validTiers.find(t => t.toUpperCase() === tierCode);
  if (!matchedTier) {
    return { isValid: false, error: `Unrecognized license tier "${tierCode}"` };
  }

  const expectedChecksum = verifyChecksum(tierCode, expCode, midShort);
  if (checksum !== expectedChecksum) {
    return { isValid: false, error: 'License key signature check failed.' };
  }

  const currentShort = getMachineShortCode(currentMachineId);
  const isUniversal = midShort === 'UNIV';
  if (!isUniversal && midShort !== currentShort) {
    return {
      isValid: false,
      error: `License belongs to terminal [${midShort}], but this terminal is [${currentShort}].`,
    };
  }

  const expDate = parseKeyDate(expCode);

  return {
    isValid: true,
    tier: matchedTier,
    expiresAt: expDate,
    isUniversal,
  };
}

export function getInstallTimestamp(): number {
  const installTs = localStorage.getItem(STORAGE_INSTALL_TS_KEY);
  if (!installTs) {
    const now = Date.now();
    localStorage.setItem(STORAGE_INSTALL_TS_KEY, String(now));
    return now;
  }
  return parseInt(installTs, 10);
}

function checkClockTamper(): boolean {
  try {
    const now = Date.now();
    const lastClock = localStorage.getItem(STORAGE_LAST_CLOCK_TS_KEY);
    if (lastClock) {
      const last = parseInt(lastClock, 10);
      if (now < last - 86400000) {
        return true;
      }
    }
    localStorage.setItem(STORAGE_LAST_CLOCK_TS_KEY, String(now));
    return false;
  } catch {
    return false;
  }
}

export function getLicenseStatus(): LicenseState {
  const machineId = getOrCreateMachineFingerprint();
  const isClockTampered = checkClockTamper();

  const savedLicenseJson = localStorage.getItem(STORAGE_LICENSE_KEY);
  if (savedLicenseJson) {
    try {
      const savedRecord = JSON.parse(savedLicenseJson) as LicenseRecord;
      const validation = validateLicenseKey(savedRecord.license_key, machineId);

      if (validation.isValid && validation.expiresAt && validation.tier) {
        const now = new Date();
        const exp = validation.expiresAt;
        const diffMs = exp.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

        if (isClockTampered) {
          return {
            isValid: false,
            isTrial: false,
            status: 'clock_tampered',
            daysRemaining: 0,
            tier: validation.tier,
            storeName: savedRecord.store_name || 'Retail Store',
            machineId,
            expiresAt: exp.toISOString(),
            licenseKey: savedRecord.license_key,
            features: TIER_FEATURES[validation.tier],
            warningMessage: 'System clock rollback detected. Please restore correct date and time.',
            activatedAt: savedRecord.activated_at,
          };
        }

        if (daysRemaining <= 0) {
          return {
            isValid: false,
            isTrial: false,
            status: 'license_expired',
            daysRemaining: 0,
            tier: validation.tier,
            storeName: savedRecord.store_name || 'Retail Store',
            machineId,
            expiresAt: exp.toISOString(),
            licenseKey: savedRecord.license_key,
            features: TIER_FEATURES[validation.tier],
            warningMessage: 'Your annual software license has expired. Enter a renewal key to resume.',
            activatedAt: savedRecord.activated_at,
          };
        }

        const isExpiringSoon = daysRemaining <= 14;
        return {
          isValid: true,
          isTrial: false,
          status: isExpiringSoon ? 'license_expiring' : 'licensed_active',
          daysRemaining,
          tier: validation.tier,
          storeName: savedRecord.store_name || 'Retail Store',
          machineId,
          expiresAt: exp.toISOString(),
          licenseKey: savedRecord.license_key,
          features: TIER_FEATURES[validation.tier],
          warningMessage: isExpiringSoon
            ? `Annual license expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}.`
            : null,
          activatedAt: savedRecord.activated_at,
        };
      }
    } catch (e) {
      console.error('Failed to parse saved license:', e);
    }
  }

  const installTs = getInstallTimestamp();
  const TRIAL_DAYS = 14;
  const trialDurationMs = TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const trialExpiryTs = installTs + trialDurationMs;
  const trialExpiryDate = new Date(trialExpiryTs);

  const now = Date.now();
  const diffMs = trialExpiryTs - now;
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  if (isClockTampered) {
    return {
      isValid: false,
      isTrial: true,
      status: 'clock_tampered',
      daysRemaining: 0,
      tier: 'pro',
      storeName: 'Trial Store',
      machineId,
      expiresAt: trialExpiryDate.toISOString(),
      licenseKey: null,
      features: TIER_FEATURES.pro,
      warningMessage: 'System clock rollback detected. Please restore correct date and time.',
      firstInstalledAt: new Date(installTs).toISOString(),
    };
  }

  if (daysRemaining <= 0) {
    return {
      isValid: false,
      isTrial: true,
      status: 'trial_expired',
      daysRemaining: 0,
      tier: 'pro',
      storeName: 'Trial Store',
      machineId,
      expiresAt: trialExpiryDate.toISOString(),
      licenseKey: null,
      features: TIER_FEATURES.pro,
      warningMessage: 'Your 14-day pilot has ended. Activate an annual license key to continue.',
      firstInstalledAt: new Date(installTs).toISOString(),
    };
  }

  const isExpiringSoon = daysRemaining <= 4;
  return {
    isValid: true,
    isTrial: true,
    status: isExpiringSoon ? 'trial_expiring' : 'trial_active',
    daysRemaining,
    tier: 'pro',
    storeName: 'Trial Store',
    machineId,
    expiresAt: trialExpiryDate.toISOString(),
    licenseKey: null,
    features: TIER_FEATURES.pro,
    warningMessage: isExpiringSoon
      ? `Pilot ends in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}.`
      : null,
    firstInstalledAt: new Date(installTs).toISOString(),
  };
}

export function activateLicenseKey(
  key: string,
  storeName: string
): { success: boolean; message: string; tier?: LicenseTier } {
  const machineId = getOrCreateMachineFingerprint();
  const validation = validateLicenseKey(key, machineId);

  if (!validation.isValid || !validation.tier || !validation.expiresAt) {
    return { success: false, message: validation.error || 'Invalid license key' };
  }

  const record: LicenseRecord = {
    license_key: key.trim().toUpperCase(),
    store_name: storeName.trim() || 'Retail Store',
    machine_id: validation.isUniversal ? 'UNIV' : machineId,
    tier: validation.tier,
    issued_at: new Date().toISOString(),
    expires_at: validation.expiresAt.toISOString(),
    max_counters: validation.tier === 'enterprise' ? 10 : 1,
    features: TIER_FEATURES[validation.tier],
    signature: verifyChecksum(
      validation.tier.toUpperCase(),
      formatDateToKey(validation.expiresAt),
      validation.isUniversal ? 'UNIV' : getMachineShortCode(machineId)
    ),
    activated_at: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_LICENSE_KEY, JSON.stringify(record));
  return {
    success: true,
    message: `Activated ${validation.tier.toUpperCase()} license! Valid until ${validation.expiresAt.toLocaleDateString(
      'en-IN',
      { day: '2-digit', month: 'short', year: 'numeric' }
    )}`,
    tier: validation.tier,
  };
}

export async function verifyAndActivateOnline(
  licenseKey: string,
  storeName: string
): Promise<{ success: boolean; message: string; tier?: LicenseTier }> {
  const machineId = getOrCreateMachineFingerprint();
  // First attempt offline certificate validation
  const offlineCheck = validateLicenseKey(licenseKey, machineId);
  if (offlineCheck.isValid) {
    return activateLicenseKey(licenseKey, storeName);
  }

  // Fallback to server-side license verification endpoint
  try {
    const resp = await fetch('/api/license/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, machineId, storeName }),
    });
    const data = await resp.json();
    if (resp.ok && data.success && data.licenseKey) {
      return activateLicenseKey(data.licenseKey, storeName);
    }
    return { success: false, message: data.message || offlineCheck.error || 'Invalid license key' };
  } catch {
    return { success: false, message: offlineCheck.error || 'Invalid license key' };
  }
}

export function deactivateLicenseKey(): void {
  localStorage.removeItem(STORAGE_LICENSE_KEY);
}

export function recordBackupExportTimestamp(iso = new Date().toISOString()): void {
  try {
    localStorage.setItem(STORAGE_LAST_BACKUP_KEY, iso);
  } catch {
    // ignore storage errors
  }
}

export function getBackupReminderStatus(): {
  lastBackupAt: string | null;
  hoursSince: number | null;
  isOverdue: boolean;
} {
  try {
    const raw = localStorage.getItem(STORAGE_LAST_BACKUP_KEY);
    if (!raw) {
      return { lastBackupAt: null, hoursSince: null, isOverdue: true };
    }
    const ts = new Date(raw).getTime();
    if (isNaN(ts)) {
      return { lastBackupAt: null, hoursSince: null, isOverdue: true };
    }
    const hoursSince = Math.max(0, Math.floor((Date.now() - ts) / (1000 * 60 * 60)));
    return {
      lastBackupAt: raw,
      hoursSince,
      isOverdue: hoursSince >= 24,
    };
  } catch {
    return { lastBackupAt: null, hoursSince: null, isOverdue: true };
  }
}

export async function downloadEmergencySafetyBackup(): Promise<void> {
  try {
    const [
      schools,
      products,
      variants,
      categories,
      bills,
      sizes,
      size_groups,
      price_list,
      stocks,
      advance_orders,
      shop_config,
      customers,
      inventory_movements,
      cash_drawer_entries,
      shift_closes,
    ] = await Promise.all([
      db.schools.toArray(),
      db.products.toArray(),
      db.variants.toArray(),
      db.categories.toArray(),
      db.bills.toArray(),
      db.sizes.toArray(),
      db.size_groups.toArray(),
      db.price_list.toArray(),
      db.stocks.toArray(),
      db.advance_orders.toArray(),
      db.shop_config.toArray(),
      db.customers.toArray(),
      db.inventory_movements.toArray(),
      db.cash_drawer_entries.toArray(),
      db.shift_closes.toArray(),
    ]);

    const nowIso = new Date().toISOString();
    const backupObj = {
      brand: 'SikkaDesk POS',
      export_type: 'STORE_SAFETY_BACKUP',
      exported_at: nowIso,
      machine_id: getOrCreateMachineFingerprint(),
      bills_count: bills.length,
      products_count: products.length,
      variants_count: variants.length,
      data: {
        shop_config,
        categories,
        products,
        variants,
        schools,
        size_groups,
        sizes,
        price_list,
        stocks,
        bills,
        advance_orders,
        customers,
        inventory_movements,
        cash_drawer_entries,
        shift_closes,
      },
    };

    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sikkadesk_store_backup_${nowIso.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    recordBackupExportTimestamp(nowIso);
  } catch (err) {
    console.error('Failed to export safety backup:', err);
    throw err;
  }
}
