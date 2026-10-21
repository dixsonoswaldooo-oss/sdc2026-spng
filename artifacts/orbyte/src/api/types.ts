// API contract shared with the backend (T1). Must match /docs/frontend-api-contract.md.

export type Money = number; // RM, 2 decimals, computed by backend
export type ISODate = string; // "2026-10-25"
export type Status = 'SAFE' | 'AT_RISK' | 'SHORTFALL';
export type ActionType = 'CHASE_RECEIVABLE' | 'RESCHEDULE_BILL' | 'HOLD_PURCHASE';
export type ActionStatus = 'PROPOSED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
export type Role = 'OWNER' | 'FINANCE_ADMIN';
export type Language = 'EN' | 'BM';
export type DataSource = 'PAYROLL' | 'RECEIVABLES' | 'BILLS' | 'PURCHASES' | 'SALES';

export interface Breakdown {
  currentBalance: Money;
  expectedSales: Money;
  expectedReceivables: Money;
  billsDue: Money;
  purchasesDue: Money; // added: purchase orders paid before payday
  balanceBeforePayroll: Money;
  projectedAfterPayroll: Money;
}

export interface BasedOn {
  label: string; // e.g. "3 overdue invoices"
  source: DataSource; // lets the UI link the chip to its data
}

export interface CashGuardSummary {
  companyName: string;
  today: ISODate;
  payday: ISODate;
  daysToPayday: number;
  payrollTotal: Money;
  headcount: number;
  breakdown: Breakdown;
  safetyBuffer: Money;
  gapToBuffer: Money;
  status: Status;
  lastCheckedAt: string; // ISO datetime
  ai: { explanation: string; basedOn: BasedOn[]; model: string; generatedAt: string; isFallback: boolean };
}

export interface ProjectionPoint {
  date: ISODate;
  current: Money;
  withActions: Money;
}

export interface ProjectionResult {
  points: ProjectionPoint[];
  withActions: { projectedAfterPayroll: Money; gapToBuffer: Money; status: Status };
}

export interface Receivable {
  id: string;
  customer: string;
  contactName: string;
  amount: Money;
  dueDate: ISODate;
  daysOverdue: number;
  likelihood: number; // 0–1
  reminderStatus: 'NONE' | 'DRAFTED' | 'SENT' | 'REPLIED';
  countedInProjection: boolean;
  lastContactAt?: string; // added: when the customer was last reminded (ISO datetime)
}

export interface Bill {
  id: string;
  vendor: string;
  description: string;
  amount: Money;
  dueDate: ISODate;
  shiftable: boolean;
  shiftableTo?: ISODate;
  termNote?: string;
  penalty: Money;
}

export interface PurchaseOrder {
  id: string;
  vendor: string;
  description: string;
  amount: Money;
  urgent: boolean;
  dueDate: ISODate; // added: when it is paid unless held
  suggestedDate?: ISODate;
}

export interface DraftMessage {
  receivableId: string;
  language: Language;
  channel: 'WHATSAPP' | 'EMAIL';
  body: string;
  isFallback: boolean;
}

export interface Action {
  id: string;
  rank: number;
  type: ActionType;
  title: string;
  reason: string;
  potentialImpact: Money;
  expectedImpact: Money;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  status: ActionStatus;
  relatedIds: string[];
  drafts?: DraftMessage[];
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  role: Role | 'AGENT' | 'SYSTEM';
  kind: string;
  summary: string;
  details?: Record<string, unknown>;
}

export interface Settings {
  paydayDayOfMonth: number;
  leadTimeDays: number;
  safetyBuffer: Money;
  defaultLanguage: Language;
  enabledActions: ActionType[];
}

/** Mock Orbyte workspace shown in the shell (the Orbyte platform itself is simulated in both modes). */
export interface Workspace {
  companyName: string;
  shortName: string;
  credits: number;
  users: Record<Role, { name: string; initials: string }>;
}
