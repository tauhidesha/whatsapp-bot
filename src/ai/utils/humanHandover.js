const prisma = require('../../lib/prisma.js');
const { DateTime } = require('luxon');

const BOSMAT_ADMIN_NUMBER = process.env.BOSMAT_ADMIN_NUMBER || process.env.ADMIN_WHATSAPP_NUMBER;
const NOTIFY_BOOKING_CREATION = process.env.NOTIFY_BOOKING_CREATION !== 'true';
const DEFAULT_ADDITIONAL_SERVICE = process.env.BOOKING_DEFAULT_ADDITIONAL_SERVICE || null;

/**
 * Tidak lagi melakukan normalisasi agresif. 
 * Memastikan suffix @c.us atau @lid tetap terjaga.
 */
function getIdentifier(number) {
  if (!number) return null;
  let trimmed = number.trim();
  if (!trimmed) return null;

  // Jika sudah punya suffix, biarkan saja
  if (trimmed.endsWith('@c.us') || trimmed.endsWith('@lid')) {
    return trimmed;
  }

  // Jika tidak ada suffix, default ke @c.us untuk backward compatibility/input manual
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  
  return `${digits}@c.us`;
}

async function sendWhatsappNotification(message) {
  if (!BOSMAT_ADMIN_NUMBER) {
    console.warn('[humanHandover] BOSMAT_ADMIN_NUMBER tidak diset. Notifikasi WA tidak dikirim.');
    return;
  }

  const target = getIdentifier(BOSMAT_ADMIN_NUMBER);
  if (!target) {
    console.warn('[humanHandover] BOSMAT_ADMIN_NUMBER tidak valid. Notifikasi WA tidak dikirim.');
    return;
  }

  const client = global.whatsappClient;
  if (!client || typeof client.sendText !== 'function') {
    console.warn('[humanHandover] whatsappClient belum tersedia. Notifikasi WA tidak dikirim.');
    return;
  }

  try {
    await client.sendText(target, message);
    console.log('[humanHandover] Notifikasi WA terkirim ke admin:', target);

    // --- Simpan ke SQL tabel DirectMessage ---
    try {
      const phone = target.replace(/@c\.us$|@lid$/, '');
      
      // Get or create admin customer record
      const customer = await prisma.customer.upsert({
        where: { phone },
        update: {
          lastMessage: message,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          phone,
          name: 'Admin BosMat',
          lastMessage: message,
          lastMessageAt: new Date(),
        }
      });

      await prisma.directMessage.create({
        data: {
          customerId: customer.id,
          senderId: 'ai',
          role: 'ai',
          content: message,
          createdAt: new Date(),
        }
      });
    } catch (err) {
      console.warn('[humanHandover] Gagal menyimpan notifikasi admin ke SQL:', err.message);
    }
  } catch (error) {
    console.error('[humanHandover] Gagal mengirim notifikasi WA ke admin:', error);
  }
}

async function notifyBosMat(senderNumber, customerQuestion, reason) {
  // Notifikasi via key-value store untuk audit atau tabel khusus
  try {
    const phone = senderNumber.replace(/[^0-9]/g, '');
    await prisma.keyValueStore.upsert({
      where: { collection_key: { collection: 'humanHandovers', key: `${phone}_${Date.now()}` } },
      update: {},
      create: {
        collection: 'humanHandovers',
        key: `${phone}_${Date.now()}`,
        value: {
          senderNumber,
          customerQuestion,
          reason,
          status: 'pending',
          createdAt: new Date().toISOString()
        }
      }
    });
  } catch (err) {
    console.warn('[humanHandover] Gagal catat handover ke KVStore:', err.message);
  }

  const messageLines = [
    '🔔 *Human Handover Request*',
    `👤 Pelanggan: ${senderNumber}`,
    `📝 Alasan: ${reason}`,
    '',
    '❓ Pertanyaan:',
    customerQuestion,
  ];

  await sendWhatsappNotification(messageLines.join('\n'));
}

async function notifyVisitIntent({ senderNumber, senderName, visitTime, purpose, additionalNotes }) {
  if (!senderNumber) {
    throw new Error('[humanHandover] senderNumber wajib untuk notifikasi kunjungan.');
  }

  const displayName = senderName && senderName.trim() ? senderName.trim() : senderNumber;
  const lines = [
    '👋 *Info Konsultasi di Studio*',
    `👤 Pelanggan: ${displayName}`,
    `📞 Kontak: ${senderNumber}`,
  ];

  if (visitTime && visitTime.trim()) {
    lines.push(`🕒 Rencana Datang: ${visitTime.trim()}`);
  }

  if (purpose && purpose.trim()) {
    lines.push(`🎯 Keperluan: ${purpose.trim()}`);
  }

  if (additionalNotes && additionalNotes.trim()) {
    lines.push('', additionalNotes.trim());
  }

  lines.push('', '⚠️ Pastikan studio siap menyambut.');

  await sendWhatsappNotification(lines.join('\n'));
}

async function notifyNewBooking(bookingData) {
  if (!NOTIFY_BOOKING_CREATION) {
    return;
  }

  const additionalService = bookingData.additionalService 
    || (bookingData.homeService?.requested && bookingData.homeService?.type)
    || DEFAULT_ADDITIONAL_SERVICE;

  const lines = [
    '🆕 *Booking Baru*',
    `👤 Nama: ${bookingData.customerName || '-'}`,
    `📞 No HP: ${bookingData.customerPhone || '-'}`,
    `🏍️ Motor: ${bookingData.vehicleInfo || '-'}`,
    `🕒 Jadwal: ${bookingData.bookingDate || '-'} ${bookingData.bookingTime || '-'}`,
    `🛠️ Layanan: ${Array.isArray(bookingData.services) ? bookingData.services.join(', ') : '-'}`,
  ];

  if (additionalService) {
    lines.push(`➕ Layanan Tambahan: ${additionalService}`);
  }

  if (bookingData.homeService?.requested) {
    const formatter = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    });

    lines.push('', '🚚 Home Service: Ya');
    if (typeof bookingData.homeService.distanceKm === 'number') {
      lines.push(`   • Jarak: ${bookingData.homeService.distanceKm.toFixed(2)} km`);
    }
    if (typeof bookingData.homeService.additionalFee === 'number') {
      lines.push(`   • Biaya tambahan: ${formatter.format(Math.round(bookingData.homeService.additionalFee))}`);
    }
    if (bookingData.homeService.address) {
      lines.push(`   • Alamat: ${bookingData.homeService.address}`);
    } else if (bookingData.homeService.label) {
      lines.push(`   • Lokasi: ${bookingData.homeService.label}`);
    }
    if (bookingData.homeService.shareLocationUrl) {
      lines.push(`   • Share Lokasi: ${bookingData.homeService.shareLocationUrl}`);
    }
  } else if (bookingData.pickupService?.requested) {
    lines.push('', '🚚 Jemput-Antar: Ya');
    if (bookingData.pickupService.address) {
      lines.push(`   • Alamat: ${bookingData.pickupService.address}`);
    }
    if (bookingData.pickupService.shareLocationUrl) {
      lines.push(`   • Share Lokasi: ${bookingData.pickupService.shareLocationUrl}`);
    }
  }

  if (bookingData.notes) {
    lines.push('', `🗒️ Catatan: ${bookingData.notes}`);
  }

  await sendWhatsappNotification(lines.join('\n'));
}

async function setSnoozeMode(senderNumber, durationMinutes = 60, options = {}) {
  const { reason = null, manual = false } = options;
  const identifier = getIdentifier(senderNumber) || senderNumber;
  const phone = identifier.replace(/@c\.us$|@lid$/, '');

  let expiresAtDate = null;

  if (!manual) {
    const effectiveDuration = typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 60;
    expiresAtDate = DateTime.now().plus({ minutes: effectiveDuration }).toJSDate();
  }

  // 1. Update HandoverSnooze table
  await prisma.handoverSnooze.upsert({
    where: { id: identifier },
    update: {
      expiresAt: expiresAtDate,
      manual,
      reason,
      createdAt: new Date(),
    },
    create: {
      id: identifier,
      customerId: phone,
      expiresAt: expiresAtDate,
      manual,
      reason,
    }
  });
  
  // 2. Sync to Customer table
  try {
    let customer = await prisma.customer.findUnique({ where: { phone } });
    if (!customer && identifier.endsWith('@lid')) {
      customer = await prisma.customer.findFirst({ where: { whatsappLid: identifier } });
    }
    if (customer) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          aiPaused: true,
          aiPausedUntil: expiresAtDate,
          aiPauseReason: reason || (manual ? 'manual-toggle' : 'timed-toggle'),
          updatedAt: new Date(),
        }
      });
    }
  } catch (err) {
    console.warn('[humanHandover] Gagal sinkronisasi snooze ke Customer:', err.message);
  }

  console.log('[humanHandover] Snooze SQL aktif untuk', identifier, manual ? '(manual)' : `(durasi ${durationMinutes} menit)`);
}

async function clearSnoozeMode(senderNumber) {
  const identifier = getIdentifier(senderNumber) || senderNumber;
  const phone = identifier.replace(/@c\.us$|@lid$/, '');
  
  try {
    await prisma.handoverSnooze.delete({ where: { id: identifier } }).catch(() => {});
    
    // Sync to Customer table
    try {
      let customer = await prisma.customer.findUnique({ where: { phone } });
      if (!customer && identifier.endsWith('@lid')) {
        customer = await prisma.customer.findFirst({ where: { whatsappLid: identifier } });
      }
      if (customer) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            aiPaused: false,
            aiPausedUntil: null,
            aiPauseReason: null,
            updatedAt: new Date(),
          }
        });
      }
    } catch (err) {
      // Ignored
    }
    console.log('[humanHandover] Snooze SQL dinonaktifkan untuk', identifier);
  } catch (error) {
    console.warn('[humanHandover] Gagal menonaktifkan snooze SQL:', error);
  }
}

async function getSnoozeInfo(senderNumber, { cleanExpired = false } = {}) {
  const identifier = getIdentifier(senderNumber) || senderNumber;
  
  try {
    const snooze = await prisma.handoverSnooze.findUnique({
      where: { id: identifier }
    });

    if (!snooze) {
      return { active: false, manual: false, durationMinutes: null, expiresAt: null, reason: null };
    }

    const { manual, expiresAt, reason, createdAt, updatedAt } = snooze;
    const now = new Date();

    let active = manual;
    if (!manual) {
      if (expiresAt && expiresAt > now) {
        active = true;
      } else {
        active = false;
        if (cleanExpired) {
          await clearSnoozeMode(senderNumber);
        }
      }
    }

    return {
      active,
      manual,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      reason,
      createdAt: createdAt ? createdAt.toISOString() : null,
      updatedAt: updatedAt ? updatedAt.toISOString() : null,
    };
  } catch (error) {
    console.error('[humanHandover] Error getting snooze info:', error);
    return { active: false };
  }
}

async function isSnoozeActive(senderNumber) {
  const info = await getSnoozeInfo(senderNumber, { cleanExpired: true });
  return info.active;
}

module.exports = {
  notifyBosMat,
  notifyVisitIntent,
  notifyNewBooking,
  setSnoozeMode,
  clearSnoozeMode,
  getSnoozeInfo,
  getIdentifier,
  isSnoozeActive,
};