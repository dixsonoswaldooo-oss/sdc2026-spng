import type { Bill, ISODate, Language, Money, PurchaseOrder, Receivable, Settings, Workspace } from '../api/types.ts';

/**
 * Everything the demo runs on. The built-in one is below (DEFAULT_SCENARIO);
 * a Google Sheet produces another one with the same shape (src/mocks/sheet.ts).
 */
export interface Scenario {
  workspace: Workspace;
  today: ISODate;
  checkedAt: string; // when the daily check ran, ISO date-time
  settings: Settings;
  bankBalance: Money;
  posDailyAverage: Money;
  payroll: { total: Money; headcount: number };
  receivables: Receivable[];
  bills: Bill[];
  purchaseOrders: PurchaseOrder[];
  channels: Record<string, 'WHATSAPP' | 'EMAIL'>;
  drafts: Record<string, Partial<Record<Language, string[]>>>; // written messages; templates fill any gaps
  aiExplanation?: string; // first explanation; empty means it is written from the data
}

// Demo scenario (brief §4), all synthetic. Only engine.ts computes numbers from these.
// PO-077 fix agreed with Owen: the packaging order counts as money out before payday,
// so the bank balance is RM 7,400 (brief: 6,200) and every headline number stays the same.

/** Demo "today". Change it to move the whole scenario. */
export const DEMO_TODAY = '2026-10-21';
export const CHECKED_AT = '2026-10-21T08:00:00+08:00';

export const WORKSPACE: Workspace = {
  companyName: 'Kopi Kawan Trading Sdn Bhd',
  shortName: 'Kopi Kawan Trading',
  credits: 1240,
  users: {
    OWNER: { name: 'Rizal Hamid', initials: 'RH' },
    FINANCE_ADMIN: { name: 'Aina Zulkifli', initials: 'AZ' },
  },
};

export const SETTINGS: Settings = {
  paydayDayOfMonth: 25,
  leadTimeDays: 10,
  safetyBuffer: 2000,
  defaultLanguage: 'EN',
  enabledActions: ['CHASE_RECEIVABLE', 'RESCHEDULE_BILL', 'HOLD_PURCHASE'],
};

export const BANK_BALANCE = 7400; // from Orbyte Connect (accounting)
export const POS_DAILY_AVERAGE = 1900; // 30-day POS average from Orbyte Connect; 4 days to payday = RM 7,600
export const PAYROLL = { total: 18000, headcount: 14 }; // from Orbyte People: net pay + EPF/SOCSO/EIS

/** daysOverdue and countedInProjection are recalculated by the engine. */
export const RECEIVABLES: Receivable[] = [
  { id: 'INV-1021', customer: 'Restoran Seri Melaka', contactName: 'Encik Faizal', amount: 4500, dueDate: '2026-09-30', daysOverdue: 0, likelihood: 0.9, reminderStatus: 'NONE', countedInProjection: false },
  { id: 'INV-1027', customer: 'Hotel Damai Cheras', contactName: 'Puan Mei Ling', amount: 3100, dueDate: '2026-10-09', daysOverdue: 0, likelihood: 0.7, reminderStatus: 'NONE', countedInProjection: false },
  { id: 'INV-1031', customer: 'Kafe Bunga Raya', contactName: 'Cik Nadia', amount: 1600, dueDate: '2026-10-13', daysOverdue: 0, likelihood: 0.6, reminderStatus: 'NONE', countedInProjection: false },
  { id: 'INV-1042', customer: 'Kafe Lorong', contactName: 'Encik Hafiz', amount: 1500, dueDate: '2026-10-23', daysOverdue: 0, likelihood: 0.95, reminderStatus: 'NONE', countedInProjection: true },
  { id: 'INV-1045', customer: 'Brew Lab KL', contactName: 'Cik Sofia', amount: 1300, dueDate: '2026-10-24', daysOverdue: 0, likelihood: 0.95, reminderStatus: 'NONE', countedInProjection: true },
];

export const BILLS: Bill[] = [
  { id: 'BILL-311', vendor: 'Biji Emas Supplies', description: 'Green beans', amount: 2600, dueDate: '2026-10-23', shiftable: true, shiftableTo: '2026-11-02', termNote: 'Supplier terms allow payment up to 2 Nov with no penalty.', penalty: 0 },
  { id: 'BILL-312', vendor: 'TNB & Air Selangor', description: 'Utilities', amount: 900, dueDate: '2026-10-24', shiftable: false, termNote: 'Utility bills cannot be moved.', penalty: 0 },
  { id: 'BILL-313', vendor: 'Landlord', description: 'Shop lot rent', amount: 3500, dueDate: '2026-10-25', shiftable: false, termNote: 'Rent is due on the 25th under the tenancy agreement.', penalty: 0 },
];

export const PURCHASE_ORDERS: PurchaseOrder[] = [
  { id: 'PO-077', vendor: 'PackRight Sdn Bhd', description: 'Packaging (bags & labels)', amount: 1200, urgent: false, dueDate: '2026-10-22', suggestedDate: '2026-10-27' },
];

export const AI_MODEL = 'SEA-LION · RunPod';

export const AI_EXPLANATION =
  'Payroll of RM 18,000 is due on 25 Oct, but your projected balance that day is RM 9,600 — a gap of RM 8,400. The main cause is RM 9,200 in overdue customer invoices, while rent and supplier bills fall in the same week. Collecting the three overdue invoices and moving the Biji Emas bill to 2 Nov (allowed by its terms) should close the gap. Holding the packaging order adds a safety margin. No recommendation affects staff salaries.';

export const CHANNELS: Record<string, 'WHATSAPP' | 'EMAIL'> = {
  'INV-1021': 'WHATSAPP',
  'INV-1027': 'EMAIL',
  'INV-1031': 'WHATSAPP',
};

/** AI drafts per invoice and language. "Regenerate draft" moves to the next version. */
export const DRAFTS: Record<string, Record<Language, string[]>> = {
  'INV-1021': {
    EN: [
      'Hi Encik Faizal, hope business is going well. Just a friendly reminder that invoice INV-1021 (RM 4,500.00, due 30 Sep) is still open on our side. Could you let us know when we can expect payment? If it\'s already on the way, please ignore this — thank you! — Aina, Kopi Kawan Trading',
      'Hi Encik Faizal, hope you\'re keeping well. We noticed invoice INV-1021 for RM 4,500.00 (due 30 Sep) is still open. Could you share when payment will go out? If you\'ve already paid, thank you and please disregard this. — Aina, Kopi Kawan Trading',
    ],
    BM: [
      'Salam Encik Faizal, harap urusan berjalan lancar. Sekadar peringatan mesra, invois INV-1021 (RM 4,500.00, tarikh akhir 30 Sep) masih belum dijelaskan dalam rekod kami. Boleh maklumkan bila bayaran dijangka dibuat? Jika sudah dibuat, sila abaikan mesej ini. Terima kasih! — Aina, Kopi Kawan Trading',
      'Salam Encik Faizal, semoga sihat. Kami dapati invois INV-1021 berjumlah RM 4,500.00 (tarikh akhir 30 Sep) masih terbuka. Boleh kongsikan bila bayaran akan dibuat? Jika sudah dibayar, terima kasih dan sila abaikan mesej ini. — Aina, Kopi Kawan Trading',
    ],
  },
  'INV-1027': {
    EN: [
      'Dear Puan Mei Ling, I hope all is well at Hotel Damai Cheras. This is a gentle reminder that invoice INV-1027 (RM 3,100.00, due 9 Oct) is still outstanding on our records. Could you let us know when payment is scheduled? If it has already been processed, please disregard this note. Thank you. — Aina, Kopi Kawan Trading',
      'Dear Puan Mei Ling, a short follow-up on invoice INV-1027 (RM 3,100.00), which was due on 9 Oct. Could you confirm the expected payment date? Please ignore this if payment is already on its way. With thanks, Aina, Kopi Kawan Trading',
    ],
    BM: [
      'Puan Mei Ling yang dihormati, semoga semuanya baik di Hotel Damai Cheras. Ini peringatan mesra bahawa invois INV-1027 (RM 3,100.00, tarikh akhir 9 Okt) masih belum dijelaskan dalam rekod kami. Boleh maklumkan bila bayaran dijadualkan? Jika sudah diproses, sila abaikan nota ini. Terima kasih. — Aina, Kopi Kawan Trading',
      'Puan Mei Ling yang dihormati, susulan ringkas mengenai invois INV-1027 (RM 3,100.00) yang tamat tempoh pada 9 Okt. Boleh sahkan tarikh jangkaan bayaran? Abaikan jika bayaran sudah dalam proses. Terima kasih, Aina, Kopi Kawan Trading',
    ],
  },
  'INV-1031': {
    EN: [
      'Hi Cik Nadia, hope Kafe Bunga Raya is doing well. Just a quick note that invoice INV-1031 (RM 1,600.00, due 13 Oct) is still open on our side. Would you be able to share an expected payment date? Please ignore this if it\'s already been sent. Thanks! — Aina, Kopi Kawan Trading',
      'Hi Cik Nadia, quick reminder that invoice INV-1031 (RM 1,600.00, due 13 Oct) is still open. Let us know if you need a copy of the invoice. Thank you! — Aina, Kopi Kawan Trading',
    ],
    BM: [
      'Hai Cik Nadia, harap Kafe Bunga Raya sihat-sihat sahaja. Sekadar makluman, invois INV-1031 (RM 1,600.00, tarikh akhir 13 Okt) masih terbuka dalam rekod kami. Boleh kongsikan tarikh jangkaan bayaran? Abaikan mesej ini jika sudah dibayar. Terima kasih! — Aina, Kopi Kawan Trading',
      'Hai Cik Nadia, peringatan ringkas bahawa invois INV-1031 (RM 1,600.00, tarikh akhir 13 Okt) masih terbuka. Beritahu kami jika perlukan salinan invois. Terima kasih! — Aina, Kopi Kawan Trading',
    ],
  },
};

export const DEFAULT_SCENARIO: Scenario = {
  workspace: WORKSPACE,
  today: DEMO_TODAY,
  checkedAt: CHECKED_AT,
  settings: SETTINGS,
  bankBalance: BANK_BALANCE,
  posDailyAverage: POS_DAILY_AVERAGE,
  payroll: PAYROLL,
  receivables: RECEIVABLES,
  bills: BILLS,
  purchaseOrders: PURCHASE_ORDERS,
  channels: CHANNELS,
  drafts: DRAFTS,
  aiExplanation: AI_EXPLANATION,
};
