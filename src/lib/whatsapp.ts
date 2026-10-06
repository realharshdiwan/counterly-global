import { type Bill, type ShopConfig } from '../types';

/**
 * Formats a comprehensive itemized invoice for WhatsApp.
 */
export function generateWhatsAppReceiptText(bill: Bill, config?: ShopConfig | null): string {
  const shopName = config?.legal_name || 'SARASWATI GARMENTS';
  const shopTagline = config?.shop_tagline || 'School Uniforms & Retail Garments';
  const shopPhone = config?.shop_phone || '';
  const dateObj = new Date(bill.created_at);
  const dateStr = dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const schoolsText = bill.schools && bill.schools.length > 1 
    ? `Schools: *${bill.schools.join(', ')}*` 
    : `School: *${bill.school_name}*`;

  const customerText = bill.customer_name || bill.customer_phone
    ? `Customer: *${[bill.customer_name, bill.customer_phone].filter(Boolean).join(' · ')}*`
    : '';

  const lines: string[] = [
    `*${shopName}*`,
    shopTagline ? `_${shopTagline}_` : '',
    shopPhone ? `Ph: ${shopPhone}` : '',
    config?.gstin ? `GSTIN: ${config.gstin}` : '',
    `*BILL OF SUPPLY*`,
    `_(Composition Dealer - No tax charged)_`,
    `--------------------------------`,
    `*Bill No:* ${bill.bill_number}`,
    `*Date:* ${dateStr} ${timeStr}`,
    schoolsText,
  ];

  if (customerText) {
    lines.push(customerText);
  }

  lines.push(`--------------------------------`);
  lines.push(`*ITEMIZED BILL:*`);

  bill.items.forEach((it, idx) => {
    const schTag = it.school_code ? `[${it.school_code}] ` : '';
    const szTag = it.size_label ? ` (Size: ${it.size_label})` : '';
    lines.push(`${idx + 1}. ${schTag}*${it.product_name}*${szTag}`);
    lines.push(`   Qty: ${it.qty} × ₹${it.unit_price} = *₹${it.subtotal}*`);
  });

  lines.push(`--------------------------------`);
  lines.push(`Subtotal: ₹${bill.subtotal}`);
  if (bill.discount_amount > 0) {
    lines.push(`Discount: -₹${bill.discount_amount}`);
  }
  lines.push(`*TOTAL PAYABLE: ₹${bill.total}*`);
  lines.push(`Payment: ${bill.payment_method.toUpperCase()} (${bill.is_paid ? 'PAID' : 'PENDING'})`);
  lines.push(`--------------------------------`);
  lines.push(`*7-Day Uniform Exchange Policy:*`);
  lines.push(`• Present original bill with tags attached`);
  lines.push(`• Size exchange within 7 days of purchase`);
  lines.push(`• No exchange on altered, stitched or washed garments`);
  lines.push(`--------------------------------`);
  lines.push(`Thank you for shopping with us!`);

  return lines.filter(l => l !== '').join('\n');
}

/**
 * Opens WhatsApp with properly encoded text across Mobile & Desktop.
 */
export function openWhatsAppReceipt(phone: string, text: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedText = encodeURIComponent(text);
  const targetPhone = cleanPhone.length >= 10 ? `91${cleanPhone.slice(-10)}` : '';
  
  const url = targetPhone 
    ? `https://api.whatsapp.com/send/?phone=${targetPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send/?text=${encodedText}`;
    
  window.open(url, '_blank');
}
