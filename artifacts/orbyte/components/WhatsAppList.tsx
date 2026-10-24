'use client';
// Simulated WhatsApp messages, shown as chat bubbles (HR outbox and employee inbox).
import { dateTime } from '@/lib/format';
import type { Employee, WhatsAppMessage } from '@/lib/types';
import { Badge, Empty } from './ui';

const KIND: Record<WhatsAppMessage['kind'], [string, 'danger' | 'warn' | 'royal']> = {
  DEDUCTION: ['Deduction', 'danger'],
  DEDUCTION_UPDATE: ['Update', 'warn'],
  OVERTIME_OFFER: ['Overtime offer', 'royal'],
};

export function WhatsAppList({ messages, employees, showRecipient }: { messages: WhatsAppMessage[]; employees: Employee[]; showRecipient: boolean }) {
  if (!messages.length) return <Empty>No messages yet. One is sent the moment a pay cut appears.</Empty>;
  return (
    <ul className="space-y-3">
      {messages.map((m) => {
        const to = employees.find((e) => e.id === m.employeeId);
        return (
          <li key={m.id} className="rounded-[var(--radius)] bg-gray p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Badge tone={KIND[m.kind][1]}>{KIND[m.kind][0]}</Badge>
              {showRecipient && <span className="font-semibold text-navy">To {to?.name}</span>}
              <span>{m.to}</span>
              <span>·</span>
              <span>{dateTime(m.at)}</span>
              <span className="ml-auto inline-flex items-center gap-1 text-success">✓✓ Sent (simulated)</span>
            </div>
            <p className="mt-3 max-w-2xl rounded-[18px] rounded-tl-[4px] bg-white px-4 py-3 text-sm leading-relaxed text-navy shadow-[0_1px_2px_rgba(11,30,77,0.08)]">{m.text}</p>
          </li>
        );
      })}
    </ul>
  );
}
