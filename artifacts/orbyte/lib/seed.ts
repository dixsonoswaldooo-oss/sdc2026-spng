// Synthetic demo data (no real people). "Reset demo data" reloads exactly this.
import { computePayroll, workingDays } from './payroll';
import type { Account, AttendanceRecord, Employee, LeaveRequest, Month, Overtime, PaymentRun, PayrollConfig } from './types';

export const DEMO_MONTH: Month = '2026-10';
export const COMPANY = 'Kopi Kawan Trading Sdn Bhd';
export const HR_NAME = 'Nur Farah Hanim';

export const EMPLOYEES: Employee[] = [
  { id: 'E1', name: 'Ahmad Faiz', position: 'Barista Supervisor', whatsapp: '+60 12-345 1001', baseSalary: 3200, bonus: 250 },
  { id: 'E2', name: 'Tan Mei Ling', position: 'Head Roaster', whatsapp: '+60 12-345 1002', baseSalary: 3600, bonus: 300 },
  { id: 'E3', name: 'Ravi Kumar', position: 'Delivery Driver', whatsapp: '+60 12-345 1003', baseSalary: 2400, bonus: 150 },
  { id: 'E4', name: 'Siti Aminah', position: 'Cashier', whatsapp: '+60 12-345 1004', baseSalary: 2200, bonus: 100 },
  { id: 'E5', name: 'Daniel Lee', position: 'Sales Executive', whatsapp: '+60 12-345 1005', baseSalary: 3000, bonus: 400 },
  { id: 'E6', name: 'Nurul Izzah', position: 'Admin Assistant', whatsapp: '+60 12-345 1006', baseSalary: 2600, bonus: 150 },
];

export const ACCOUNTS: Account[] = [
  { id: 'HR1', role: 'HR', name: HR_NAME, email: 'farah@kopikawan.my' },
  ...EMPLOYEES.map((e): Account => ({
    id: `ACC-${e.id}`, role: 'EMPLOYEE', name: e.name, employeeId: e.id,
    email: `${e.name.split(' ')[0].toLowerCase()}@kopikawan.my`,
  })),
];

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

function attendanceFor(month: Month): AttendanceRecord[] {
  return EMPLOYEES.flatMap((e, ei) =>
    workingDays(month).map((day, di): AttendanceRecord => {
      const special = EXCEPTIONS[e.id][day];
      if (special === null) return { employeeId: e.id, date: day, lateMinutes: 0 };
      const minutes = special ?? -(5 + ((ei * 7 + di * 3) % 12)); // on time: 07:44–07:55
      return { employeeId: e.id, date: day, clockIn: clock(minutes), clockOut: clock(9 * 60 + ((ei + di) % 9)), lateMinutes: Math.max(0, minutes) };
    }),
  );
}

export function seedState() {
  const attendance = [...attendanceFor('2026-09'), ...attendanceFor(DEMO_MONTH)];
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

  return { employees: structuredClone(EMPLOYEES), attendance, config: { ...DEFAULT_CONFIG }, leaves, overtime, payments: [september] };
}
