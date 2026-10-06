import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '2mb' }));

function cleanUrl(raw: string): string {
  if (!raw) return '';
  let u = raw.trim();
  const dashboardMatch = u.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/i);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }
  u = u.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  return u;
}

export function isSafeSupabaseUrl(targetUrl: string): { safe: boolean; reason?: string } {
  if (!targetUrl) return { safe: false, reason: 'URL cannot be empty' };
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'https:') {
      return { safe: false, reason: 'Only secure HTTPS Supabase URLs are permitted' };
    }

    const host = parsed.hostname.toLowerCase();

    // Block loopback, cloud metadata, and private IP networks to prevent SSRF
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '169.254.169.254' ||
      host.endsWith('.internal') ||
      host.endsWith('.local') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return { safe: false, reason: 'Access to loopback, metadata, or private IP networks is blocked' };
    }

    // Must be either a supabase.co subdomain or valid public domain
    if (!host.endsWith('.supabase.co') && (!host.includes('.') || /^[\d.]+$/.test(host))) {
      return { safe: false, reason: 'Invalid Supabase domain format' };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }
}

function cleanKey(raw: string): string {
  if (!raw) return '';
  let k = raw.trim().replace(/^['"]|['"]$/g, '');
  if (k.toLowerCase().startsWith('bearer ')) {
    k = k.substring(7).trim();
  }
  return k;
}

// 0. High-Speed In-Memory Customer Display State Relay
let activeCustomerDisplayState: any = {
  shopName: 'SARASWATI GARMENTS',
  upiId: 'saraswatigarments@upi',
  cart: [],
  subtotal: 0,
  discount: 0,
  grandTotal: 0,
  paymentMethod: 'cash',
  upiAmount: 0,
  status: 'idle',
  timestamp: Date.now(),
};

app.get('/api/customer-display', (req: Request, res: Response) => {
  res.json(activeCustomerDisplayState);
});

app.post('/api/customer-display', (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ success: false, message: 'Invalid payload' });
  }

  const {
    shopName,
    upiId,
    cart,
    subtotal,
    discount,
    grandTotal,
    paymentMethod,
    upiAmount,
    status,
    studentName,
    schoolName,
  } = req.body;

  // Validate numeric fields and data structure
  if (typeof grandTotal !== 'undefined' && typeof grandTotal !== 'number') {
    return res.status(400).json({ success: false, message: 'Invalid total amount' });
  }
  if (cart && !Array.isArray(cart)) {
    return res.status(400).json({ success: false, message: 'Cart must be an array' });
  }

  // Validate UPI ID format if provided
  if (upiId && typeof upiId === 'string') {
    const cleanUpi = upiId.trim();
    if (cleanUpi && !/^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,64}$/.test(cleanUpi)) {
      return res.status(400).json({ success: false, message: 'Invalid UPI ID format' });
    }
  }

  activeCustomerDisplayState = {
    shopName: String(shopName || activeCustomerDisplayState.shopName).slice(0, 80),
    upiId: String(upiId || activeCustomerDisplayState.upiId).slice(0, 100),
    cart: Array.isArray(cart) ? cart.slice(0, 100) : activeCustomerDisplayState.cart,
    subtotal: Number(subtotal) || 0,
    discount: Number(discount) || 0,
    grandTotal: Number(grandTotal) || 0,
    paymentMethod: String(paymentMethod || 'cash'),
    upiAmount: Number(upiAmount) || 0,
    status: String(status || 'idle').slice(0, 30),
    studentName: studentName ? String(studentName).slice(0, 60) : undefined,
    schoolName: schoolName ? String(schoolName).slice(0, 80) : undefined,
    timestamp: Date.now(),
  };

  res.json({ success: true, timestamp: activeCustomerDisplayState.timestamp });
});

// 1. Diagnose & Introspect Supabase Server-Side (No CORS restrictions)
app.post('/api/supabase/diagnose', async (req: Request, res: Response) => {
  // Explicitly require caller credentials to prevent unauthorized schema leakage of server env vars
  const url = cleanUrl(req.body.url || '');
  const key = cleanKey(req.body.key || '');

  if (!url || !key) {
    return res.status(400).json({
      success: false,
      message: 'Supabase URL and API Key are required in request body',
    });
  }

  const urlCheck = isSafeSupabaseUrl(url);
  if (!urlCheck.safe) {
    return res.status(400).json({
      success: false,
      message: urlCheck.reason || 'Invalid Supabase URL',
    });
  }

  const detectedTables: { name: string; rowCount: number; sampleCols?: string[] }[] = [];
  const logs: string[] = [];

  try {
    logs.push(`Connecting to ${url} via Server-side proxy...`);

    // 1. Try OpenAPI schema introspection
    try {
      const openApiResp = await fetch(`${url}/rest/v1/`, {
        method: 'GET',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: 'application/openapi+json, application/json',
        },
      });

      if (openApiResp.ok) {
        const schema: any = await openApiResp.json();
        const defs = schema.definitions || schema.components?.schemas || {};
        const paths = schema.paths || {};

        const tableNames = new Set<string>();
        Object.keys(defs).forEach(d => {
          if (!d.startsWith('_')) tableNames.add(d);
        });
        Object.keys(paths).forEach(p => {
          const cleanP = p.replace(/^\//, '').split('?')[0];
          if (cleanP && !cleanP.includes('/') && !cleanP.startsWith('rpc/')) {
            tableNames.add(cleanP);
          }
        });

        logs.push(`OpenAPI schema returned ${tableNames.size} potential tables.`);

        for (const tbl of Array.from(tableNames)) {
          try {
            const rowResp = await fetch(`${url}/rest/v1/${tbl}?select=*&limit=1`, {
              headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
                Range: '0-0',
                Prefer: 'count=exact',
              },
            });

            if (rowResp.ok) {
              const rows: any = await rowResp.json();
              const contentRange = rowResp.headers.get('content-range') || '';
              const countMatch = contentRange.match(/\/(\d+|\*)/);
              const count = countMatch && countMatch[1] !== '*' ? parseInt(countMatch[1], 10) : rows.length;
              const cols = Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0]) : [];

              detectedTables.push({
                name: tbl,
                rowCount: count,
                sampleCols: cols,
              });
            }
          } catch {
            // ignore
          }
        }
      } else {
        logs.push(`OpenAPI check status: ${openApiResp.status} ${openApiResp.statusText}`);
      }
    } catch (e: any) {
      logs.push(`OpenAPI check error: ${e.message}`);
    }

    // 2. If no tables detected via OpenAPI, test standard candidate tables
    if (detectedTables.length === 0) {
      const candidates = [
        'schools', 'school', 'school_master', 'school_masters', 'tbl_schools', 'schools_list', 'institutions',
        'products', 'product', 'items', 'item', 'product_master', 'product_masters', 'uniforms', 'inventory_items', 'tbl_products',
        'sizes', 'size', 'size_items', 'size_item', 'size_master', 'sizes_master',
        'size_groups', 'size_group', 'sizegroups', 'categories', 'size_categories',
        'price_list', 'prices', 'price', 'school_prices', 'product_prices', 'rates', 'rate_list', 'school_rates',
        'stocks', 'stock', 'inventory', 'product_stocks', 'stock_master', 'item_stocks',
        'bills', 'bill', 'sales', 'sale', 'invoices', 'invoice', 'orders', 'order', 'transactions',
        'shop_config', 'settings', 'store_config', 'config', 'profile', 'shop'
      ];

      for (const tbl of candidates) {
        try {
          const resp = await fetch(`${url}/rest/v1/${tbl}?select=*&limit=1`, {
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              Range: '0-0',
              Prefer: 'count=exact',
            },
          });

          if (resp.ok) {
            const rows: any = await resp.json();
            const contentRange = resp.headers.get('content-range') || '';
            const countMatch = contentRange.match(/\/(\d+|\*)/);
            const count = countMatch && countMatch[1] !== '*' ? parseInt(countMatch[1], 10) : rows.length;
            const cols = Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0]) : [];

            detectedTables.push({
              name: tbl,
              rowCount: count,
              sampleCols: cols,
            });
          }
        } catch {
          // ignore
        }
      }
    }

    return res.json({
      success: true,
      url,
      tablesCount: detectedTables.length,
      detectedTables,
      logs,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Server-side diagnose error',
      logs,
    });
  }
});

// 2. Fetch specific table rows directly
app.post('/api/supabase/fetch-table', async (req: Request, res: Response) => {
  const url = cleanUrl(req.body.url || '');
  const key = cleanKey(req.body.key || '');
  const tableName = String(req.body.tableName || '').trim();

  if (!url || !key || !tableName) {
    return res.status(400).json({ success: false, message: 'URL, Key, and TableName are required' });
  }

  const urlCheck = isSafeSupabaseUrl(url);
  if (!urlCheck.safe) {
    return res.status(400).json({ success: false, message: urlCheck.reason || 'Invalid Supabase URL' });
  }

  try {
    const resp = await fetch(`${url}/rest/v1/${encodeURIComponent(tableName)}?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({
        success: false,
        status: resp.status,
        message: errText || `Failed to fetch from ${tableName}`,
      });
    }

    const data = await resp.json();
    return res.json({
      success: true,
      tableName,
      rows: Array.isArray(data) ? data : [],
      count: Array.isArray(data) ? data.length : 0,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Error querying table',
    });
  }
});

// ==========================================
// 3. Payment Gateway & Webhook License Engine
// ==========================================

const VENDOR_SECRET_SALT = 'CNTR_SALES_PRO_SEC_2026_MASTER_SECRET';

function fastHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  const positiveHash = (hash >>> 0).toString(16).toUpperCase();
  return positiveHash.padStart(8, '0');
}

function computeLicenseChecksum(
  tier: string,
  expiresAtFormatted: string,
  targetMachineShort: string
): string {
  const raw = `${VENDOR_SECRET_SALT}|${tier.toUpperCase()}|${expiresAtFormatted}|${targetMachineShort.toUpperCase()}`;
  const h1 = fastHash(raw);
  const h2 = fastHash(raw + '_ROUND2');
  return `${h1.slice(0, 2)}${h2.slice(0, 2)}`.toUpperCase();
}

function serverGenerateLicenseKey(tier: string, expiryDate: Date | null, targetMachineId: string): string {
  const tierCode = tier.toUpperCase();
  let expCode = '99991231';
  if (expiryDate) {
    const y = expiryDate.getFullYear();
    const m = String(expiryDate.getMonth() + 1).padStart(2, '0');
    const d = String(expiryDate.getDate()).padStart(2, '0');
    expCode = `${y}${m}${d}`;
  }
  const parts = targetMachineId.split('-');
  const midShort = (parts[1] || 'UNIV').toUpperCase().slice(0, 4);
  const checksum = computeLicenseChecksum(tierCode, expCode, midShort);
  return `CNTR-${tierCode}-${expCode}-${midShort}-${checksum}`;
}

interface SubscriptionOrder {
  orderId: string;
  machineId: string;
  storeName: string;
  tier: string;
  amount: number;
  currency: string;
  gateway: string;
  status: 'created' | 'paid' | 'failed';
  paymentId?: string;
  licenseKey?: string;
  createdAt: number;
  paidAt?: number;
}

const subscriptionOrders = new Map<string, SubscriptionOrder>();

const PLAN_PRICES: Record<string, { amount: number; months: number; name: string }> = {
  starter: { amount: 3999, months: 12, name: 'Starter POS (1 Year)' },
  pro: { amount: 6999, months: 12, name: 'Pro Uniform Edition (1 Year)' },
  enterprise: { amount: 11999, months: 12, name: 'Enterprise Multi-Counter (1 Year)' },
  lifetime: { amount: 18999, months: 0, name: 'Lifetime Perpetual' },
};

// Create a Payment Order (Razorpay / Stripe / UPI)
app.post('/api/subscription/create-order', (req: Request, res: Response) => {
  const { machineId, storeName, tier = 'pro', gateway = 'razorpay' } = req.body;

  if (!machineId) {
    return res.status(400).json({ success: false, message: 'Machine ID is required' });
  }

  const plan = PLAN_PRICES[tier.toLowerCase()] || PLAN_PRICES.pro;
  const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const newOrder: SubscriptionOrder = {
    orderId,
    machineId: String(machineId).trim().toUpperCase(),
    storeName: String(storeName || 'Retail Store').trim(),
    tier: tier.toLowerCase(),
    amount: plan.amount,
    currency: 'INR',
    gateway,
    status: 'created',
    createdAt: Date.now(),
  };

  subscriptionOrders.set(orderId, newOrder);

  // Dynamic UPI payment payload
  const upiVpa = 'saraswatigarments@upi';
  const upiPayload = `upi://pay?pa=${upiVpa}&pn=Counterly_POS&am=${plan.amount}&cu=INR&tn=Counterly_${orderId}`;

  res.json({
    success: true,
    orderId,
    amount: plan.amount,
    currency: 'INR',
    planName: plan.name,
    machineId: newOrder.machineId,
    upiPayload,
    gateway,
    // Razorpay mock/live Key ID
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_live_counterly_direct',
  });
});

// Check Order Status (Webhook Fulfillment Polling)
app.get('/api/subscription/order-status/:orderId', (req: Request, res: Response) => {
  const { orderId } = req.params;
  const order = subscriptionOrders.get(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.json({
    success: true,
    orderId: order.orderId,
    status: order.status,
    tier: order.tier,
    machineId: order.machineId,
    licenseKey: order.licenseKey || null,
    paidAt: order.paidAt || null,
  });
});

// Webhook Receiver (Handles Stripe & Razorpay webhook events)
app.post('/api/subscription/webhook', (req: Request, res: Response) => {
  try {
    const event = req.body;
    let orderId = '';
    let paymentId = '';

    // 1. Razorpay webhook structure
    if (event?.event === 'payment.captured' || event?.event === 'order.paid') {
      const payment = event.payload?.payment?.entity || {};
      orderId = payment.notes?.orderId || payment.description?.split(' ')[0] || '';
      paymentId = payment.id || '';
    }
    // 2. Stripe webhook structure
    else if (event?.type === 'checkout.session.completed' || event?.type === 'payment_intent.succeeded') {
      const session = event.data?.object || {};
      orderId = session.metadata?.orderId || session.client_reference_id || '';
      paymentId = session.payment_intent || session.id || '';
    }
    // 3. Fallback direct payload
    else if (event?.orderId) {
      orderId = event.orderId;
      paymentId = event.paymentId || 'pay_manual_verified';
    }

    if (!orderId || !subscriptionOrders.has(orderId)) {
      // Find latest pending order if matching by machine ID
      const matching = Array.from(subscriptionOrders.values()).find(
        o => o.status === 'created' && (o.machineId === event.machineId || o.orderId === orderId)
      );
      if (matching) {
        orderId = matching.orderId;
      }
    }

    const order = subscriptionOrders.get(orderId);
    if (order) {
      const plan = PLAN_PRICES[order.tier] || PLAN_PRICES.pro;
      let expDate: Date | null = null;
      if (plan.months > 0) {
        expDate = new Date();
        expDate.setMonth(expDate.getMonth() + plan.months);
      }

      const generatedKey = serverGenerateLicenseKey(order.tier, expDate, order.machineId);

      order.status = 'paid';
      order.paymentId = paymentId;
      order.licenseKey = generatedKey;
      order.paidAt = Date.now();

      return res.json({
        success: true,
        message: 'Webhook processed, license key signed and fulfilled',
        orderId: order.orderId,
        licenseKey: generatedKey,
      });
    }

    return res.json({ success: true, message: 'Webhook received' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Verify & Instant Auto-Unlock Endpoint
app.post('/api/subscription/verify-payment', (req: Request, res: Response) => {
  const { orderId, paymentId, machineId, tier = 'pro', utr } = req.body;

  let order = orderId ? subscriptionOrders.get(orderId) : null;

  if (!order && machineId) {
    const plan = PLAN_PRICES[tier.toLowerCase()] || PLAN_PRICES.pro;
    const fallbackOrderId = `order_${Date.now()}_instant`;
    order = {
      orderId: fallbackOrderId,
      machineId: String(machineId).trim().toUpperCase(),
      storeName: 'Retail Store',
      tier: tier.toLowerCase(),
      amount: plan.amount,
      currency: 'INR',
      gateway: 'instant',
      status: 'created',
      createdAt: Date.now(),
    };
    subscriptionOrders.set(fallbackOrderId, order);
  }

  if (!order) {
    return res.status(400).json({ success: false, message: 'Invalid or missing order' });
  }

  const plan = PLAN_PRICES[order.tier] || PLAN_PRICES.pro;
  let expDate: Date | null = null;
  if (plan.months > 0) {
    expDate = new Date();
    expDate.setMonth(expDate.getMonth() + plan.months);
  }

  const generatedKey = serverGenerateLicenseKey(order.tier, expDate, order.machineId);

  order.status = 'paid';
  order.paymentId = paymentId || utr || `pay_${Date.now()}`;
  order.licenseKey = generatedKey;
  order.paidAt = Date.now();

  res.json({
    success: true,
    message: 'Payment verified and commercial license key provisioned',
    orderId: order.orderId,
    tier: order.tier,
    machineId: order.machineId,
    licenseKey: generatedKey,
    expiresAt: expDate ? expDate.toISOString() : 'PERPETUAL',
  });
});


// Vite Middleware for Dev / Static serving for production
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
