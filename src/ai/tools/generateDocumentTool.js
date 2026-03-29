// File: src/ai/tools/generateDocumentTool.js
const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { formatCurrency } = require('../utils/distanceMatrix.js');
const { getStudioInfoTool } = require('./getStudioInfoTool.js');
const { getServiceDetailsTool } = require('./getServiceDetailsTool.js');
const masterLayanan = require('../../data/masterLayanan.js');
const { isAdmin } = require('../utils/adminAuth.js');
const { warrantyRepaint, warrantyCoating } = require('../../data/warrantyTerms.js');
const generateInvoiceHTML = require('../../data/templates/invoiceTemplate.js');

// Helper untuk membuat garis horizontal
function generateHr(doc, y) {
  doc.strokeColor('#aaaaaa')
    .lineWidth(1)
    .moveTo(50, y)
    .lineTo(550, y)
    .stroke();
}

const generateDocumentTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'generateDocument',
      description: 'Buat PDF (tanda_terima/invoice/bukti_bayar) dan kirim ke customer. WAJIB isi recipientNumber dengan nomor customer.',
      parameters: {
        type: 'object',
        properties: {
          documentType: {
            type: 'string',
            enum: ['tanda_terima', 'invoice', 'bukti_bayar', 'garansi_repaint', 'garansi_coating'],
            description: 'Jenis dokumen: "tanda_terima" (motor masuk), "invoice" (tagihan), "bukti_bayar" (lunas), "garansi_repaint", atau "garansi_coating".'
          },
          customerName: { type: 'string', description: 'Nama pelanggan.' },
          motorDetails: { type: 'string', description: 'Info motor (Merk, Tipe, Nopol).' },
          items: {
            type: 'string',
            description: 'Daftar layanan/barang. Gunakan format "Nama Layanan: Harga" untuk item kustom. Gunakan "-" di awal baris untuk sub-item/deskripsi yang tidak punya harga sendiri. Contoh: "Paket Coating: 4500000\n- Poles Bodi\n- Coating Kaca".'
          },
          totalAmount: { type: 'number', description: 'Total biaya. Jika 0 atau kosong, sistem akan mencoba menghitung otomatis berdasarkan layanan dan ukuran motor.' },
          amountPaid: { type: 'number', description: 'Jumlah yang sudah dibayar. Isi 0 jika belum bayar. Isi sebagian jika DP. Isi sama dengan total jika Lunas.' },
          paymentMethod: { type: 'string', description: 'Metode pembayaran (Transfer, Tunai, QRIS).' },
          notes: { type: 'string', description: 'Catatan tambahan (keluhan, kondisi fisik, dll).' },
          senderNumber: { type: 'string', description: 'Nomor pengirim (otomatis diisi sistem).' },
          recipientNumber: { type: 'string', description: 'WAJIB: Nomor customer penerima dokumen. Format: 628xxx@c.us atau 176665158225970@lid' },
          bookingDate: { type: 'string', description: 'Tanggal booking (YYYY-MM-DD) untuk kalkulasi estimasi selesai.' }
        },
        required: ['documentType', 'senderNumber', 'recipientNumber']
      }
    }
  },
  implementation: async (input) => {
    const {
      documentType,
      customerName = 'Pelanggan',
      motorDetails = '-',
      items = '-',
      totalAmount = 0,
      amountPaid = 0,
      paymentMethod = '-',
      notes = '-',
      senderNumber,
      recipientNumber,
      bookingDate
    } = input;

    let targetRecipient = recipientNumber || senderNumber;
    
    // Auto-detect customer if recipientNumber is missing
    if (!recipientNumber) {
      const prisma = require('../../lib/prisma');
      try {
        const lastCustomer = await prisma.customer.findFirst({
          where: {
            messages: {
              some: {
                createdAt: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
              }
            }
          },
          orderBy: { updatedAt: 'desc' },
          select: { phone: true, whatsappLid: true, name: true }
        });
        
        if (lastCustomer && lastCustomer.whatsappLid) {
          targetRecipient = lastCustomer.whatsappLid;
        } else if (lastCustomer && lastCustomer.phone) {
          targetRecipient = lastCustomer.phone + '@c.us';
        }
      } catch (err) {
        console.log(`[generateDocument] Failed to auto-detect customer: ${err.message}`);
      }
    }
    
    // Auto-Calculate Price if totalAmount is 0/missing, or enrich items with descriptions
    let finalTotal = totalAmount;
    let finalItems = items;
    let detectedSize = null;

    if (documentType !== 'tanda_terima') {
      try {
        const sizeRes = await getServiceDetailsTool.implementation({
          service_name: 'Full Detailing',
          motor_model: motorDetails,
          senderNumber
        });
        detectedSize = (sizeRes.success && sizeRes.motor_size) ? sizeRes.motor_size : null;
      } catch (err) {
        console.warn('[generateDocument] Size detection failed:', err);
      }
    }

    // Always try to enrich items with descriptions from masterLayanan
    if (finalItems && finalItems !== '-') {
      try {
        // Step 1: Split and Parse
        const itemList = finalItems.split('\n').map(i => i.trim()).filter(Boolean);
        let parsedItems = [];
        let runningTotal = 0;

        for (const itemStr of itemList) {
          let name = '';
          let price = 0;
          let desc = '';
          
          if (itemStr.includes('||')) {
            const parts = itemStr.split('||');
            name = (parts[0] || '').trim();
            price = parseInt(parts[1]) || 0;
            desc = (parts[2] || '').trim();
          } else {
            const lastColon = itemStr.lastIndexOf(':');
            if (lastColon > -1) {
              name = itemStr.substring(0, lastColon).trim();
              price = parseInt(itemStr.substring(lastColon + 1).replace(/[^\d]/g, '')) || 0;
            } else {
              name = itemStr;
            }
          }

          if (!name) continue;

          // Precise Matching: Try exact match first
          let service = masterLayanan.find(s => s.name.toLowerCase() === name.toLowerCase());
          
          // Fallback to fuzzy match only if name is long enough to be significant
          if (!service && name.length > 5) {
            service = masterLayanan.find(s => 
              name.toLowerCase().includes(s.name.toLowerCase()) || 
              s.name.toLowerCase().includes(name.toLowerCase())
            );
          }

          if (service) {
            let finalPrice = price;
            if (finalPrice <= 0 && (!finalTotal || finalTotal === 0)) {
              finalPrice = service.price;
              if (service.variants && detectedSize) {
                const variant = service.variants.find(v => v.name === detectedSize);
                if (variant) finalPrice = variant.price;
              }
            }
            
            parsedItems.push({
              name: service.name,
              price: finalPrice,
              desc: desc || service.summary || service.description || ''
            });
            runningTotal += finalPrice;
          } else {
            parsedItems.push({ name, price, desc });
            runningTotal += price;
          }
        }

        // Step 2: Deduplicate while preserving order
        // We only deduplicate if the prices are the same (likely redundant lookup)
        const uniqueItems = [];
        const seen = new Set();

        for (const item of parsedItems) {
          const key = `${item.name.toLowerCase()}|${item.price}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueItems.push(`${item.name}||${item.price}||${item.desc}`);
          }
        }

        finalItems = uniqueItems.join('\n');
        // If we didn't have a total before, use the calculated one
        if (!finalTotal || finalTotal === 0) {
          finalTotal = runningTotal;
        }
      } catch (err) {
        console.warn('[generateDocument] Items enrichment/calculation failed:', err);
      }
    }

    // Setup Waktu, ID, & Info Studio
    const now = new Date();
    const idSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const tempDir = path.resolve(__dirname, '../../../temp_docs');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filename = `${documentType}_${now.getTime()}.pdf`;
    const filePath = path.join(tempDir, filename);
    let title = 'Dokumen';

    if (documentType.startsWith('garansi_')) {
      // ─── WARRANTY PDF (PDFKIT) ───
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      const warrantyData = documentType === 'garansi_repaint' ? warrantyRepaint : warrantyCoating;
      const logoPath = path.join(__dirname, '../../../data/boS Mat (1000 x 500 px) (1).png');
      if (fs.existsSync(logoPath)) doc.image(logoPath, 50, 25, { width: 120 });

      doc.fillColor('#18181b').fontSize(16).font('Helvetica-Bold').text(warrantyData.title, 250, 35, { width: 365 });
      doc.fillColor('#71717a').fontSize(10).font('Helvetica').text('Bosmat Detailing & Repainting Studio', 250, 55, { width: 365 });
      title = warrantyData.title;
      generateHr(doc, 85);

      let y = 105;
      doc.fillColor('#18181b').fontSize(11).font('Helvetica-Bold').text('Informasi Pelanggan & Kendaraan', 50, y);
      y += 22;
      doc.font('Helvetica').fontSize(10).fillColor('#52525b');
      doc.text(`Nama: ${customerName}`, 50, y);
      doc.text(`Kendaraan: ${motorDetails}`, 50, y + 18);
      doc.text(`Tanggal Berlaku: ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 50, y + 36);
      doc.text(`No. WA: ${recipientNumber}`, 360, y);
      doc.text(`Masa Berlaku: ${warrantyData.duration}`, 360, y + 18);
      generateHr(doc, y + 65);
      y += 85;

      for (const section of warrantyData.sections) {
        if (y > 700) { doc.addPage(); y = 50; }
        doc.fillColor('#18181b').fontSize(11).font('Helvetica-Bold').text(section.heading, 50, y);
        y += 15;
        if (section.body) {
          if (y > 750) { doc.addPage(); y = 50; }
          doc.fillColor('#52525b').fontSize(9).font('Helvetica').text(section.body, 50, y, { width: 495, align: 'justify' });
          y += doc.heightOfString(section.body, { width: 495 }) + 10;
        }
        if (section.items && section.items.length > 0) {
          for (const item of section.items) {
            const h = doc.heightOfString(`• ${item}`, { width: 480 });
            if (y + h > 750) { doc.addPage(); y = 50; }
            doc.fillColor('#52525b').fontSize(9).text('•', 50, y);
            doc.text(item, 60, y, { width: 480, align: 'justify' });
            y += h + 3;
          }
          y += 5;
        }
      }
      y += 30;
      doc.fillColor('#18181b').fontSize(10).text('Hormat Kami,', 50, y, { align: 'right', width: 495 });
      y += 50;
      doc.font('Helvetica-Bold').text('Bosmat Detailing And Repainting', 50, y, { align: 'right', width: 495 });
      doc.end();

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

    } else {
      // ─── INVOICE / RECEIPT PDF (PUPPETEER) ───
      title = documentType === 'tanda_terima' ? 'Receipt' : documentType === 'bukti_bayar' ? 'Payment' : 'Invoice';

      // Load logo as base64 for Puppeteer stability
      const logoPath = path.resolve(process.cwd(), 'data/boS Mat (1000 x 500 px) (1).png');
      const logoBase64 = fs.existsSync(logoPath) 
        ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
        : '';

      const html = generateInvoiceHTML({
        documentType, customerName, motorDetails,
        items: finalItems, finalTotal, amountPaid,
        paymentMethod, notes, recipientNumber,
        bookingDate, docNumber: idSuffix, now, detectedSize,
        logoBase64
      });

      const { getChromiumPath, DEFAULT_CHROME_ARGS } = require('../utils/browser');
      const executablePath = getChromiumPath();

      const browser = await puppeteer.launch({ 
        executablePath,
        args: DEFAULT_CHROME_ARGS,
        headless: 'new'
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0px',
          bottom: '0px',
          left: '0px',
          right: '0px'
        }
      });
      await browser.close();
    }

    // 4. Send via WhatsApp
    if (global.whatsappClient) {
      try {
        // Small delay to ensure browser stability after generation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await global.whatsappClient.sendFile(
          targetRecipient,
          filePath,
          `${title}_${customerName}.pdf`,
          `Berikut adalah ${title} untuk pesanan Anda.`
        );

        setTimeout(() => {
          fs.unlink(filePath, (err) => {
            if (err) console.error(`[generateDocument] Failed deletion: ${err.message}`);
          });
        }, 15000);

        return {
          success: true,
          message: `Dokumen PDF ${documentType} berhasil dibuat dan dikirim ke WhatsApp Anda.`,
          formattedResult: `[Dokumen PDF ${title} telah dikirim]`
        };
      } catch (error) {
        console.error('[generateDocument] Error sending file:', error);
        return { success: false, message: `Gagal mengirim file PDF: ${error.message}` };
      }
    } else {
      return { success: false, message: "WhatsApp client tidak tersedia saat ini." };
    }
  }
};

module.exports = { generateDocumentTool };