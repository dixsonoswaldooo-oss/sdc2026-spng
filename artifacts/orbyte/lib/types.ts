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
}

/** One working day from the attendance system (synthetic). No clockIn = did not come in. */
export interface AttendanceRecord {
  employeeId: string;
  date: ISODate;
  clockIn?: string; // "08:12"
  clockOut?: string;
  lateMinutes: number;
}

export interface PayrollConfig {
  overtimeRatePerHour: number;
  lateToleranceMinutes: number;
  lateRatePerMinute: number;
  absentDeductionPct: number; // % of daily wage per absent day
  leaveDeductionPct: number; // % of daily wage per deducted leave day
}

export type OvertimeStatus = 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface Overtime {
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

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: ISODate;
  endDate: ISODate;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  label: LeaveLabel;
  labelReason: string;
  confidence: number;
  labelSource: LabelSource;
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
}

export interface WhatsAppMessage {
  id: string;
  employeeId: string;
  to: string;
  at: string;
  kind: 'DEDUCTION' | 'DEDUCTION_UPDATE' | 'OVERTIME_OFFER';
  text: string;
}

export type ActivityKind = 'LOGIN' | 'CONFIG' | 'REQUEST' | 'DECISION' | 'AI_LABEL' | 'RECALC' | 'WHATSAPP' | 'PAYMENT' | 'SYSTEM';

export interface ActivityEntry {
  id: string;
  at: string;
  actor: string; // "HR: Nur Farah", employee name, "System" or "AI"
  kind: ActivityKind;
  action: string;
  target: string;
  detail: string;
}
