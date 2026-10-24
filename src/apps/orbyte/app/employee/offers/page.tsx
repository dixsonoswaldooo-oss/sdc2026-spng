'use client';
// Overtime from HR (accept / decline) and approved own requests; mark done after working it, or ask HR to cancel.
import Link from 'next/link';
import { useState } from 'react';
import { GuardedButton, OT_STATUS, StatusBadges } from '@/components/requests';
import { Badge, ConfirmDialog, Empty, ErrorNote, PageHead, Panel, type Confirm } from '@/components/ui';
import { overtimeCancelBlock, overtimeRate } from '@/lib/engine';
import { date, money } from '@/lib/format';
import { useMe } from '@/lib/useMe';
import { t } from '@/lib/i18n';

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
      <PageHead eyebrow={t('Overtime')} title={t('Offers and approved overtime')}>
        {t("Answer HR's overtime offers. After you work the hours, mark them done and they are added to your pay.")}
      </PageHead>
      <ErrorNote message={error} />
      <Panel>
        {mine.length === 0 ? <Empty>{t('No overtime yet. Want extra hours?')} <Link href="/employee/requests" className="font-medium text-royal">{t('Ask HR under Requests →')}</Link></Empty> : (
          <ul className="space-y-4">
            {mine.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius)] bg-gray p-5">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {t('{h} h on {date}', { h: o.hours, date: date(o.date) })}
                    <StatusBadges item={o} words={OT_STATUS[o.status]} />
                    <Badge tone="muted">{t(o.origin === 'HR' ? 'Offered by HR' : 'My request')}</Badge>
                  </p>
                  <p className="mt-1 text-sm text-text-70">{o.note}</p>
                  <p className="mt-1 text-xs text-muted">{t('Worth {amount} when done', { amount: money(o.hours * overtimeRate(data, me)) })}</p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  {o.status === 'OFFERED' && (
                    <>
                      <button type="button" className="btn btn-ghost" onClick={() => act(() => moveOvertime(o.id, 'DECLINED'))}>{t('Decline')}</button>
                      <button type="button" className="btn btn-primary" onClick={() => act(() => moveOvertime(o.id, 'ACCEPTED'))}>{t('Accept')}</button>
                    </>
                  )}
                  {(o.status === 'ACCEPTED' || o.status === 'APPROVED') && (
                    o.cancelRequestedAt ? <span className="text-xs text-muted">{t('Waiting for HR to decide the cancellation')}</span> : (
                      <>
                        <GuardedButton
                          label={t('Request cancellation')} blocked={overtimeCancelBlock(data, o)}
                          onClick={() => setConfirm({
                            title: t('Ask HR to cancel this overtime?'), body: t('Until HR decides, the overtime stays on.'), confirmLabel: t('Send to HR'),
                            onConfirm: () => act(() => requestOvertimeCancellation(o.id)),
                          })}
                        />
                        <GuardedButton label={t('Mark as done')} primary blocked={null} onClick={() => act(() => moveOvertime(o.id, 'COMPLETED'))} />
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
