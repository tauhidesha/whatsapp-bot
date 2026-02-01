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

    // --- HEADER ---
    // Logo: src/data/bosmat.png (relative: ../../data/bosmat.png)
    const logoPath = path.join(__dirname, '../../data/bosmat.png');
    
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 45, { width: 60 });
    }

    // Company Info
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .text('BOSMAT', 120, 50)
      .fontSize(10)
      .font('Helvetica')
      .text('Repainting & Detailing Studio', 120, 75)
      .text(studioAddress, 250, 55, { align: 'right', width: 300 })
      .moveDown();

    // Divider
    doc.moveTo(50, 100).lineTo(550, 100).stroke();
    doc.moveDown(2);

    // --- DOCUMENT TITLE ---
    let title = '';
    let docCode = '';

    if (documentType === 'tanda_terima') {
      title = 'SURAT TANDA TERIMA KENDARAAN';
      docCode = 'STT';
    } else if (documentType === 'invoice') {
      title = 'INVOICE / TAGIHAN';
      docCode = 'INV';
    } else if (documentType === 'bukti_bayar') {
      title = 'BUKTI PEMBAYARAN (LUNAS)';
      docCode = 'RCP';
    }

    const docNumber = `${docCode}/${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${idSuffix}`;

    doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Nomor: ${docNumber}`, { align: 'center' });
    doc.moveDown(2);

    // --- DETAILS ---
    const startY = doc.y;
    
    doc.text(`Tanggal: ${dateStr} ${timeStr}`, 50, startY);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Kepada Yth:', 50);
    doc.font('Helvetica').text(customerName);
    doc.text(motorDetails);
    doc.moveDown(2);

    // --- ITEMS ---
    doc.font('Helvetica-Bold').text('Rincian Pekerjaan / Layanan:', 50);
    doc.moveDown(0.5);
    doc.font('Helvetica');

    const itemsList = finalItems.split(/,|\n/).map(i => i.trim()).filter(Boolean);
    itemsList.forEach((item, index) => {
      doc.text(`${index + 1}. ${item}`, { indent: 10 });
    });
    doc.moveDown();

    // --- NOTES ---
    if (notes && notes !== '-') {
      doc.moveDown();
      doc.font('Helvetica-Bold').text('Catatan:', 50);
      doc.font('Helvetica').text(notes);
    }

    // --- TOTAL & FOOTER ---
    if (documentType !== 'tanda_terima') {
      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);
      
      doc.fontSize(14).font('Helvetica-Bold').text(`TOTAL: ${formatCurrency(finalTotal)}`, { align: 'right' });
      
      if (documentType === 'bukti_bayar') {
        doc.fontSize(10).font('Helvetica').text(`Metode Pembayaran: ${paymentMethod}`, { align: 'right' });
        doc.fillColor('green').text('LUNAS', { align: 'right' });
        doc.fillColor('black');
      } else {
        doc.fontSize(10).font('Helvetica').text('Silakan lakukan pembayaran sesuai total tagihan.', { align: 'right' });
      }
    } else {
      doc.moveDown(2);
      doc.font('Helvetica-Oblique').fontSize(10).text('Kendaraan telah diterima untuk dilakukan pengecekan/pengerjaan.', { align: 'center' });
    }

    // Signatures
    doc.moveDown(4);
    const signatureY = doc.y;
    doc.text('Hormat Kami,', 400, signatureY, { align: 'center', width: 150 });
    doc.moveDown(3);
    doc.text('( Admin Bosmat )', 400, doc.y, { align: 'center', width: 150 });

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