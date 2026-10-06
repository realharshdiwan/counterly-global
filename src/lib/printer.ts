import { type Bill, type ShopConfig } from '../types';

// Convert number to Indian Rupee Words
export function numberToWords(num: number): string {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = Math.floor(num);
  if (n === 0) return 'Rupees Zero Only';

  function convert(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  }

  return 'Rupees ' + convert(n).trim() + ' Only';
}

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';

export function generateEscPosReceipt(bill: Bill, config: ShopConfig, overrideWidth?: 32 | 48): Uint8Array {
  const width = overrideWidth || config.printer_width || 48; // 32 chars for 58mm, 48 chars for 80mm
  const is32 = width <= 32;

  let out = '';

  // Initialize
  out += ESC + '@'; // Reset
  out += ESC + 'a' + '\x01'; // Center alignment

  // Header
  out += ESC + 'E' + '\x01'; // Bold on
  out += (config.legal_name || 'SARASWATI GARMENTS') + '\n';
  out += ESC + 'E' + '\x00'; // Bold off

  if (config.shop_tagline) {
    out += config.shop_tagline + '\n';
  }
  if (config.shop_address) {
    out += config.shop_address + '\n';
  }
  if (config.shop_phone) {
    out += 'Ph: ' + config.shop_phone + '\n';
  }
  if (config.gstin) {
    out += 'GSTIN: ' + config.gstin + '\n';
  }

  out += ESC + 'a' + '\x01'; // Center
  out += '------------------------------------------------'.substring(0, width) + '\n';
  out += ESC + 'E' + '\x01'; // Bold
  const scheme = config.gst_scheme || 'composition';
  if (scheme === 'regular') {
    out += 'TAX INVOICE\n';
    out += ESC + 'E' + '\x00'; // Normal
  } else if (scheme === 'none') {
    out += 'CASH MEMO\n';
    out += ESC + 'E' + '\x00'; // Normal
  } else {
    out += 'BILL OF SUPPLY\n';
    out += ESC + 'E' + '\x00'; // Normal
    out += is32
      ? 'Composition taxable person,\nnot eligible to collect tax\n'
      : 'Composition taxable person, not eligible to collect tax\n';
  }
  out += '------------------------------------------------'.substring(0, width) + '\n';

  // Left align for bill metadata
  out += ESC + 'a' + '\x00'; // Left align
  const billDate = new Date(bill.created_at);
  const dateStr = billDate.toLocaleDateString('en-IN') + ' ' + billDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  out += `Bill No: ${bill.bill_number}\n`;
  out += `Date   : ${dateStr}\n`;
  out += `${bill.schools && bill.schools.length > 1 ? 'Schools: ' : 'School : '}${bill.school_name}\n`;
  if (bill.customer_name || bill.customer_phone) {
    out += `Cust   : ${[bill.customer_name, bill.customer_phone].filter(Boolean).join(' · ')}\n`;
  }

  out += '------------------------------------------------'.substring(0, width) + '\n';

  // Items Header
  if (is32) {
    // 32-column layout (58mm)
    out += 'Item              Qty  Rate  Amt\n';
    out += '--------------------------------\n';
    for (const item of bill.items) {
      const schPrefix = item.school_code ? `[${item.school_code}] ` : '';
      const name = schPrefix + item.product_name + (item.size_label ? ` (${item.size_label})` : '');
      const trimmedName = name.length > 32 ? name.substring(0, 31) + '.' : name;
      out += trimmedName + '\n';
      const qtyStr = String(item.qty).padStart(3);
      const rateStr = `Rs.${item.unit_price}`.padStart(7);
      const amtStr = `Rs.${item.subtotal}`.padStart(8);
      out += `           ${qtyStr} ${rateStr} ${amtStr}\n`;
    }
    out += '--------------------------------\n';
  } else {
    // 48-column layout (80mm)
    out += 'Item Description          Size  Qty   Rate   Amt\n';
    out += '------------------------------------------------\n';
    for (const item of bill.items) {
      const schPrefix = item.school_code ? `[${item.school_code}] ` : '';
      const fullName = schPrefix + item.product_name;
      const name = fullName.padEnd(25).substring(0, 25);
      const size = (item.size_label || '-').padEnd(5).substring(0, 5);
      const qty = String(item.qty).padStart(4);
      const rate = `Rs.${item.unit_price}`.padStart(7);
      const amt = `Rs.${item.subtotal}`.padStart(7);
      out += `${name} ${size} ${qty} ${rate} ${amt}\n`;
    }
    out += '------------------------------------------------\n';
  }

  // Subtotal & Totals
  const padLabel = is32 ? 20 : 36;
  const padVal = is32 ? 12 : 12;

  out += 'Subtotal:'.padEnd(padLabel) + `Rs.${bill.subtotal}`.padStart(padVal) + '\n';

  if (bill.discount_amount > 0) {
    out += 'Discount:'.padEnd(padLabel) + `-Rs.${bill.discount_amount}`.padStart(padVal) + '\n';
  }

  out += '------------------------------------------------'.substring(0, width) + '\n';

  // Total in bold
  out += ESC + 'E' + '\x01'; // Bold on
  out += 'TOTAL PAYABLE:'.padEnd(padLabel) + `Rs.${bill.total}`.padStart(padVal) + '\n';
  out += ESC + 'E' + '\x00'; // Bold off

  out += '------------------------------------------------'.substring(0, width) + '\n';

  // Payment status
  const payMethodText = bill.payment_method.toUpperCase();
  out += `Payment Mode: ${payMethodText} (${bill.is_paid ? 'PAID' : 'PENDING'})\n`;
  if (bill.payment_method === 'split' && bill.payment_details) {
    const d = bill.payment_details;
    const parts = [];
    if (d.cash) parts.push(`Cash: Rs.${d.cash}`);
    if (d.upi) parts.push(`UPI: Rs.${d.upi}`);
    if (d.card) parts.push(`Card: Rs.${d.card}`);
    if (d.credit) parts.push(`Credit: Rs.${d.credit}`);
    out += `  ${parts.join(' | ')}\n`;
  }

  // Amount in words
  out += `\n${numberToWords(bill.total)}\n\n`;

  // Footer & Exchange Policy
  out += ESC + 'a' + '\x01'; // Center
  out += '------------------------------------------------'.substring(0, width) + '\n';
  out += '*** 7-DAY UNIFORM EXCHANGE POLICY ***\n';
  out += '• Original bill & barcode tags must be intact\n';
  out += '• Size exchange within 7 days of purchase\n';
  out += '• No exchange on altered, stitched or washed items\n';
  out += '------------------------------------------------'.substring(0, width) + '\n';
  out += '*** THANK YOU FOR SHOPPING WITH US! ***\n\n';

  // Paper feed & cut
  out += '\n\n\n';
  out += GS + 'V' + '\x42' + '\x00'; // Full cut

  // Encode to bytes
  return new TextEncoder().encode(out);
}

// Web Bluetooth LE Thermal Printer Service
class BluetoothPrinterService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private isConnecting = false;

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
      throw new Error('Web Bluetooth is not supported on this browser or platform.');
    }

    try {
      this.isConnecting = true;
      // Request device with standard POS / Serial BLE service UUIDs
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
      if (!server) throw new Error('Could not connect to GATT Server');

      // Discover writable characteristic
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
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
  }

  async printData(data: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      throw new Error('Printer not connected over Bluetooth.');
    }

    // Send in 200-byte chunks to avoid buffer overflow
    const chunkSize = 200;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      if (this.characteristic.properties.writeWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValueWithResponse(chunk);
      }
      // Brief pause between packets
      await new Promise(r => setTimeout(r, 20));
    }
  }
}

export const bluetoothPrinter = new BluetoothPrinterService();

// Quick audio sound feedback using Web Audio API (no external asset downloads)
export function playBeep(type: 'tap' | 'success' | 'warn' = 'tap') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'tap') {
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 high pleasant tap
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    } else if (type === 'warn') {
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch {
    // Audio context may be restricted before user gesture
  }
}
