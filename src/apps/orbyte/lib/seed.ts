// Synthetic demo data (no real people). "Reset demo data" reloads exactly this.
import { computePayroll, workingDays } from './payroll';
import type { Account, AttendanceRecord, Employee, ISODate, LeaveRequest, Month, Overtime, PaymentRun, PayrollConfig } from './types';

export const DEMO_MONTH: Month = '2026-10';
export const COMPANY = 'Kopi Kawan Trading Sdn Bhd';
export const HR_NAME = 'Nur Farah Hanim';

export const DIVISIONS = ['Café floor', 'Roastery', 'Logistics', 'Office'];
export const DEFAULT_LEAVE_DAYS = 14;

export const EMPLOYEES: Employee[] = [
  { id: 'E1', name: 'Ahmad Faiz', position: 'Barista Supervisor', whatsapp: '+60 12-345 1001', baseSalary: 3200, bonus: 250, division: 'Café floor', annualLeaveDays: DEFAULT_LEAVE_DAYS },
  { id: 'E2', name: 'Tan Mei Ling', position: 'Head Roaster', whatsapp: '+60 12-345 1002', baseSalary: 3600, bonus: 300, division: 'Roastery', annualLeaveDays: DEFAULT_LEAVE_DAYS },
  { id: 'E3', name: 'Ravi Kumar', position: 'Delivery Driver', whatsapp: '+60 12-345 1003', baseSalary: 2400, bonus: 150, division: 'Logistics', annualLeaveDays: DEFAULT_LEAVE_DAYS },
  { id: 'E4', name: 'Siti Aminah', position: 'Cashier', whatsapp: '+60 12-345 1004', baseSalary: 2200, bonus: 100, division: 'Café floor', annualLeaveDays: DEFAULT_LEAVE_DAYS },
  { id: 'E5', name: 'Daniel Lee', position: 'Sales Executive', whatsapp: '+60 12-345 1005', baseSalary: 3000, bonus: 400, division: 'Office', annualLeaveDays: DEFAULT_LEAVE_DAYS },
  { id: 'E6', name: 'Nurul Izzah', position: 'Admin Assistant', whatsapp: '+60 12-345 1006', baseSalary: 2600, bonus: 150, division: 'Office', annualLeaveDays: DEFAULT_LEAVE_DAYS },
];

/** The HR account plus one account per worker (workers HR adds get one too). Same first name → ahmad2@, ahmad3@, … */
export function accountsOf(employees: Employee[]): Account[] {
  const used = new Map<string, number>();
  return [
    { id: 'HR1', role: 'HR', name: HR_NAME, email: 'farah@kopikawan.my' },
    ...employees.map((e): Account => {
      const first = e.name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'worker';
      const n = (used.get(first) ?? 0) + 1;
      used.set(first, n);
      return { id: `ACC-${e.id}`, role: 'EMPLOYEE', name: e.name, employeeId: e.id, email: `${first}${n > 1 ? n : ''}@kopikawan.my` };
    }),
  ];
}

export const ACCOUNTS: Account[] = accountsOf(EMPLOYEES);

export const DEFAULT_CONFIG: PayrollConfig = {
  overtimeRatePerHour: 18, // about 1.5× the hourly rate of a RM 2,600 monthly salary
  lateToleranceMinutes: 10,
  lateRatePerMinute: 0.5,
  absentDeductionPct: 100,
  leaveDeductionPct: 100,
};

/** Special days per employee: minutes late, or null = did not come in. Every other day is on time. */
const EXCEPTIONS: Record<string, Record<string, number | null>> = {
  E1: {}, // perfect attendance
  E2: { '2026-10-06': 6, '2026-10-15': 9 }, // late, but within the 10-minute tolerance
  E3: { '2026-10-14': 25, '2026-10-21': 18, '2026-10-27': 12, '2026-09-15': 20 }, // late beyond tolerance
  E4: { '2026-10-09': null, '2026-10-20': 7 }, // absent without notice + one small late
  E5: { '2026-10-27': null }, // the day of his pending (important) leave
  E6: { '2026-10-30': null }, // the day of her pending (non-essential) leave
};

const clock = (minutesAfter8: number) => {
  const total = 8 * 60 + minutesAfter8;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

function attendanceFor(month: Month, before: ISODate, employees: Employee[]): AttendanceRecord[] {
  return employees.flatMap((e, ei) =>
    workingDays(month).filter((day) => day < before && day >= (e.startDate ?? '')).map((day, di): AttendanceRecord => {
      const special = EXCEPTIONS[e.id]?.[day]; // workers added by HR clock in on time
      if (special === null) return { employeeId: e.id, date: day, lateMinutes: 0 };
      const minutes = special ?? -(5 + ((ei * 7 + di * 3) % 12)); // on time: 07:44–07:55
      return { employeeId: e.id, date: day, clockIn: clock(minutes), clockOut: clock(9 * 60 + ((ei + di) % 9)), lateMinutes: Math.max(0, minutes) };
    }),
  );
}

/** The "imported" attendance: every working day of September and October 2026 that has already happened (before `today`). */
export function importAttendance(today: ISODate, employees: Employee[] = EMPLOYEES): AttendanceRecord[] {
  return [...attendanceFor('2026-09', today, employees), ...attendanceFor(DEMO_MONTH, today, employees)];
}

export function seedState(today: ISODate) {
  const attendance = importAttendance(today);
  const leaves: LeaveRequest[] = [
    {
      id: 'LV-1', employeeId: 'E5', type: 'LEAVE', startDate: '2026-10-27', endDate: '2026-10-27',
      reason: 'My father was admitted to hospital and I need to accompany him for his surgery.', status: 'PENDING',
      label: 'DITOLERANSI', labelReason: 'Accompanying a hospitalised parent is a family emergency.', confidence: 0.93, labelSource: 'AI',
      createdAt: '2026-10-22T01:15:00.000Z',
    },
    {
      id: 'LV-2', employeeId: 'E6', type: 'DAY_OFF', startDate: '2026-10-30', endDate: '2026-10-30',
      reason: 'Want to take a short trip to Langkawi with friends.', status: 'PENDING',
      label: 'DIPOTONG', labelReason: 'A leisure trip can be planned outside working days.', confidence: 0.9, labelSource: 'AI',
      createdAt: '2026-10-22T03:40:00.000Z',
    },
  ];
  const overtime: Overtime[] = [
    {
      id: 'OT-1', employeeId: 'E2', date: '2026-10-22', hours: 3, note: 'Large hotel order needs an extra roasting batch.',
      origin: 'EMPLOYEE', status: 'REQUESTED', createdAt: '2026-10-21T09:05:00.000Z',
    },
  ];

  // September 2026 was already paid, so Payment History has something in it from the start.
  const septemberLines = EMPLOYEES.map((employee, i) => ({
    ...computePayroll({
      employee, month: '2026-09', config: DEFAULT_CONFIG,
      attendance: attendance.filter((a) => a.employeeId === employee.id), leaves: [], overtime: [],
    }),
    reference: `PAY-202609-${String(i + 1).padStart(3, '0')}`,
    employeeName: employee.name,
  }));
  const september: PaymentRun = {
    month: '2026-09', paidAt: '2026-09-30T09:30:00.000Z', paidBy: HR_NAME, lines: septemberLines,
    total: Math.round(septemberLines.reduce((t, l) => t + l.netPay, 0) * 100) / 100,
  };

  return { employees: structuredClone(EMPLOYEES), attendance, config: { ...DEFAULT_CONFIG }, leaves, overtime, payments: [september], today };
}
