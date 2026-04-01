const prisma = require('../../lib/prisma.js');
const studioMetadata = require('../constants/studioMetadata');

const COATING_MAINTENANCE_MESSAGES = {
  h7: (name, vehicle) => `Halo Kak ${name},\n\nIni dari admin ${studioMetadata.name}. Sekedar mengingatkan bahwa jadwal *Coating Maintenance* untuk kendaraan ${vehicle} Kakak jatuh tempo dalam *7 hari* lagi.\n\nAgar kualitas coating tetap prima dan garansi tetap berlaku, yuk jadwalkan maintenance-nya sekarang. Kakak bisa balas pesan ini untuk booking jadwal ya!`,
  h3: (name, vehicle) => `Halo Kak ${name},\n\nMengingatkan kembali ya Kak, jadwal *Coating Maintenance* untuk ${vehicle} sisa *3 hari* lagi. \n\nJangan sampai terlewat ya Kak agar perlindungan cat kendaraannya tetap maksimal. Mau booking untuk hari apa Kak?`,
  h1: (name, vehicle) => `Panggilan terakhir untuk Kak ${name}! 🚨\n\nBesok adalah hari jatuh tempo *Coating Maintenance* untuk ${vehicle} Kakak.\n\nJika belum sempat ke ${studioMetadata.name} besok, Kakak tetap bisa booking jadwalnya hari ini agar hak maintenance-nya tidak hangus. Yuk balas pesan ini untuk reservasi!`,
};

async function processCoatingReminders(client) {
  if (!client) return;
  console.log('[CoatingReminders] Starting daily SQL check...');

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const records = await prisma.coatingMaintenance.findMany({
      where: {
        status: { in: ['pending', 'reminded_h7', 'reminded_h3'] }
      }
    });
      
    if (records.length === 0) {
      console.log('[CoatingReminders] No pending maintenance reminders found in SQL.');
      return;
    }

    const updates = [];

    for (const record of records) {
      if (!record.maintenanceDate || !record.customerPhone) continue;

      const maintenanceDate = new Date(record.maintenanceDate);
      const mDateMidnight = new Date(maintenanceDate);
      mDateMidnight.setHours(0, 0, 0, 0);

      const diffTime = mDateMidnight.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let messageToSend = null;
      let newStatus = null;

      if (diffDays === 7 && record.status === 'pending') {
        messageToSend = COATING_MAINTENANCE_MESSAGES.h7(record.customerName, record.vehicleInfo);
        newStatus = 'reminded_h7';
      } else if (diffDays === 3 && record.status === 'reminded_h7') {
        messageToSend = COATING_MAINTENANCE_MESSAGES.h3(record.customerName, record.vehicleInfo);
        newStatus = 'reminded_h3';
      } else if (diffDays === 1 && record.status === 'reminded_h3') {
        messageToSend = COATING_MAINTENANCE_MESSAGES.h1(record.customerName, record.vehicleInfo);
        newStatus = 'reminded_h1';
      }

      if (messageToSend && newStatus) {
        const { normalizeWhatsappNumber } = require('./humanHandover.js');
        const phone = normalizeWhatsappNumber(record.customerPhone);
        if (!phone) {
          console.warn(`[CoatingReminders] Invalid phone for record ${record.id}: ${record.customerPhone}`);
          continue;
        }

        try {
          await client.sendText(phone, messageToSend);
          console.log(`[CoatingReminders] Sent H-${diffDays} reminder to ${phone}`);
          
          await prisma.coatingMaintenance.update({
            where: { id: record.id },
            data: {
              status: newStatus,
              reminderSent: true,
              reminderSentAt: new Date()
            }
          });
        } catch (err) {
          console.error(`[CoatingReminders] Failed to send WA to ${phone}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('[CoatingReminders] Error checking SQL reminders:', err);
  }
}

function initCoatingRemindersSchedule(client) {
  console.log('[CoatingReminders] SQL Scheduler initialized.');
  setTimeout(() => processCoatingReminders(client), 10000);
  setInterval(() => processCoatingReminders(client), 12 * 60 * 60 * 1000);
}

async function markCoatingReminderAsReplied(customerPhone) {
  if (!customerPhone) return;
  try {
    let rawPhone = customerPhone.replace(/\D/g, '');
    let localPhone = rawPhone.startsWith('62') ? '0' + rawPhone.slice(2) : (rawPhone.startsWith('0') ? rawPhone : '0' + rawPhone);

    const records = await prisma.coatingMaintenance.findMany({
      where: {
        status: { in: ['reminded_h7', 'reminded_h3', 'reminded_h1'] }
      }
    });

    for (const record of records) {
      const dbPhone = record.customerPhone ? record.customerPhone.replace(/\D/g, '') : '';
      if (dbPhone.endsWith(localPhone) || rawPhone.endsWith(dbPhone)) {
        await prisma.coatingMaintenance.update({
          where: { id: record.id },
          data: {
            status: 'replied',
            reminderSentAt: new Date() // Reusing the field or should use updated_at
          }
        });
        console.log(`[CoatingReminders] SQL: Marked reminder for ${customerPhone} as replied.`);
      }
    }
  } catch (err) {
    console.error('[CoatingReminders] Error marking SQL reminder as replied:', err);
  }
}

module.exports = {
  processCoatingReminders,
  initCoatingRemindersSchedule,
  markCoatingReminderAsReplied
};
