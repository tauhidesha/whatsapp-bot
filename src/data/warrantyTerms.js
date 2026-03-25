// File: src/data/warrantyTerms.js
// Full warranty terms for repaint and coating services

const warrantyRepaint = {
  title: 'Sertifikat Garansi Repaint Motor',
  duration: '1 (Satu) Tahun',
  durationMonths: 12,
  sections: [
    {
      heading: '1. Cakupan Garansi',
      body: 'Garansi ini menjamin perbaikan ulang tanpa biaya tambahan (jasa dan material) untuk kerusakan yang murni disebabkan oleh kegagalan aplikasi cat atau cacat pada material produk.',
      items: [
        'Cat mengelupas (peeling), melepuh (bubbling), atau keriting dengan sendirinya.',
        'Cat mengalami retak rambut (cracking) pada area pengecatan yang bukan disebabkan oleh tekanan atau benturan.',
        'Lapisan pernis (clear coat) menguning atau memudar secara tidak wajar dalam pemakaian normal.',
      ],
    },
    {
      heading: '2. Pengecualian Garansi (Klaim Tidak Berlaku)',
      body: 'Garansi akan otomatis hangus dan tidak dapat diklaim apabila kerusakan disebabkan oleh faktor eksternal atau kelalaian pengguna, antara lain:',
      items: [
        'Goresan, lecet, penyok, atau pecah akibat kecelakaan, benturan, terjatuh, atau gesekan benda keras (termasuk lontaran kerikil di jalan).',
        'Kerusakan akibat paparan bahan kimia korosif seperti minyak rem, air aki, thinner, bensin yang dibiarkan mengering, atau kotoran burung/getah pohon yang tidak segera dibersihkan.',
        'Kesalahan metode perawatan, seperti mencuci menggunakan sabun berbahan keras (sabun colek/deterjen), penggunaan kompon yang terlalu abrasif, atau kerusakan pernis akibat pemasangan/pelepasan stiker dan decal.',
        'Kerusakan yang timbul akibat bencana alam (banjir, kebakaran, gempa bumi) atau huru-hara.',
        'Kendaraan atau panel yang bermasalah telah dibongkar, dipoles paksa, atau diperbaiki oleh pihak bengkel lain.',
      ],
    },
    {
      heading: '3. Prosedur Klaim Garansi',
      body: '',
      items: [
        'Hubungi pihak bengkel secepatnya setelah menemukan indikasi kerusakan pada cat.',
        'Bawa kendaraan beserta Nota Pembayaran Asli ke bengkel kami untuk dilakukan inspeksi.',
        'Tim teknisi akan melakukan pengecekan fisik untuk memastikan apakah kerusakan masuk dalam cakupan garansi atau akibat kelalaian pemakaian.',
        'Apabila klaim disetujui, kami akan menjadwalkan perbaikan ulang khusus pada panel yang mengalami masalah (tidak termasuk panel lain yang kondisinya masih baik).',
      ],
    },
  ],
};

const warrantyCoating = {
  title: 'Sertifikat Garansi Ceramic Coating',
  duration: '1 (Satu) Tahun',
  durationMonths: 12,
  maintenanceIntervalMonths: 3,
  maintenancePrices: { S: 100000, M: 125000, L: 150000, XL: 300000 },
  sections: [
    {
      heading: '1. Kewajiban Perawatan Berkala (Mandatory Maintenance)',
      body: 'Untuk menjaga kualitas lapisan ceramic coating dan memastikan garansi tetap berlaku, pemilik kendaraan diwajibkan untuk melakukan maintenance rutin setiap 3 (tiga) bulan sekali di bengkel/studio kami.',
      items: [
        'Ukuran S (Small): Rp 100.000',
        'Ukuran M (Medium): Rp 125.000',
        'Ukuran L (Large): Rp 150.000',
        'Ukuran XL (Extra Large): Rp 300.000',
        'Toleransi keterlambatan jadwal maintenance: 7 hari dari tanggal yang ditentukan.',
        'Jika pelanggan tidak melakukan maintenance sesuai jadwal, maka garansi dinyatakan Otomatis Hangus (Void).',
      ],
    },
    {
      heading: '2. Cakupan Garansi',
      body: 'Garansi ini menjamin perbaikan lapisan coating tanpa biaya tambahan (hanya pada panel yang bermasalah) untuk kondisi berikut:',
      items: [
        'Lapisan coating mengalami retak (cracking), terkelupas (peeling), atau memudar/menguning (yellowing) secara tidak wajar yang diakibatkan oleh cacat produk atau kegagalan proses aplikasi.',
        'Hilangnya efek daun talas (hydrophobic) secara drastis sebelum masa garansi habis, dengan catatan riwayat maintenance per 3 bulan selalu rutin dilakukan.',
      ],
    },
    {
      heading: '3. Pengecualian Garansi (Klaim Tidak Berlaku)',
      body: 'Garansi tidak berlaku apabila kerusakan pada lapisan coating disebabkan oleh faktor eksternal atau kelalaian pengguna, seperti:',
      items: [
        'Goresan, baret, lecet, penyok, atau kerusakan fisik akibat kecelakaan, benturan, dan gesekan benda keras/batu.',
        'Timbulnya jamur bodi (water spot) yang diakibatkan oleh air hujan atau air cucian yang dibiarkan mengering sendiri (tidak langsung dilap).',
        'Kerusakan akibat paparan getah pohon, kotoran burung, cipratan aspal, cairan asam, minyak rem, atau bahan kimia korosif lainnya yang dibiarkan terlalu lama menempel pada bodi.',
        'Kesalahan perawatan mandiri, seperti mencuci menggunakan sabun cuci piring, deterjen, sabun colek, atau shampo kendaraan yang tidak memiliki pH netral (pH balance).',
        'Kendaraan telah dicat ulang (repaint), dikompon paksa, atau dipoles oleh pihak bengkel lain setelah aplikasi coating dari kami.',
      ],
    },
    {
      heading: '4. Prosedur Klaim Garansi',
      body: '',
      items: [
        'Klaim garansi wajib menyertakan Kartu Garansi atau Buku Riwayat Maintenance asli yang membuktikan bahwa kendaraan selalu dirawat rutin setiap 3 bulan di bengkel kami.',
        'Bawa kendaraan yang bermasalah ke bengkel kami untuk dilakukan inspeksi oleh tim teknisi.',
        'Jika disetujui, kami akan melakukan proses re-coating khusus pada area/panel yang mengalami kegagalan produk secara gratis.',
      ],
    },
  ],
};

module.exports = { warrantyRepaint, warrantyCoating };
