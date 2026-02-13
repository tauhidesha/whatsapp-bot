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
    const primaryColor = '#2c3e50'; // Dark Blue/Grey
    const secondaryColor = '#7f8c8d'; // Grey

    // --- HEADER ---
    // Logo: data/boS Mat (1000 x 500 px) (1).png
    const logoPath = path.join(__dirname, '../../../data/boS Mat (1000 x 500 px) (1).png');

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 30, { width: 150 });
    }

    // Company Info
    doc
      .fillColor(secondaryColor)
      .fontSize(10)
      .font('Helvetica')
      .text(studioAddress, 200, 45, { align: 'right', width: 350 })
      .moveDown();

    // Divider Header
    generateHr(doc, 110);

    // --- DOCUMENT TITLE ---
    let title = '';
    let docCode = '';

    if (documentType === 'tanda_terima') {
      title = 'TANDA TERIMA';
      docCode = 'STT';
    } else if (documentType === 'invoice') {
      title = 'INVOICE';
      docCode = 'INV';
    } else if (documentType === 'bukti_bayar') {
      title = 'RECEIPT';
      docCode = 'RCP';
    }

    const docNumber = `${docCode}/${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${idSuffix}`;

    // --- INFO SECTION (2 Columns) ---
    const infoTop = 130;

    // Left Column: Document Title & Customer
    doc
      .fillColor(primaryColor)
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(title, 50, infoTop);

    doc
      .fontSize(10)
      .fillColor('black')
      .font('Helvetica-Bold')
      .text('Kepada Yth:', 50, infoTop + 35)
      .font('Helvetica')
      .text(customerName, 50, infoTop + 50)
      .text(motorDetails, 50, infoTop + 65);

    // Right Column: Document Details
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Detail Dokumen:', 350, infoTop + 35)
      .font('Helvetica')
      .text(`Nomor: ${docNumber}`, 350, infoTop + 50)
      .text(`Tanggal: ${dateStr}`, 350, infoTop + 65)
      .text(`Jam: ${timeStr}`, 350, infoTop + 80);

    // --- TABLE ITEMS ---
    const tableTop = 270;
    const itemCodeX = 50;
    const descriptionX = 90;
    const priceX = 450;

    // Table Header
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('No', itemCodeX, tableTop)
      .text('Layanan', descriptionX, tableTop)
      .text('Harga', priceX, tableTop, { align: 'right' });

    generateHr(doc, tableTop + 15);

    // Table Rows
    doc.font('Helvetica');
    let y = tableTop + 30;

    // Split items by newline (preferred) or comma
    const itemsList = finalItems.split(/\n|,\s*/).map(i => i.trim()).filter(Boolean);

    itemsList.forEach((item, index) => {
      // Coba pisahkan nama layanan dan harga jika formatnya "Layanan : RpXXX"
      let desc = item;
      let priceStr = '-';

      const lastColonIndex = item.lastIndexOf(':');
      if (lastColonIndex > -1) {
        const potentialPrice = item.substring(lastColonIndex + 1).trim();
        // Cek apakah bagian kanan terlihat seperti harga (ada angka atau Rp)
        if (potentialPrice.includes('Rp') || /\d/.test(potentialPrice)) {
          desc = item.substring(0, lastColonIndex).trim();
          priceStr = potentialPrice;
        }
      } else {
        // Fallback: Coba regex di akhir string (misal "Layanan Rp 100.000" atau "Layanan 100rb")
        const priceMatch = item.match(/(?:Rp\.?\s?)?[\d,.]+\s*(?:rb|jt|juta|ribu)?$/i);
        if (priceMatch) {
          const potentialPrice = priceMatch[0].trim();
          // Validasi agar tidak menangkap tahun atau cc (misal "Vario 150")
          const isCurrency = /Rp|rb|jt|juta|ribu/i.test(potentialPrice) ||
            (potentialPrice.includes('.') && potentialPrice.length > 4) ||
            (potentialPrice.includes(',') && potentialPrice.length > 3);

          if (isCurrency) {
            priceStr = potentialPrice;
            desc = item.substring(0, item.length - priceMatch[0].length).trim();
          }
        }
      }

      // Bersihkan bullet points atau nomor di awal deskripsi, dan separator di akhir
      desc = desc.replace(/^(\d+\.|[-*•])\s*/, '').replace(/[-:]\s*$/, '');

      // Cari deskripsi layanan untuk ditampilkan di bawah nama layanan
      const cleanName = desc.replace(/\s*\(.*?\)/g, '').trim();
      const serviceData = masterLayanan.find(s => {
        const sName = s.name.toLowerCase();
        const cName = cleanName.toLowerCase();
        return sName === cName || cName.includes(sName) || sName.includes(cName);
      });

      const descriptionText = serviceData ? (serviceData.summary || serviceData.description) : '';

      // Fallback: Jika harga kosong ('-'), coba cari di master data atau gunakan total jika item tunggal
      if (priceStr === '-' && documentType !== 'tanda_terima') {
        if (serviceData && detectedSize) {
          let price = serviceData.price;
          if (serviceData.variants && Array.isArray(serviceData.variants)) {
            const variant = serviceData.variants.find(v => v.name === detectedSize);
            if (variant) price = variant.price;
          }
          if (price > 0) priceStr = formatCurrency(price);
        }

        // Jika masih kosong dan ini satu-satunya item, gunakan finalTotal
        if (priceStr === '-' && itemsList.length === 1 && finalTotal > 0) {
          priceStr = formatCurrency(finalTotal);
        }
      }

      doc.fontSize(10).fillColor('black').font('Helvetica').text(`${index + 1}`, itemCodeX, y);
      doc.font('Helvetica-Bold').text(desc, descriptionX, y, { width: 340 });
      doc.font('Helvetica').text(priceStr, priceX, y, { align: 'right' });

      if (descriptionText) {
        const nameHeight = doc.heightOfString(desc, { width: 340 });
        const descY = y + nameHeight + 2;

        doc.fontSize(8).fillColor('#555555').font('Helvetica-Oblique')
          .text(descriptionText, descriptionX, descY, { width: 340 });

        const descHeight = doc.heightOfString(descriptionText, { width: 340 });
        y = descY + descHeight + 10;
        doc.fillColor('black').font('Helvetica');
      } else {
        y += 20;
      }

      if (y > 700) { doc.addPage(); y = 50; }
    });

    generateHr(doc, y);
    y += 15;

    // --- TOTAL & FOOTER ---
    if (documentType !== 'tanda_terima') {
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('TOTAL', 350, y, { width: 90, align: 'right' })
        .text(formatCurrency(finalTotal), priceX, y, { align: 'right' });
      y += 20;

      // Logic Status Pembayaran (DP / Lunas / Belum Bayar)
      const paid = amountPaid || 0;
      const remaining = finalTotal - paid;

      if (paid > 0) {
        // Tampilkan baris pembayaran jika ada uang masuk (DP atau Lunas)
        doc
          .font('Helvetica')
          .fontSize(10)
          .text('Sudah Dibayar', 350, y, { width: 90, align: 'right' })
          .text(formatCurrency(paid), priceX, y, { align: 'right' });
        y += 15;

        if (remaining > 0) {
          // Kasus DP
          doc
            .font('Helvetica-Bold')
            .fontSize(12)
            .text('SISA TAGIHAN', 350, y, { width: 90, align: 'right' })
            .text(formatCurrency(remaining), priceX, y, { align: 'right' });
          y += 25;

          // Stempel BELUM LUNAS
          doc.save().rotate(-10, { origin: [420, y] });
          doc.rect(380, y - 5, 130, 30).stroke('orange');
          doc.fillColor('orange').fontSize(16).text('BELUM LUNAS', 380, y + 2, { width: 130, align: 'center' });
          doc.restore();
        } else {
          // Kasus Lunas
          doc.save().rotate(-10, { origin: [420, y] });
          doc.rect(400, y - 5, 100, 30).stroke('green');
          doc.fillColor('green').fontSize(16).text('LUNAS', 400, y + 2, { width: 100, align: 'center' });
          doc.restore();
        }
      } else if (documentType === 'bukti_bayar') {
        // Jika tipe dokumen bukti bayar tapi amountPaid 0, anggap Lunas (default behavior lama)
        doc.fillColor('green')
          .fontSize(12)
          .text('LUNAS', priceX, y, { align: 'right' });
        doc.fillColor('black');
      }

      // Info Metode Pembayaran
      if (paymentMethod !== '-' && paid > 0) {
        y += 15;
        doc.fillColor('black').fontSize(10).font('Helvetica').text(`Metode: ${paymentMethod}`, priceX, y, { align: 'right' });
      }

      // Info Rekening (Hanya muncul jika masih ada tagihan/invoice)
      if (documentType === 'invoice' && remaining > 0) {
        y += 30;
        doc
          .fillColor('black')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text('Detail Pembayaran:', 50, y)
          .font('Helvetica')
          .text('Bank: BCA', 50, y + 15)
          .text('No. Rek: 1662515412', 50, y + 30)
          .text('A.N: Muhammad Tauhid Haryadesa', 50, y + 45);
        y += 45;
      }
    } else {
      doc.moveDown(2);
      y = doc.y;
      doc.font('Helvetica-Oblique').fontSize(10).text('Kendaraan telah diterima untuk dilakukan pengecekan/pengerjaan.', 50, y, { align: 'center', width: 500 });
    }

    // --- NOTES ---
    y += 40;
    if (notes && notes !== '-') {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Catatan:', 50, y)
        .font('Helvetica')
        .text(notes, 50, y + 15);
      y += 40;
    }

    // Signatures
    y += 30;
    // Pastikan tidak keluar halaman
    if (y > 700) { doc.addPage(); y = 50; }

    doc.text('Hormat Kami,', 400, y, { align: 'center', width: 150 });
    doc.text('( Admin Bosmat )', 400, y + 50, { align: 'center', width: 150 });

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