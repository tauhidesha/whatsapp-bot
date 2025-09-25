// File: src/ai/utils/dateTime.js
// Utility helpers to parse natural language Indonesian date & time expressions.

const DAY_NAMES = {
  minggu: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  "jum'at": 5,
  sabtu: 6,
};

const MONTH_NAMES = {
  januari: 0,
  jan: 0,
  februari: 1,
  feb: 1,
  maret: 2,
  mar: 2,
  april: 3,
  apr: 3,
  mei: 4,
  juni: 5,
  jun: 5,
  juli: 6,
  jul: 6,
  agustus: 7,
  agu: 7,
  agt: 7,
  september: 8,
  sep: 8,
  oktober: 9,
  okt: 9,
  november: 10,
  nov: 10,
  desember: 11,
  des: 11,
};

function pad(value) {
  return value.toString().padStart(2, '0');
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseRelativeDateToken(text, baseDate) {
  const token = text.trim().toLowerCase();
  if (token.includes('hari ini')) return new Date(baseDate);
  if (token.includes('besok')) return addDays(baseDate, 1);
  if (token.includes('lusa')) return addDays(baseDate, 2);
  if (token.includes('kemarin')) return addDays(baseDate, -1);
  if (token.includes('minggu depan')) return addDays(baseDate, 7);
  if (token.includes('minggu ini')) return startOfWeek(baseDate, 1);
  if (token.includes('minggu lalu')) return addDays(baseDate, -7);
  return null;
}

function startOfWeek(date, weekStartsOn = 0) {
  const result = new Date(date);
  const day = (result.getDay() - weekStartsOn + 7) % 7;
  result.setDate(result.getDate() - day);
  return result;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function resolveDayOfWeek(targetDay, baseDate) {
  const result = new Date(baseDate);
  const currentDay = result.getDay();
  const diff = (targetDay + 7 - currentDay) % 7;
  if (diff === 0) {
    result.setDate(result.getDate() + 7);
  } else {
    result.setDate(result.getDate() + diff);
  }
  return result;
}

function parseDateComponent(text, baseDate) {
  const cleaned = (text || '').trim().toLowerCase();
  if (!cleaned) return null;

  const relative = parseRelativeDateToken(cleaned, baseDate);
  if (relative) return relative;

  const dayNameMatch = Object.keys(DAY_NAMES).find(name => cleaned.includes(name));
  if (dayNameMatch) {
    let target = resolveDayOfWeek(DAY_NAMES[dayNameMatch], baseDate);
    if (cleaned.includes('depan')) {
      target = addDays(target, 7);
    }
    return target;
  }

  const shortcutMatch = cleaned.match(/\d{4}-\d{2}-\d{2}/);
  if (shortcutMatch) {
    const parsed = new Date(`${shortcutMatch[0]}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const monthRegex = /(\d{1,2})\s+(januari|jan|februari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|agt|september|sep|oktober|okt|november|nov|desember|des)(?:\s+(\d{2,4}))?/;
  const monthMatch = cleaned.match(monthRegex);
  if (monthMatch) {
    const day = parseInt(monthMatch[1], 10);
    const monthName = monthMatch[2];
    const monthIndex = MONTH_NAMES[monthName];
    let year = monthMatch[3] ? parseInt(monthMatch[3], 10) : baseDate.getFullYear();
    if (year < 100) {
      year += 2000;
    }
    let candidate = new Date(Date.UTC(year, monthIndex, day));
    if (Number.isNaN(candidate.getTime())) {
      candidate = new Date(year, monthIndex, day);
    }
    if (candidate < baseDate) {
      candidate.setFullYear(candidate.getFullYear() + 1);
    }
    return candidate;
  }

  return null;
}

function parseTimeComponent(text) {
  const cleaned = (text || '').toLowerCase().trim();
  if (!cleaned) return null;

  const explicitMatch = cleaned.match(/(\d{1,2})(?:[:.](\d{2}))?/);
  if (!explicitMatch) return null;

  let hour = parseInt(explicitMatch[1], 10);
  let minute = explicitMatch[2] ? parseInt(explicitMatch[2], 10) : 0;

  const hasAm = cleaned.includes('am') || cleaned.includes('a.m');
  const hasPm = cleaned.includes('pm') || cleaned.includes('p.m');
  const hasSiang = cleaned.includes('siang');
  const hasSore = cleaned.includes('sore') || cleaned.includes('petang');
  const hasMalam = cleaned.includes('malam');
  const hasPagi = cleaned.includes('pagi') || cleaned.includes('subuh') || cleaned.includes('dini');

  if (hasPm || hasSiang || hasSore || hasMalam) {
    if (hour < 12) {
      hour += 12;
    }
  }

  if (hasAm || hasPagi) {
    if (hour === 12 && !hasPm && !hasSiang && !hasSore && !hasMalam) {
      hour = 0;
    }
  }

  hour %= 24;

  return `${pad(hour)}:${pad(minute)}`;
}

function parseDateTime(input, base = new Date()) {
  const result = {};
  const [datePart, ...timeParts] = (input || '').split(' ');
  const timePartRaw = timeParts.join(' ').trim();

  const parsedDate = parseDateComponent(input, base) || parseDateComponent(datePart, base);
  if (parsedDate) {
    result.date = toISODate(parsedDate);
  }

  const parsedTime = parseTimeComponent(timePartRaw || input);
  if (parsedTime) {
    result.time = parsedTime;
  }

  return result;
}

module.exports = {
  parseDateTime,
};
