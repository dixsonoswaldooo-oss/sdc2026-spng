// One way to show money and dates everywhere.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const myr = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' });

/** 3500 → "RM 3,500.00" (Intl gives "RM3,500.00"; a space reads better). */
export function money(amount: number): string {
  return myr.format(amount).replace(/^(-?)RM\s?/, '$1RM ');
}

/** Round to sen (the smallest MYR unit). */
export const toSen = (n: number) => Math.round(n * 100) / 100;

/** "2026-10-14" → "14 Oct 2026" (or "14 Oct"). Read from the text so time zones never shift the day. */
export function date(iso: string, { year = true } = {}): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return year ? `${d} ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]}`;
}

/** "2026-10" → "October 2026" */
export function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** ISO date-time → "23 Oct 2026, 14:05" in Malaysia time (UTC+8 all year). */
export function dateTime(iso: string): string {
  const myt = new Date(Date.parse(iso) + 8 * 3_600_000);
  const hh = String(myt.getUTCHours()).padStart(2, '0');
  const mm = String(myt.getUTCMinutes()).padStart(2, '0');
  return `${myt.getUTCDate()} ${MONTHS[myt.getUTCMonth()]} ${myt.getUTCFullYear()}, ${hh}:${mm}`;
}
