// File: src/ai/tools/generateDocumentTool.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { formatCurrency } = require('../utils/distanceMatrix.js');
const { getStudioInfoTool } = require('./getStudioInfoTool.js');
const { getMotorSizeDetailsTool } = require('./getMotorSizeDetailsTool.js');
const masterLayanan = require('../../data/masterLayanan.js');

// Helper untuk memvalidasi apakah pengirim adalah admin
function isAdmin(senderNumber) {
  const adminNumbers = [
    process.env.BOSMAT_ADMIN_NUMBER,
    process.env.ADMIN_WHATSAPP_NUMBER
  ].filter(Boolean);

  if (!senderNumber || adminNumbers.length === 0) return false;

  // Normalisasi: hapus karakter non-digit dan suffix @c.us
  const normalize = (n) => n.toString().replace(/\D/g, '');
  const sender = normalize(senderNumber);
  
  return adminNumbers.some(admin => normalize(admin) === sender);
}

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

    if ((!finalTotal || finalTotal === 0) && documentType !== 'tanda_terima') {
      try {
        // Detect Motor Size
        const sizeRes = await getMotorSizeDetailsTool.implementation({ motor_query: motorDetails });
        const size = (sizeRes.success && sizeRes.motor_size) ? sizeRes.motor_size : null;

        if (size) {
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
                const variant = service.variants.find(v => v.name === size);
                if (variant) price = variant.price;
              }
              runningTotal += price;
              detailedList.push(`${service.name} (${size}): ${formatCurrency(price)}`);
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
    
    // Ambil info alamat dari tool getStudioInfo
    let studioAddress = 'Jl. Bukit Cengkeh 1, Depok'; // Fallback
    try {
      const studioInfoResult = await getStudioInfoTool.implementation({ infoType: 'location' });
      if (typeof studioInfoResult === 'string') {
        studioAddress = studioInfoResult;
      } else if (studioInfoResult && studioInfoResult.address) {
        studioAddress = studioInfoResult.address;
      } else if (studioInfoResult && studioInfoResult.info) {
        studioAddress = studioInfoResult.info;
      }
    } catch (err) {
      console.warn('[generateDocument] Gagal mengambil info studio:', err);
    }

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
      doc.image(logoPath, 50, 45, { width: 60 });
    }

    // Company Info
    doc
      .fillColor(primaryColor)
      .font('Helvetica-Bold')
      .fontSize(20)
      .text('BOSMAT', 120, 50)
      .fontSize(10)
      .font('Helvetica')
      .text('Repainting & Detailing Studio', 120, 75)
      .fillColor(secondaryColor)
      .text(studioAddress, 200, 50, { align: 'right', width: 350 })
      .moveDown();

    // Divider Header
    generateHr(doc, 95);

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
    const infoTop = 115;
    
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
    const tableTop = 230;
    const itemCodeX = 50;
    const descriptionX = 90;
    const priceX = 450;

    // Table Header
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('No', itemCodeX, tableTop)
      .text('Deskripsi Layanan', descriptionX, tableTop)
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
      }

      doc
        .fontSize(10)
        .text(`${index + 1}`, itemCodeX, y)
        .text(desc, descriptionX, y, { width: 340 })
        .text(priceStr, priceX, y, { align: 'right' });
      
      y += 20;
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
      
      if (documentType === 'bukti_bayar') {
        y += 20;
        doc
          .fillColor('green')
          .fontSize(12)
          .text('LUNAS', priceX, y, { align: 'right' });
        doc.fillColor('black');
        
        y += 15;
        doc.fontSize(10).font('Helvetica').text(`Metode: ${paymentMethod}`, priceX, y, { align: 'right' });
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