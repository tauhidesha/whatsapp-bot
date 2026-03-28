// File: src/data/templates/invoiceTemplate.js
// Export function yang return HTML string
module.exports = function generateInvoiceHTML(data) {
  const {
    documentType, customerName, motorDetails, items,
    finalTotal, amountPaid, paymentMethod, notes,
    recipientNumber, bookingDate, docNumber, now, detectedSize
  } = data;

  // Hitung values
  const paid = amountPaid || 0;
  const balance = finalTotal - paid;
  const subtotal = finalTotal;

  // Parse items jadi array
  const itemsList = items.split(/\n|,\s*/).map(i => i.trim()).filter(Boolean);

  return `<!DOCTYPE html>
<html class="dark">
<head>
  <meta charset="utf-8"/>
  <link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@100..900&family=Manrope:wght@200..800&display=swap" rel="stylesheet"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #131313;
      color: #e5e2e1;
      font-family: 'Manrope', sans-serif;
      padding: 60px;
      width: 900px;
      margin: 0 auto;
    }
    .font-headline { font-family: 'League Spartan', sans-serif; }
    .text-yellow { color: #FFFF00; }
    .bg-yellow { background: #FFFF00; color: #1d1d00; }
    .bg-dark { background: #1c1b1b; }
    .bg-darker { background: #0e0e0e; }
    .text-muted { color: #cac8aa; }
    .border-yellow { border-left: 2px solid #FFFF00; }
    .item-row { display:grid; grid-template-columns:6fr 1fr 2fr 2fr; padding:28px 16px; border-bottom:1px solid rgba(255,255,255,0.05); align-items:center; }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:60px">
    <div>
      <h1 class="font-headline" style="font-size:72px; font-weight:900; line-height:0.85; text-transform:uppercase; margin-bottom:16px">
        ${documentType === 'tanda_terima' ? 'Receipt' : documentType === 'bukti_bayar' ? 'Payment' : 'Invoice'}<br/>
        <span class="text-yellow">Repaint &<br/>Detailing</span>
      </h1>
      <div style="display:flex; gap:12px; margin-top:16px">
        <span style="background:#676700; color:#e6e67a; padding:4px 12px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em">
          Status: ${paid >= finalTotal ? 'Lunas' : paid > 0 ? 'DP' : 'Belum Bayar'}
        </span>
      </div>
    </div>
    <div style="text-align:right">
      <img src="file://${process.cwd()}/data/boS Mat (1000 x 500 px) (1).png" style="height:60px; margin-bottom:24px"/>
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
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:1px; background:#484831; margin-bottom:60px">
    <div class="bg-dark" style="padding:40px">
      <p class="text-yellow" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; margin-bottom:20px">Informasi Pelanggan</p>
      <p class="font-headline" style="font-size:24px; font-weight:700; text-transform:uppercase; margin-bottom:8px">${customerName}</p>
      <p class="text-muted" style="font-size:14px; line-height:1.8">
        ${recipientNumber}<br/>
        Kendaraan: ${motorDetails}
      </p>
    </div>
    <div class="bg-dark" style="padding:40px">
      <p class="text-yellow" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; margin-bottom:20px">Studio Layanan</p>
      <p class="font-headline" style="font-size:24px; font-weight:700; text-transform:uppercase; margin-bottom:8px">BOSMAT STUDIO</p>
      <p class="text-muted" style="font-size:14px; line-height:1.8">
        Garasi 54, Jl. R. Sanim No. 99<br/>
        Beji, Depok, Jawa Barat 16456<br/>
        08179481010
      </p>
    </div>
  </div>

  <!-- Items Table Header -->
  <div style="display:grid; grid-template-columns:6fr 1fr 2fr 2fr; padding:0 16px 12px; border-bottom:1px solid #484831; margin-bottom:8px">
    <span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em">Deskripsi Layanan</span>
    <span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em; text-align:center">Jml</span>
    <span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em; text-align:right">Harga</span>
    <span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em; text-align:right">Total</span>
  </div>

  <!-- Items -->
  ${itemsList.map(item => {
    const lastColon = item.lastIndexOf(':');
    let desc = item, price = 0;
    if (lastColon > -1) {
      price = parseInt(item.substring(lastColon+1).replace(/[^\d]/g,'')) || 0;
      desc = item.substring(0, lastColon).trim();
    }
    const priceStr = price > 0 ? `Rp${price.toLocaleString('id-ID')}` : '-';
    // Clean desc for display
    const cleanDesc = desc.replace(/^(\d+\.|[-*•])\s*/, '').trim();

    return `
    <div class="item-row">
      <div>
        <p class="font-headline" style="font-size:18px; font-weight:700; text-transform:uppercase">${cleanDesc}</p>
      </div>
      <p class="font-headline" style="font-size:18px; font-weight:700; text-align:center">01</p>
      <p class="text-muted" style="font-size:14px; text-align:right">${priceStr}</p>
      <p class="font-headline text-yellow" style="font-size:18px; font-weight:700; text-align:right">${priceStr}</p>
    </div>`;
  }).join('')}

  <!-- Totals + Notes -->
  <div style="display:grid; grid-template-columns:7fr 5fr; gap:48px; margin-top:60px">
    <!-- Notes & Payment Info -->
    <div>
      ${notes && notes !== '-' ? `
      <div class="bg-darker border-yellow" style="padding:32px; margin-bottom:24px">
        <p class="font-headline" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.15em; margin-bottom:16px">Catatan</p>
        <p class="text-muted" style="font-size:14px; line-height:1.7">${notes}</p>
      </div>` : ''}
      <div style="padding:24px; border:1px solid #484831; background:#1c1b1b">
        <p class="text-yellow" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.15em; margin-bottom:12px">Informasi Pembayaran</p>
        <p class="font-headline" style="font-size:18px; font-weight:700; text-transform:uppercase">Bank BCA: 1662515412</p>
        <p class="text-muted" style="font-size:13px">A/N Muhammad Tauhid Haryadesa</p>
      </div>
    </div>

    <!-- Calculations -->
    <div style="background:#2a2a2a; padding:40px; display:flex; flex-direction:column; justify-content:space-between">
      <div style="display:flex; flex-direction:column; gap:20px">
        <div style="display:flex; justify-content:space-between">
          <span class="text-muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.1em">Subtotal</span>
          <span style="font-size:16px">Rp${subtotal.toLocaleString('id-ID')}</span>
        </div>
        ${paid > 0 ? `
        <div style="display:flex; justify-content:space-between">
          <span class="text-muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.1em">DP / Uang Muka</span>
          <span style="font-size:16px; color:#ffb4ab">- Rp${paid.toLocaleString('id-ID')}</span>
        </div>` : ''}
        <div style="display:flex; justify-content:space-between; padding-top:16px">
          <div>
            <span class="text-muted" style="font-size:10px; text-transform:uppercase; letter-spacing:0.2em; display:block; margin-bottom:8px">Total Keseluruhan</span>
            <span class="font-headline" style="font-size:36px; font-weight:900">Rp${subtotal.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>
      <div class="bg-yellow" style="padding:20px 24px; margin:0 -40px -40px; display:flex; justify-content:space-between; align-items:center">
        <div>
          <span style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; display:block; margin-bottom:4px">Sisa Tagihan</span>
          <span class="font-headline" style="font-size:44px; font-weight:900">Rp${balance.toLocaleString('id-ID')}</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
};
