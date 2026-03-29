// test_invoice_generate.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const generateInvoiceHTML = require('./src/data/templates/invoiceTemplate.js');

async function main() {
  // Logo
  const logoPath = path.resolve(process.cwd(), 'data/boS Mat (1000 x 500 px) (1).png');
  const logoBase64 = fs.existsSync(logoPath)
    ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
    : '';

  // Data from SQL
  const data = {
    documentType: 'invoice',
    customerName: 'Tauhid',
    motorDetails: 'NMax - B1234ETV',
    items: 'Repaint Bodi Halus\nFull Detailing Glossy',
    finalTotal: 1500000,
    amountPaid: 500000,
    paymentMethod: 'Transfer BCA',
    notes: 'Layanan: Repaint Bodi Halus, Full Detailing Glossy | DP: Transfer BCA',
    recipientNumber: '176665158225970',
    bookingDate: new Date('2026-03-29 03:00:00'),
    docNumber: '79',
    now: new Date(),
    detectedSize: null,
    logoBase64
  };

  const html = generateInvoiceHTML(data);

  // Save HTML for inspection
  const htmlPath = '/Users/Babayasa/Downloads/test_invoice.html';
  fs.writeFileSync(htmlPath, html);
  console.log('HTML saved to:', htmlPath);

  // Generate PDF
  const pdfPath = '/Users/Babayasa/Downloads/test_invoice.pdf';
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' }
  });
  await browser.close();

  console.log('PDF saved to:', pdfPath);
}

main().catch(err => { console.error(err); process.exit(1); });
