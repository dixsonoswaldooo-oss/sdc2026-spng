'use client';
// HR's overtime queue, in three parts the Approvals page places: waiting requests, cancellation requests, and the history
// (decided ones, which can go back to waiting). Each part renders nothing when empty; the page shows the empty state.
import { GuardedButton, OT_STATUS, OvertimeTable, StatusBadges } from '@/components/requests';
import { type Confirm } from '@/components/ui';
import { overtimeRate, paidReason, type Data } from '@/lib/engine';
import { date, dateTime, money } from '@/lib/format';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';

export const overtimeWaiting = (data: Data) => data.overtime.filter((o) => o.status === 'REQUESTED');
export const overtimeCancellations = (data: Data) => data.overtime.filter((o) => o.cancelRequestedAt);

export function OvertimeApprovals({ part, act, ask }: { part: 'waiting' | 'cancellations' | 'history'; act: (fn: () => void) => void; ask: (c: Confirm) => void }) {
  const { data, moveOvertime, revertOvertime, decideOvertimeCancellation } = useStore();
  const person = (id: string) => data.employees.find((e) => e.id === id)!;
  const name = (id: string) => person(id).name;

  if (part === 'waiting') {
    const pending = overtimeWaiting(data);
    return pending.length > 0 && (
      <ul className="space-y-4">
        {pending.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius)] bg-gray p-5">
            <div>
              <p className="flex flex-wrap items-center gap-2 font-semibold">{t('{name} · Overtime {h} h on {date}', { name: name(o.employeeId), h: o.hours, date: date(o.date) })} <StatusBadges item={o} words={OT_STATUS[o.status]} /></p>
              <p className="mt-1 text-sm text-text-70">“{o.note}”</p>
              <p className="mt-1 text-xs text-muted">{t('Worth {amount} once marked done', { amount: money(o.hours * overtimeRate(data, person(o.employeeId))) })}{o.editedAt && ` · ${t('edited {when}', { when: dateTime(o.editedAt) })}`}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => act(() => moveOvertime(o.id, 'REJECTED'))}>{t('Reject')}</button>
              <button type="button" className="btn btn-primary" onClick={() => act(() => moveOvertime(o.id, 'APPROVED'))}>{t('Approve')}</button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (part === 'cancellations') {
    const cancellations = overtimeCancellations(data);
    return cancellations.length > 0 && (
      <ul className="space-y-4">
        {cancellations.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius)] bg-gray p-5">
            <div>
              <p className="font-semibold">{t(o.origin === 'HR' ? '{name} wants to cancel an accepted overtime offer' : '{name} wants to cancel approved overtime', { name: name(o.employeeId) })}</p>
              <p className="mt-1 text-sm text-muted">{t('{h} h on {date}', { h: o.hours, date: date(o.date) })} · {t('asked {when}', { when: dateTime(o.cancelRequestedAt!) })}</p>
              <p className="mt-1 text-sm text-text-70">“{o.note}”</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => act(() => decideOvertimeCancellation(o.id, false))}>{t('Reject cancellation')}</button>
              <button type="button" className="btn btn-primary" onClick={() => act(() => decideOvertimeCancellation(o.id, true))}>{t('Approve cancellation')}</button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  const decided = data.overtime.filter((o) => o.origin === 'EMPLOYEE' && o.status !== 'REQUESTED');
  if (!decided.length) return <p className="mt-3 text-sm text-muted">{t('Nothing decided yet.')}</p>;
  return (
    <OvertimeTable
      rows={decided}
      name={name}
      action={(o) => (o.status === 'APPROVED' || o.status === 'REJECTED' || o.status === 'COMPLETED') && (
        <GuardedButton
          label={t('Undo decision')}
          blocked={o.status === 'COMPLETED' ? t('Worked and marked done') : paidReason(data, [o.date])}
          onClick={() => ask({
            title: t('Undo this decision?'),
            body: t("{name}'s overtime ({h} h on {date}) goes back to the waiting list and its {status} decision is cleared. The undo is logged.", { name: name(o.employeeId), h: o.hours, date: date(o.date), status: t(OT_STATUS[o.status][0]).toLowerCase() }),
            confirmLabel: t('Undo decision'),
            onConfirm: () => act(() => revertOvertime(o.id)),
          })}
        />
      )}
    />
  );
}
