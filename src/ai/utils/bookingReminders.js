// File: src/ai/utils/bookingReminders.js
const { DateTime } = require('luxon');
const prisma = require('../../lib/prisma.js');
const { getIdentifier } = require('./humanHandover.js');
const studioMetadata = require('../constants/studioMetadata');

const REMINDER_ENABLED = process.env.BOOKING_REMINDER_ENABLED !== 'false';
const REMINDER_HOUR = parseInt(process.env.BOOKING_REMINDER_HOUR || '8', 10);
const REMINDER_WINDOW_MINUTES = parseInt(process.env.BOOKING_REMINDER_WINDOW || '30', 10);
const REMINDER_INTERVAL_MINUTES = parseInt(process.env.BOOKING_REMINDER_INTERVAL || '15', 10);
const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Jakarta';

let reminderIntervalHandle = null;

async function sendBookingReminders(force = false) {
  if (!REMINDER_ENABLED) return;

  const { generateFollowUpMessage } = require('../agents/followUpEngine/messageGenerator');
  const now = DateTime.now().setZone(TIMEZONE);
  if (!force && (now.hour !== REMINDER_HOUR || now.minute >= REMINDER_WINDOW_MINUTES)) {
    return;
  }

  // Find bookings for today (local time)
  const startOfDayLocal = now.startOf('day');
  const endOfDayLocal = now.endOf('day');

  const startOfDayUTC = startOfDayLocal.toJSDate();
  const endOfDayUTC = endOfDayLocal.toJSDate();

  try {
    const bookings = await prisma.booking.findMany({
      where: {
        bookingDate: {
          gte: startOfDayUTC,
          lte: endOfDayUTC
        },
        reminderSent: false,
        status: {
          notIn: ['CANCELLED', 'COMPLETED', 'IN_PROGRESS']
        }
      },
      include: {
        customer: {
          select: { phone: true, name: true }
        }
      }
    });

    if (bookings.length === 0) return;

    console.log(`[bookingReminders] Menemukan ${bookings.length} booking SQL untuk diingatkan oleh Zoya`);

    for (const booking of bookings) {
      const target = booking.customerPhone || (booking.customer && booking.customer.phone);
      let normalizedTarget = getIdentifier(target);
      if (!normalizedTarget) continue;

      const bookingTime = DateTime.fromJSDate(booking.bookingDate).setZone(TIMEZONE).toFormat('HH:mm');
      
      try {
        const customerData = {
          name: booking.customerName || (booking.customer && booking.customer.name) || 'Kak',
          context: {
            bookingTime: bookingTime,
            target_service: booking.serviceType || 'layanan studio',
            customerLabel: 'active'
          }
        };

        const message = await generateFollowUpMessage(customerData, { 
          angle: 'booking_reminder',
          type: 'booking_reminder'
        });

        if (message) {
          try {
            await global.whatsappClient.sendText(normalizedTarget, message);
          } catch (initialError) {
            if (initialError.message && initialError.message.includes('No LID')) {
              console.warn(`[bookingReminders] Send failed with No LID for: ${normalizedTarget}`);
              const cleanPhone = normalizedTarget.replace(/@c\.us$|@lid$/, '');
              const customerFallback = await prisma.customer.findFirst({
                where: {
                  OR: [
                    { whatsappLid: normalizedTarget },
                    { whatsappLid: cleanPhone },
                    { phone: normalizedTarget },
                    { phone: cleanPhone }
                  ]
                },
                select: { phone: true, whatsappLid: true }
              });

              let fallbackTarget = null;
              if (normalizedTarget.endsWith('@c.us') && customerFallback?.whatsappLid) {
                fallbackTarget = customerFallback.whatsappLid;
              } else if (normalizedTarget.endsWith('@lid') && customerFallback?.phone) {
                fallbackTarget = customerFallback.phone.includes('@') ? customerFallback.phone : `${customerFallback.phone}@c.us`;
              }

              // Brute-force flip if DB had no distinct alternative
              if (!fallbackTarget || fallbackTarget === normalizedTarget) {
                const rawDigits = cleanPhone.replace(/\D/g, '');
                if (normalizedTarget.endsWith('@c.us')) {
                  fallbackTarget = `${rawDigits}@lid`;
                } else if (normalizedTarget.endsWith('@lid')) {
                  fallbackTarget = `${rawDigits}@c.us`;
                }
                console.log(`[bookingReminders] DB had no distinct alt, brute-force flip: ${fallbackTarget}`);
              }

              if (fallbackTarget && fallbackTarget !== normalizedTarget) {
                console.log(`[bookingReminders] Retrying with fallback: ${fallbackTarget}`);
                await global.whatsappClient.sendText(fallbackTarget, message);
                normalizedTarget = fallbackTarget;
              } else {
                throw initialError;
              }
            } else {
              throw initialError;
            }
          }
          console.log('[bookingReminders] AI Reminder terkirim ke', normalizedTarget);
          
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              reminderSent: true,
              reminderSentAt: new Date(),
            }
          });
        }
      } catch (err) {
        console.error(`[bookingReminders] Gagal mengirim AI reminder ke ${normalizedTarget}:`, err);
      }
    }
  } catch (err) {
    console.error('[bookingReminders] SQL Error:', err.message);
  }
}

// startBookingReminderScheduler removed as it is now called by the central scheduler

function startBookingReminderScheduler() {
  if (!REMINDER_ENABLED) {
    console.log('[bookingReminders] Reminder booking dimatikan (BOOKING_REMINDER_ENABLED=false)');
    return;
  }

  if (reminderIntervalHandle) return;

  const intervalMs = REMINDER_INTERVAL_MINUTES * 60 * 1000;
  reminderIntervalHandle = setInterval(() => {
    sendBookingReminders().catch(error => {
      console.error('[bookingReminders] Error saat mengirim reminder:', error);
    });
  }, intervalMs);

  console.log(`[bookingReminders] SQL Scheduler dimulai. Interval ${REMINDER_INTERVAL_MINUTES} menit, pengingat jam ${REMINDER_HOUR}:00 ${TIMEZONE}`);
}

module.exports = {
  startBookingReminderScheduler,
  sendBookingReminders,
};
