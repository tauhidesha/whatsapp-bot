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
const { generateWarrantyHTML } = require('../../data/templates/warrantyTemplate.js');
const { markBotMessage } = require('../utils/adminMessageSync.js');

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
          bookingDate: { type: 'string', description: 'Tanggal booking (YYYY-MM-DD) untuk kalkulasi estimasi selesai.' },
          serviceType: { type: 'string', description: 'Layanan yang digaransikan. Pisahkan dengan § jika lebih dari satu. Contoh: "Full Body Repaint § Nano Ceramic Coating".' },
          realPhone: { type: 'string', description: 'Nomor WhatsApp asli customer (human-readable).' }
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
      bookingDate,
      serviceType = '-',
      realPhone = ''
    } = input;

    let targetRecipient = recipientNumber || senderNumber;
    let customerRecord = null;

    try {
      const { getIdentifier } = require('../utils/humanHandover.js');
      let intermediateTarget = getIdentifier(targetRecipient) || targetRecipient;
      
      const prisma = require('../../lib/prisma');
      const phoneNoSuffix = intermediateTarget.replace(/@c\.us$|@lid$/, '');
      customerRecord = await prisma.customer.findFirst({
        where: { 
          OR: [
            { whatsappLid: intermediateTarget },
            { whatsappLid: phoneNoSuffix },
            { phone: intermediateTarget },
            { phone: phoneNoSuffix }
          ]
        },
        select: { whatsappLid: true, phone: true, phoneReal: true }
      });

      if (customerRecord?.whatsappLid) {
        targetRecipient = customerRecord.whatsappLid;
      } else if (customerRecord?.phone && customerRecord.phone.includes('@')) {
        targetRecipient = customerRecord.phone;
      } else {
        targetRecipient = intermediateTarget;
      }
    } catch (e) {
      console.warn('[generateDocument] DB resolve target failed:', e.message);
    }

    // Auto-fix WID suffix: ONLY if missing '@'
    if (targetRecipient && typeof targetRecipient === 'string' && !targetRecipient.includes('@')) {
      let cleaned = targetRecipient.replace(/\D/g, '');
      if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
      }
      targetRecipient = cleaned + '@c.us';
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
        // Support §, \n, and comma + space (legacy)
        const itemList = finalItems.split(/§|\n/).map(i => i.trim()).filter(Boolean);
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
          
          // Fallback to fuzzy match: strict overlap ratio > 0.7
          if (!service && name.length > 8) {
            service = masterLayanan.find(s => {
              const sName = s.name.toLowerCase();
              const iName = name.toLowerCase();
              // Only match if exact or substring with > 70% length overlap
              return iName.includes(sName) && (sName.length / iName.length > 0.7);
            });
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
      // ─── WARRANTY PDF (PUPPETEER) ───
      title = documentType === 'garansi_repaint' ? 'Garansi Repaint' : 'Garansi Coating';

      // Auto-fill dari booking terakhir jika data kosong
      let warrantyCustomerName = customerName;
      let warrantyMotorDetails = motorDetails;
      let warrantyServiceType = serviceType;
      let warrantyBookingDate = bookingDate;
      let warrantyRecipient = targetRecipient;

      if (!warrantyCustomerName || warrantyCustomerName === 'Pelanggan' || warrantyMotorDetails === '-' || warrantyServiceType === '-') {
        try {
          const prisma = require('../../lib/prisma');
          const booking = await prisma.booking.findFirst({
            where: {
              OR: [
                { customerPhone: targetRecipient?.replace('@c.us', '').replace('@lid', '') },
                { customer: { phoneReal: targetRecipient?.replace('@c.us', '') } },
                { customer: { whatsappLid: targetRecipient } },
              ],
              status: { in: ['DONE', 'PAID'] }
            },
            include: { customer: true, vehicle: true },
            orderBy: { bookingDate: 'desc' }
          });

          if (booking) {
            if (!warrantyCustomerName || warrantyCustomerName === 'Pelanggan') warrantyCustomerName = booking.customerName;
            if (warrantyMotorDetails === '-') warrantyMotorDetails = `${booking.vehicleModel || ''} (${booking.plateNumber || ''})`;
            if (warrantyServiceType === '-') warrantyServiceType = booking.serviceType || '-';
            if (!warrantyBookingDate) warrantyBookingDate = booking.bookingDate?.toISOString().split('T')[0];
            if (booking.customer?.whatsappLid) {
              warrantyRecipient = booking.customer.whatsappLid;
            } else if (booking.customer?.phoneReal) {
              const ph = booking.customer.phoneReal;
              warrantyRecipient = ph.includes('@') ? ph : ph + '@c.us';
            }
          }
        } catch (err) {
          console.warn('[generateDocument] Auto-fill warranty data failed:', err.message);
        }
      }

      // Parse plateNumber dari motorDetails — format: "NMax (B1234ETV)"
      const plateMatch = warrantyMotorDetails.match(/\(([^)]+)\)/);
      const plateNumber = plateMatch ? plateMatch[1].trim() : '-';
      const motorName = warrantyMotorDetails.replace(/\([^)]*\)/, '').trim();

      // Load logo as base64
      const logoPath = path.resolve(process.cwd(), 'data/boS Mat (1000 x 500 px) (1).png');
      const logoBase64 = fs.existsSync(logoPath)
        ? fs.readFileSync(logoPath).toString('base64')
        : '';

      const html = generateWarrantyHTML({
        type: documentType === 'garansi_repaint' ? 'repaint' : 'coating',
        customerName: warrantyCustomerName,
        customerPhone: warrantyRecipient?.replace('@c.us', '').replace('@lid', '').replace(/^62/, '0') || '-',
        motorDetails: motorName,
        plateNumber,
        serviceType: warrantyServiceType,
        bookingDate: warrantyBookingDate,
        docNumber: idSuffix,
        logoBase64,
        realPhone: realPhone || (customerRecord?.phoneReal) || ''
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
        margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' }
      });
      await browser.close();

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
        logoBase64, realPhone
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

        const fileCaption = `Berikut adalah ${title} untuk pesanan Anda.`;
        // Mark before sending so onAnyMessage doesn't treat it as admin-from-HP
        markBotMessage(targetRecipient, fileCaption);
        
        try {
          await global.whatsappClient.sendFile(
            targetRecipient,
            filePath,
            `${title}_${customerName}.pdf`,
            fileCaption
          );
        } catch (initialError) {
          // FALLBACK LOGIC: If sending to LID or @c.us fails, try the alternative
          if (initialError.message && initialError.message.includes('No LID')) {
            console.warn(`[generateDocument] Send failed with No LID for: ${targetRecipient}`);
            const prisma = require('../../lib/prisma');
            const cleanPhone = targetRecipient.replace(/@c\.us$|@lid$/, '');
            const customer = await prisma.customer.findFirst({
              where: {
                OR: [
                  { whatsappLid: targetRecipient },
                  { whatsappLid: cleanPhone },
                  { phone: targetRecipient },
                  { phone: cleanPhone }
                ]
              },
              select: { phone: true, whatsappLid: true }
            });
            
            let fallbackTarget = null;
            if (targetRecipient.endsWith('@c.us') && customer?.whatsappLid) {
              fallbackTarget = customer.whatsappLid;
            } else if (targetRecipient.endsWith('@lid') && customer?.phone) {
              fallbackTarget = customer.phone.includes('@') ? customer.phone : `${customer.phone}@c.us`;
            }
            
            // If DB didn't provide a DIFFERENT alternative, brute-force flip the suffix
            if (!fallbackTarget || fallbackTarget === targetRecipient) {
              const rawDigits = cleanPhone.replace(/\D/g, '');
              if (targetRecipient.endsWith('@c.us')) {
                fallbackTarget = `${rawDigits}@lid`;
              } else if (targetRecipient.endsWith('@lid')) {
                fallbackTarget = `${rawDigits}@c.us`;
              }
              console.log(`[generateDocument] DB had no distinct alt, brute-force flip: ${fallbackTarget}`);
            }

            if (fallbackTarget && fallbackTarget !== targetRecipient) {
              console.log(`[generateDocument] Retrying with fallback: ${fallbackTarget}`);
              markBotMessage(fallbackTarget, fileCaption);
              await global.whatsappClient.sendFile(
                fallbackTarget,
                filePath,
                `${title}_${customerName}.pdf`,
                fileCaption
              );
              // Update targetRecipient for the return success message
              targetRecipient = fallbackTarget;
            } else {
              throw initialError; // No fallback found, throw original
            }
          } else {
            throw initialError; // Not a LID error or no fallback possible
          }
        }

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