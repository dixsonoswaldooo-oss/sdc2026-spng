// Plain words shown on screen, in one place so every page says the same thing.
// Stored values (DITOLERANSI, Fallback, IZIN, …) stay as they are; only what people read is here.
import type { AttendanceOverride, LabelSource, LeaveLabel } from './types';

/** Short label for a leave day: is it paid or cut from pay? */
export const LEAVE_PAY: Record<LeaveLabel, string> = { DITOLERANSI: 'Paid leave', DIPOTONG: 'Unpaid leave' };
/** The same, explained (choices in HR's label menu). */
export const LEAVE_PAY_LONG: Record<LeaveLabel, string> = { DITOLERANSI: 'Paid leave (no pay cut)', DIPOTONG: 'Unpaid leave (cut from pay)' };
/** Who suggested or set that label. */
export const LABEL_BY: Record<LabelSource, string> = { AI: 'AI suggestion', Fallback: 'Keyword check', HR: 'Set by HR' };
/** Shown when the AI or keyword check is unsure, or the reason looks like an attempt to game it. */
export const PLEASE_CHECK = 'Please check';
/** A day's attendance. */
export const DAY_STATUS: Record<AttendanceOverride['status'], string> = { PRESENT: 'Present', ABSENT: 'Absent', IZIN: 'Permitted absence' };
/** Overtime rate of a division: everyone's rate, or its own. */
export const RATE_KIND = { shared: 'Same as everyone', own: 'Own rate' };
