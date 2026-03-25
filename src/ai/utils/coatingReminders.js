const { getFirebaseAdmin } = require('../../lib/firebaseAdmin.js');
const db = getFirebaseAdmin().firestore();

const COATING_MAINTENANCE_MESSAGES = {
  h7: (name, vehicle) => `Halo Kak ${name},\n\nIni dari admin Bosmat Detailing. Sekedar mengingatkan bahwa jadwal *Coating Maintenance* untuk kendaraan ${vehicle} Kakak jatuh tempo dalam *7 hari* lagi.\n\nAgar kualitas coating tetap prima dan garansi tetap berlaku, yuk jadwalkan maintenance-nya sekarang. Kakak bisa balas pesan ini untuk booking jadwal ya!`,
  h3: (name, vehicle) => `Halo Kak ${name},\n\nMengingatkan kembali ya Kak, jadwal *Coating Maintenance* untuk ${vehicle} sisa *3 hari* lagi. \n\nJangan sampai terlewat ya Kak agar perlindungan cat kendaraannya tetap maksimal. Mau booking untuk hari apa Kak?`,
  h1: (name, vehicle) => `Panggilan terakhir untuk Kak ${name}! 🚨\n\nBesok adalah hari jatuh tempo *Coating Maintenance* untuk ${vehicle} Kakak.\n\nJika belum sempat ke Garasi 54 besok, Kakak tetap bisa booking jadwalnya hari ini agar hak maintenance-nya tidak hangus. Yuk balas pesan ini untuk reservasi!`,
};

function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * Checks pending coating maintenance records and triggers WhatsApp messages.
 * @param {import('@wppconnect-team/wppconnect').Whatsapp} client
 */
async function processCoatingReminders(client) {
  if (!client) return;
  console.log('[CoatingReminders] Starting daily check...');

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snapshot = await db.collection('coatingMaintenance')
      .where('status', 'in', ['pending', 'reminded_h7', 'reminded_h3'])
      .get();
      
    if (snapshot.empty) {
      console.log('[CoatingReminders] No pending maintenance reminders found.');
      return;
    }

    const updates = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.maintenanceDate || !data.customerPhone) continue;

      let maintenanceDate;
      // Handle Firestore Timestamp
      if (typeof data.maintenanceDate.toDate === 'function') {
        maintenanceDate = data.maintenanceDate.toDate();
      } else {
        maintenanceDate = new Date(data.maintenanceDate);
      }
      
      const mDateMidnight = new Date(maintenanceDate);
      mDateMidnight.setHours(0, 0, 0, 0);

      const diffTime = mDateMidnight.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let messageToSend = null;
      let newStatus = null;

      if (diffDays === 7 && data.status === 'pending') {
        messageToSend = COATING_MAINTENANCE_MESSAGES.h7(data.customerName, data.vehicleInfo);
        newStatus = 'reminded_h7';
      } else if (diffDays === 3 && data.status === 'reminded_h7') {
        messageToSend = COATING_MAINTENANCE_MESSAGES.h3(data.customerName, data.vehicleInfo);
        newStatus = 'reminded_h3';
      } else if (diffDays === 1 && data.status === 'reminded_h3') {
        messageToSend = COATING_MAINTENANCE_MESSAGES.h1(data.customerName, data.vehicleInfo);
        newStatus = 'reminded_h1';
      }

      if (messageToSend && newStatus) {
        // Normalize phone number
        let phone = data.customerPhone.replace(/\D/g, '');
        if (phone.startsWith('0')) {
          phone = `62${phone.slice(1)}`;
        }
        if (!phone.includes('@c.us')) {
          phone = `${phone}@c.us`;
        }

        try {
          await client.sendText(phone, messageToSend);
          console.log(`[CoatingReminders] Sent H-${diffDays} reminder to ${phone}`);
          
          updates.push(
            doc.ref.update({
              status: newStatus,
              lastRemindedAt: new Date()
            })
          );
        } catch (err) {
          console.error(`[CoatingReminders] Failed to send WA to ${phone}:`, err);
        }
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`[CoatingReminders] Updated ${updates.length} records.`);
    }

  } catch (err) {
    console.error('[CoatingReminders] Error checking reminders:', err);
  }
}

/**
 * Initializes the automated schedule.
 * Runs once immediately, then every 12 hours.
 */
function initCoatingRemindersSchedule(client) {
  console.log('[CoatingReminders] Initializing schedule scheduler...');
  
  // Run 10 seconds after init to ensure client is ready
  setTimeout(() => processCoatingReminders(client), 10000);

  // Run every 12 hours
  setInterval(() => {
    processCoatingReminders(client);
  }, 12 * 60 * 60 * 1000);
}

/**
 * Marks a coating maintenance record as replied if the user responded to a reminder.
 */
async function markCoatingReminderAsReplied(customerPhone) {
  if (!customerPhone) return;
  try {
    let rawPhone = customerPhone.replace(/\D/g, '');
    let localPhone = rawPhone.startsWith('62') ? '0' + rawPhone.slice(2) : rawPhone;

    const snapshot = await db.collection('coatingMaintenance')
      .where('status', 'in', ['reminded_h7', 'reminded_h3', 'reminded_h1'])
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const dbPhone = data.customerPhone ? data.customerPhone.replace(/\D/g, '') : '';
      
      if (dbPhone.endsWith(localPhone) || rawPhone.endsWith(dbPhone)) {
        await doc.ref.update({
          status: 'replied',
          repliedAt: new Date()
        });
        console.log(`[CoatingReminders] Marked reminder for ${customerPhone} as replied.`);
      }
    }
  } catch (err) {
    console.error('[CoatingReminders] Error marking reminder as replied:', err);
  }
}

module.exports = {
  processCoatingReminders,
  initCoatingRemindersSchedule,
  markCoatingReminderAsReplied
};
