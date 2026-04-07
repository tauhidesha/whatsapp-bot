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
  const subtotal = Number(subtotalParam || finalTotal) || 0;
  const dp = Number(downPayment) || 0;
  const totalPaid = Number(amountPaid) || 0;
  const balance = Math.max(0, Math.round(subtotal - discountAmount - totalPaid));


  // Clean recipient number - prefer realPhone (actual WA number) over @lid
  const displayPhone = realPhone
    ? realPhone.replace(/^62/, '0')
    : (recipientNumber || '-')
        .replace('@c.us', '')
        .replace('@lid', '')
        .replace(/^62/, '0');

  // Parse items jadi array - Split by newline ONLY
  const itemsList = items.split('\n').map(i => i.trim()).filter(Boolean);

  // Filter redundant notes
  let filteredNotes = notes || '-';
  if (filteredNotes.match(/^Layanan:\s*/i)) {
    const headerRemoved = filteredNotes.replace(/^Layanan:\s*/i, '').trim();
    // Extract strictly the service names from the items list for comparison
    const itemsSummary = itemsList.map(i => i.split('||')[0].trim()).join(', ');
    
    // If the entire note content is just a repeat of the items, we can hide it
    if (headerRemoved === itemsSummary) {
      filteredNotes = '';
    } else {
      // Just strip the "Layanan:" prefix but keep the rest
      filteredNotes = headerRemoved;
    }
  }

  const notesList = (filteredNotes && filteredNotes !== '-') 
    ? filteredNotes.split('\n')
        .map(n => n.trim())
        .filter(n => n && !n.match(/^Layanan:?$/i)) // Also filter out standalone header labels
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
    .bg-yellow { background: #FFFF00; color: #1d1d00; }
    .bg-dark { background: #1c1b1b; }
    .bg-darker { background: #0e0e0e; }
    .text-muted { color: #cac8aa; }
    .border-yellow { border-left: 2px solid #FFFF00; }
    
    /* Table styling for better page breaks and margins */
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
      break-inside: avoid;
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
          ${documentType === 'tanda_terima' ? 'Receipt' : 
            documentType === 'bukti_bayar' ? 'Payment' : 
            documentType === 'garansi_repaint' ? 'Warranty' :
            documentType === 'garansi_coating' ? 'Warranty' :
            'Invoice'}<br/>
          <span class="text-yellow">
            ${documentType === 'garansi_repaint' ? 'Official<br/>Repaint' :
              documentType === 'garansi_coating' ? 'Official<br/>Coating' :
              'Repaint &<br/>Detailing'}
          </span>
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
          <p class="font-headline text-yellow" style="font-size:28px; font-weight:700">#BS-${docNumber}</p>
        </div>
        <div style="margin-top:16px">
          <p class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em">Tanggal Terbit</p>
          <p style="font-size:16px; font-weight:500">${now.toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</p>
        </div>
      </div>
    </div>

    <!-- Customer & Studio -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1px; background:#484831; margin-bottom:1px">
      <div class="bg-dark" style="padding:28px">
        <p class="text-yellow" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; margin-bottom:20px">Informasi Pelanggan</p>
        <p class="font-headline" style="font-size:24px; font-weight:700; text-transform:uppercase; margin-bottom:8px">${customerName}</p>
        <p class="text-muted" style="font-size:14px; line-height:1.8">
          WhatsApp: ${displayPhone}<br/>
          Kendaraan: ${motorDetails}
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
    <div style="background:rgba(255,255,255,0.03); border:1px solid #484831; border-top:none; padding:24px 28px; margin-bottom:60px; display:flex; align-items:center; gap:20px">
      <div style="background:#FFFF00; padding:12px; display:flex; align-items:center; justify-content:center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          ${documentType === 'tanda_terima' 
            ? '<path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#1d1d00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
            : documentType === 'bukti_bayar'
            ? '<path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#1d1d00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
            : '<path d="M13 16H12V12H11M12 8H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#1d1d00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
          }
        </svg>
      </div>
      <div>
        <p class="font-headline" style="font-size:16px; font-weight:700; text-transform:uppercase; margin-bottom:4px">
          ${documentType === 'tanda_terima' ? 'KENDARAAN DITERIMA' : documentType === 'bukti_bayar' ? 'PEMBAYARAN DIVALIDASI' : 'RINGKASAN ESTIMASI'}
        </p>
        <p class="text-muted" style="font-size:13px; line-height:1.6">
          ${documentType === 'tanda_terima' 
            ? `Halo! Unit kendaraan <b>${motorDetails || '-'}</b> telah kami terima dengan aman di Studio untuk proses treatment. Terima kasih telah mempercayakan kendaraan Anda kepada kami.` 
            : documentType === 'bukti_bayar'
            ? `Terima kasih! Kami telah menerima pembayaran sebesar <b>Rp${(totalPaid).toLocaleString('id-ID')}</b> via <b>${paymentMethod || 'Transfer'}</b>. Status tagihan Anda telah diperbarui.`
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
        ${itemsList.map(item => {
          const parts = item.split('||');
          const cleanTitle = (parts[0] || '').trim().replace(/^(\d+\.|[-*•])\s*/, '');
          const price = parseInt(parts[1]) || 0;
          const itemDesc = (parts[2] || '').trim();
          const priceStr = price > 0 ? `Rp${price.toLocaleString('id-ID')}` : '-';

          return `
          <tr class="item-row" style="page-break-inside: avoid; break-inside: avoid;">
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
            <td style="text-align:center">
              <p class="font-headline" style="font-size:18px; font-weight:700">01</p>
            </td>
            <td style="text-align:right">
              <p class="text-muted" style="font-size:14px">${priceStr}</p>
            </td>
            <td style="text-align:right">
              <p class="font-headline text-yellow" style="font-size:18px; font-weight:700">${priceStr}</p>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

  <!-- Totals + Notes -->
  <div class="totals-section" style="display:grid; grid-template-columns:7fr 5fr; gap:32px; margin-top:40px">
    <!-- Notes & Payment Info -->
    <div>
      <div style="padding:24px; border:1px solid #484831; background:#1c1b1b">
        <p class="text-yellow" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.15em; margin-bottom:16px">Informasi Pembayaran</p>
        <div style="display:flex; align-items:center; gap:16px">
          <!-- Icon box -->
          <div style="background:rgba(255,255,255,0.05); padding:12px; display:flex; align-items:center; justify-content:center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 21H21M3 10H21M5 6L12 3L19 6M4 10V21M8 10V21M12 10V21M16 10V21M20 10V21" stroke="#FFFF00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <p class="font-headline" style="font-size:18px; font-weight:700; text-transform:uppercase">Blu BCA Digital: 0901 1180 1695</p>
            <p class="text-muted" style="font-size:13px; text-transform:uppercase">A/N Muhammad Tauhid Haryadesa</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Calculations -->
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
      ${(totalPaid - dp) > 0 ? `
      <div style="display:flex; justify-content:space-between">
        <span class="text-muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.1em">Sudah Dibayar</span>
        <span style="font-size:16px; color:#ffb4ab">- Rp${(totalPaid - dp).toLocaleString('id-ID')}</span>
      </div>` : ''}

      <!-- Border separator -->
      <div style="border-top:1px solid #484831; padding-top:24px; margin-top:8px">
        <span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em; display:block; margin-bottom:8px">Total Keseluruhan</span>
        <span class="font-headline" style="font-size:36px; font-weight:900">Rp${finalTotal.toLocaleString('id-ID')}</span>
      </div>

      <!-- Sisa Tagihan kuning — full bleed -->
      <div style="background:#FFFF00; padding:20px 24px; margin:0 -40px -40px; display:flex; justify-content:space-between; align-items:center">
        <div>
          <span style="color:#1d1d00; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; display:block; margin-bottom:4px">Sisa Tagihan</span>
          <span class="font-headline" style="color:#1d1d00; font-size:44px; font-weight:900">Rp${balance.toLocaleString('id-ID')}</span>
        </div>
        <!-- Wallet icon unicode -->
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="5" width="20" height="14" rx="2" stroke="#1d1d00" stroke-width="2"/>
          <path d="M2 10H22" stroke="#1d1d00" stroke-width="2"/>
          <path d="M6 15H10" stroke="#1d1d00" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    </div>
    </div>
      </td></tr></tbody>
    <tfoot><tr><td class="margin-bottom"></td></tr></tfoot>
  </table>
</body>
</html>`;
};
