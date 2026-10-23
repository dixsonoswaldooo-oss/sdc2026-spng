'use client';
// Overtime from HR (accept / decline) and approved own requests; mark done after working it.
import { useState } from 'react';
import { OT_STATUS } from '@/components/requests';
import { Badge, Empty, ErrorNote, PageHead, Panel } from '@/components/ui';
import { date, money } from '@/lib/format';
import { useMe } from '@/lib/useMe';

export default function MyOvertime() {
  const { data, me, moveOvertime } = useMe();
  const [error, setError] = useState<string | null>(null);
  const mine = data.overtime.filter((o) => o.employeeId === me.id && o.status !== 'REQUESTED');
  const act = (fn: () => void) => {
    setError(null);
    try { fn(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <>
      <PageHead eyebrow="Overtime" title="Offers and approved overtime">
        Accept or decline HR&apos;s offers. After working the hours, mark it done and it is added to your pay.
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
                    <Badge tone={OT_STATUS[o.status][1]}>{OT_STATUS[o.status][0]}</Badge>
                    <Badge tone="muted">{o.origin === 'HR' ? 'Offered by HR' : 'My request'}</Badge>
                  </p>
                  <p className="mt-1 text-sm text-text-70">{o.note}</p>
                  <p className="mt-1 text-xs text-muted">Worth {money(o.hours * data.config.overtimeRatePerHour)} when done</p>
                </div>
                <div className="flex gap-2">
                  {o.status === 'OFFERED' && (
                    <>
                      <button type="button" className="btn btn-ghost" onClick={() => act(() => moveOvertime(o.id, 'DECLINED'))}>Decline</button>
                      <button type="button" className="btn btn-primary" onClick={() => act(() => moveOvertime(o.id, 'ACCEPTED'))}>Accept</button>
                    </>
                  )}
                  {(o.status === 'ACCEPTED' || o.status === 'APPROVED') && (
                    <button type="button" className="btn btn-primary" onClick={() => act(() => moveOvertime(o.id, 'COMPLETED'))}>Mark as done</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
