import { db } from '../db/db';
import { type LicenseFeatures, type LicenseRecord, type LicenseState, type LicenseTier } from '../types';

const VENDOR_SECRET_SALT = 'CNTR_SALES_PRO_SEC_2026_MASTER_SECRET';
const STORAGE_MACHINE_ID_KEY = 'counterly_machine_fingerprint_id';
const STORAGE_LICENSE_KEY = 'counterly_active_license_record';
const STORAGE_INSTALL_TS_KEY = 'counterly_app_install_timestamp';
const STORAGE_LAST_CLOCK_TS_KEY = 'counterly_last_system_clock_ts';

export const VENDOR_MASTER_PIN = '882299'; // Default Vendor Master PIN for generating client keys
export const VENDOR_CONTACT_PHONE = '+91 98765 43210'; // Vendor support number
export const VENDOR_BRAND_NAME = 'Counterly POS Systems';

/**
 * Standard tier features
 */
export const TIER_FEATURES: Record<LicenseTier, LicenseFeatures> = {
  starter: {
    multi_school: false,
    barcode_labels: false,
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

/**
 * Fast deterministic hash function (string to hex string)
 */
function fastHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  const positiveHash = (hash >>> 0).toString(16).toUpperCase();
  return positiveHash.padStart(8, '0');
}

/**
 * Computes a cryptographic checksum for a license payload
 */
export function computeLicenseChecksum(
  tier: string,
  expiresAtFormatted: string,
  targetMachineShort: string,
  salt = VENDOR_SECRET_SALT
): string {
  const raw = `${salt}|${tier.toUpperCase()}|${expiresAtFormatted}|${targetMachineShort.toUpperCase()}`;
  const h1 = fastHash(raw);
  const h2 = fastHash(raw + '_ROUND2');
  return `${h1.slice(0, 2)}${h2.slice(0, 2)}`.toUpperCase();
}

/**
 * Generates or retrieves a persistent unique hardware fingerprint for this machine/browser.
 */
export function getOrCreateMachineFingerprint(): string {
  try {
    const existing = localStorage.getItem(STORAGE_MACHINE_ID_KEY);
    if (existing && existing.startsWith('MID-') && existing.length >= 10) {
      return existing;
    }

    // Build hardware & browser canvas entropy signature
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
        ctx.fillText('Counterly POS', 2, 15);
        canvasHash = fastHash(canvas.toDataURL()).slice(0, 4);
      }
    } catch {
      // Fallback if canvas is disabled
      canvasHash = 'A9C1';
    }

    const screenEntropy = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const navEntropy = `${navigator.language}_${navigator.hardwareConcurrency || 4}`;
    const tzEntropy = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

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

/**
 * Extracts 4-char short code from full Machine ID (e.g. "MID-9B2F-7A41" -> "9B2F")
 */
export function getMachineShortCode(machineId: string): string {
  const parts = machineId.split('-');
  return (parts[1] || 'UNIV').toUpperCase().slice(0, 4);
}

/**
 * Formats a Date object to YYYYMMDD string or PERPETUAL
 */
export function formatDateToKey(d: Date | null): string {
  if (!d) return '99991231';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Parses YYYYMMDD to Date object
 */
export function parseKeyDate(keyDateStr: string): Date {
  if (keyDateStr === '99991231' || keyDateStr.toUpperCase() === 'PERPETUAL') {
    return new Date('2099-12-31T23:59:59.999Z');
  }
  const y = parseInt(keyDateStr.slice(0, 4), 10);
  const m = parseInt(keyDateStr.slice(4, 6), 10) - 1;
  const d = parseInt(keyDateStr.slice(6, 8), 10);
  return new Date(y, m, d, 23, 59, 59, 999);
}

/**
 * Generates a valid commercial license key for a customer.
 * Structure: CNTR-{TIER}-{EXPIRY_YYYYMMDD}-{MID_SHORT}-{CHECKSUM_4}
 * Example: CNTR-PRO-20271231-9B2F-6A8E
 */
export function generateLicenseKey(
  tier: LicenseTier,
  expiryDate: Date | null,
  targetMachineId: string // Full MID or 'UNIV' for universal
): string {
  const tierCode = tier.toUpperCase();
  const expCode = formatDateToKey(expiryDate);
  const midShort = targetMachineId === 'UNIV' ? 'UNIV' : getMachineShortCode(targetMachineId);
  const checksum = computeLicenseChecksum(tierCode, expCode, midShort);
  return `CNTR-${tierCode}-${expCode}-${midShort}-${checksum}`;
}

/**
 * Validates a License Key against a target Machine ID.
 */
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

  const [_, tierCode, expCode, midShort, checksum] = parts;

  // Validate tier
  const validTiers: LicenseTier[] = ['starter', 'pro', 'enterprise', 'lifetime'];
  const matchedTier = validTiers.find(t => t.toUpperCase() === tierCode);
  if (!matchedTier) {
    return { isValid: false, error: `Unrecognized license tier "${tierCode}"` };
  }

  // Validate checksum
  const expectedChecksum = computeLicenseChecksum(tierCode, expCode, midShort);
  if (checksum !== expectedChecksum) {
    return { isValid: false, error: 'License key signature check failed (corrupted or tampered key).' };
  }

  // Validate Machine ID matching
  const currentShort = getMachineShortCode(currentMachineId);
  const isUniversal = midShort === 'UNIV';
  if (!isUniversal && midShort !== currentShort) {
    return {
      isValid: false,
      error: `License belongs to device [${midShort}], but current device is [${currentShort}].`,
    };
  }

  // Parse expiry date
  const expDate = parseKeyDate(expCode);

  return {
    isValid: true,
    tier: matchedTier,
    expiresAt: expDate,
    isUniversal,
  };
}

/**
 * Gets or initializes the installation timestamp for 14-day trial evaluation.
 */
export function getInstallTimestamp(): number {
  let installTs = localStorage.getItem(STORAGE_INSTALL_TS_KEY);
  if (!installTs) {
    const now = Date.now();
    localStorage.setItem(STORAGE_INSTALL_TS_KEY, String(now));
    return now;
  }
  return parseInt(installTs, 10);
}

/**
 * Detects if system clock was set backwards to cheat trial/expiry.
 */
function checkClockTamper(): boolean {
  try {
    const now = Date.now();
    const lastClock = localStorage.getItem(STORAGE_LAST_CLOCK_TS_KEY);
    if (lastClock) {
      const last = parseInt(lastClock, 10);
      // If current clock is older by more than 24 hours compared to last recorded clock
      if (now < last - 86400000) {
        return true; // Clock tampered
      }
    }
    // Update last clock
    localStorage.setItem(STORAGE_LAST_CLOCK_TS_KEY, String(now));
    return false;
  } catch {
    return false;
  }
}

/**
 * Evaluates the full license / trial state of the application.
 */
export function getLicenseStatus(): LicenseState {
  const machineId = getOrCreateMachineFingerprint();
  const isClockTampered = checkClockTamper();

  // 1. Check if a valid paid/commercial license is activated
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
            warningMessage: 'System clock rollback detected. Please restore correct date/time to use Counterly.',
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
            warningMessage: 'Your annual license subscription has expired. Please renew to continue billing.',
            activatedAt: savedRecord.activated_at,
          };
        }

        const isExpiringSoon = daysRemaining <= 10;
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
            ? `Your subscription expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}. Contact vendor to renew.`
            : null,
          activatedAt: savedRecord.activated_at,
        };
      }
    } catch (e) {
      console.error('Failed to parse saved license:', e);
    }
  }

  // 2. No commercial key -> Evaluate 14-Day Pro Free Trial
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
      warningMessage: 'System clock rollback detected. Please restore correct date/time.',
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
      warningMessage: 'Your 14-day free trial has ended. Please activate a full license to continue.',
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
      ? `Trial ends in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}. Upgrade to avoid interruption.`
      : null,
    firstInstalledAt: new Date(installTs).toISOString(),
  };
}

/**
 * Activates and persists a commercial license key.
 */
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
    signature: computeLicenseChecksum(
      validation.tier.toUpperCase(),
      formatDateToKey(validation.expiresAt),
      validation.isUniversal ? 'UNIV' : getMachineShortCode(machineId)
    ),
    activated_at: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_LICENSE_KEY, JSON.stringify(record));
  return {
    success: true,
    message: `Successfully activated ${validation.tier.toUpperCase()} license! Valid until ${validation.expiresAt.toLocaleDateString(
      'en-IN',
      { day: '2-digit', month: 'short', year: 'numeric' }
    )}`,
    tier: validation.tier,
  };
}

/**
 * Deactivates or removes the current license key (returns to trial or expired state).
 */
export function deactivateLicenseKey(): void {
  localStorage.removeItem(STORAGE_LICENSE_KEY);
}

/**
 * Vendor tool: Generates a ready-to-send WhatsApp license delivery template.
 */
export function generateWhatsAppLicenseDeliveryMessage(
  storeName: string,
  machineId: string,
  licenseKey: string,
  tier: LicenseTier,
  expiryDateStr: string
): string {
  return [
    `*${VENDOR_BRAND_NAME} — Software Activation Key*`,
    `--------------------------------`,
    `Store: *${storeName}*`,
    `Hardware ID: *${machineId}*`,
    `License Tier: *${tier.toUpperCase()} Edition*`,
    `Valid Until: *${expiryDateStr}*`,
    `--------------------------------`,
    `*Your Activation License Key:*`,
    `\`${licenseKey}\``,
    `--------------------------------`,
    `*Activation Instructions:*`,
    `1. Open Counterly POS on your device`,
    `2. Go to Settings > License & Subscription (or tap Enter Key on screen)`,
    `3. Paste the License Key above and tap "Activate License"`,
    `--------------------------------`,
    `For support & renewal: ${VENDOR_CONTACT_PHONE}`,
  ].join('\n');
}

/**
 * Emergency Safety Data Export:
 * Allows merchants to download 100% of their business data in JSON/Excel format even if license is expired.
 * Ensures complete trust and zero data lock-in.
 */
export async function downloadEmergencySafetyBackup(): Promise<void> {
  try {
    const [schools, products, bills, sizes, size_groups, price_list, stocks, advance_orders, shop_config] =
      await Promise.all([
        db.schools.toArray(),
        db.products.toArray(),
        db.bills.toArray(),
        db.sizes.toArray(),
        db.size_groups.toArray(),
        db.price_list.toArray(),
        db.stocks.toArray(),
        db.advance_orders.toArray(),
        db.shop_config.toArray(),
      ]);

    const backupObj = {
      brand: 'Counterly POS',
      export_type: 'EMERGENCY_SAFETY_BACKUP',
      exported_at: new Date().toISOString(),
      machine_id: getOrCreateMachineFingerprint(),
      shop_config,
      bills_count: bills.length,
      products_count: products.length,
      schools_count: schools.length,
      data: {
        shop_config,
        schools,
        products,
        size_groups,
        sizes,
        price_list,
        stocks,
        bills,
        advance_orders,
      },
    };

    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `counterly_emergency_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to export emergency backup:', err);
    throw err;
  }
}
