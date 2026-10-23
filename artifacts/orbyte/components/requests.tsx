'use client';
// Shared bits for leave and overtime lists (HR and employee screens).
import { LABEL_WORDS } from '@/lib/engine';
import { date } from '@/lib/format';
import type { LeaveRequest, Overtime } from '@/lib/types';
import { Badge, Empty, TABLE, TD, TH } from './ui';

export const LEAVE_TYPE: Record<LeaveRequest['type'], string> = { LEAVE: 'Leave', PERMISSION: 'Permission', SICK: 'Sick', DAY_OFF: 'Day off' };
export const STATUS_TONE = { PENDING: 'warn', APPROVED: 'success', REJECTED: 'muted' } as const;
export const SOURCE: Record<LeaveRequest['labelSource'], string> = { AI: 'AI', Fallback: 'Fallback', HR: 'Changed by HR' };

export function LabelBadge({ leave }: { leave: LeaveRequest }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge tone={leave.label === 'DIPOTONG' ? 'danger' : 'success'}>{LABEL_WORDS[leave.label]}</Badge>
      <Badge tone="royal">{SOURCE[leave.labelSource]}</Badge>
      {leave.labelSource !== 'HR' && leave.confidence < 0.6 && <Badge tone="warn">Needs review</Badge>}
    </span>
  );
}

export const OT_STATUS: Record<Overtime['status'], [string, 'warn' | 'success' | 'muted' | 'royal']> = {
  OFFERED: ['Offered', 'warn'], ACCEPTED: ['Accepted', 'royal'], DECLINED: ['Declined', 'muted'], REQUESTED: ['Requested', 'warn'],
  APPROVED: ['Approved', 'royal'], REJECTED: ['Rejected', 'muted'], COMPLETED: ['Done · paid', 'success'],
};

export function OvertimeTable({ rows, name }: { rows: Overtime[]; name: (id: string) => string }) {
  if (!rows.length) return <div className="mt-4"><Empty>Nothing here yet.</Empty></div>;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className={TABLE}>
        <thead><tr>{['Employee', 'Date', 'Hours', 'Note', 'Status'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td className={TD}>{name(o.employeeId)}</td>
              <td className={TD}>{date(o.date)}</td>
              <td className={TD}>{o.hours} h</td>
              <td className={`${TD} max-w-xs`}>{o.note}</td>
              <td className={TD}><Badge tone={OT_STATUS[o.status][1]}>{OT_STATUS[o.status][0]}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
