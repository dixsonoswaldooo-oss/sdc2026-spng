'use client';
// Read-only activity log with a filter by type.
import { useState } from 'react';
import { Badge, Empty, PageHead, Panel, TABLE, TD, TH } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { ActivityKind } from '@/lib/types';

const KINDS: [ActivityKind | 'ALL', string][] = [
  ['ALL', 'All'], ['LOGIN', 'Sign-in'], ['CONFIG', 'Settings'], ['REQUEST', 'Requests'], ['DECISION', 'Decisions'], ['REVERT', 'Reverts'], ['ATTENDANCE', 'Attendance'],
  ['AI_LABEL', 'AI labels'], ['RECALC', 'Recalculations'], ['WHATSAPP', 'WhatsApp'], ['PAYMENT', 'Payments'], ['SYSTEM', 'System'],
];
const TONE: Partial<Record<ActivityKind, 'royal' | 'success' | 'warn' | 'danger' | 'navy' | 'muted'>> = {
  DECISION: 'success', REVERT: 'danger', ATTENDANCE: 'warn', AI_LABEL: 'royal', RECALC: 'warn', PAYMENT: 'success', CONFIG: 'navy', WHATSAPP: 'muted',
};

export default function ActivityLog() {
  const { data } = useStore();
  const [kind, setKind] = useState<ActivityKind | 'ALL'>('ALL');
  const rows = data.activity.filter((a) => kind === 'ALL' || a.kind === kind);

  return (
    <>
      <PageHead eyebrow="Activity log" title="Everything that happened">
        Who did what, when, to whom, and what changed. Read-only.
      </PageHead>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by type">
        {KINDS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`btn !px-4 !py-2 ${kind === k ? 'btn-primary' : 'btn-ghost'}`}>
            {label}
          </button>
        ))}
      </div>
      <Panel>
        {rows.length === 0 ? <Empty>Nothing of this type yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead><tr>{['Time', 'Actor', 'Action', 'Target', 'Details'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className={`${TD} whitespace-nowrap text-xs text-muted`}>{dateTime(a.at)}</td>
                    <td className={`${TD} whitespace-nowrap`}>{a.actor}</td>
                    <td className={TD}><Badge tone={TONE[a.kind] ?? 'navy'}>{KINDS.find(([k]) => k === a.kind)?.[1]}</Badge><span className="mt-1 block font-medium">{a.action}</span></td>
                    <td className={TD}>{a.target}</td>
                    <td className={`${TD} max-w-md text-text-70`}>{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
