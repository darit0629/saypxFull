const puppeteer = require('puppeteer');

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  }
  return browserPromise;
}

function fmtMoney(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ordinalSuffix(day) {
  if (day % 10 === 1 && day !== 11) return 'st';
  if (day % 10 === 2 && day !== 12) return 'nd';
  if (day % 10 === 3 && day !== 13) return 'rd';
  return 'th';
}

function invoiceHtml(invoice, business) {
  const rows = invoice.items
    .map(
      (it) => `
      <tr>
        <td>${escapeHtml(it.description)}</td>
        <td class="num">${it.quantity}${it.unit ? ' ' + escapeHtml(it.unit) : ''}</td>
        <td class="num">${fmtMoney(it.rate)}</td>
        <td class="num">${fmtMoney(it.amount)}</td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
  <html>
  <head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 48px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .brand { font-size: 22px; font-weight: 800; }
    .brand span { color: #ff5722; }
    .biz-info { font-size: 11px; color: #555; margin-top: 4px; line-height: 1.5; }
    .invoice-meta { text-align: right; }
    .invoice-meta h1 { font-size: 20px; margin: 0 0 6px; }
    .invoice-meta div { font-size: 11px; color: #555; }
    .bill-to { margin: 24px 0; }
    .bill-to h3 { font-size: 11px; text-transform: uppercase; color: #888; margin: 0 0 6px; letter-spacing: 0.05em; }
    .bill-to div { font-size: 13px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #888; border-bottom: 2px solid #eee; padding: 8px 4px; }
    td { padding: 10px 4px; border-bottom: 1px solid #eee; }
    .num { text-align: right; }
    .totals { margin-top: 16px; margin-left: auto; width: 260px; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .totals .grand { font-size: 16px; font-weight: 700; border-top: 2px solid #1a1a1a; padding-top: 8px; margin-top: 4px; }
    .totals .due { color: #d32f2f; font-weight: 700; }
    .status { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .status.paid { background: #e8f5e9; color: #2e7d32; }
    .status.partial { background: #fff8e1; color: #f57f17; }
    .status.unpaid, .status.overdue { background: #ffebee; color: #c62828; }
    .notes { margin-top: 32px; font-size: 11px; color: #555; }
    .footer { margin-top: 48px; text-align: center; font-size: 10px; color: #999; }
  </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="brand">SAYPX <span>BILLING</span></div>
        <div class="biz-info">
          ${escapeHtml(business.business_name || '')}<br>
          ${escapeHtml(business.address || '')}<br>
          ${business.phone ? escapeHtml(business.phone) + ' · ' : ''}${escapeHtml(business.email || '')}
        </div>
      </div>
      <div class="invoice-meta">
        <h1>INVOICE</h1>
        <div>${escapeHtml(invoice.invoice_number)}</div>
        <div>Date: ${fmtDate(invoice.invoice_date)}</div>
        <div>Due: ${fmtDate(invoice.due_date)}</div>
        <div style="margin-top:6px"><span class="status ${invoice.display_status}">${invoice.display_status}</span></div>
      </div>
    </div>

    <div class="bill-to">
      <h3>Bill To</h3>
      <div>
        <strong>${escapeHtml(invoice.client_name)}</strong><br>
        ${invoice.client_address ? escapeHtml(invoice.client_address) + '<br>' : ''}
        ${invoice.client_phone ? escapeHtml(invoice.client_phone) + '<br>' : ''}
        ${invoice.client_email ? escapeHtml(invoice.client_email) : ''}
      </div>
    </div>

    <table>
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div><span>Subtotal</span><span>${fmtMoney(invoice.subtotal)}</span></div>
      ${invoice.discount ? `<div><span>Discount</span><span>-${fmtMoney(invoice.discount)}</span></div>` : ''}
      ${invoice.tax ? `<div><span>Tax</span><span>${fmtMoney(invoice.tax)}</span></div>` : ''}
      <div class="grand"><span>Total</span><span>${fmtMoney(invoice.total_amount)}</span></div>
      <div><span>Received</span><span>${fmtMoney(invoice.received_amount)}</span></div>
      <div class="due"><span>Balance Due</span><span>${fmtMoney(invoice.due_amount)}</span></div>
    </div>

    ${invoice.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</div>` : ''}
    ${invoice.terms ? `<div class="notes"><strong>Terms:</strong> ${escapeHtml(invoice.terms)}</div>` : ''}

    <div class="footer">Generated by SAYPX Billing${business.website ? ' · ' + escapeHtml(business.website) : ''}</div>
  </body>
  </html>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Renders each template element's real, live content at its saved position -
// unlike a hardcoded-demo-content editor, every binding reads the actual
// invoice/business data being rendered.
function bindingContent(binding, invoice, business, el) {
  // Custom-calibrated bindings below use absolute px offsets (to align with
  // pre-printed background lines/labels), so they don't inherit CSS line-height
  // the way plain stacked text does - this ratio scales every offset/height
  // together so the Line Spacing control still does something real, while
  // reproducing today's exact calibrated pixels at the 1.4 default.
  const lhRatio = (el && el.lineHeight ? el.lineHeight : 1.4) / 1.4;
  switch (binding) {
    case 'logo_text':
      return `<div style="font-size:1.6em;font-weight:800;">SAYPX <span style="color:#ff5722">BILLING</span></div>`;
    case 'business_info':
      return `<div>
        <strong>${escapeHtml(business.business_name || '')}</strong><br>
        ${escapeHtml(business.address || '')}<br>
        ${business.phone ? escapeHtml(business.phone) + ' · ' : ''}${escapeHtml(business.email || '')}
      </div>`;
    case 'invoice_meta':
      return `<div style="text-align:right">
        <div style="font-size:1.3em;font-weight:700;">INVOICE</div>
        <div>${escapeHtml(invoice.invoice_number)}</div>
        <div>Date: ${fmtDate(invoice.invoice_date)}</div>
        <div>Due: ${fmtDate(invoice.due_date)}</div>
        <div style="margin-top:4px"><span class="status ${invoice.display_status}">${invoice.display_status}</span></div>
      </div>`;
    case 'client_block':
      return `<div>
        <div style="font-size:0.7em;text-transform:uppercase;color:#888;margin-bottom:4px;">Bill To</div>
        <strong>${escapeHtml(invoice.client_name)}</strong><br>
        ${invoice.client_address ? escapeHtml(invoice.client_address) + '<br>' : ''}
        ${invoice.client_phone ? escapeHtml(invoice.client_phone) + '<br>' : ''}
        ${invoice.client_email ? escapeHtml(invoice.client_email) : ''}
      </div>`;
    case 'items_table': {
      const rows = invoice.items
        .map(
          (it) => `<tr>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;">${escapeHtml(it.description)}</td>
            <td class="num" style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">${fmtMoney(it.rate)}</td>
            <td class="num" style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">${it.quantity}${it.unit ? ' ' + escapeHtml(it.unit) : ''}</td>
            <td class="num" style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmtMoney(it.amount)}</td>
          </tr>`
        )
        .join('');
      return `<table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#262626;">
          <th style="text-align:left;color:#fff;font-weight:700;padding:12px;">Item name</th>
          <th style="text-align:right;color:#fff;font-weight:700;padding:12px;">Price</th>
          <th style="text-align:right;color:#fff;font-weight:700;padding:12px;">Qty/Link</th>
          <th style="text-align:right;color:#fff;font-weight:700;padding:12px;">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    }
    case 'totals_block':
      return `<div style="width:100%;">
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Subtotal</span><span>${fmtMoney(invoice.subtotal)}</span></div>
        ${invoice.discount ? `<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Discount</span><span>-${fmtMoney(invoice.discount)}</span></div>` : ''}
        ${invoice.tax ? `<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Tax</span><span>${fmtMoney(invoice.tax)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1.15em;border-top:2px solid #1a1a1a;padding-top:4px;margin-top:2px;"><span>Total</span><span>${fmtMoney(invoice.total_amount)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Received</span><span>${fmtMoney(invoice.received_amount)}</span></div>
        <div style="display:flex;justify-content:space-between;color:#d32f2f;font-weight:700;padding:2px 0;"><span>Balance Due</span><span>${fmtMoney(invoice.due_amount)}</span></div>
      </div>`;
    case 'notes':
      return invoice.notes ? `<div><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</div>` : '';
    case 'terms':
      return invoice.terms ? `<div><strong>Terms:</strong> ${escapeHtml(invoice.terms)}</div>` : '';
    case 'invoice_meta_list':
      return `<table style="border-collapse:collapse;">
        <tr><td style="padding:3px 14px 3px 0;font-weight:700;white-space:nowrap;">Invoice Number</td><td style="padding:3px 0;">:</td><td style="padding:3px 0 3px 10px;">${escapeHtml(invoice.invoice_number)}</td></tr>
        <tr><td style="padding:3px 14px 3px 0;font-weight:700;white-space:nowrap;">Customer Name</td><td style="padding:3px 0;">:</td><td style="padding:3px 0 3px 10px;">${escapeHtml(invoice.client_name)}</td></tr>
        <tr><td style="padding:3px 14px 3px 0;font-weight:700;white-space:nowrap;">Address</td><td style="padding:3px 0;">:</td><td style="padding:3px 0 3px 10px;">${escapeHtml(invoice.client_address || '')}</td></tr>
        <tr><td style="padding:3px 14px 3px 0;font-weight:700;white-space:nowrap;">Date</td><td style="padding:3px 0;">:</td><td style="padding:3px 0 3px 10px;">${fmtDate(invoice.invoice_date)}</td></tr>
      </table>`;
    case 'totals_simple':
      return `<div style="width:100%;">
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #999;"><span>Advance / Received</span><span>${fmtMoney(invoice.received_amount)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #999;font-weight:700;font-size:1.1em;"><span>Grand Total</span><span>${fmtMoney(invoice.total_amount)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:7px 0 0;color:#8b0000;font-weight:800;font-size:1.25em;"><span>DUE</span><span>${fmtMoney(invoice.due_amount)}</span></div>
      </div>`;
    case 'work_for': {
      if (!invoice.event_date && !invoice.event_location) return '';
      let dateHtml = '';
      if (invoice.event_date) {
        const d = new Date(invoice.event_date);
        const day = d.getDate();
        const month = d.toLocaleDateString('en-IN', { month: 'long' }).toUpperCase();
        dateHtml = `<div style="color:#8b0000;font-weight:800;font-size:1.35em;line-height:1.3;">${day}<sup style="font-size:0.55em;">${ordinalSuffix(day)}</sup>&nbsp;${month}&nbsp;${d.getFullYear()}</div>`;
      }
      return `<div>
        <div style="color:#8b0000;font-weight:800;font-size:1.1em;letter-spacing:0.03em;">WORK FOR</div>
        ${dateHtml}
        ${invoice.event_location ? `<div style="font-weight:700;color:#2b2b2b;margin-top:2px;">${escapeHtml(invoice.event_location)}</div>` : ''}
      </div>`;
    }
    case 'invoice_meta_values': {
      // Values only, no labels — meant to sit directly beside pre-printed
      // "Invoice Number :" / "Customer Name :" / "Address :" / "Date :" labels
      // baked into a background image. Row height scales with lineHeight so
      // the Line Spacing control does something real (1.4 default = 23px).
      const rowH = Math.round(23 * lhRatio);
      const rowStyle = `height:${rowH}px;line-height:${rowH}px;`;
      return `<div>
        <div style="${rowStyle}">${escapeHtml(invoice.invoice_number)}</div>
        <div style="${rowStyle}">${escapeHtml(invoice.client_name)}</div>
        <div style="${rowStyle}">${escapeHtml(invoice.client_address || '')}</div>
        <div style="${rowStyle}">${fmtDate(invoice.invoice_date)}</div>
      </div>`;
    }
    case 'items_rows_only': {
      // Body rows only, no header row — meant to sit below a pre-printed
      // dark table-header bar baked into a background image. Column widths
      // are calibrated to the bar's "Item name / Price / Qty-Link / Total" positions.
      // Vertical padding scales with lineHeight.
      const padV = Math.round(9 * lhRatio);
      const rows = invoice.items
        .map(
          (it) => `<tr>
            <td style="width:330px;padding:${padV}px 4px ${padV}px 32px;text-align:left;">${escapeHtml(it.description)}</td>
            <td style="width:100px;padding:${padV}px 8px ${padV}px 4px;text-align:right;">${fmtMoney(it.rate)}</td>
            <td style="width:115px;padding:${padV}px 8px ${padV}px 4px;text-align:right;">${it.quantity}${it.unit ? ' ' + escapeHtml(it.unit) : ''}</td>
            <td style="width:117px;padding:${padV}px 8px ${padV}px 4px;text-align:right;font-weight:600;">${fmtMoney(it.amount)}</td>
          </tr>`
        )
        .join('');
      return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;"><tbody>${rows}</tbody></table>`;
    }
    case 'totals_values_only': {
      // Values only, right-aligned to sit level with the pre-printed
      // "Advance/Recived" / "Grand Total" / "DUE" caption rows (not the
      // rule lines above them — the gap between a label and the next rule
      // is too tight to float a value there without colliding with it).
      // Every offset/height scales together with lineHeight so the block
      // stretches/compresses as one unit instead of drifting out of shape.
      const top1 = 0;
      const h1 = Math.round(27 * lhRatio);
      const top2 = Math.round(48 * lhRatio);
      const h2 = Math.round(27 * lhRatio);
      const top3 = Math.round(98 * lhRatio);
      const h3 = Math.round(37 * lhRatio);
      return `<div style="position:relative;height:100%;">
        <div style="position:absolute;top:${top1}px;right:0;height:${h1}px;display:flex;align-items:center;">${fmtMoney(invoice.received_amount)}</div>
        <div style="position:absolute;top:${top2}px;right:0;height:${h2}px;display:flex;align-items:center;font-weight:700;">${fmtMoney(invoice.total_amount)}</div>
        <div style="position:absolute;top:${top3}px;right:0;height:${h3}px;display:flex;align-items:center;color:#8b0000;font-weight:800;">${fmtMoney(invoice.due_amount)}</div>
      </div>`;
    }
    case 'website_line':
      return business.website ? `<div>&#127760;&nbsp;&nbsp;${escapeHtml(business.website)}</div>` : '';
    case 'contact_footer':
      return `<div style="font-size:0.95em;line-height:2;">
        ${business.email ? `<div>&#9993;&nbsp;&nbsp;${escapeHtml(business.email)}</div>` : ''}
        ${business.phone ? `<div>&#9742;&nbsp;&nbsp;${escapeHtml(business.phone)}</div>` : ''}
        ${business.address ? `<div>&#128205;&nbsp;&nbsp;${escapeHtml(business.address)}</div>` : ''}
      </div>`;
    default:
      return '';
  }
}

function templatedInvoiceHtml(invoice, business, template) {
  const bg = template.background_url
    ? `<img src="${template.background_url.startsWith('http') ? template.background_url : (process.env.PUBLIC_BASE_URL || 'http://localhost:' + (process.env.PORT || 4200)) + template.background_url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.9;">`
    : '';

  const elements = (template.elements || [])
    .filter((el) => !el.hidden)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    .map((el) => {
      const style = `position:absolute; left:${el.x}px; top:${el.y}px; width:${el.width}px; height:${el.height}px; transform:rotate(${el.rotation || 0}deg); font-size:${el.fontSize || 13}px; font-weight:${el.fontWeight || 'normal'}; line-height:${el.lineHeight || 1.4}; color:${el.color || '#1a1a1a'}; text-align:${el.align || 'left'};`;
      const content =
        el.type === 'custom_text'
          ? escapeHtml(el.text || '')
          : bindingContent(el.binding, invoice, business, el);
      return `<div style="${style}">${content}</div>`;
    })
    .join('');

  return `<!doctype html>
  <html>
  <head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; }
    .page { position: relative; width: 794px; height: 1123px; overflow: hidden; }
    .num { text-align: right; }
    .status { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .status.paid { background: #e8f5e9; color: #2e7d32; }
    .status.partial { background: #fff8e1; color: #f57f17; }
    .status.unpaid, .status.overdue { background: #ffebee; color: #c62828; }
  </style>
  </head>
  <body>
    <div class="page">
      ${bg}
      ${elements}
    </div>
  </body>
  </html>`;
}

async function generateInvoicePdf(invoice, business, template) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const html =
      template && template.elements && template.elements.length > 0
        ? templatedInvoiceHtml(invoice, business || {}, template)
        : invoiceHtml(invoice, business || {});
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
    return buffer;
  } finally {
    await page.close();
  }
}

module.exports = { generateInvoicePdf, templatedInvoiceHtml };
