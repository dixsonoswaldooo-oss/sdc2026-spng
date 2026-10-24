'use client';
// One worker's message thread (simulated WhatsApp), oldest first like a chat, with a box to write the next message.
// HR sees its own messages and the automatic alerts on the right; the worker sees their replies on the right.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { dateTime } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { WhatsAppMessage } from '@/lib/types';
import { Badge, Empty, Notice } from './ui';
import { t, tx } from '@/lib/i18n';

const AUTO: Partial<Record<WhatsAppMessage['kind'], [string, 'danger' | 'warn' | 'royal']>> = {
  DEDUCTION: ['Pay cut alert', 'danger'], // labels translated where shown
  DEDUCTION_UPDATE: ['Pay cut update', 'warn'],
  OVERTIME_OFFER: ['Overtime offer', 'royal'],
};
const MAX = 500;

export function Conversation({ employeeId, viewer }: { employeeId: string; viewer: 'HR' | 'WORKER' }) {
  const { data, sendMessage } = useStore();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const worker = data.employees.find((e) => e.id === employeeId)!;
  const messages = data.whatsapp.filter((m) => m.employeeId === employeeId).reverse(); // stored newest first
  // Newest message in view inside the thread, without scrolling the page itself.
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [messages.length]);

  const send = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      sendMessage(employeeId, text);
      setText('');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      {messages.length === 0 ? (
        <Empty>{t('No messages yet.')} {viewer === 'HR' ? t('Write to {name} below.', { name: worker.name.split(' ')[0] }) : t('Pay cut alerts and messages from HR show up here; you can answer below.')}</Empty>
      ) : (
        <ol ref={list} className="max-h-[32rem] space-y-3 overflow-y-auto rounded-[var(--radius)] bg-gray p-3 sm:p-5" aria-label={t('Messages with {name}', { name: viewer === 'HR' ? worker.name : 'HR' })}>
          {messages.map((m) => {
            const fromWorker = m.kind === 'REPLY';
            const mine = (viewer === 'WORKER') === fromWorker;
            const auto = AUTO[m.kind];
            return (
              <li key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {auto ? <Badge tone={auto[1]}>{t(auto[0])}</Badge> : <span className="font-semibold text-navy">{fromWorker ? worker.name : 'HR'}</span>}
                  {dateTime(m.at)}
                </span>
                <p className={`max-w-[85%] whitespace-pre-wrap rounded-[18px] px-4 py-3 text-sm leading-relaxed shadow-[0_1px_2px_rgba(11,30,77,0.08)] sm:max-w-xl ${mine ? 'rounded-tr-[4px] bg-royal text-white' : 'rounded-tl-[4px] bg-white text-navy'}`}>{auto ? tx(m.text) : m.text}</p>
              </li>
            );
          })}
        </ol>
      )}
      <form onSubmit={send} className="mt-4">
        <label htmlFor={`msg-${employeeId}`} className="text-[0.85rem] font-semibold">{viewer === 'HR' ? t('Message to {name}', { name: worker.name }) : t('Reply to HR')}</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            id={`msg-${employeeId}`} rows={2} maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)}
            className="min-h-12 flex-1 rounded-[var(--radius-sm)] border border-line bg-white px-3 py-2 text-sm"
            placeholder={t(viewer === 'HR' ? 'e.g. Please bring your MC slip on Monday.' : 'e.g. Noted, thank you.')}
          />
          <button type="submit" className="btn btn-primary justify-center" disabled={!text.trim()}>{t('Send')}</button>
        </div>
        <p className="mt-1 text-xs text-muted">{text.length}/{MAX} · {t('sent by WhatsApp (simulated)')}</p>
        <Notice error={error} />
      </form>
    </div>
  );
}
