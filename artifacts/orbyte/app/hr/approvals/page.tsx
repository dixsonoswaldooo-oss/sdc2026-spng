'use client';
// HR's approvals: one "To decide" list (leave, overtime and cancellations, filterable), then the history.
import Link from 'next/link';
import { useState } from 'react';
import { leaveCancellations, LeaveApprovals, leaveWaiting } from '@/components/approvals/LeaveApprovals';
import { overtimeCancellations, OvertimeApprovals, overtimeWaiting } from '@/components/approvals/OvertimeApprovals';
import { Badge, ConfirmDialog, Empty, ErrorNote, PageHead, Panel, type Confirm } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { useStore } from '@/lib/store';

type Filter = 'all' | 'leave' | 'overtime';

export default function Approvals() {
  const { data, markNotificationsRead } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const act = (fn: () => void) => {
    setError(null);
    try { fn(); } catch (e) { setError((e as Error).message); }
  };
  const leave = filter !== 'overtime';
  const overtime = filter !== 'leave';
  const leaveCount = leaveWaiting(data).length + leaveCancellations(data).length;
  const otCount = overtimeWaiting(data).length + overtimeCancellations(data).length;
  const cancelCount = (leave ? leaveCancellations(data).length : 0) + (overtime ? overtimeCancellations(data).length : 0);
  const shown = (leave ? leaveCount : 0) + (overtime ? otCount : 0);
  const unread = data.notifications.filter((n) => !n.read);
  const parts = { act, ask: setConfirm };

  const filterButton = (id: Filter, label: string, count: number) => (
    <button
      type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}
      className={`btn !px-4 !py-2 ${filter === id ? 'btn-primary' : 'btn-ghost'}`}
    >
      {label} {count > 0 && <span className={`rounded-full px-1.5 text-xs ${filter === id ? 'bg-white/20' : 'bg-royal/10 text-royal'}`}>{count}</span>}
    </button>
  );

  return (
    <>
      <PageHead eyebrow="Approvals" title="Requests waiting for HR">
        Decide on leave and overtime requests. The AI (SEA-LION) suggests whether leave is paid or unpaid; you have the final say.
      </PageHead>

      {unread.length > 0 && (
        <Panel className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2">Updates from employees <Badge tone="warn">{unread.length} new</Badge></h2>
            <button type="button" className="btn btn-ghost !px-4 !py-2" onClick={() => markNotificationsRead()}>Mark all as read</button>
          </div>
          <ul className="mt-4 space-y-2" aria-live="polite">
            {unread.map((n) => (
              <li key={n.id} className="rounded-[var(--radius-sm)] bg-gray px-4 py-3 text-sm">
                {n.text} <span className="text-xs text-muted">· {dateTime(n.at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2>To decide ({shown})</h2>
          <div role="tablist" aria-label="Show" className="flex flex-wrap gap-2">
            {filterButton('all', 'All', leaveCount + otCount)}{filterButton('leave', 'Leave', leaveCount)}{filterButton('overtime', 'Overtime', otCount)}
          </div>
        </div>
        <ErrorNote message={error} />
        <div className="mt-4 space-y-4">
          {leave && <LeaveApprovals part="waiting" {...parts} />}
          {overtime && <OvertimeApprovals part="waiting" {...parts} />}
          {cancelCount > 0 && <h3 className="!mt-8 text-[1rem]">Cancellation requests ({cancelCount})</h3>}
          {leave && <LeaveApprovals part="cancellations" {...parts} />}
          {overtime && <OvertimeApprovals part="cancellations" {...parts} />}
          {shown === 0 && (
            <Empty>
              Nothing to decide. New requests from employees show up here.{' '}
              <Link href="/hr/salary#overtime" className="font-medium text-royal">Need extra hands? Offer overtime →</Link>
            </Empty>
          )}
        </div>
      </Panel>

      <Panel className="mt-8">
        <h2>History</h2>
        <p className="mt-1 text-sm text-muted">Decided requests. Undo a decision to send it back to the list above.</p>
        {leave && <><h3 className="mt-6 text-[1rem]">Leave</h3><div className="mt-3"><LeaveApprovals part="history" {...parts} /></div></>}
        {overtime && <><h3 className="mt-6 text-[1rem]">Overtime</h3><OvertimeApprovals part="history" {...parts} /></>}
      </Panel>
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
