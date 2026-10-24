'use client';
// Read-only activity log in plain sentences: who did what, to whom, when. A few filters; details on demand.
import { useState } from 'react';
import { Empty, PageHead, Panel } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { ActivityKind } from '@/lib/types';
import { t, td, tx } from '@/lib/i18n';

const FILTERS: [string, string, ActivityKind[]][] = [
  ['all', 'Everything', []],
  ['decisions', 'Requests & decisions', ['REQUEST', 'DECISION', 'REVERT', 'AI_LABEL']],
  ['pay', 'Pay & rates', ['CONFIG', 'RECALC', 'PAYMENT', 'ATTENDANCE']],
  ['people', 'Workers & messages', ['PEOPLE', 'WHATSAPP', 'LOGIN']],
];
const PAGE = 50;

export default function ActivityLog() {
  const { data } = useStore();
  const [filter, setFilter] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const kinds = FILTERS.find(([id]) => id === filter)![2];
  const rows = data.activity.filter((a) => !kinds.length || kinds.includes(a.kind));

  return (
    <>
      <PageHead eyebrow={t('Activity log')} title={t('What happened')}>
        {t('Who did what, and when, newest first. Nothing can be edited here.')}
      </PageHead>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t('Show')}>
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => { setFilter(id); setShown(PAGE); }} className={`btn !px-4 !py-2 ${filter === id ? 'btn-primary' : 'btn-ghost'}`}>
            {t(label)}
          </button>
        ))}
      </div>
      <Panel>
        {rows.length === 0 ? <Empty>{t('Nothing here yet. Pick another filter above.')}</Empty> : (
          <>
            <ol className="divide-y divide-line">
              {rows.slice(0, shown).map((a) => (
                <li key={a.id} className="py-3 first:pt-0">
                  <p className="text-sm">
                    <span className="font-semibold text-navy">{td(a.actor.replace(/^HR: /, ''))}</span> · {tx(a.action)}
                    {a.target && <> · <span className="font-medium">{tx(a.target)}</span></>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{dateTime(a.at)}</p>
                  {a.detail && (
                    <details className="mt-1 text-sm text-text-70">
                      <summary className="cursor-pointer py-1 text-xs text-royal">{t('Details')}</summary>
                      <p className="mt-1 max-w-2xl">{tx(a.detail)}</p>
                    </details>
                  )}
                </li>
              ))}
            </ol>
            {rows.length > shown && (
              <button type="button" className="btn btn-ghost mt-4 !px-4 !py-2" onClick={() => setShown(shown + PAGE)}>{t('Show older ({n} more)', { n: rows.length - shown })}</button>
            )}
          </>
        )}
      </Panel>
    </>
  );
}
