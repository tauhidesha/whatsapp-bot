// File: src/ai/tools/checkBookingAvailabilityTool.js
// Check availability for booking slots with Prisma-backed constraints.

const { z } = require('zod');
const prisma = require('../../lib/prisma');
const { parseDateTime } = require('../utils/dateTime');
const { DateTime } = require('luxon');

const STATUS_ACTIVE = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'IN_QUEUE'];

const InputSchema = z.object({
  bookingDate: z.string().describe('Tanggal booking. Format YYYY-MM-DD atau bahasa alami seperti "besok".'),
  bookingTime: z.string().optional().describe('Jam booking. Format HH:mm atau bahasa alami seperti "jam 2 siang". Jika kosong, tool akan cari slot tersedia.'),
  serviceName: z.string().optional().describe('Nama layanan yang ingin dibooking'),
  estimatedDurationMinutes: z.number().optional().describe('Estimasi durasi layanan dalam menit'),
});

function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  const d = new Date(date);
  const hours = `${d.getHours()}`.padStart(2, '0');
  const minutes = `${d.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

function determineServiceCategory(serviceName) {
  const lower = serviceName.toLowerCase();
  if (lower.includes('repaint') || lower.includes('repair')) return 'repaint';
  if (lower.includes('coating')) return 'coating';
  if (lower.includes('detailing')) return 'detailing';
  if (lower.includes('cuci') || lower.includes('wash')) return 'detailing';
  return 'general';
}

function computeFinishDate(startDate, durationMinutes) {
  return new Date(startDate.getTime() + durationMinutes * 60000);
}

function extractDurationMinutes(data) {
  if (typeof data.estimatedDurationMinutes === 'number') {
    return data.estimatedDurationMinutes;
  }
  if (typeof data.estimatedDuration === 'number') {
    return data.estimatedDuration;
  }
  if (typeof data.estimatedDuration === 'string') {
    const num = parseInt(data.estimatedDuration, 10);
    if (!Number.isNaN(num)) {
      return num;
    }
    const matchHours = data.estimatedDuration.match(/(\d+)\s*jam/i);
    if (matchHours) {
      return parseInt(matchHours[1], 10) * 60;
    }
  }
  return 180; // default 3 jam
}

function hasOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

async function getDailyBookings(date, category) {
  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

  const where = {
    bookingDate: {
      gte: startOfDay,
      lte: endOfDay,
    },
    status: { in: STATUS_ACTIVE }
  };

  if (category) {
    where.category = category;
  }

  const bookings = await prisma.booking.findMany({
    where,
    select: {
      id: true,
      bookingDate: true,
      serviceType: true,
      status: true
    }
  });

  // Add duration to each booking
  const bookingsWithDuration = bookings.map(b => ({
    ...b,
    estimatedDurationMinutes: extractDurationMinutes(b)
  }));

  console.log(`[checkBookingAvailability] Ditemukan ${bookings.length} booking kategori ${category || 'semua'} pada ${date}`);
  return bookingsWithDuration;
}

async function getRepaintBookingsOverlap(dates) {
  const startDate = new Date(`${dates[0]}T00:00:00.000Z`);
  const endDate = new Date(`${dates[dates.length - 1]}T23:59:59.999Z`);

  const bookings = await prisma.booking.findMany({
    where: {
      category: 'repaint',
      status: { in: STATUS_ACTIVE },
      bookingDate: { lte: endDate }
    }
  });

  const overlapping = [];
  for (const data of bookings) {
    if (!data.bookingDate) continue;

    const bookingStart = new Date(data.bookingDate);
    const durationMinutes = extractDurationMinutes(data);
    const durationDays = Math.max(5, Math.ceil(durationMinutes / (60 * 24)));
    const bookingEnd = new Date(bookingStart);
    bookingEnd.setDate(bookingEnd.getDate() + durationDays);

    if (bookingStart < endDate && bookingEnd > startDate) {
      overlapping.push(data);
    }
  }

  console.log(`[checkBookingAvailability] Repaint overlap ditemukan: ${overlapping.length}`);
  return overlapping;
}

async function checkSimpleSlotAvailability(input) {
  const start = new Date(`${input.bookingDate}T${input.bookingTime}:00`);
  const end = computeFinishDate(start, input.estimatedDurationMinutes);
  const startOfDay = new Date(`${input.bookingDate}T00:00:00.000Z`);
  const endOfDay = new Date(`${input.bookingDate}T23:59:59.999Z`);

  const bookings = await prisma.booking.findMany({
    where: {
      bookingDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: { in: STATUS_ACTIVE }
    }
  });

  let conflict = null;

  for (const data of bookings) {
    if (!data.bookingDate) continue;

    const existingStart = new Date(data.bookingDate);
    const durationMinutes = extractDurationMinutes(data);
    const existingEnd = computeFinishDate(existingStart, durationMinutes);

    if (hasOverlap(start, end, existingStart, existingEnd)) {
      conflict = {
        id: data.id,
        serviceName: data.serviceType || 'Booking lain',
        start: formatTime(existingStart),
        end: formatTime(existingEnd),
      };
    }
  }

  if (conflict) {
    return {
      isAvailable: false,
      reason: `Ada booking lain (${conflict.serviceName}) dari ${conflict.start} sampai ${conflict.end}.`,
    };
  }

  return {
    isAvailable: true,
  };
}

async function findNextAvailableSlotCustom(input, daysRange, isRepaint, isDetailingOrCoating) {
  for (let i = 1; i <= daysRange; i++) {
    const nextDate = new Date(`${input.bookingDate}T00:00:00`);
    nextDate.setDate(nextDate.getDate() + i);
    const nextDateString = formatDate(nextDate);

    if (isRepaint) {
      const overlapDates = [];
      for (let j = 0; j < 5; j++) {
        const d = new Date(nextDate);
        d.setDate(d.getDate() + j);
        overlapDates.push(formatDate(d));
      }
      const repaintBookings = await getRepaintBookingsOverlap(overlapDates);
      if (repaintBookings.length < 2) {
        return { date: nextDateString, time: input.bookingTime };
      }
    } else if (isDetailingOrCoating) {
      const dailyBookings = await getDailyBookings(nextDateString, determineServiceCategory(input.serviceName));
      if (dailyBookings.length < 2) {
        return { date: nextDateString, time: input.bookingTime };
      }
    } else {
      const result = await checkSimpleSlotAvailability({ ...input, bookingDate: nextDateString });
      if (result.isAvailable) {
        return { date: nextDateString, time: input.bookingTime };
      }
    }
  }
  return null;
}

async function checkDetailingOrCoatingCapacity(input) {
  const bookings = await getDailyBookings(input.bookingDate, determineServiceCategory(input.serviceName));
  if (bookings.length < 2) {
    return { available: true };
  }
  return {
    available: false,
    conflictReason: 'Kapasitas harian penuh (maksimal 2 motor per hari).',
  };
}

async function checkRepaintCapacity(input) {
  const overlapDates = [];
  const baseDate = new Date(`${input.bookingDate}T00:00:00`);
  for (let i = 0; i < 5; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    overlapDates.push(formatDate(d));
  }
  const repaintBookings = await getRepaintBookingsOverlap(overlapDates);
  if (repaintBookings.length < 2) {
    return { available: true };
  }
  return {
    available: false,
    conflictReason: 'Kapasitas repaint penuh (maksimal 2 motor dalam proses 5 hari).',
  };
}

async function implementation(rawInput) {
  // Handle alias names common in orchestrator calls
  if (rawInput.day && !rawInput.bookingDate) rawInput.bookingDate = rawInput.day;
  if (rawInput.time && !rawInput.bookingTime) rawInput.bookingTime = rawInput.time;

  const parsedInput = InputSchema.parse(rawInput);

  let bookingDate = parsedInput.bookingDate;
  let bookingTime = parsedInput.bookingTime;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^\d{2}:\d{2}$/;

  // Parse Date/Time if natural language
  if (!dateRegex.test(bookingDate) || (bookingTime && !timeRegex.test(bookingTime))) {
    const combinedStr = bookingTime ? `${bookingDate} ${bookingTime}` : bookingDate;
    const parsed = parseDateTime(combinedStr);
    if (parsed.date) bookingDate = parsed.date;
    if (parsed.time) bookingTime = parsed.time;
  }

  const normalizedInput = {
    ...parsedInput,
    bookingDate,
    bookingTime,
    serviceName: parsedInput.serviceName || 'Layanan Umum (Cuci/Detailing)',
    estimatedDurationMinutes: parsedInput.estimatedDurationMinutes || 120, // default 2 jam
  };

  const serviceCategory = determineServiceCategory(normalizedInput.serviceName);
  const isRepaint = serviceCategory === 'repaint';
  const isDetailingOrCoating = serviceCategory === 'detailing' || serviceCategory === 'coating';

  // --- LOGIKA REKOMENDASI SLOT JIKA JAM KOSONG ---
  if (!normalizedInput.bookingTime) {
    const nowJkt = DateTime.now().setZone('Asia/Jakarta');
    const isToday = normalizedInput.bookingDate === formatDate(nowJkt.toJSDate());
    
    // Start searching from 09:00 or Now + 30 mins
    let startHour = 9;
    let startMin = 0;

    if (isToday) {
      const earliestStart = nowJkt.plus({ minutes: 30 });
      startHour = earliestStart.hour;
      startMin = earliestStart.minute > 30 ? 60 : 30; // Round to next 30 min block
      if (startMin === 60) {
        startHour += 1;
        startMin = 0;
      }
      if (startHour < 9) {
        startHour = 9;
        startMin = 0;
      }
    }

    // Iterate through slots every 30 mins until 16:30
    for (let h = startHour; h <= 16; h++) {
      for (let m = (h === startHour ? startMin : 0); m < 60; m += 30) {
        const testTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const testInput = { ...normalizedInput, bookingTime: testTime };
        
        let availCheck;
        if (isRepaint) availCheck = await checkRepaintCapacity(testInput);
        else if (isDetailingOrCoating) availCheck = await checkDetailingOrCoatingCapacity(testInput);
        else {
          const res = await checkSimpleSlotAvailability(testInput);
          availCheck = { available: res.isAvailable };
        }

        if (availCheck.available) {
          return {
            available: true,
            recommendedTime: testTime,
            summary: `Slot tersedia untuk ${normalizedInput.serviceName} pada ${normalizedInput.bookingDate}. Jam paling dekat yang tersedia adalah: ${testTime}.`,
          };
        }
      }
    }

    return {
      available: false,
      summary: `Maaf, untuk tanggal ${normalizedInput.bookingDate} sepertinya semua slot sudah penuh atau sudah melewati jam operasional. Silakan pilih hari lain?`,
    };
  }

  // --- LOGIKA CEK SLOT SPESIFIK (Default Path) ---
  const startDate = new Date(`${normalizedInput.bookingDate}T${normalizedInput.bookingTime}:00`);
  const finishDate = computeFinishDate(startDate, normalizedInput.estimatedDurationMinutes);
  const finishTimeString = formatTime(finishDate);

  let overnightWarning;
  if (!isRepaint && (finishDate.getHours() > 17 || (finishDate.getHours() === 17 && finishDate.getMinutes() > 0))) {
    overnightWarning = `Pengerjaan diperkirakan selesai jam ${finishTimeString}, melebihi jam operasional (17:00). Ada kemungkinan motor harus menginap.`;
  }

  let availability;
  if (isRepaint) {
    availability = await checkRepaintCapacity(normalizedInput);
  } else if (isDetailingOrCoating) {
    availability = await checkDetailingOrCoatingCapacity(normalizedInput);
  } else {
    const result = await checkSimpleSlotAvailability(normalizedInput);
    availability = {
      available: result.isAvailable,
      conflictReason: result.reason,
    };
  }

  if (availability.available) {
    return {
      available: true,
      summary: `Slot tersedia untuk booking layanan ${normalizedInput.serviceName} pada ${normalizedInput.bookingDate} jam ${normalizedInput.bookingTime}` + (overnightWarning ? `\n${overnightWarning}` : ''),
    };
  }

  const nextSlot = await findNextAvailableSlotCustom(
    normalizedInput,
    30,
    isRepaint,
    isDetailingOrCoating
  );

  if (nextSlot) {
    return {
      available: false,
      conflictReason: availability.conflictReason,
      summary: `Slot tidak tersedia pada tanggal yang diminta. Slot berikutnya yang tersedia adalah pada ${nextSlot.date} jam ${nextSlot.time}` + (overnightWarning ? `\n${overnightWarning}` : ''),
    };
  }

  return {
    available: false,
    conflictReason: availability.conflictReason,
    summary: availability.conflictReason
      || overnightWarning
      || `Slot tidak tersedia untuk booking layanan ${normalizedInput.serviceName} pada ${normalizedInput.bookingDate} jam ${normalizedInput.bookingTime}`,
  };
}

const checkBookingAvailabilityTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'checkBookingAvailability',
      description: 'Cek ketersediaan slot booking.',
      parameters: {
        type: 'object',
        properties: {
          bookingDate: { type: 'string', description: 'Tgl (YYYY-MM-DD).' },
          bookingTime: { type: 'string', description: 'Jam (HH:mm).' },
          serviceName: { type: 'string', description: 'Nama layanan.' },
          estimatedDurationMinutes: { type: 'number', description: 'Durasi (menit).' },
        },
        required: ['bookingDate', 'bookingTime', 'serviceName', 'estimatedDurationMinutes'],
      },
    },
  },
  implementation,
};

module.exports = { checkBookingAvailabilityTool };