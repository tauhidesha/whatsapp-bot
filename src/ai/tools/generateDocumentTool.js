// File: src/ai/tools/generateDocumentTool.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { formatCurrency } = require('../utils/distanceMatrix.js');
const { getStudioInfoTool } = require('./getStudioInfoTool.js');
const { getMotorSizeDetailsTool } = require('./getMotorSizeDetailsTool.js');
const masterLayanan = require('../../data/masterLayanan.js');
const { isAdmin } = require('../utils/adminAuth.js');

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
      description: 'Membuat dokumen PDF resmi (Surat Tanda Terima, Invoice, Bukti Bayar) dan mengirimkannya ke admin. HANYA bisa digunakan jika pengirim adalah admin.',
      parameters: {
        type: 'object',
        properties: {
          documentType: {
            type: 'string',
            enum: ['tanda_terima', 'invoice', 'bukti_bayar'],
            description: 'Jenis dokumen: "tanda_terima" (motor masuk), "invoice" (tagihan), atau "bukti_bayar" (lunas).'
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
          senderNumber: { type: 'string', description: 'Nomor pengirim (otomatis diisi sistem).' }
        },
        required: ['documentType', 'senderNumber']
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
      senderNumber
    } = input;

    // 1. Security Check: Pastikan yang request adalah Admin
    if (!isAdmin(senderNumber)) {
      return {
        success: false,
        message: "⛔ Akses Ditolak. Fitur pembuatan dokumen hanya dapat diakses oleh nomor Admin."
      };
    }

    // 1.5 Auto-Calculate Price if totalAmount is 0/missing
    let finalTotal = totalAmount;
    let finalItems = items;
    let detectedSize = null;

    // Detect Motor Size (needed for auto-price or filling missing row prices)
    if (documentType !== 'tanda_terima') {
      try {
        const sizeRes = await getMotorSizeDetailsTool.implementation({ motor_query: motorDetails });
        detectedSize = (sizeRes.success && sizeRes.motor_size) ? sizeRes.motor_size : null;
      } catch (err) {
        console.warn('[generateDocument] Size detection failed:', err);
      }
    }

    if ((!finalTotal || finalTotal === 0) && documentType !== 'tanda_terima') {
      try {
        if (detectedSize) {
          let runningTotal = 0;
          const itemList = items.split(/,|\n/).map(i => i.trim()).filter(Boolean);
          const detailedList = [];

          for (const itemStr of itemList) {
            // Find service in masterLayanan
            const service = masterLayanan.find(s =>
              itemStr.toLowerCase().includes(s.name.toLowerCase()) ||
              s.name.toLowerCase().includes(itemStr.toLowerCase())
            );

            if (service) {
              let price = service.price;
              if (service.variants && Array.isArray(service.variants)) {
                const variant = service.variants.find(v => v.name === detectedSize);
                if (variant) price = variant.price;
              }
              runningTotal += price;
              detailedList.push(`${service.name} (${detectedSize}): ${formatCurrency(price)}`);
            } else {
              detailedList.push(itemStr);
            }
          }

          if (runningTotal > 0) {
            finalTotal = runningTotal;
            finalItems = detailedList.join('\n');
          }
        }
      } catch (err) {
        console.warn('[generateDocument] Auto-price calculation failed:', err);
      }
    }

    // 2. Setup Waktu, ID, & Info Studio
    const now = new Date();
    const idSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    // 3. Generate PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const tempDir = path.resolve(__dirname, '../../../temp_docs');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filename = `${documentType}_${now.getTime()}.pdf`;
    const filePath = path.join(tempDir, filename);
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    // --- STYLING CONSTANTS ---
    const primaryColor = '#18181b'; // Zinc-950
    const secondaryColor = '#52525b'; // Zinc-600
    const mutedColor = '#71717a'; // Zinc-500
    const lightBg = '#f4f4f5'; // Zinc-100

    // --- HEADER ---
    // Logo: Top Left
    const logoPath = path.join(__dirname, '../../../data/boS Mat (1000 x 500 px) (1).png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 30, { width: 140 });
    }

    // Document Title & Company Info: Top Right
    let title = 'Faktur';
    let docCode = 'INV';
    if (documentType === 'tanda_terima') { title = 'Surat Tanda Terima'; docCode = 'STT'; }
    else if (documentType === 'bukti_bayar') { title = 'Kuitansi'; docCode = 'RCP'; }

    const docNumber = `${idSuffix}`;

    // Title at Top Right
    doc
      .fillColor(primaryColor)
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(title, 345, 30, { align: 'right', width: 200 });

    // Company Info below Title
    const headerX = 345;
    const headerWidth = 200;
    let headerY = 65;

    doc
      .fontSize(10)
      .text('Bosmat Detailing And Repainting', headerX, headerY, { align: 'right', width: headerWidth })
      .font('Helvetica')
      .fillColor(secondaryColor);

    headerY += 14;
    doc.text('Garasi 54', headerX, headerY, { align: 'right', width: headerWidth });
    headerY += 12;
    doc.text('Jl. R. Sanim No. 99 , Beji, Tanah Baru', headerX, headerY, { align: 'right', width: headerWidth });
    headerY += 12;
    doc.text('Depok Jawa Barat 16456', headerX, headerY, { align: 'right', width: headerWidth });
    headerY += 12;
    doc.text('ID', headerX, headerY, { align: 'right', width: headerWidth });
    headerY += 12;
    doc.text('08179481010', headerX, headerY, { align: 'right', width: headerWidth });
    headerY += 12;
    doc.text('Bosmatdetailing.studio@gmail.com', headerX, headerY, { align: 'right', width: headerWidth });

    // --- BILL TO / INFO BAR ---
    doc.fillColor(lightBg).rect(30, 180, 535, 60).fill();

    doc
      .fillColor(secondaryColor)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('DITAGIH KEPADA', 50, 195);

    doc
      .fillColor(primaryColor)
      .fontSize(11)
      .text(customerName, 50, 208)
      .font('Helvetica')
      .fontSize(10)
      .text(senderNumber, 50, 222);

    // Document Meta (Right side of bar)
    doc
      .fillColor(primaryColor)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('Faktur #', 350, 195, { width: 80, align: 'right' })
      .text(docNumber, 440, 195, { width: 100, align: 'right' })
      .text('Tanggal', 350, 208, { width: 80, align: 'right' })
      .text(now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }), 440, 208, { width: 100, align: 'right' })
      .text('Jatuh tempo', 350, 221, { width: 80, align: 'right' })
      .text(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }), 440, 221, { width: 100, align: 'right' });

    // --- TABLE ITEMS ---
    const tableTop = 265;
    doc
      .fillColor(primaryColor)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Barang', 50, tableTop)
      .text('Kuantitas', 300, tableTop, { width: 60, align: 'center' })
      .text('Harga', 370, tableTop, { width: 80, align: 'right' })
      .text('Jumlah', 460, tableTop, { width: 85, align: 'right' });

    generateHr(doc, tableTop + 15);

    let y = tableTop + 30;
    const itemsList = finalItems.split(/\n|,\s*/).map(i => i.trim()).filter(Boolean);

    itemsList.forEach((item, index) => {
      let desc = item;
      let priceVal = 0;

      const isSubItem = /^([-*•])/.test(item);

      const lastColonIndex = item.lastIndexOf(':');
      if (lastColonIndex > -1) {
        const potentialPrice = item.substring(lastColonIndex + 1).replace(/[^\d]/g, '');
        priceVal = parseInt(potentialPrice) || 0;
        desc = item.substring(0, lastColonIndex).trim();
      }

      // Cleanup desc for matching/display
      const cleanDesc = desc.replace(/^(\d+\.|[-*•])\s*/, '').trim();

      // Fallback price from masterLayanan if still 0 and NOT a sub-item
      if (!isSubItem && priceVal === 0) {
        const service = masterLayanan.find(s => cleanDesc.toLowerCase().includes(s.name.toLowerCase()));
        if (service) {
          priceVal = service.price;
          if (service.variants && Array.isArray(service.variants) && detectedSize) {
            const variant = service.variants.find(v => v.name === detectedSize);
            if (variant) priceVal = variant.price;
          }
        }
      }

      // Secondary fallback: if it's the only item, use finalTotal
      if (!isSubItem && priceVal === 0 && itemsList.length === 1) {
        priceVal = finalTotal;
      }

      // Item Name
      doc.font(isSubItem ? 'Helvetica' : 'Helvetica-Bold')
        .fontSize(isSubItem ? 9 : 10)
        .fillColor(isSubItem ? secondaryColor : primaryColor)
        .text(isSubItem ? `  ${desc}` : cleanDesc, 50, y, { width: 240 });

      if (!isSubItem) {
        // Kuantitas, Harga, Jumlah
        doc.font('Helvetica').fontSize(10).fillColor(primaryColor).text('1', 300, y, { width: 60, align: 'center' });

        const priceText = priceVal > 0 ? formatCurrency(priceVal) : '-';
        doc.text(priceText, 370, y, { width: 80, align: 'right' });
        doc.text(priceText, 460, y, { width: 85, align: 'right' });
      }

      // Automatically add SOP/Description from masterLayanan if it matches and isn't already a sub-item list
      const serviceData = !isSubItem ? masterLayanan.find(s => cleanDesc.toLowerCase().includes(s.name.toLowerCase())) : null;
      if (serviceData && (serviceData.summary || serviceData.description)) {
        const summary = serviceData.summary || serviceData.description;
        const bulletPoints = summary.split('\n').filter(p => p.trim());

        y += doc.heightOfString(isSubItem ? `  ${desc}` : cleanDesc, { width: 240 }) + 5;
        doc.fontSize(8).fillColor(secondaryColor);

        bulletPoints.forEach(point => {
          const pointText = `• ${point.replace(/^•\s*/, '')}`;
          const h = doc.heightOfString(pointText, { width: 240 });
          if (y + h > 750) { doc.addPage(); y = 50; }
          doc.text(pointText, 50, y, { width: 240 });
          y += h + 2;
        });
        y += 10;
        doc.fillColor(primaryColor);
      } else {
        y += Math.max(doc.heightOfString(isSubItem ? `  ${desc}` : cleanDesc, { width: 240 }) + 10, 20);
      }

      if (y > 750) { doc.addPage(); y = 50; }
    });

    generateHr(doc, y);
    y += 20;

    // --- SUMMARY SECTION ---
    const summaryX = 350;

    const subtotal = finalTotal;
    const paid = amountPaid || 0;
    const balance = subtotal - paid;

    doc
      .fontSize(10)
      .fillColor(secondaryColor)
      .text('Subtotal', summaryX, y, { width: 100, align: 'right' })
      .fillColor(primaryColor)
      .text(formatCurrency(subtotal), summaryX + 110, y, { width: 85, align: 'right' });
    y += 20;

    doc
      .fillColor(secondaryColor)
      .text('Total', summaryX, y, { width: 100, align: 'right' })
      .fillColor(primaryColor)
      .text(formatCurrency(subtotal), summaryX + 110, y, { width: 85, align: 'right' });
    y += 20;

    if (paid > 0) {
      doc
        .fillColor(secondaryColor)
        .text(`Lunas pada ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`, summaryX - 20, y, { width: 120, align: 'right' })
        .fillColor(primaryColor)
        .text(formatCurrency(paid), summaryX + 110, y, { width: 85, align: 'right' });
      y += 30;
    }

    // Amount Due Highlight box
    doc.fillColor(lightBg).rect(345, y, 210, 45).fill();
    doc
      .fillColor(secondaryColor)
      .fontSize(10)
      .text('Jumlah yang Harus Dibayar', 355, y + 10);
    doc
      .fillColor(primaryColor)
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(formatCurrency(balance), 355, y + 20, { width: 190, align: 'right' });

    y += 70;
    doc
      .fontSize(12)
      .fillColor(primaryColor)
      .font('Helvetica-Bold')
      .text('Instruksi Pembayaran', 50, y);
    y += 20;

    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Bank BCA', 50, y)
      .text('1662515412', 50, y + 14)
      .text('A/N Nama Muhammad Tauhid Haryadesa', 50, y + 28);

    y += 80;
    doc
      .fontSize(9)
      .fillColor(secondaryColor)
      .text('Penjadwalan pengerjaan menyusul sesuai ketersediaan slot (TBA).', 50, y);

    y += 40;
    doc
      .fillColor(primaryColor)
      .font('Helvetica-Bold')
      .text('Detail Pembayaran', 50, y);
    doc
      .font('Helvetica')
      .text('Bank: BCA', 50, y + 14)
      .text('Nomor Rekening: 1662515412', 50, y + 28)
      .text('Atas Nama: Muhammad Tauhid Haryadesa', 50, y + 42);

    doc.end();

    // 4. Wait for file write & Send
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    if (global.whatsappClient) {
      try {
        await global.whatsappClient.sendFile(
          senderNumber,
          filePath,
          filename,
          `Berikut dokumen *${title}* yang diminta.`
        );

        // Cleanup: Hapus file temp setelah dikirim
        setTimeout(() => {
          fs.unlink(filePath, (err) => {
            if (err) console.error(`[generateDocument] Gagal menghapus temp file ${filePath}:`, err);
            else console.log(`[generateDocument] Temp file dihapus: ${filename}`);
          });
        }, 5000);

        return {
          success: true,
          message: `Dokumen PDF ${documentType} berhasil dibuat dan dikirim ke WhatsApp Anda.`,
          formattedResult: `[Dokumen PDF ${title} telah dikirim]`
        };
      } catch (error) {
        console.error('[generateDocument] Error sending file:', error);
        return {
          success: false,
          message: `Gagal mengirim file PDF: ${error.message}`
        };
      }
    } else {
      return {
        success: false,
        message: "WhatsApp client tidak tersedia saat ini."
      };
    }
  }
};

module.exports = { generateDocumentTool };