'use client';
// Messages: one conversation per worker. Pick a worker (latest conversation first), read the thread, write to them.
// /hr/whatsapp?who=E3 opens that worker (used by "Try it live").
import { useEffect, useState } from 'react';
import { Conversation } from '@/components/Conversation';
import { Badge, PageHead, Panel } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { useStore } from '@/lib/store';
import { t, td, tx } from '@/lib/i18n';

export default function Messages() {
  const { data } = useStore();
  const latest = (id: string) => data.whatsapp.find((m) => m.employeeId === id); // stored newest first
  const people = [...data.employees].sort((a, b) => (latest(b.id)?.at ?? '').localeCompare(latest(a.id)?.at ?? ''));
  const [who, setWho] = useState(people[0]?.id ?? '');
  useEffect(() => {
    const asked = new URLSearchParams(location.search).get('who');
    if (asked && data.employees.some((e) => e.id === asked)) setWho(asked);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only the address on arrival
  }, []);
  const worker = data.employees.find((e) => e.id === who);

  return (
    <>
      <PageHead eyebrow={t('Messages')} title={t('Messages with workers')}>
        {t('Write to one worker and read their answers. Pay cut alerts and overtime offers sent automatically appear in the same conversation. Simulated WhatsApp: nothing leaves this app.')}
      </PageHead>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div>
          <div className="field lg:hidden">
            <label htmlFor="who">{t('Worker')}</label>
            <select id="who" value={who} onChange={(e) => setWho(e.target.value)}>
              {people.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <ul className="hidden space-y-1 lg:block" aria-label={t('Workers')}>
            {people.map((e) => {
              const last = latest(e.id);
              return (
                <li key={e.id}>
                  <button
                    type="button" aria-current={who === e.id ? 'true' : undefined} onClick={() => setWho(e.id)}
                    className={`w-full cursor-pointer rounded-[var(--radius-sm)] px-4 py-3 text-left transition ${who === e.id ? 'bg-white shadow-[0_1px_2px_rgba(11,30,77,0.08)]' : 'hover:bg-white/60'}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-navy">{e.name}</span>
                      {last?.kind === 'REPLY' && <Badge tone="royal">{t('Replied')}</Badge>}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{last ? `${dateTime(last.at)} · ${last.kind === 'REPLY' || last.kind === 'HR_MESSAGE' ? last.text : tx(last.text)}` : td(e.position)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        {worker && (
          <Panel>
            <h2>{worker.name}</h2>
            <p className="mt-1 text-sm text-muted">{td(worker.position)} · {td(worker.division)} · {worker.whatsapp}</p>
            <div className="mt-5"><Conversation key={worker.id} employeeId={worker.id} viewer="HR" /></div>
          </Panel>
        )}
      </div>
    </>
  );
}
