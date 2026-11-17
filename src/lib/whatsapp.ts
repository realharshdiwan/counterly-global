import { type Bill, type ShopConfig } from '../types';
import { formatDateShort, formatMoney, formatTimeShort, getPaymentMethodLabel } from './locale';

export function generateWhatsAppReceiptText(bill: Bill, config?: ShopConfig | null): string {
  const shopName = config?.legal_name || 'SIKKADESK RETAIL';
  const shopTagline = config?.shop_tagline || '';
  const shopPhone = config?.shop_phone || '';
  const dateStr = formatDateShort(bill.created_at, config);
  const timeStr = formatTimeShort(bill.created_at, config);

  const customerText = bill.customer_name || bill.customer_phone
    ? `Customer: *${[bill.customer_name, bill.customer_phone].filter(Boolean).join(' · ')}*`
    : '';

  const lines: string[] = [
    `*${shopName}*`,
    shopTagline ? `_${shopTagline}_` : '',
    shopPhone ? `Tel: ${shopPhone}` : '',
    config?.gstin ? `${config.tax_label || 'Tax'} ID: ${config.gstin}` : '',
    `--------------------------------`,
    `*Receipt:* ${bill.bill_number}`,
    `*Date:* ${dateStr} ${timeStr}`,
    customerText,
  ];

  lines.push(`--------------------------------`);
  lines.push(`*ITEMS:*`);

  bill.items.forEach((it, idx) => {
    const variantTag = [it.size_label, it.color_label].filter(Boolean).join(' · ');
    const varSuffix = variantTag ? ` (${variantTag})` : '';
    lines.push(`${idx + 1}. *${it.product_name}*${varSuffix}`);
    lines.push(`   Qty: ${it.qty} × ${formatMoney(it.unit_price, config)} = *${formatMoney(it.subtotal, config)}*`);
  });

  lines.push(`--------------------------------`);
  lines.push(`Subtotal: ${formatMoney(bill.subtotal, config)}`);
  if (bill.discount_amount > 0) {
    lines.push(`Discount: -${formatMoney(bill.discount_amount, config)}`);
  }
  if (bill.tax_amount && bill.tax_amount > 0) {
    lines.push(`${bill.tax_label || config?.tax_label || 'Tax'}: ${formatMoney(bill.tax_amount, config)}`);
  }
  lines.push(`*TOTAL: ${formatMoney(bill.total, config)}*`);
  if ((bill.store_credit_used || 0) > 0) {
    lines.push(`Store Credit Used: -${formatMoney(bill.store_credit_used || 0, config)}`);
  }
  if ((bill.refunded_amount || 0) > 0) {
    lines.push(`Refunded: -${formatMoney(bill.refunded_amount || 0, config)}`);
    lines.push(`*NET PAID: ${formatMoney(Math.max(0, bill.total - (bill.refunded_amount || 0)), config)}*`);
  }
  lines.push(`Payment: ${getPaymentMethodLabel(bill.payment_method, config)} (${bill.is_paid ? 'PAID' : 'DUE'})`);
  lines.push(`--------------------------------`);
  lines.push(config?.terms_conditions || '7-day exchange with original receipt & tags intact.');
  lines.push(`Thank you for shopping with us!`);

  return lines.filter(l => l !== '').join('\n');
}

export function openWhatsAppReceipt(phone: string, text: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedText = encodeURIComponent(text);
  const url = cleanPhone.length >= 7
    ? `https://api.whatsapp.com/send/?phone=${cleanPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send/?text=${encodedText}`;

  window.open(url, '_blank');
}
