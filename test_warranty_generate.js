// test_warranty_generate.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { generateWarrantyHTML } = require('./src/data/templates/warrantyTemplate.js');

async function main() {
  // Logo
  const logoPath = path.resolve(process.cwd(), 'data/boS Mat (1000 x 500 px) (1).png');
  const logoBase64 = fs.existsSync(logoPath)
    ? fs.readFileSync(logoPath).toString('base64')
    : '';

  // Test Repaint
  const repaintHtml = generateWarrantyHTML({
    type: 'repaint',
    customerName: 'Tauhid',
    customerPhone: '0895401527556',
    motorDetails: 'NMax',
    plateNumber: 'B1234ETV',
    serviceType: 'Full Body Repaint',
    bookingDate: '2026-03-29',
    docNumber: '79',
    logoBase64,
  });

  // Test Coating
  const coatingHtml = generateWarrantyHTML({
    type: 'coating',
    customerName: 'Tauhid',
    customerPhone: '0895401527556',
    motorDetails: 'NMax',
    plateNumber: 'B1234ETV',
    serviceType: 'Nano Ceramic Coating § Detailing Glossy',
    bookingDate: '2026-03-29',
    docNumber: '80',
    logoBase64,
  });

  // Save HTML
  fs.writeFileSync('/Users/Babayasa/Downloads/test_warranty_repaint.html', repaintHtml);
  fs.writeFileSync('/Users/Babayasa/Downloads/test_warranty_coating.html', coatingHtml);
  console.log('HTML saved');

  // Generate PDFs
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const [name, html] of [['repaint', repaintHtml], ['coating', coatingHtml]]) {
    const pdfPath = `/Users/Babayasa/Downloads/test_warranty_${name}.pdf`;
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' }
    });
    console.log(`PDF saved: ${pdfPath}`);
  }

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
