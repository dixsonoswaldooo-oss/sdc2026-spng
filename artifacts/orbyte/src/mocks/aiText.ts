// Sample "AI" wording for mock mode, written from the data so it stays right whatever the Google Sheet says.
// The real version comes from SEA-LION through the backend. This file only puts given numbers into sentences;
// every number is calculated in engine.ts.
import type { Action, Bill, ISODate, Language, Money, PurchaseOrder, Receivable, Status } from '../api/types.ts';
import { formatDate, formatMoney } from '../lib/format.ts';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const firstName = (name: string) => name.split(' ')[0];
const short = (date: ISODate) => formatDate(date, { year: false });

/** Two polite reminder versions per language; "Regenerate draft" moves between them. */
export function templateDrafts(r: Receivable, language: Language, sender: string, company: string): string[] {
  const [amount, due, signature] = [formatMoney(r.amount), short(r.dueDate), `${firstName(sender)}, ${company}`];
  if (language === 'BM') {
    return [
      `Salam ${r.contactName}, harap urusan di ${r.customer} berjalan lancar. Sekadar peringatan mesra, invois ${r.id} (${amount}, tarikh akhir ${due}) masih belum dijelaskan dalam rekod kami. Boleh maklumkan bila bayaran dijangka dibuat? Jika sudah dibuat, sila abaikan mesej ini. Terima kasih. — ${signature}`,
      `Salam ${r.contactName}, susulan ringkas mengenai invois ${r.id} (${amount}) yang tamat tempoh pada ${due}. Boleh sahkan tarikh jangkaan bayaran? Abaikan jika bayaran sudah dalam proses. Terima kasih, ${signature}`,
    ];
  }
  return [
    `Hi ${r.contactName}, hope all is well at ${r.customer}. Just a friendly reminder that invoice ${r.id} (${amount}, due ${due}) is still open on our side. Could you let us know when we can expect payment? If it is already on the way, please ignore this. Thank you. — ${signature}`,
    `Hi ${r.contactName}, a short follow-up on invoice ${r.id} (${amount}), which was due on ${due}. Could you confirm the expected payment date? Please ignore this if payment is already on its way. With thanks, ${signature}`,
  ];
}

/** Used when the AI is unavailable: plain, clearly a template. */
export function fallbackDraft(r: Receivable, language: Language, company: string): string {
  const [amount, due] = [formatMoney(r.amount), formatDate(r.dueDate)];
  return language === 'EN'
    ? `Hello ${r.contactName}, this is a reminder that invoice ${r.id} (${amount}, due ${due}) is unpaid. Please let us know the expected payment date. Thank you. — ${company}`
    : `Salam ${r.contactName}, ini peringatan bahawa invois ${r.id} (${amount}, tarikh akhir ${due}) belum dibayar. Sila maklumkan tarikh jangkaan bayaran. Terima kasih. — ${company}`;
}

type ActionWording = Pick<Action, 'title' | 'reason' | 'confidence'>;

export function chaseText(invoices: Receivable[], potential: Money, expected: Money): ActionWording {
  const averageLikelihood = invoices.reduce((t, r) => t + r.likelihood, 0) / Math.max(1, invoices.length);
  return {
    title: `Chase ${plural(invoices.length, 'overdue invoice')}`,
    reason: `${formatMoney(potential)} is overdue from ${plural(invoices.length, 'customer')}. Based on how reliably each one pays, about ${formatMoney(expected)} should arrive before payday.`,
    confidence: averageLikelihood >= 0.85 ? 'HIGH' : averageLikelihood >= 0.6 ? 'MEDIUM' : 'LOW',
  };
}

export function rescheduleText(bills: Bill[], amount: Money): ActionWording {
  if (bills.length === 1) {
    const [b] = bills;
    const to = short(b.shiftableTo ?? b.dueDate);
    return {
      title: `Move the ${b.vendor} bill to ${to}`,
      reason: `Supplier terms allow payment up to ${to} with no penalty, so ${formatMoney(amount)} stays in the bank on payday.`,
      confidence: 'HIGH',
    };
  }
  return {
    title: `Move ${plural(bills.length, 'bill')} to after payday`,
    reason: `Supplier terms allow these bills to be paid after payday with no penalty, so ${formatMoney(amount)} stays in the bank on payday.`,
    confidence: 'HIGH',
  };
}

export function holdText(orders: PurchaseOrder[], amount: Money): ActionWording {
  if (orders.length === 1) {
    const [p] = orders;
    return {
      title: `Order ${lowerFirst(p.description)} after payday`,
      reason: `This order is not urgent. Placing it on ${short(p.suggestedDate ?? p.dueDate)} keeps ${formatMoney(amount)} in the bank on payday.`,
      confidence: 'HIGH',
    };
  }
  return {
    title: `Hold ${plural(orders.length, 'purchase order')} until after payday`,
    reason: `These orders are not urgent. Placing them after payday keeps ${formatMoney(amount)} in the bank on payday.`,
    confidence: 'HIGH',
  };
}

/** Numbers the explanation talks about, all calculated by the engine. */
export interface ExplanationFacts {
  payrollTotal: Money;
  payday: ISODate;
  balanceBeforePayroll: Money;
  projectedAfterPayroll: Money;
  status: Status;
  safetyBuffer: Money;
  gapToBuffer: Money;
  overdueUnchased: Money;
  overdueUnchasedCount: number;
  billsDue: Money;
  withAllActions?: { projectedAfterPayroll: Money; status: Status };
}

const STATUS_WORDS: Record<Status, string> = { SAFE: 'safe', AT_RISK: 'at risk', SHORTFALL: 'short' };

export function explanation(f: ExplanationFacts): string {
  const payroll = `Payroll of ${formatMoney(f.payrollTotal)} is due on ${short(f.payday)}`;
  if (f.status === 'SAFE') {
    return `${payroll} and is covered: your projected balance after payroll is ${formatMoney(f.projectedAfterPayroll)}, above your ${formatMoney(f.safetyBuffer)} safety buffer. No action is needed. No recommendation affects staff salaries.`;
  }
  const situation = f.status === 'SHORTFALL'
    ? `${payroll}, but your projected balance that day is ${formatMoney(f.balanceBeforePayroll)}, a gap of ${formatMoney(-f.projectedAfterPayroll)}.`
    : `${payroll}. It is covered, but only ${formatMoney(f.projectedAfterPayroll)} would be left, ${formatMoney(f.gapToBuffer)} below your ${formatMoney(f.safetyBuffer)} safety buffer.`;
  const bills = f.billsDue > 0 ? `, while ${formatMoney(f.billsDue)} in bills fall due before payday` : '';
  const cause = f.overdueUnchasedCount > 0
    ? ` The main cause is ${formatMoney(f.overdueUnchased)} in overdue customer invoices${bills}.`
    : f.billsDue > 0 ? ` Bills of ${formatMoney(f.billsDue)} fall due before payday.` : '';
  const fix = f.withAllActions
    ? ` Approving the suggested actions would leave ${formatMoney(f.withAllActions.projectedAfterPayroll)} after payroll (${STATUS_WORDS[f.withAllActions.status]}).`
    : '';
  return `${situation}${cause}${fix} No recommendation affects staff salaries.`;
}

export function fallbackExplanation(f: ExplanationFacts, overdueTotal: Money): string {
  return `Projected balance after payroll on ${formatDate(f.payday)} is ${formatMoney(f.projectedAfterPayroll)} against a safety buffer of ${formatMoney(f.safetyBuffer)}. Overdue invoices total ${formatMoney(overdueTotal)}. Bills due before payday total ${formatMoney(f.billsDue)}. Actions are ranked by expected cash impact. This text is rules-based because the AI is unavailable.`;
}
