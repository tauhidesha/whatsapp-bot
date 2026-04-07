const generateInvoiceHTML = require('./src/data/templates/invoiceTemplate.js');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function testGenerate() {
  const data = {
    documentType: 'bukti_bayar', // Menjadi Bukti Bayar
    customerName: 'Aldhy Hidayat',
    motorDetails: 'spacy (B 3531 EYF)',
    items: 'Repaint Bodi Halus (+Candy Colors)||925000||Warna: Merah Mazda\nRepaint Velg||350000||Warna: Silver\nRepaint Bodi Kasar||300000||\nRepaint Cover CVT / Arm||150000||Warna: Silver\nREPAINT 4 PANEL BODI KASAR KE GLOSSY (LACI, BATOK LAMPU, COVER SAMPING KIRI KANAN)||400000||\nREPAINT BOTTOM SHOCK DEPAN||150000||',
    totalAmount: 2047500, // finalTotal tetap 2.047.500
    amountPaid: 1000000,   // DP yang dibayar
    paymentMethod: 'Transfer BCA',
    notes: 'DP: Transfer BCA',
    docNumber: 'TEST-002-PAY',
    now: new Date(),
    logoBase64: '',
    realPhone: '0811885387',
    subtotal: 2275000,
    discount: 227500,
    downPayment: 1000000 
  };

  const html = generateInvoiceHTML(data);
  const outputPath = path.join(__dirname, 'test_invoice_payment.pdf');

  console.log('Generating PDF Payment (DP 1.000.000) for Aldhy Hidayat...');
  
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' }
  });

  await browser.close();
  console.log('PDF generated at:', outputPath);
}

testGenerate().catch(console.error);
