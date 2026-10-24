'use client';
// Overtime and leave requests. Sending is instant: the AI reads a leave reason in the background and HR sees its summary.
import { useRef, useState, type FormEvent } from 'react';
import { RequestHistory } from '@/components/employee/RequestHistory';
import { LEAVE_TYPE } from '@/components/requests';
import { Notice, PageHead, Panel } from '@/components/ui';
import { useMe } from '@/lib/useMe';
import type { LeaveType } from '@/lib/types';
import { t } from '@/lib/i18n';

export default function Requests() {
  const { requestOvertime, submitLeave } = useMe();
  const [ot, setOt] = useState({ date: '2026-10-28', hours: 3, note: '' });
  const [lv, setLv] = useState({ type: 'LEAVE' as LeaveType, startDate: '2026-10-29', endDate: '2026-10-29', reason: '' });
  const [otMsg, setOtMsg] = useState<[string, boolean] | null>(null);
  const [lvMsg, setLvMsg] = useState<[string, boolean] | null>(null);
  const leaveReason = useRef<HTMLTextAreaElement>(null);
  const otReason = useRef<HTMLTextAreaElement>(null);

  const sendOt = (event: FormEvent) => {
    event.preventDefault();
    try {
      requestOvertime(ot);
      setOtMsg([t('Sent to HR for approval.'), true]);
      setOt({ ...ot, note: '' });
    } catch (e) {
      setOtMsg([(e as Error).message, false]);
    }
  };

  const sendLeave = (event: FormEvent) => {
    event.preventDefault();
    try {
      submitLeave(lv);
      setLvMsg([t('Sent to HR. It is waiting for HR’s decision; the AI is reading your reason in the background and HR will see its summary.'), true]);
      setLv({ ...lv, reason: '' });
    } catch (e) {
      setLvMsg([(e as Error).message, false]);
    }
  };

  /** A rejected request comes back into the form as a new one. */
  const prefill = (field: HTMLTextAreaElement | null) => {
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field?.focus({ preventScroll: true });
  };

  const note = (msg: [string, boolean] | null) => msg && <Notice error={msg[1] ? null : msg[0]} success={msg[0]} />;

  return (
    <>
      <PageHead eyebrow={t('Requests')} title={t('Ask for overtime or leave')}>{t("Ask HR for leave or overtime. HR's answer shows up in the list below.")}</PageHead>
      <div className="grid gap-8 lg:grid-cols-2">
        <Panel>
          <h2>{t('Leave, permission, sick or day off')}</h2>
          <form onSubmit={sendLeave} className="mt-5">
            <div className="field">
              <label htmlFor="type">{t('Type')}</label>
              <select id="type" value={lv.type} onChange={(e) => setLv({ ...lv, type: e.target.value as LeaveType })}>
                {(Object.keys(LEAVE_TYPE) as LeaveType[]).map((type) => <option key={type} value={type}>{t(LEAVE_TYPE[type])}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4">
              <div className="field"><label htmlFor="start">{t('From')}</label><input id="start" type="date" value={lv.startDate} onChange={(e) => setLv({ ...lv, startDate: e.target.value, endDate: e.target.value > lv.endDate ? e.target.value : lv.endDate })} required /></div>
              <div className="field"><label htmlFor="end">{t('To')}</label><input id="end" type="date" min={lv.startDate} value={lv.endDate} onChange={(e) => setLv({ ...lv, endDate: e.target.value })} required /></div>
            </div>
            <div className="field">
              <label htmlFor="reason">{t('Reason')}</label>
              <textarea id="reason" ref={leaveReason} value={lv.reason} onChange={(e) => setLv({ ...lv, reason: e.target.value })} placeholder={t('e.g. My child has a high fever and needs to see a doctor.')} />
              <span className="mt-1 block text-xs text-muted">{t('The AI suggests whether this day is paid or unpaid. HR makes the final decision.')}</span>
            </div>
            <button type="submit" className="btn btn-primary">{t('Send request')}</button>
            {note(lvMsg)}
          </form>
        </Panel>

        <Panel>
          <h2>{t('Overtime')}</h2>
          <form onSubmit={sendOt} className="mt-5">
            <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4">
              <div className="field"><label htmlFor="otdate">{t('Date')}</label><input id="otdate" type="date" value={ot.date} onChange={(e) => setOt({ ...ot, date: e.target.value })} required /></div>
              <div className="field"><label htmlFor="othours">{t('Hours')}</label><input id="othours" type="number" min={0.5} max={12} step={0.5} value={ot.hours} onChange={(e) => setOt({ ...ot, hours: Number(e.target.value) })} required /></div>
            </div>
            <div className="field"><label htmlFor="otnote">{t('Reason')}</label><textarea id="otnote" ref={otReason} value={ot.note} onChange={(e) => setOt({ ...ot, note: e.target.value })} required placeholder={t('e.g. Stock count after closing.')} /></div>
            <button type="submit" className="btn btn-primary">{t('Send request')}</button>
            <p className="mt-3 text-xs text-muted">{t('Once approved and worked, mark it done under Overtime. Only completed overtime is paid.')}</p>
            {note(otMsg)}
          </form>
        </Panel>
      </div>

      <Panel className="mt-8">
        <h2>{t('My requests')}</h2>
        <RequestHistory
          onResubmitLeave={(l) => {
            setLv({ type: l.type, startDate: l.startDate, endDate: l.endDate, reason: l.reason });
            setLvMsg([t('Copied from your rejected request. Change what you need, then send it as a new request.'), true]);
            prefill(leaveReason.current);
          }}
          onResubmitOvertime={(o) => {
            setOt({ date: o.date, hours: o.hours, note: o.note });
            setOtMsg([t('Copied from your rejected request. Change what you need, then send it as a new request.'), true]);
            prefill(otReason.current);
          }}
        />
      </Panel>
    </>
  );
}
