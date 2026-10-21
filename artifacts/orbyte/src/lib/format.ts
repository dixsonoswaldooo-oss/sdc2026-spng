// Every money amount and date on screen goes through these helpers, so all pages look the same.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MALAYSIA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000; // Malaysia is UTC+8 all year (no daylight saving)
const twoDecimals = new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * 8400 → "RM 8,400.00", -8400 → "−RM 8,400.00" (a true minus sign, as in the brief).
 * With { signed: true } positive amounts get a plus: 1380 → "+RM 1,380.00". Zero never gets a sign.
 */
export function formatMoney(amount: number, { signed = false } = {}): string {
  const cents = Math.round(amount * 100);
  const sign = cents < 0 ? '−' : signed && cents > 0 ? '+' : '';
  return `${sign}RM ${twoDecimals.format(Math.abs(cents) / 100)}`;
}

/**
 * "2026-10-25" → "25 Oct 2026". Built by hand because browsers now write September as "Sept",
 * and reading the text directly means the viewer's time zone can never shift the day.
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** "2026-10-21T00:00:00Z" → "21 Oct, 08:00", always in Malaysia time. */
export function formatDateTime(isoDateTime: string): string {
  const myt = new Date(Date.parse(isoDateTime) + MALAYSIA_UTC_OFFSET_MS);
  const time = [myt.getUTCHours(), myt.getUTCMinutes()].map((n) => String(n).padStart(2, '0')).join(':');
  return `${myt.getUTCDate()} ${MONTHS[myt.getUTCMonth()]}, ${time}`;
}
