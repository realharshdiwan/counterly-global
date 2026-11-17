import { type Bill, type ShopConfig } from '../types';
import { formatDateShort, formatPrintMoney, formatTimeShort, getCurrencyCode, getPaymentMethodLabel } from './locale';

export function numberToWords(num: number, config?: ShopConfig | null): string {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const code = getCurrencyCode(config);
  const unitLabel = code === 'INR' ? 'Rupees' : code === 'EUR' ? 'Euros' : code === 'GBP' ? 'Pounds' : 'Dollars';
  const n = Math.floor(Math.abs(num));
  if (n === 0) return `${unitLabel} Zero Only`;

  function convert(val: number): string {
    if (val < 20) return a[val];
    if (val < 100) return b[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + a[val % 10] : '');
    if (val < 1000) return a[Math.floor(val / 100)] + ' Hundred' + (val % 100 !== 0 ? ' ' + convert(val % 100) : '');
    if (val < 1000000) return convert(Math.floor(val / 1000)) + ' Thousand' + (val % 1000 !== 0 ? ' ' + convert(val % 1000) : '');
    return convert(Math.floor(val / 1000000)) + ' Million' + (val % 1000000 !== 0 ? ' ' + convert(val % 1000000) : '');
  }

  return `${unitLabel} ${convert(n).trim()} Only`;
}

const ESC = '\x1B';
const GS = '\x1D';

export function generateEscPosReceipt(bill: Bill, config: ShopConfig, overrideWidth?: 32 | 48): Uint8Array {
  const width = overrideWidth || config.printer_width || 48;
  const is32 = width <= 32;
  const divider = '-'.repeat(width);

  let out = '';

  out += ESC + '@';
  out += ESC + 'a' + '\x01';

  out += ESC + 'E' + '\x01';
  out += (config.legal_name || 'SIKKADESK RETAIL') + '\n';
  out += ESC + 'E' + '\x00';

  if (config.shop_tagline) out += config.shop_tagline + '\n';
  if (config.shop_address) out += config.shop_address + '\n';
  if (config.shop_phone) out += 'Tel: ' + config.shop_phone + '\n';
  if (config.gstin) out += `${config.tax_label || 'Tax'} ID: ` + config.gstin + '\n';

  out += ESC + 'a' + '\x01';
  out += divider + '\n';
  out += ESC + 'E' + '\x01';
  if (config.tax_type !== 'none' && config.tax_rate > 0) {
    out += `${(config.tax_label || 'TAX').toUpperCase()} RECEIPT\n`;
  } else {
    out += 'SALES RECEIPT\n';
  }
  out += ESC + 'E' + '\x00';
  out += divider + '\n';

  out += ESC + 'a' + '\x00';
  const dateStr = `${formatDateShort(bill.created_at, config)} ${formatTimeShort(bill.created_at, config)}`;

  out += `Receipt: ${bill.bill_number}\n`;
  out += `Date   : ${dateStr}\n`;
  if (bill.school_name && bill.school_id !== 'retail_counter' && bill.school_name !== 'Walk-in Retail') {
    out += `Account: ${bill.school_name}\n`;
  }
  if (bill.customer_name || bill.customer_phone) {
    out += `Cust   : ${[bill.customer_name, bill.customer_phone].filter(Boolean).join(' · ')}\n`;
  }

  out += divider + '\n';

  if (is32) {
    out += 'Item              Qty Rate   Amt\n';
    out += divider + '\n';
    for (const item of bill.items) {
      const variantTag = [item.size_label, item.color_label].filter(Boolean).join('/');
      const name = item.product_name + (variantTag ? ` (${variantTag})` : '');
      out += (name.length > 32 ? name.substring(0, 31) + '.' : name) + '\n';
      const qtyStr = String(item.qty).padStart(3);
      const rateStr = formatPrintMoney(item.unit_price, config).padStart(7);
      const amtStr = formatPrintMoney(item.subtotal, config).padStart(8);
      out += `          ${qtyStr} ${rateStr} ${amtStr}\n`;
    }
    out += divider + '\n';
  } else {
    out += 'Item Description         Var    Qty   Rate   Amt\n';
    out += divider + '\n';
    for (const item of bill.items) {
      const variantTag = [item.size_label, item.color_label].filter(Boolean).join('/');
      const name = item.product_name.padEnd(24).substring(0, 24);
      const size = (variantTag || '-').padEnd(6).substring(0, 6);
      const qty = String(item.qty).padStart(3);
      const rate = formatPrintMoney(item.unit_price, config).padStart(7);
      const amt = formatPrintMoney(item.subtotal, config).padStart(7);
      out += `${name} ${size} ${qty} ${rate} ${amt}\n`;
    }
    out += divider + '\n';
  }

  const padLabel = is32 ? 20 : 35;
  const padVal = is32 ? 12 : 13;

  out += 'Subtotal:'.padEnd(padLabel) + formatPrintMoney(bill.subtotal, config).padStart(padVal) + '\n';

  if (bill.discount_amount > 0) {
    out += 'Discount:'.padEnd(padLabel) + ('-' + formatPrintMoney(bill.discount_amount, config)).padStart(padVal) + '\n';
  }

  if (bill.tax_amount && bill.tax_amount > 0) {
    const tLabel = `${bill.tax_label || config.tax_label || 'Tax'}:`;
    out += tLabel.padEnd(padLabel) + formatPrintMoney(bill.tax_amount, config).padStart(padVal) + '\n';
  }

  out += divider + '\n';
  out += ESC + 'E' + '\x01';
  out += 'TOTAL:'.padEnd(padLabel) + formatPrintMoney(bill.total, config).padStart(padVal) + '\n';
  out += ESC + 'E' + '\x00';
  if ((bill.store_credit_used || 0) > 0) {
    out += 'Store Credit:'.padEnd(padLabel) + ('-' + formatPrintMoney(bill.store_credit_used || 0, config)).padStart(padVal) + '\n';
  }
  if ((bill.refunded_amount || 0) > 0) {
    out += 'Refunded:'.padEnd(padLabel) + ('-' + formatPrintMoney(bill.refunded_amount || 0, config)).padStart(padVal) + '\n';
    out += ESC + 'E' + '\x01';
    out += 'NET PAID:'.padEnd(padLabel) + formatPrintMoney(Math.max(0, bill.total - (bill.refunded_amount || 0)), config).padStart(padVal) + '\n';
    out += ESC + 'E' + '\x00';
  }
  out += divider + '\n';

  const payMethodText = getPaymentMethodLabel(bill.payment_method, config).toUpperCase();
  out += `Payment: ${payMethodText} (${bill.is_paid ? 'PAID' : 'DUE'})\n`;
  if (bill.payment_method === 'split' && bill.payment_details) {
    const d = bill.payment_details;
    const parts: string[] = [];
    if (d.cash) parts.push(`Cash: ${formatPrintMoney(d.cash, config)}`);
    if (d.card) parts.push(`Card: ${formatPrintMoney(d.card, config)}`);
    if (d.upi) parts.push(`Digital: ${formatPrintMoney(d.upi, config)}`);
    if (d.credit) parts.push(`Credit: ${formatPrintMoney(d.credit, config)}`);
    if (parts.length > 0) out += `  ${parts.join(' | ')}\n`;
  }

  out += '\n';
  out += ESC + 'a' + '\x01';
  out += divider + '\n';
  out += (config.terms_conditions || '7-day exchange with original receipt & tags intact.') + '\n';
  out += divider + '\n';
  out += 'THANK YOU FOR YOUR BUSINESS\n\n\n\n';
  out += GS + 'V' + '\x42' + '\x00';

  return new TextEncoder().encode(out);
}

class BluetoothPrinterService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  async isSupported(): Promise<boolean> {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  isConnected(): boolean {
    return !!this.characteristic && !!this.device?.gatt?.connected;
  }

  getDeviceName(): string {
    return this.device?.name || 'Not Connected';
  }

  async connect(): Promise<boolean> {
    if (!('bluetooth' in navigator)) {
      throw new Error('Web Bluetooth is not supported on this browser.');
    }

    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
        { services: ['0000fee7-0000-1000-8000-00805f9b34fb'] },
        { services: ['0000e0ff-3c17-d293-8e48-14fe2e4da212'] },
        { services: ['49535343-fe7d-4ae5-8fa9-9fafd205e455'] },
        { namePrefix: 'MPT' },
        { namePrefix: 'RP' },
        { namePrefix: 'POS' },
        { namePrefix: 'BT' },
        { namePrefix: 'Thermal' },
      ],
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000fee7-0000-1000-8000-00805f9b34fb',
        '0000e0ff-3c17-d293-8e48-14fe2e4da212',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      ],
    });

    this.device = device;
    const server = await device.gatt?.connect();
    if (!server) throw new Error('Could not connect to printer GATT server');

    const services = await server.getPrimaryServices();
    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          this.characteristic = char;
          break;
        }
      }
      if (this.characteristic) break;
    }

    if (!this.characteristic) {
      throw new Error('No writable thermal printer characteristic found.');
    }
    return true;
  }

  async disconnect(): Promise<void> {
    try {
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    } finally {
      this.characteristic = null;
    }
  }

  async printData(data: Uint8Array): Promise<void> {
    if (!this.characteristic || !this.device?.gatt?.connected) {
      await this.connect();
    }
    if (!this.characteristic) {
      throw new Error('Thermal printer not connected');
    }

    const chunkSize = 100;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await this.characteristic.writeValue(chunk);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
}

export const bluetoothPrinter = new BluetoothPrinterService();

export function playBeep(type: 'success' | 'warn' | 'tap' = 'success') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'warn') {
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } else {
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    }
  } catch {
    // ignore audio block
  }
}
