'use client';
import { useState } from 'react';
import { LeaveApprovals } from '@/components/approvals/LeaveApprovals';
import { OvertimeApprovals } from '@/components/approvals/OvertimeApprovals';
import { Badge, ConfirmDialog, ErrorNote, PageHead, Panel, type Confirm } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { useStore } from '@/lib/store';

export default function Approvals() {
  const { data, markNotificationsRead } = useStore();
  const [tab, setTab] = useState<'overtime' | 'leave'>('leave');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const act = (fn: () => void) => {
    setError(null);
    try { fn(); } catch (e) { setError((e as Error).message); }
  };
  const leaveCount = data.leaves.filter((l) => l.status === 'PENDING' || l.cancelRequestedAt).length;
  const otCount = data.overtime.filter((o) => o.status === 'REQUESTED' || o.cancelRequestedAt).length;
  const unread = data.notifications.filter((n) => !n.read);

  const tabButton = (id: typeof tab, label: string, count: number) => (
    <button
      type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
      className={`btn !px-5 ${tab === id ? 'btn-primary' : 'btn-ghost'}`}
    >
      {label} {count > 0 && <span className={`rounded-full px-1.5 text-xs ${tab === id ? 'bg-white/20' : 'bg-royal/10 text-royal'}`}>{count}</span>}
    </button>
  );

  return (
    <>
      <PageHead eyebrow="Approvals" title="Requests waiting for HR">
        Leave reasons are read by AI (SEA-LION) in the background. You decide: approve or reject, change the label if the AI got it wrong, or revert a decision.
      </PageHead>

      {unread.length > 0 && (
        <Panel className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2">Updates from employees <Badge tone="warn">{unread.length} new</Badge></h2>
            <button type="button" className="btn btn-line !px-4 !py-2" onClick={() => markNotificationsRead()}>Mark all as read</button>
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

      <div role="tablist" className="mb-6 flex gap-2">{tabButton('leave', 'Leave', leaveCount)}{tabButton('overtime', 'Overtime', otCount)}</div>
      <ErrorNote message={error} />
      {tab === 'leave' ? <LeaveApprovals act={act} ask={setConfirm} /> : <OvertimeApprovals act={act} ask={setConfirm} />}
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
