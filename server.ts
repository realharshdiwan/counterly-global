import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '2mb' }));

// ==========================================
// 1. Scoped Customer Display State Relay
// ==========================================
const DEFAULT_DISPLAY_STATE = {
  shopName: 'SIKKADESK RETAIL',
  currencySymbol: '₹',
  currencyCode: 'INR',
  locale: 'en-IN',
  upiId: '',
  cart: [],
  subtotal: 0,
  taxAmount: 0,
  taxLabel: 'GST',
  discount: 0,
  grandTotal: 0,
  paymentMethod: 'cash',
  upiAmount: 0,
  status: 'idle',
  timestamp: Date.now(),
};

const terminalDisplayStates = new Map<string, any>();

function sanitizeTerminalId(raw: unknown): string {
  const cleaned = String(raw || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48);
  return cleaned || 'default';
}

app.get('/api/display/:terminalId', (req: Request, res: Response) => {
  const terminalId = sanitizeTerminalId(req.params.terminalId);
  res.json(terminalDisplayStates.get(terminalId) || DEFAULT_DISPLAY_STATE);
});

app.post('/api/display/:terminalId', (req: Request, res: Response) => {
  const terminalId = sanitizeTerminalId(req.params.terminalId);
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ success: false, message: 'Invalid payload' });
  }

  const prev = terminalDisplayStates.get(terminalId) || DEFAULT_DISPLAY_STATE;
  const {
    shopName,
    currencySymbol,
    currencyCode,
    locale,
    upiId,
    cart,
    subtotal,
    taxAmount,
    taxLabel,
    discount,
    grandTotal,
    paymentMethod,
    upiAmount,
    status,
    customerName,
    lastBillNumber,
  } = req.body;

  if (typeof grandTotal !== 'undefined' && typeof grandTotal !== 'number') {
    return res.status(400).json({ success: false, message: 'Invalid total amount' });
  }
  if (cart && !Array.isArray(cart)) {
    return res.status(400).json({ success: false, message: 'Cart must be an array' });
  }

  const nextState = {
    shopName: String(shopName || prev.shopName).slice(0, 80),
    currencySymbol: String(currencySymbol || prev.currencySymbol || '$').slice(0, 8),
    currencyCode: String(currencyCode || prev.currencyCode || 'USD').slice(0, 8),
    locale: String(locale || prev.locale || 'en-US').slice(0, 16),
    upiId: typeof upiId === 'string' ? upiId.trim().slice(0, 100) : prev.upiId,
    cart: Array.isArray(cart) ? cart.slice(0, 100) : prev.cart,
    subtotal: Number(subtotal) || 0,
    taxAmount: Number(taxAmount) || 0,
    taxLabel: String(taxLabel || prev.taxLabel || 'Tax').slice(0, 24),
    discount: Number(discount) || 0,
    grandTotal: Number(grandTotal) || 0,
    paymentMethod: String(paymentMethod || 'cash').slice(0, 20),
    upiAmount: Number(upiAmount) || 0,
    status: String(status || 'idle').slice(0, 30),
    customerName: customerName ? String(customerName).slice(0, 60) : undefined,
    lastBillNumber: lastBillNumber ? String(lastBillNumber).slice(0, 40) : undefined,
    timestamp: Date.now(),
  };

  terminalDisplayStates.set(terminalId, nextState);
  res.json({ success: true, terminalId, timestamp: nextState.timestamp });
});

// Backward-compatible route with optional ?terminalId=
app.get('/api/customer-display', (req: Request, res: Response) => {
  const terminalId = sanitizeTerminalId(req.query.terminalId);
  res.json(terminalDisplayStates.get(terminalId) || DEFAULT_DISPLAY_STATE);
});

app.post('/api/customer-display', (req: Request, res: Response) => {
  const terminalId = sanitizeTerminalId(req.body?.terminalId || req.query.terminalId);
  const prev = terminalDisplayStates.get(terminalId) || DEFAULT_DISPLAY_STATE;
  const body = req.body || {};

  if (typeof body.grandTotal !== 'undefined' && typeof body.grandTotal !== 'number') {
    return res.status(400).json({ success: false, message: 'Invalid total amount' });
  }
  if (body.cart && !Array.isArray(body.cart)) {
    return res.status(400).json({ success: false, message: 'Cart must be an array' });
  }

  const nextState = {
    shopName: String(body.shopName || prev.shopName).slice(0, 80),
    currencySymbol: String(body.currencySymbol || prev.currencySymbol || '$').slice(0, 8),
    currencyCode: String(body.currencyCode || prev.currencyCode || 'USD').slice(0, 8),
    locale: String(body.locale || prev.locale || 'en-US').slice(0, 16),
    upiId: typeof body.upiId === 'string' ? body.upiId.trim().slice(0, 100) : prev.upiId,
    cart: Array.isArray(body.cart) ? body.cart.slice(0, 100) : prev.cart,
    subtotal: Number(body.subtotal) || 0,
    taxAmount: Number(body.taxAmount) || 0,
    taxLabel: String(body.taxLabel || prev.taxLabel || 'Tax').slice(0, 24),
    discount: Number(body.discount) || 0,
    grandTotal: Number(body.grandTotal) || 0,
    paymentMethod: String(body.paymentMethod || 'cash').slice(0, 20),
    upiAmount: Number(body.upiAmount) || 0,
    status: String(body.status || 'idle').slice(0, 30),
    customerName: body.customerName ? String(body.customerName).slice(0, 60) : undefined,
    lastBillNumber: body.lastBillNumber ? String(body.lastBillNumber).slice(0, 40) : undefined,
    timestamp: Date.now(),
  };

  terminalDisplayStates.set(terminalId, nextState);
  res.json({ success: true, terminalId, timestamp: nextState.timestamp });
});

// ==========================================
// 2. Server-Verified Annual License & Vendor Portal API
// ==========================================
const LICENSE_SIGNING_SECRET =
  process.env.COUNTERLY_LICENSE_SECRET || 'CNTR_SALES_PRO_SEC_2026_MASTER_SECRET';
const VENDOR_PASSWORD =
  process.env.COUNTERLY_VENDOR_PASSWORD || 'counterly-vendor-2026';

const DATA_DIR = path.join(__dirname, 'data');
const LEDGER_FILE = path.join(DATA_DIR, 'vendor-licenses.json');

interface ServerLicenseRecord {
  key: string;
  buyerName: string;
  buyerEmail?: string;
  tier: 'starter' | 'pro' | 'enterprise' | 'lifetime';
  expiresAt: string;
  machineId: string;
  createdAt: string;
  revoked: boolean;
  revokedAt?: string;
  notes?: string;
}

function readLicenseLedger(): ServerLicenseRecord[] {
  try {
    if (!fs.existsSync(LEDGER_FILE)) return [];
    const raw = fs.readFileSync(LEDGER_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLicenseLedger(records: ServerLicenseRecord[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${LEDGER_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(records, null, 2), 'utf8');
    fs.renameSync(tmpFile, LEDGER_FILE);
  } catch (err) {
    console.error('Failed to persist vendor license ledger:', err);
  }
}

function createVendorSessionToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt, role: 'vendor' })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', LICENSE_SIGNING_SECRET)
    .update(payload)
    .digest('base64url');
  return { token: `${payload}.${sig}`, expiresAt };
}

function verifyVendorSessionToken(authHeader?: string): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expectedSig = crypto
    .createHmac('sha256', LICENSE_SIGNING_SECRET)
    .update(payload)
    .digest('base64url');
  if (sig !== expectedSig) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function fastHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function computeLicenseChecksum(tier: string, expCode: string, midShort: string): string {
  const raw = `${LICENSE_SIGNING_SECRET}|${tier.toUpperCase()}|${expCode}|${midShort.toUpperCase()}`;
  const h1 = fastHash(raw);
  const h2 = fastHash(raw + '_ROUND2');
  return `${h1.slice(0, 2)}${h2.slice(0, 2)}`.toUpperCase();
}

app.post('/api/vendor/login', (req: Request, res: Response) => {
  const pass = String(req.body?.password || '');
  if (!pass || pass !== VENDOR_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Incorrect vendor passphrase.' });
  }
  const session = createVendorSessionToken();
  return res.json({ success: true, ...session });
});

app.get('/api/vendor/licenses', (req: Request, res: Response) => {
  if (!verifyVendorSessionToken(req.headers.authorization)) {
    return res.status(401).json({ success: false, message: 'Vendor session expired or unauthorized.' });
  }
  const records = readLicenseLedger().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return res.json({ success: true, licenses: records });
});

app.post('/api/vendor/licenses', (req: Request, res: Response) => {
  if (!verifyVendorSessionToken(req.headers.authorization)) {
    return res.status(401).json({ success: false, message: 'Vendor session expired or unauthorized.' });
  }

  const buyerName = String(req.body?.buyerName || '').trim().slice(0, 80);
  const buyerEmail = String(req.body?.buyerEmail || '').trim().slice(0, 100);
  const tier = String(req.body?.tier || 'pro').toLowerCase() as ServerLicenseRecord['tier'];
  const duration = String(req.body?.duration || '1y');
  const rawMachine = String(req.body?.machineId || '').trim().toUpperCase();
  const notes = String(req.body?.notes || '').trim().slice(0, 200);

  if (!buyerName) {
    return res.status(400).json({ success: false, message: 'Buyer / Store name is required.' });
  }
  if (!['starter', 'pro', 'enterprise', 'lifetime'].includes(tier)) {
    return res.status(400).json({ success: false, message: 'Invalid tier selected.' });
  }

  let expCode = '20991231';
  let expiresAtIso = '2099-12-31T23:59:59.000Z';
  if (tier !== 'lifetime' && duration !== 'lifetime') {
    const years = duration === '2y' ? 2 : 1;
    const d = new Date();
    d.setFullYear(d.getFullYear() + years);
    expCode = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    expiresAtIso = d.toISOString();
  }

  let midShort = 'UNIV';
  if (rawMachine) {
    const seg = rawMachine.includes('-') ? rawMachine.split('-')[1] || rawMachine : rawMachine;
    midShort = seg.replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, 'X') || 'UNIV';
  }

  const tierUpper = tier.toUpperCase();
  const checksum = computeLicenseChecksum(tierUpper, expCode, midShort);
  const key = `CNTR-${tierUpper}-${expCode}-${midShort}-${checksum}`;

  const newRecord: ServerLicenseRecord = {
    key,
    buyerName,
    buyerEmail: buyerEmail || undefined,
    tier,
    expiresAt: expiresAtIso,
    machineId: rawMachine || 'UNIV',
    createdAt: new Date().toISOString(),
    revoked: false,
    notes: notes || undefined,
  };

  const ledger = readLicenseLedger();
  const filtered = ledger.filter(r => r.key !== key);
  filtered.unshift(newRecord);
  writeLicenseLedger(filtered);

  return res.json({ success: true, license: newRecord });
});

app.post('/api/vendor/revoke', (req: Request, res: Response) => {
  if (!verifyVendorSessionToken(req.headers.authorization)) {
    return res.status(401).json({ success: false, message: 'Vendor session expired or unauthorized.' });
  }
  const key = String(req.body?.key || '').trim().toUpperCase();
  const revoked = Boolean(req.body?.revoked);

  const ledger = readLicenseLedger();
  const idx = ledger.findIndex(r => r.key === key);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'License key not found in ledger.' });
  }

  ledger[idx] = {
    ...ledger[idx],
    revoked,
    revokedAt: revoked ? new Date().toISOString() : undefined,
  };
  writeLicenseLedger(ledger);
  return res.json({ success: true, license: ledger[idx] });
});

app.post('/api/license/verify', (req: Request, res: Response) => {
  const rawKey = String(req.body?.licenseKey || '').trim().toUpperCase();
  const machineId = String(req.body?.machineId || '').trim().toUpperCase();

  const parts = rawKey.split('-');
  if (parts.length !== 5 || parts[0] !== 'CNTR') {
    return res.status(400).json({
      success: false,
      message: 'Invalid license format. Expected CNTR-TIER-YYYYMMDD-MID-XXXX',
    });
  }

  const [, tierCode, expCode, midShort, checksum] = parts;
  if (!['STARTER', 'PRO', 'ENTERPRISE', 'LIFETIME'].includes(tierCode)) {
    return res.status(400).json({ success: false, message: `Unrecognized license tier "${tierCode}"` });
  }

  const expected = computeLicenseChecksum(tierCode, expCode, midShort);
  if (checksum !== expected) {
    return res.status(403).json({ success: false, message: 'License signature verification failed.' });
  }

  const ledger = readLicenseLedger();
  const ledgerEntry = ledger.find(r => r.key === rawKey);
  if (ledgerEntry?.revoked) {
    return res.status(403).json({
      success: false,
      message: 'This license key has been revoked by SikkaDesk Licensing.',
    });
  }

  const currentShort = (machineId.split('-')[1] || 'UNIV').slice(0, 4);
  if (midShort !== 'UNIV' && midShort !== currentShort) {
    return res.status(403).json({
      success: false,
      message: `License belongs to terminal [${midShort}], not [${currentShort}].`,
    });
  }

  return res.json({
    success: true,
    licenseKey: rawKey,
    tier: tierCode.toLowerCase(),
  });
});

// ==========================================
// 3. Vite Middleware / Production Static Serve
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
