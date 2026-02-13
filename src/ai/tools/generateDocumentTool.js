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
          items: { type: 'string', description: 'Daftar layanan/barang. Contoh: "Ganti Oli, Servis CVT".' },
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
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const idSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    // Info alamat studio
    const studioAddress = `Bosmat Studio
Bukit Cengkeh 1
Jl. Medan No.B3/2
Kota Depok, Jawa Barat 16451
Telp/WA 0895 4015 27556`;

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
    const accentYellow = '#FFEA00';

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

    const docNumber = `${idSuffix}`; // Minimalist ID like in reference

    doc
      .fillColor(primaryColor)
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(title, 400, 30, { align: 'right' });

    doc
      .fontSize(10)
      .text('Bosmat Detailing And Repainting', 400, 60, { align: 'right' })
      .font('Helvetica')
      .fillColor(secondaryColor)
      .text('Garasi 54', 400, 72, { align: 'right' })
      .text('Jl. R. Sanim No. 99 , Beji, Tanah Baru', 400, 84, { align: 'right' })
      .text('Depok Jawa Barat 16456', 400, 96, { align: 'right' })
      .text('ID', 400, 108, { align: 'right' })
      .text('08179481010', 400, 120, { align: 'right' })
      .text('Bosmatdetailing.studio@gmail.com', 400, 132, { align: 'right' });

    // --- BILL TO / INFO BAR ---
    doc.fillColor(lightBg).rect(30, 160, 535, 60).fill();

    doc
      .fillColor(secondaryColor)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('DITAGIH KEPADA', 50, 175);

    doc
      .fillColor(primaryColor)
      .fontSize(11)
      .text(customerName, 50, 188)
      .font('Helvetica')
      .fontSize(10)
      .text(normalizedAddress || senderNumber, 50, 202);

    // Document Meta (Right side of bar)
    doc
      .fillColor(primaryColor)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('Faktur #', 400, 175, { width: 80, align: 'right' })
      .text(docNumber, 500, 175, { align: 'right' })
      .text('Tanggal', 400, 188, { width: 80, align: 'right' })
      .text(now.toLocaleDateString('id-ID', { day: 'j', month: 'short', year: 'numeric' }), 500, 188, { align: 'right' })
      .text('Jatuh tempo', 400, 201, { width: 80, align: 'right' })
      .text(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID', { day: 'j', month: 'short', year: 'numeric' }), 500, 201, { align: 'right' });

    // --- TABLE ITEMS ---
    const tableTop = 245;
    doc
      .fillColor(primaryColor)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Barang', 50, tableTop)
      .text('Kuantitas', 300, tableTop, { width: 80, align: 'center' })
      .text('Harga', 400, tableTop, { width: 80, align: 'right' })
      .text('Jumlah', 500, tableTop, { align: 'right' });

    generateHr(doc, tableTop + 15);

    let y = tableTop + 30;
    const itemsList = finalItems.split(/\n|,\s*/).map(i => i.trim()).filter(Boolean);

    itemsList.forEach((item, index) => {
      let desc = item;
      let priceVal = 0;

      const lastColonIndex = item.lastIndexOf(':');
      if (lastColonIndex > -1) {
        const potentialPrice = item.substring(lastColonIndex + 1).replace(/[^\d]/g, '');
        priceVal = parseInt(potentialPrice) || 0;
        desc = item.substring(0, lastColonIndex).trim();
      } else if (itemsList.length === 1) {
        priceVal = finalTotal;
      }

      // Cleanup desc
      desc = desc.replace(/^(\d+\.|[-*•])\s*/, '').trim();

      // Item Name
      doc.font('Helvetica-Bold').fontSize(10).text(desc, 50, y, { width: 240 });

      // Kuantitas, Harga, Jumlah
      doc.font('Helvetica').text('1', 300, y, { width: 80, align: 'center' });
      doc.text(formatCurrency(priceVal), 400, y, { width: 80, align: 'right' });
      doc.text(formatCurrency(priceVal), 500, y, { align: 'right' });

      // Item Description (Summary/SOP)
      const serviceData = masterLayanan.find(s => desc.toLowerCase().includes(s.name.toLowerCase()));
      if (serviceData && (serviceData.summary || serviceData.description)) {
        const summary = serviceData.summary || serviceData.description;
        const bulletPoints = summary.split('\n').filter(p => p.trim());

        y += doc.heightOfString(desc, { width: 240 }) + 5;
        doc.fontSize(8).fillColor(secondaryColor);

        bulletPoints.forEach(point => {
          const pointText = `• ${point.replace(/^•\s*/, '')}`;
          doc.text(pointText, 50, y, { width: 240 });
          y += doc.heightOfString(pointText, { width: 240 }) + 2;
        });
        y += 10;
        doc.fillColor(primaryColor);
      } else {
        y += Math.max(doc.heightOfString(desc, { width: 240 }) + 15, 25);
      }

      if (y > 700) { doc.addPage(); y = 50; }
    });

    generateHr(doc, y);
    y += 20;

    // --- SUMMARY SECTION ---
    const summaryX = 350;
    const valueX = 500;

    const subtotal = finalTotal;
    const paid = amountPaid || 0;
    const balance = subtotal - paid;

    doc
      .fontSize(10)
      .fillColor(secondaryColor)
      .text('Subtotal', summaryX, y, { width: 120, align: 'right' })
      .fillColor(primaryColor)
      .text(formatCurrency(subtotal), valueX, y, { align: 'right' });
    y += 18;

    doc
      .fillColor(secondaryColor)
      .text('Total', summaryX, y, { width: 120, align: 'right' })
      .fillColor(primaryColor)
      .text(formatCurrency(subtotal), valueX, y, { align: 'right' });
    y += 18;

    if (paid > 0) {
      doc
        .fillColor(secondaryColor)
        .text(`Lunas pada ${now.toLocaleDateString('id-ID', { day: 'j', month: 'short', year: 'numeric' })}`, summaryX, y, { width: 120, align: 'right' })
        .fillColor(primaryColor)
        .text(formatCurrency(paid), valueX, y, { align: 'right' });
      y += 25;
    }

    // Amount Due Highlight box
    doc.fillColor(lightBg).rect(summaryX, y, 215, 45).fill();
    doc
      .fillColor(secondaryColor)
      .fontSize(10)
      .text('Jumlah yang Harus Dibayar', summaryX + 10, y + 10);
    doc
      .fillColor(primaryColor)
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(formatCurrency(balance), summaryX + 40, y + 20, { width: 165, align: 'right' });

    // --- FOOTER / PAYMENT ---
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