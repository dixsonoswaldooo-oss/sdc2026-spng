'use client';
// Overtime from HR (accept / decline) and approved own requests; mark done after working it, or ask HR to cancel.
import { useState } from 'react';
import { GuardedButton, OT_STATUS, StatusBadges } from '@/components/requests';
import { Badge, ConfirmDialog, Empty, ErrorNote, PageHead, Panel, type Confirm } from '@/components/ui';
import { overtimeCancelBlock, overtimeRate } from '@/lib/engine';
import { date, money } from '@/lib/format';
import { useMe } from '@/lib/useMe';

export default function MyOvertime() {
  const { data, me, moveOvertime, requestOvertimeCancellation } = useMe();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const mine = data.overtime.filter((o) => o.employeeId === me.id && o.status !== 'REQUESTED' && o.status !== 'WITHDRAWN');
  const act = (fn: () => void) => {
    setError(null);
    try { fn(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <>
      <PageHead eyebrow="Overtime" title="Offers and approved overtime">
        Accept or decline HR&apos;s offers. After working the hours, mark it done and it is added to your pay. Plans changed? Ask HR to cancel before the day.
      </PageHead>
      <ErrorNote message={error} />
      <Panel>
        {mine.length === 0 ? <Empty>No overtime offers or approved requests yet.</Empty> : (
          <ul className="space-y-4">
            {mine.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius)] bg-gray p-5">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {o.hours} h on {date(o.date)}
                    <StatusBadges item={o} words={OT_STATUS[o.status]} />
                    <Badge tone="muted">{o.origin === 'HR' ? 'Offered by HR' : 'My request'}</Badge>
                  </p>
                  <p className="mt-1 text-sm text-text-70">{o.note}</p>
                  <p className="mt-1 text-xs text-muted">Worth {money(o.hours * overtimeRate(data, me))} when done</p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  {o.status === 'OFFERED' && (
                    <>
                      <button type="button" className="btn btn-ghost" onClick={() => act(() => moveOvertime(o.id, 'DECLINED'))}>Decline</button>
                      <button type="button" className="btn btn-primary" onClick={() => act(() => moveOvertime(o.id, 'ACCEPTED'))}>Accept</button>
                    </>
                  )}
                  {(o.status === 'ACCEPTED' || o.status === 'APPROVED') && (
                    o.cancelRequestedAt ? <span className="text-xs text-muted">Waiting for HR to decide the cancellation</span> : (
                      <>
                        <GuardedButton
                          label="Request cancellation" blocked={overtimeCancelBlock(data, o)}
                          onClick={() => setConfirm({
                            title: 'Ask HR to cancel this overtime?', body: 'Until HR decides, the overtime stays on.', confirmLabel: 'Send to HR',
                            onConfirm: () => act(() => requestOvertimeCancellation(o.id)),
                          })}
                        />
                        <GuardedButton label="Mark as done" primary blocked={null} onClick={() => act(() => moveOvertime(o.id, 'COMPLETED'))} />
                      </>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
