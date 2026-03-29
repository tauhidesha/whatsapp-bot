// File: src/data/templates/warrantyTemplate.js
// Redesigned warranty card HTML template for Puppeteer PDF generation
// Design system: dark #0e0e0e, accent #FFFF00, League Spartan, industrial/brutalist

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}

function formatDateShort(date) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function generateWarrantyHTML({
  type = 'repaint',
  customerName = 'Pelanggan',
  customerPhone = '-',
  motorDetails = '-',
  plateNumber = '-',
  serviceType = '-',
  bookingDate,
  docNumber = '0001',
  logoBase64 = '',
}) {
  const issueDate = bookingDate ? new Date(bookingDate) : new Date();
  const expiryDate = addMonths(issueDate, 12);
  const isCoating = type === 'coating';

  // Parse serviceType (§ atau , separated)
  const services = serviceType
    .split(/§|,/)
    .map(s => s.trim())
    .filter(Boolean);

  // Maintenance schedule untuk coating
  const maintenanceSchedule = isCoating ? [
    { label: 'Maintenance 1', date: addMonths(issueDate, 3), done: false },
    { label: 'Maintenance 2', date: addMonths(issueDate, 6), done: false },
    { label: 'Maintenance 3', date: addMonths(issueDate, 9), done: false },
    { label: 'Maintenance 4', date: addMonths(issueDate, 12), done: false },
  ] : [];

  const certNumber = `BSMT/${isCoating ? 'CTG' : 'RPT'}/${issueDate.getFullYear().toString().slice(2)}/${docNumber.toString().padStart(4, '0')}`;

  const logoSrc = logoBase64
    ? `data:image/png;base64,${logoBase64}`
    : '';

  // ─── WARRANTY TERMS ───
  const repaintTerms = [
    { title: 'CAKUPAN GARANSI', items: ['Cat mengelupas atau melepuh dengan sendirinya', 'Retak rambut bukan karena benturan', 'Pernis menguning tidak wajar dalam pemakaian normal'] },
    { title: 'TIDAK BERLAKU JIKA', items: ['Goresan/benturan/kecelakaan', 'Paparan bahan kimia korosif (minyak rem, thinner)', 'Diperbaiki oleh bengkel lain', 'Bencana alam'] },
    { title: 'PROSEDUR KLAIM', items: ['Hubungi kami setelah menemukan kerusakan', 'Bawa kendaraan + nota pembayaran asli', 'Tim teknisi melakukan inspeksi fisik', 'Perbaikan dijadwalkan jika klaim disetujui'] },
  ];

  const coatingTerms = [
    { title: 'CAKUPAN GARANSI', items: ['Coating retak/terkelupas akibat cacat produk', 'Hilangnya efek hydrophobic sebelum garansi habis (dengan riwayat maintenance rutin)'] },
    { title: 'KEWAJIBAN MAINTENANCE', items: ['Wajib maintenance setiap 3 bulan di Bosmat Studio', 'Toleransi keterlambatan: 7 hari', 'Garansi hangus otomatis jika melewati jadwal'] },
    { title: 'TIDAK BERLAKU JIKA', items: ['Kerusakan akibat benturan/goresan', 'Water spot karena air dibiarkan mengering', 'Dicuci dengan sabun tidak pH-netral', 'Dicoating ulang oleh pihak lain'] },
  ];

  const terms = isCoating ? coatingTerms : repaintTerms;

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;700;800;900&family=Manrope:wght@400;500;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg:       #0e0e0e;
    --surface:  #1a1a1a;
    --elevated: #242424;
    --accent:   #FFFF00;
    --accent-dim: rgba(255,255,0,0.08);
    --accent-border: rgba(255,255,0,0.2);
    --text:     #ffffff;
    --muted:    rgba(255,255,255,0.4);
    --border:   rgba(255,255,255,0.06);
  }

  html, body {
    width: 210mm;
    background: var(--bg);
    color: var(--text);
    font-family: 'Manrope', sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 12mm 14mm 16mm;
    position: relative;
    background: var(--bg);
    overflow: hidden;
  }

  /* ── DECORATIVE BG ── */
  .page::before {
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 300px; height: 300px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,0,0.04) 0%, transparent 70%);
    pointer-events: none;
  }

  .accent-bar-right {
    position: absolute;
    top: 0; right: 0;
    width: 4px; height: 100%;
    background: var(--accent);
  }

  .accent-bar-bottom {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 3px;
    background: var(--accent);
  }

  /* ── HEADER ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10mm;
    padding-bottom: 6mm;
    border-bottom: 1px solid var(--border);
  }

  .header-left { display: flex; flex-direction: column; gap: 6px; }

  .header { margin-top: 36px; }

  .logo {
    height: 36px;
    width: auto;
    object-fit: contain;
    filter: brightness(1.1);
    position: absolute;
    top: 12mm;
    left: 14mm;
  }

  .doc-title {
    font-family: 'League Spartan', sans-serif;
    font-size: 28px;
    font-weight: 900;
    color: var(--accent);
    letter-spacing: -1px;
    text-transform: uppercase;
    line-height: 1;
    margin-top: 8px;
  }

  .doc-subtitle {
    font-family: 'League Spartan', sans-serif;
    font-size: 9px;
    font-weight: 700;
    color: var(--muted);
    letter-spacing: 3px;
    text-transform: uppercase;
  }

  .header-right { text-align: right; }

  .cert-label {
    font-family: 'League Spartan', sans-serif;
    font-size: 8px;
    font-weight: 700;
    color: var(--muted);
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 3px;
  }

  .cert-number {
    font-family: 'League Spartan', sans-serif;
    font-size: 13px;
    font-weight: 800;
    color: var(--text);
    letter-spacing: 1px;
  }

  .validity-badge {
    margin-top: 8px;
    display: inline-block;
    background: var(--accent-dim);
    border: 1px solid var(--accent-border);
    padding: 4px 10px;
    font-family: 'League Spartan', sans-serif;
    font-size: 9px;
    font-weight: 800;
    color: var(--accent);
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  /* ── SECTION LABEL ── */
  .section-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .section-label::before {
    content: '';
    display: block;
    width: 16px;
    height: 2px;
    background: var(--accent);
    flex-shrink: 0;
  }

  .section-label span {
    font-family: 'League Spartan', sans-serif;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* ── INFO GRID ── */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6mm 8mm;
    margin-bottom: 8mm;
  }

  .info-item label {
    display: block;
    font-family: 'League Spartan', sans-serif;
    font-size: 7px;
    font-weight: 800;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 4px;
  }

  .info-item .value {
    font-family: 'League Spartan', sans-serif;
    font-size: 13px;
    font-weight: 800;
    color: var(--text);
    border-bottom: 1px solid var(--border);
    padding-bottom: 4px;
    line-height: 1.2;
  }

  .info-item .value.accent { color: var(--accent); }

  /* ── SERVICES BOX ── */
  .services-box {
    background: var(--accent-dim);
    border: 1px solid var(--accent-border);
    border-left: 3px solid var(--accent);
    padding: 5mm 6mm;
    margin-bottom: 8mm;
  }

  .services-box .service-tag {
    font-family: 'League Spartan', sans-serif;
    font-size: 11px;
    font-weight: 900;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1.6;
  }

  /* ── DIVIDER ── */
  .divider {
    height: 1px;
    background: var(--border);
    margin: 6mm 0;
  }

  /* ── TERMS GRID ── */
  .terms-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4mm 8mm;
    margin-bottom: 8mm;
  }

  .term-block {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 4mm 5mm;
  }

  .term-block h4 {
    font-family: 'League Spartan', sans-serif;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 6px;
  }

  .term-block ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .term-block ul li {
    font-size: 8.5px;
    color: rgba(255,255,255,0.7);
    line-height: 1.4;
    padding-left: 10px;
    position: relative;
  }

  .term-block ul li::before {
    content: '—';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-size: 7px;
  }

  /* ── MAINTENANCE TABLE (coating only) ── */
  .maintenance-section {
    margin-bottom: 8mm;
  }

  .maintenance-table {
    width: 100%;
    border-collapse: collapse;
  }

  .maintenance-table th {
    font-family: 'League Spartan', sans-serif;
    font-size: 7px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted);
    text-align: left;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
  }

  .maintenance-table td {
    font-family: 'Manrope', sans-serif;
    font-size: 9px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }

  .maintenance-table td.date-col {
    font-family: 'League Spartan', sans-serif;
    font-weight: 700;
  }

  .stamp-box {
    width: 60px;
    height: 24px;
    border: 1px dashed rgba(255,255,255,0.15);
    display: inline-block;
  }

  /* ── FOOTER ── */
  .footer {
    background: var(--accent);
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 4mm 14mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-text {
    font-family: 'League Spartan', sans-serif;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #000;
  }

  .footer-dates {
    font-family: 'League Spartan', sans-serif;
    font-size: 8px;
    font-weight: 700;
    color: rgba(0,0,0,0.6);
    letter-spacing: 1px;
    text-align: right;
  }

  /* ── SIGNATURE ── */
  .signature-row {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 8mm;
  }

  .signature-box {
    text-align: center;
    width: 120px;
  }

  .signature-line {
    height: 1px;
    background: var(--border);
    margin-bottom: 4px;
    margin-top: 20px;
  }

  .signature-name {
    font-family: 'League Spartan', sans-serif;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* ── WATERMARK ── */
  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-family: 'League Spartan', sans-serif;
    font-size: 72px;
    font-weight: 900;
    color: rgba(255,255,0,0.025);
    letter-spacing: -2px;
    text-transform: uppercase;
    pointer-events: none;
    white-space: nowrap;
  }
</style>
</head>
<body>
<div class="page">
  <div class="accent-bar-right"></div>
  <div class="watermark">BOSMAT</div>

  <!-- HEADER -->
  ${logoSrc ? `<img src="${logoSrc}" class="logo" alt="Bosmat Studio"/>` : ''}
  <div class="header">
    <div class="header-left">
      <div class="doc-title">${isCoating ? 'GARANSI COATING' : 'GARANSI REPAINT'}</div>
      <div class="doc-subtitle">Premium Automotive Finish · Bosmat Studio</div>
    </div>
    <div class="header-right">
      <div class="cert-label">No. Sertifikat</div>
      <div class="cert-number">${certNumber}</div>
      <div class="validity-badge">Berlaku s/d ${formatDateShort(expiryDate)}</div>
    </div>
  </div>

  <!-- CUSTOMER INFO -->
  <div class="section-label"><span>Informasi Pelanggan</span></div>
  <div class="info-grid">
    <div class="info-item">
      <label>Nama Pelanggan</label>
      <div class="value">${customerName}</div>
    </div>
    <div class="info-item">
      <label>Nomor WhatsApp</label>
      <div class="value">${customerPhone}</div>
    </div>
    <div class="info-item">
      <label>Kendaraan</label>
      <div class="value">${motorDetails}</div>
    </div>
    <div class="info-item">
      <label>Nomor Plat</label>
      <div class="value">${plateNumber}</div>
    </div>
  </div>

  <!-- SERVICE -->
  <div class="section-label"><span>Detail Layanan</span></div>
  <div class="services-box">
    ${services.map(s => `<div class="service-tag">↗ ${s}</div>`).join('')}
  </div>

  <!-- DATE ROW -->
  <div class="info-grid" style="margin-bottom: 6mm;">
    <div class="info-item">
      <label>Tanggal Terbit</label>
      <div class="value">${formatDate(issueDate)}</div>
    </div>
    <div class="info-item">
      <label>Masa Berlaku Garansi</label>
      <div class="value accent">${formatDate(expiryDate)}</div>
    </div>
  </div>

  <div class="divider"></div>

  <!-- MAINTENANCE TABLE (coating only) -->
  ${isCoating ? `
  <div class="maintenance-section">
    <div class="section-label"><span>Jadwal Maintenance Wajib</span></div>
    <table class="maintenance-table">
      <thead>
        <tr>
          <th>Jadwal</th>
          <th>Tanggal</th>
          <th>Toleransi s/d</th>
          <th>Biaya (S/M/L/XL)</th>
          <th style="width:80px;">Stempel</th>
        </tr>
      </thead>
      <tbody>
        ${maintenanceSchedule.map((m, i) => `
        <tr>
          <td class="date-col">${m.label}</td>
          <td>${formatDateShort(m.date)}</td>
          <td style="color:rgba(255,255,255,0.4)">${formatDateShort(addMonths(m.date, 0.23))}</td>
          <td style="font-size:8px;color:rgba(255,255,255,0.5)">100K / 125K / 150K / 300K</td>
          <td><div class="stamp-box"></div></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
  <div class="divider"></div>
  ` : ''}

  <!-- TERMS -->
  <div class="section-label"><span>Syarat & Ketentuan</span></div>
  <div class="terms-grid">
    ${terms.map(t => `
    <div class="term-block">
      <h4>${t.title}</h4>
      <ul>${t.items.map(i => `<li>${i}</li>`).join('')}</ul>
    </div>`).join('')}
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-text">Bosmat Studio · Precision & Passion</div>
    <div class="footer-dates">
      Terbit: ${formatDateShort(issueDate)} &nbsp;·&nbsp; Expire: ${formatDateShort(expiryDate)}
    </div>
  </div>
</div>
</body>
</html>`;
}

module.exports = { generateWarrantyHTML };
