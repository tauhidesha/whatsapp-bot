const studioMetadata = require('../../ai/constants/studioMetadata.js');

module.exports = function generateInvoiceHTML(data) {
  const {
    documentType, customerName, motorDetails, items,
    finalTotal, amountPaid, paymentMethod, notes,
    recipientNumber, bookingDate, docNumber, now, detectedSize,
    logoBase64, realPhone, subtotal: subtotalParam, discount,
    downPayment
  } = data;

  // Hitung values
  const discountAmount = Number(discount) || 0;
  // Subtotal adalah total sebelum diskon
  const subtotal = Number(subtotalParam) || (Number(finalTotal) + discountAmount);
  const dp = Number(downPayment) || 0;
  const totalPaid = Number(amountPaid) || 0;

  // Sisa Tagihan = (Subtotal - Diskon) - DP - Bayar Hari Ini
  const balance = Math.max(0, Math.round(subtotal - discountAmount - dp - totalPaid));

  // Clean recipient number - prefer realPhone (actual WA number) over @lid
  const displayPhone = realPhone
    ? realPhone.replace(/^62/, '0')
    : (recipientNumber || '-')
      .replace('@c.us', '')
      .replace('@lid', '')
      .replace(/^62/, '0');

  // Parse items jadi array - Split by newline ONLY
  const itemsList = (items || '').split('\n').map(i => i.trim()).filter(Boolean);

  // Filter redundant notes
  let filteredNotes = notes || '-';
  if (filteredNotes && filteredNotes !== '-' && filteredNotes.match(/^Layanan:\s*/i)) {
    const headerRemoved = filteredNotes.replace(/^Layanan:\s*/i, '').trim();
    const itemsSummary = itemsList.map(i => i.split('||')[0].trim()).join(', ');
    if (headerRemoved === itemsSummary) {
      filteredNotes = '';
    } else {
      filteredNotes = headerRemoved;
    }
  }

  const notesList = (filteredNotes && filteredNotes !== '-')
    ? filteredNotes.split('\n')
      .map(n => n.trim())
      .filter(n => n
        && !n.match(/^Layanan:?$/i)
        && !n.includes('||')              // filter raw item strings
        && !n.match(/^[●•\-*]\s*.+\|\|/) // filter bullet + item format
      )
    : [];

  return `<!DOCTYPE html>
<html class="dark">
<head>
  <meta charset="utf-8"/>
  <link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@100..900&family=Manrope:wght@200..800&display=swap" rel="stylesheet"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { margin: 0; size: A4; }
    html { background: #131313; -webkit-print-color-adjust: exact; }
    body {
      background: #131313;
      color: #e5e2e1;
      font-family: 'Manrope', sans-serif;
      padding: 0;
      width: 794px; /* A4 width in px at 96dpi */
      margin: 0 auto;
      -webkit-print-color-adjust: exact;
    }
    .page-wrap {
      padding: 40px;
      background: #131313;
    }
    .margin-top, .margin-bottom {
      height: 40px;
      background: #131313;
    }
    
    .font-headline { font-family: 'League Spartan', sans-serif; }
    .text-yellow { color: #FFFF00; }
    .bg-dark { background: #1c1b1b; }
    .bg-darker { background: #0e0e0e; }
    .text-muted { color: #cac8aa; }
    .border-yellow { border-left: 2px solid #FFFF00; }
    
    .items-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .items-table thead { display: table-header-group; }
    
    .item-row td {
      padding: 28px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      vertical-align: middle;
    }
    .item-row:last-child td { border-bottom: none; }
    
    .totals-section {
      page-break-inside: avoid;
    }
    
    @media print {
      body { background: #131313; }
    }
  </style>
</head>
<body>
  <table style="width:100%; border-collapse:collapse; background:#131313;">
    <thead><tr><td class="margin-top"></td></tr></thead>
    <tbody><tr><td style="padding: 0 40px; background:#131313;">

    <!-- Header -->
    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:60px">
      <div>
        <h1 class="font-headline" style="font-size:48px; font-weight:900; line-height:0.8; text-transform:uppercase; margin-bottom:16px">
          ${documentType === 'tanda_terima' ? 'Receipt' : documentType === 'bukti_bayar' ? 'Payment' : 'Invoice'}<br/>
          <span class="text-yellow">Repaint &<br/>Detailing</span>
        </h1>
        <div style="display:flex; gap:12px; margin-top:16px">
          <span style="background:#676700; color:#e6e67a; padding:4px 12px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em">
            Status: ${(totalPaid) >= (subtotal - discountAmount) ? 'Lunas' : (totalPaid) > 0 ? 'DP' : 'Belum Bayar'}
          </span>
        </div>
      </div>
      <div style="text-align:right">
        <img src="${logoBase64}" style="height:60px; margin-bottom:24px"/>
        <div>
          <p class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em">Nomor Dokumen</p>
          <p class="font-headline text-yellow" style="font-size:28px; font-weight:700">#BS-${docNumber || 'PREVIEW'}</p>
        </div>
        <div style="margin-top:16px">
          <p class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em">Tanggal Terbit</p>
          <p style="font-size:16px; font-weight:500">${now instanceof Date ? now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : (new Date()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>
    </div>

    <!-- Info Section -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1px; background:#484831; margin-bottom:60px">
      <div class="bg-dark" style="padding:28px">
        <p class="text-yellow" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; margin-bottom:20px">Informasi Pelanggan</p>
        <p class="font-headline" style="font-size:24px; font-weight:700; text-transform:uppercase; margin-bottom:8px">${customerName || '-'}</p>
        <p class="text-muted" style="font-size:14px; line-height:1.8">
          WhatsApp: ${displayPhone}<br/>
          Kendaraan: ${motorDetails || '-'}
        </p>
      </div>
      <div class="bg-dark" style="padding:28px">
        <p class="text-yellow" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; margin-bottom:20px">Studio Layanan</p>
        <p class="font-headline" style="font-size:24px; font-weight:700; text-transform:uppercase; margin-bottom:8px">${studioMetadata.name.toUpperCase()}</p>
        <p class="text-muted" style="font-size:14px; line-height:1.8">
          ${studioMetadata.location.address}<br/>
          WA: ${studioMetadata.contact.phone}
        </p>
      </div>
    </div>

    <!-- Status Banner Message -->
    <div style="margin-bottom:40px; padding:24px; background:rgba(255,255,0,0.03); border:1px solid rgba(255,255,0,0.15); display:flex; align-items:flex-start; gap:16px;">
      <div style="background:#FFFF00; padding:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        ${documentType === 'tanda_terima'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
      : documentType === 'bukti_bayar'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    }
      </div>
      <div>
        <p style="font-size:14px; font-weight:800; color:#FFFF00; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px;">
          ${documentType === 'tanda_terima' ? 'KENDARAAN DITERIMA' : documentType === 'bukti_bayar' ? 'PEMBAYARAN DIVALIDASI' : 'RINGKASAN ESTIMASI'}
        </p>
        <p style="font-size:13px; color:#cac8aa; line-height:1.6; margin:0; font-weight:400;">
          ${documentType === 'tanda_terima'
      ? `Halo! Unit kendaraan <b>${motorDetails || '-'}</b> telah kami terima dengan aman di Studio untuk proses treatment. Terima kasih telah mempercayakan kendaraan Anda kepada kami.`
      : documentType === 'bukti_bayar'
        ? `Terima kasih! Kami telah menerima pembayaran sebesar <b style="color:#FFFF00">Rp${(totalPaid || dp || 0).toLocaleString('id-ID')}</b> via <b>${paymentMethod || 'Transfer'}</b>. Status tagihan Anda telah diperbarui.`
        : `Berikut adalah rincian estimasi biaya untuk layanan Repaint & Detailing kendaraan Anda. Jika ada perubahan atau tambahan, akan kami informasikan kembali.`}
        </p>
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr style="border-bottom:1px solid #484831;">
          <th style="width:50%; text-align:left; padding-bottom:12px">
            <span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em">Deskripsi Layanan</span>
          </th>
          <th style="width:10%; text-align:center; padding-bottom:12px">
            <span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em">Jml</span>
          </th>
          <th style="width:20%; text-align:right; padding-bottom:12px">
            <span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em">Harga</span>
          </th>
          <th style="width:20%; text-align:right; padding-bottom:12px">
            <span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em">Total</span>
          </th>
        </tr>
      </thead>
      <tbody>
        ${itemsList.length > 0 ? itemsList.map(item => {
          const parts = item.split('||');
          const cleanTitle = (parts[0] || '').trim().replace(/^(\d+\.|[-*•●])\s*/, '');
          const price = parseInt(parts[1]) || 0;
          // Clean itemDesc: strip ALL leading "Warna:" / "Catatan Warna:" prefixes, keep only the color name
          const rawDesc = (parts[2] || '').trim();
          let itemDesc = rawDesc;
          if (rawDesc) {
            // Strip any combo of "Catatan Warna:" and "Warna:" prefixes (case-insensitive, repeated)
            const stripped = rawDesc.replace(/^(catatan\s+warna:\s*|warna:\s*)+/gi, '').trim();
            // Re-wrap with clean "Catatan Warna:" prefix if there was any color-related prefix
            if (stripped !== rawDesc || rawDesc.match(/^(catatan\s+warna:|warna:)/i)) {
              itemDesc = `Catatan Warna: ${stripped}`;
            }
          }
          const priceStr = price > 0 ? `Rp${price.toLocaleString('id-ID')}` : '-';

          return `
          <tr class="item-row" style="page-break-inside: avoid;">
            <td>
              <p class="font-headline" style="font-size:18px; font-weight:700; text-transform:uppercase">${cleanTitle}</p>
              ${itemDesc ? (
              itemDesc.startsWith('Catatan Warna:')
                ? `<div style="display:flex; align-items:center; gap:6px; margin-top:6px; padding:4px 10px; background:rgba(255,255,0,0.05); border-left:2px solid #FFFF00; width:fit-content">
                    <span style="font-size:10px; color:#FFFF00; font-weight:800; text-transform:uppercase; letter-spacing:0.1em">🎨 ${itemDesc}</span>
                   </div>`
                : `<p class="text-muted" style="font-size:12px; line-height:1.4; margin-top:4px">${itemDesc}</p>`
            ) : ''}
            </td>
            <td style="text-align:center"><p class="font-headline" style="font-size:18px; font-weight:700">01</p></td>
            <td style="text-align:right"><p class="text-muted" style="font-size:14px">${priceStr}</p></td>
            <td style="text-align:right"><p class="font-headline text-yellow" style="font-size:18px; font-weight:700">${priceStr}</p></td>
          </tr>`;
        }).join('') : '<tr><td colspan="4" style="text-align:center; padding:40px; color:#666;">Belum ada layanan ditambahkan</td></tr>'}
      </tbody>
    </table>

    <div class="totals-section" style="display:grid; grid-template-columns:7fr 5fr; gap:32px; margin-top:40px">
      <div>
        ${notesList.length > 0 ? `
        <div class="bg-darker border-yellow" style="padding:32px; margin-bottom:24px">
          <p class="font-headline" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.15em; margin-bottom:16px">Catatan Teknis Layanan</p>
          <div style="display:flex; flex-direction:column; gap:8px">
            ${notesList.map(n => {
          let icon = '●';
          if (n.toLowerCase().includes('garansi')) icon = '✓';
          else if (n.toLowerCase().match(/waktu|jam|hari/)) icon = '⏱';
          return `<div style="display:flex; gap:10px; align-items:flex-start"><span style="color:#FFFF00; font-size:14px; margin-top:2px">${icon}</span><p class="text-muted" style="font-size:14px; line-height:1.5">${n}</p></div>`;
        }).join('')}
          </div>
        </div>` : ''}

        <div style="padding:24px; border:1px solid #484831; background:#1c1b1b">
          <p class="text-yellow" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.15em; margin-bottom:16px">Informasi Pembayaran</p>
          <div style="display:flex; align-items:center; gap:16px">
            <div style="background:rgba(255,255,255,0.05); padding:12px; display:flex; align-items:center; justify-content:center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 21H21M3 10H21M5 6L12 3L19 6M4 10V21M8 10V21M12 10V21M16 10V21M20 10V21" stroke="#FFFF00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div>
              <p class="font-headline" style="font-size:18px; font-weight:700; text-transform:uppercase">Blu BCA Digital: 0901 1180 1695</p>
              <p class="text-muted" style="font-size:13px; text-transform:uppercase">A/N Muhammad Tauhid Haryadesa</p>
            </div>
          </div>
        </div>
      </div>

      <div style="background:#2a2a2a; padding:40px; display:flex; flex-direction:column; gap:20px">
        <div style="display:flex; justify-content:space-between">
          <span class="text-muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.1em">Subtotal</span>
          <span style="font-size:16px">Rp${subtotal.toLocaleString('id-ID')}</span>
        </div>
        ${discountAmount > 0 ? `
        <div style="display:flex; justify-content:space-between">
          <span class="text-muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.1em">Diskon</span>
          <span style="font-size:16px; color:#ffb4ab">- Rp${discountAmount.toLocaleString('id-ID')}</span>
        </div>` : ''}
        ${dp > 0 ? `
        <div style="display:flex; justify-content:space-between">
          <span class="text-muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.1em">Down Payment (DP)</span>
          <span style="font-size:16px; color:#ffb4ab">- Rp${dp.toLocaleString('id-ID')}</span>
        </div>` : ''}
        ${totalPaid > 0 ? `
        <div style="display:flex; justify-content:space-between">
          <span class="text-muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.1em">${documentType === 'bukti_bayar' ? 'Bayar Hari Ini' : 'Total Bayar'}</span>
          <span style="font-size:16px; color:#85ff7a">Rp${totalPaid.toLocaleString('id-ID')}</span>
        </div>` : ''}
        
        <div style="border-top:1px solid #484831; padding-top:24px; margin-top:8px">
          <span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em; display:block; margin-bottom:8px">Total Keseluruhan</span>
          <span class="font-headline" style="font-size:36px; font-weight:900">Rp${(subtotal - discountAmount).toLocaleString('id-ID')}</span>
        </div>

        <div style="background:#FFFF00; padding:20px 24px; margin:0 -40px -40px; display:flex; justify-content:space-between; align-items:center">
          <div>
            <span style="color:#1d1d00; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; display:block; margin-bottom:4px">Sisa Tagihan</span>
            <span class="font-headline" style="color:#1d1d00; font-size:44px; font-weight:900">Rp${balance.toLocaleString('id-ID')}</span>
          </div>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="#1d1d00" stroke-width="2"/><path d="M2 10H22" stroke="#1d1d00" stroke-width="2"/><path d="M6 15H10" stroke="#1d1d00" stroke-width="2" stroke-linecap="round"/></svg>
        </div>
      </div>
    </div>
      </td></tr></tbody>
    <tfoot><tr><td class="margin-bottom"></td></tr></tfoot>
  </table>
</body>
</html>`;
};