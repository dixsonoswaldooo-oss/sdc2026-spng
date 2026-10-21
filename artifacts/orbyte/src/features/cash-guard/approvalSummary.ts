import type { Action, Bill, DraftMessage, PurchaseOrder, Receivable } from '@/api/types';
import { formatDate, formatMoney } from '@/lib/format';

const CHANNEL = { WHATSAPP: 'WhatsApp', EMAIL: 'email' } as const;

/** Plain words for "exactly what will happen" in the approve dialog, plus the toast shown afterwards. */
export function approvalSummary(action: Action, drafts: DraftMessage[], receivables: Receivable[], bills: Bill[], purchaseOrders: PurchaseOrder[]) {
  if (action.type === 'CHASE_RECEIVABLE') {
    const n = drafts.length;
    const plural = n === 1 ? 'message' : 'messages';
    return {
      headline: `${n} ${plural} will be queued for sending. Nothing is sent until you confirm.`,
      details: drafts.map((d) => `${receivables.find((r) => r.id === d.receivableId)?.customer ?? d.receivableId} by ${CHANNEL[d.channel]} (${d.language})`),
      toast: `Approved. ${n} ${n === 1 ? 'reminder' : 'reminders'} queued for sending.`,
    };
  }
  if (action.type === 'RESCHEDULE_BILL') {
    const b = bills.filter((x) => action.relatedIds.includes(x.id));
    return {
      headline: b.map((x) => `${x.id} (${x.vendor}, ${formatMoney(x.amount)}) moves from ${formatDate(x.dueDate)} to ${formatDate(x.shiftableTo ?? x.dueDate)}.`).join(' '),
      details: [...b.map((x) => x.termNote ?? ''), 'Penalty: none.'].filter(Boolean),
      toast: 'Approved. The bill now falls after payday.',
    };
  }
  const p = purchaseOrders.filter((x) => action.relatedIds.includes(x.id));
  return {
    headline: p.map((x) => `${x.id} (${x.description}, ${formatMoney(x.amount)}) will be ordered on ${formatDate(x.suggestedDate ?? x.dueDate)} instead of ${formatDate(x.dueDate)}.`).join(' '),
    details: ['The order is not urgent.', 'The supplier is not contacted until the new date.'],
    toast: 'Approved. The packaging order moves to after payday.',
  };
}
