// Shapes of every piece of data in e-Salary Guard. Everything lives in the browser (demo).

export type Role = 'HR' | 'EMPLOYEE';
export type Month = string; // "2026-10"
export type ISODate = string; // "2026-10-14"

export interface Account {
  id: string;
  role: Role;
  name: string;
  email: string;
  employeeId?: string; // for employee accounts
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  whatsapp: string; // dummy number
  baseSalary: number; // MYR per month
  bonus: number; // MYR per month
  division: string; // groups positions for overtime rules, e.g. "Café floor"
  annualLeaveDays: number; // yearly allowance of "Leave"-type days
  startDate?: ISODate; // added by HR: days before this are not worked, so never absent
}

/** One working day from the attendance system (synthetic). No clockIn = did not come in. */
export interface AttendanceRecord {
  employeeId: string;
  date: ISODate;
  clockIn?: string; // "08:12"
  clockOut?: string;
  lateMinutes: number;
  izin?: boolean; // HR marked the day as permitted leave: not absent, not deducted
  editedByHr?: boolean; // an HR override replaced the imported values for this day
}

/** HR's correction for one day, kept apart from the imported attendance (which is never overwritten). */
export interface AttendanceOverride {
  status: 'PRESENT' | 'ABSENT' | 'IZIN';
  lateMinutes: number;
  by: string;
  at: string;
}

export interface PayrollConfig {
  overtimeRatePerHour: number;
  lateToleranceMinutes: number;
  lateRatePerMinute: number;
  absentDeductionPct: number; // % of daily wage per absent day
  leaveDeductionPct: number; // % of daily wage per deducted leave day
}

export type OvertimeStatus = 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'WITHDRAWN' | 'CANCELLED';

/** Decision and change fields shared by leave and overtime. */
interface Tracked {
  decidedAt?: string;
  decidedBy?: string;
  cancelRequestedAt?: string; // the employee asked to cancel an approved request; waiting for HR
  editedAt?: string; // the employee edited it while pending
}

export interface Overtime extends Tracked {
  id: string;
  employeeId: string;
  date: ISODate;
  hours: number;
  note: string;
  origin: 'HR' | 'EMPLOYEE';
  status: OvertimeStatus;
  createdAt: string;
}

export type LeaveType = 'LEAVE' | 'PERMISSION' | 'SICK' | 'DAY_OFF';
/** Labels as returned by the AI (spec): tolerated = not deducted, deducted = cut from pay. */
export type LeaveLabel = 'DITOLERANSI' | 'DIPOTONG';
export type LabelSource = 'AI' | 'Fallback' | 'HR';

export interface LeaveClassification {
  label: LeaveLabel;
  alasan: string; // one-sentence reason
  keyakinan: number; // confidence 0–1
  source: 'AI' | 'Fallback';
}

export interface LeaveRequest extends Tracked {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: ISODate;
  endDate: ISODate;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'CANCELLED';
  label: LeaveLabel;
  labelReason: string;
  confidence: number;
  labelSource: LabelSource;
  aiPending?: boolean; // the AI is still reading the reason; the keyword label is shown until it answers
  createdAt: string;
}

export type DeductionKind = 'LATE' | 'ABSENT' | 'LEAVE';

export interface DeductionEvent {
  key: string; // "LATE:2026-10-14" — stable, used to know if a WhatsApp was already sent
  date: ISODate;
  kind: DeductionKind;
  amount: number;
  explanation: string;
}

export interface PayrollBreakdown {
  employeeId: string;
  month: Month;
  workingDays: number;
  dailyWage: number;
  baseSalary: number;
  bonus: number;
  overtimeHours: number;
  overtimePay: number;
  gross: number;
  lateDeduction: number;
  absentDeduction: number;
  leaveDeduction: number;
  totalDeductions: number;
  netPay: number; // never below 0
  negativeClamped: boolean; // true when deductions were bigger than gross pay
  events: DeductionEvent[];
}

export interface PaymentLine extends PayrollBreakdown {
  reference: string; // PAY-YYYYMM-NNN
  employeeName: string;
}

export interface PaymentRun {
  month: Month;
  paidAt: string;
  paidBy: string;
  total: number;
  lines: PaymentLine[];
  draft?: true; // the running month, not paid yet: recalculated live, never stored
}

export interface WhatsAppMessage {
  id: string;
  employeeId: string;
  to: string;
  at: string;
  kind: 'DEDUCTION' | 'DEDUCTION_UPDATE' | 'OVERTIME_OFFER' | 'HR_MESSAGE' | 'REPLY'; // REPLY = from the worker to HR
  text: string;
}

export type ActivityKind = 'LOGIN' | 'CONFIG' | 'REQUEST' | 'DECISION' | 'REVERT' | 'ATTENDANCE' | 'AI_LABEL' | 'RECALC' | 'WHATSAPP' | 'PAYMENT' | 'PEOPLE' | 'SYSTEM';

export interface ActivityEntry {
  id: string;
  at: string;
  actor: string; // "HR: Nur Farah", employee name, "System" or "AI"
  kind: ActivityKind;
  action: string;
  target: string;
  detail: string;
}

/** Something an employee changed that HR should know about (withdrawn, edited, cancellation asked). */
export interface HrNotification {
  id: string;
  at: string;
  text: string;
  read: boolean;
}
