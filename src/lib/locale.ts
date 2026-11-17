import { type PaymentMethod, type ShopConfig, type TaxLabel } from '../types';

export interface CurrencyPreset {
  code: string;
  symbol: string;
  locale: string;
  name: string;
  defaultTaxLabel: TaxLabel;
  defaultTaxRate: number;
  defaultTaxType: 'none' | 'inclusive' | 'exclusive';
}

export const CURRENCY_PRESETS: CurrencyPreset[] = [
  {
    code: 'INR',
    symbol: '₹',
    locale: 'en-IN',
    name: 'Indian Rupee (₹)',
    defaultTaxLabel: 'GST',
    defaultTaxRate: 0,
    defaultTaxType: 'none',
  },
  {
    code: 'USD',
    symbol: '$',
    locale: 'en-US',
    name: 'US Dollar ($)',
    defaultTaxLabel: 'Sales Tax',
    defaultTaxRate: 8,
    defaultTaxType: 'exclusive',
  },
  {
    code: 'EUR',
    symbol: '€',
    locale: 'en-IE',
    name: 'Euro (€)',
    defaultTaxLabel: 'VAT',
    defaultTaxRate: 20,
    defaultTaxType: 'inclusive',
  },
  {
    code: 'GBP',
    symbol: '£',
    locale: 'en-GB',
    name: 'British Pound (£)',
    defaultTaxLabel: 'VAT',
    defaultTaxRate: 20,
    defaultTaxType: 'inclusive',
  },
  {
    code: 'CAD',
    symbol: 'CA$',
    locale: 'en-CA',
    name: 'Canadian Dollar (CA$)',
    defaultTaxLabel: 'Sales Tax',
    defaultTaxRate: 13,
    defaultTaxType: 'exclusive',
  },
  {
    code: 'AUD',
    symbol: 'A$',
    locale: 'en-AU',
    name: 'Australian Dollar (A$)',
    defaultTaxLabel: 'GST',
    defaultTaxRate: 10,
    defaultTaxType: 'inclusive',
  },
  {
    code: 'AED',
    symbol: 'AED ',
    locale: 'en-AE',
    name: 'UAE Dirham (AED)',
    defaultTaxLabel: 'VAT',
    defaultTaxRate: 5,
    defaultTaxType: 'inclusive',
  },
  {
    code: 'SGD',
    symbol: 'S$',
    locale: 'en-SG',
    name: 'Singapore Dollar (S$)',
    defaultTaxLabel: 'GST',
    defaultTaxRate: 9,
    defaultTaxType: 'inclusive',
  },
];

export function getCurrencyCode(config?: ShopConfig | null): string {
  return config?.currency_code || 'INR';
}

export function getCurrencySymbol(config?: ShopConfig | null): string {
  if (config?.currency_symbol) return config.currency_symbol;
  const preset = CURRENCY_PRESETS.find(c => c.code === config?.currency_code);
  return preset?.symbol || '₹';
}

export function getLocaleCode(config?: ShopConfig | null): string {
  return config?.locale || 'en-IN';
}

export function formatMoney(amount: number, config?: ShopConfig | null): string {
  const safeAmt = Number.isFinite(amount) ? amount : 0;
  const code = getCurrencyCode(config);
  const locale = getLocaleCode(config);
  const symbol = getCurrencySymbol(config);

  try {
    const isWholeOnly = code === 'INR' && Math.abs(safeAmt % 1) < 0.001;
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: isWholeOnly ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(safeAmt);
    return `${symbol}${formatted}`;
  } catch {
    return `${symbol}${safeAmt.toFixed(2)}`;
  }
}

export function formatPrintMoney(amount: number, config?: ShopConfig | null): string {
  const safeAmt = Number.isFinite(amount) ? amount : 0;
  const code = getCurrencyCode(config);
  // Thermal ESC/POS printers handle ASCII reliably; map ₹ -> Rs. for raw ESC/POS bytes
  const rawSym = getCurrencySymbol(config);
  const asciiSym = rawSym === '₹' ? 'Rs.' : rawSym === '€' ? 'EUR ' : rawSym === '£' ? 'GBP ' : rawSym;
  const isWhole = code === 'INR' && Math.abs(safeAmt % 1) < 0.001;
  return `${asciiSym}${isWhole ? Math.round(safeAmt) : safeAmt.toFixed(2)}`;
}

export function formatDateShort(iso: string, config?: ShopConfig | null): string {
  try {
    return new Date(iso).toLocaleDateString(getLocaleCode(config), {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatTimeShort(iso: string, config?: ShopConfig | null): string {
  try {
    return new Date(iso).toLocaleTimeString(getLocaleCode(config), {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function getPaymentMethodLabel(method: PaymentMethod, config?: ShopConfig | null): string {
  const isIndia = getCurrencyCode(config) === 'INR';
  switch (method) {
    case 'cash':
      return 'Cash';
    case 'card':
      return 'Card';
    case 'upi':
      return isIndia ? 'UPI / QR' : 'Digital Wallet';
    case 'wallet':
      return 'Digital Wallet';
    case 'credit':
      return 'Store Credit / Due';
    case 'split':
      return 'Split Tender';
    default:
      return String(method).toUpperCase();
  }
}

export function getTaxSummaryLabel(config?: ShopConfig | null): string {
  if (!config || config.tax_type === 'none' || !config.tax_rate) return 'Tax';
  return `${config.tax_label || 'Tax'} (${config.tax_rate}%)`;
}
