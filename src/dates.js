// Calendar-date helpers. Pure, isomorphic, no Date object, no local time zone.
// Dates are compared as civil day numbers (days since 1970-01-01, proleptic Gregorian).

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

// Returns {year, month, day} for a valid YYYY-MM-DD calendar date, otherwise null.
export function parseCalendarDate(text) {
  if (typeof text !== 'string') return null;
  const m = DATE_RE.exec(text);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isValidCalendarDate(text) {
  return parseCalendarDate(text) !== null;
}

// Days from civil (Howard Hinnant's algorithm). Integer result, no time zone involved.
export function dayNumber(text) {
  const d = parseCalendarDate(text);
  if (d === null) return null;
  let { year, month } = d;
  const { day } = d;
  year -= month <= 2 ? 1 : 0;
  const era = Math.floor(year / 400);
  const yoe = year - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function compareDates(a, b) {
  const da = dayNumber(a);
  const db = dayNumber(b);
  if (da === null || db === null) throw new Error('compareDates requires valid calendar dates');
  return da < db ? -1 : da > db ? 1 : 0;
}

// Inclusive window check on calendar days.
export function isWithinWindow(date, start, end) {
  return compareDates(date, start) >= 0 && compareDates(date, end) <= 0;
}
