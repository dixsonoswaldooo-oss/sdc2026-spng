'use client';
// Shared bits for leave and overtime lists (HR and employee screens).
import type { ReactNode } from 'react';
import { LABEL_WORDS } from '@/lib/engine';
import { date } from '@/lib/format';
import type { LeaveRequest, Overtime } from '@/lib/types';
import { Badge, Empty, TABLE, TD, TH } from './ui';

type Tone = 'warn' | 'success' | 'muted' | 'royal';

export const LEAVE_TYPE: Record<LeaveRequest['type'], string> = { LEAVE: 'Leave', PERMISSION: 'Permission', SICK: 'Sick', DAY_OFF: 'Day off' };
export const LEAVE_STATUS: Record<LeaveRequest['status'], [string, Tone]> = {
  PENDING: ['Waiting for HR', 'warn'], APPROVED: ['Approved', 'success'], REJECTED: ['Rejected', 'muted'],
  WITHDRAWN: ['Withdrawn', 'muted'], CANCELLED: ['Cancelled', 'muted'],
};
export const SOURCE: Record<LeaveRequest['labelSource'], string> = { AI: 'AI', Fallback: 'Fallback', HR: 'Changed by HR' };

export function LabelBadge({ leave }: { leave: LeaveRequest }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge tone={leave.label === 'DIPOTONG' ? 'danger' : 'success'}>{LABEL_WORDS[leave.label]}</Badge>
      <Badge tone="royal">{SOURCE[leave.labelSource]}</Badge>
      {leave.aiPending && leave.status === 'PENDING' && <Badge tone="muted">AI reading…</Badge>}
      {leave.labelSource !== 'HR' && leave.confidence < 0.6 && <Badge tone="warn">Needs review</Badge>}
    </span>
  );
}

export const OT_STATUS: Record<Overtime['status'], [string, Tone]> = {
  OFFERED: ['Offered', 'warn'], ACCEPTED: ['Accepted', 'royal'], DECLINED: ['Declined', 'muted'], REQUESTED: ['Requested', 'warn'],
  APPROVED: ['Approved', 'royal'], REJECTED: ['Rejected', 'muted'], COMPLETED: ['Done · paid', 'success'],
  WITHDRAWN: ['Withdrawn', 'muted'], CANCELLED: ['Cancelled', 'muted'],
};

/** Status badge plus the extra states shown on both sides: cancellation asked, edited while pending. */
export function StatusBadges({ item, words }: { item: LeaveRequest | Overtime; words: [string, Tone] }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge tone={words[1]}>{words[0]}</Badge>
      {item.cancelRequestedAt && <Badge tone="warn">Cancellation requested</Badge>}
      {item.editedAt && (item.status === 'PENDING' || item.status === 'REQUESTED') && <Badge tone="navy">Edited</Badge>}
    </span>
  );
}

export function OvertimeTable({ rows, name, action }: { rows: Overtime[]; name: (id: string) => string; action?: (o: Overtime) => ReactNode }) {
  if (!rows.length) return <div className="mt-4"><Empty>Nothing here yet.</Empty></div>;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className={TABLE}>
        <thead><tr>{['Employee', 'Date', 'Hours', 'Note', 'Status', ...(action ? [''] : [])].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td className={TD}>{name(o.employeeId)}</td>
              <td className={TD}>{date(o.date)}</td>
              <td className={TD}>{o.hours} h</td>
              <td className={`${TD} max-w-xs`}>{o.note}</td>
              <td className={TD}><StatusBadges item={o} words={OT_STATUS[o.status]} /></td>
              {action && <td className={TD}>{action(o)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A button that may be unavailable; the reason is shown as text under it (not only on hover). */
export function GuardedButton({ label, blocked, onClick, primary = false }: { label: string; blocked: string | null; onClick: () => void; primary?: boolean }) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={`btn ${primary ? 'btn-primary' : 'btn-line'} !px-4 !py-2`} disabled={!!blocked} onClick={onClick}>{label}</button>
      {blocked && <span className="max-w-[16rem] text-xs text-muted">{blocked}</span>}
    </span>
  );
}
