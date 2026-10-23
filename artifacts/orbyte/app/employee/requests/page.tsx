'use client';
// Overtime and leave requests. Sending is instant: the AI reads a leave reason in the background and HR sees its summary.
import { useRef, useState, type FormEvent } from 'react';
import { RequestHistory } from '@/components/employee/RequestHistory';
import { LEAVE_TYPE } from '@/components/requests';
import { ErrorNote, PageHead, Panel } from '@/components/ui';
import { useMe } from '@/lib/useMe';
import type { LeaveType } from '@/lib/types';

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
      setOtMsg(['Sent to HR for approval.', true]);
      setOt({ ...ot, note: '' });
    } catch (e) {
      setOtMsg([(e as Error).message, false]);
    }
  };

  const sendLeave = (event: FormEvent) => {
    event.preventDefault();
    try {
      submitLeave(lv);
      setLvMsg(['Sent to HR. It is waiting for HR’s decision; the AI is reading your reason in the background and HR will see its summary.', true]);
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

  const note = (msg: [string, boolean] | null) => msg && (msg[1] ? <p role="status" className="mt-3 text-sm font-medium text-success">{msg[0]}</p> : <ErrorNote message={msg[0]} />);

  return (
    <>
      <PageHead eyebrow="Requests" title="Ask for overtime or leave" />
      <div className="grid gap-8 lg:grid-cols-2">
        <Panel>
          <h2>Leave, permission, sick or day off</h2>
          <form onSubmit={sendLeave} className="mt-5">
            <div className="field">
              <label htmlFor="type">Type</label>
              <select id="type" value={lv.type} onChange={(e) => setLv({ ...lv, type: e.target.value as LeaveType })}>
                {(Object.keys(LEAVE_TYPE) as LeaveType[]).map((t) => <option key={t} value={t}>{LEAVE_TYPE[t]}</option>)}
              </select>
            </div>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <div className="field"><label htmlFor="start">From</label><input id="start" type="date" value={lv.startDate} onChange={(e) => setLv({ ...lv, startDate: e.target.value, endDate: e.target.value > lv.endDate ? e.target.value : lv.endDate })} required /></div>
              <div className="field"><label htmlFor="end">To</label><input id="end" type="date" min={lv.startDate} value={lv.endDate} onChange={(e) => setLv({ ...lv, endDate: e.target.value })} required /></div>
            </div>
            <div className="field">
              <label htmlFor="reason">Reason</label>
              <textarea id="reason" ref={leaveReason} value={lv.reason} onChange={(e) => setLv({ ...lv, reason: e.target.value })} placeholder="e.g. My child has a high fever and needs to see a doctor." />
              <span className="mt-1 block text-xs text-muted">The AI suggests whether this day is paid (tolerated) or unpaid (deducted). HR makes the final decision.</span>
            </div>
            <button type="submit" className="btn btn-primary">Send request</button>
            {note(lvMsg)}
          </form>
        </Panel>

        <Panel>
          <h2>Overtime</h2>
          <form onSubmit={sendOt} className="mt-5">
            <div className="grid gap-x-4 sm:grid-cols-2">
              <div className="field"><label htmlFor="otdate">Date</label><input id="otdate" type="date" value={ot.date} onChange={(e) => setOt({ ...ot, date: e.target.value })} required /></div>
              <div className="field"><label htmlFor="othours">Hours</label><input id="othours" type="number" min={0.5} max={12} step={0.5} value={ot.hours} onChange={(e) => setOt({ ...ot, hours: Number(e.target.value) })} required /></div>
            </div>
            <div className="field"><label htmlFor="otnote">Reason</label><textarea id="otnote" ref={otReason} value={ot.note} onChange={(e) => setOt({ ...ot, note: e.target.value })} required placeholder="e.g. Stock count after closing." /></div>
            <button type="submit" className="btn btn-primary">Send request</button>
            <p className="mt-3 text-xs text-muted">Once approved and worked, mark it done in Overtime offers. Only completed overtime is paid.</p>
            {note(otMsg)}
          </form>
        </Panel>
      </div>

      <Panel className="mt-8">
        <h2>My requests</h2>
        <RequestHistory
          onResubmitLeave={(l) => {
            setLv({ type: l.type, startDate: l.startDate, endDate: l.endDate, reason: l.reason });
            setLvMsg(['Copied from your rejected request. Change what you need, then send it as a new request.', true]);
            prefill(leaveReason.current);
          }}
          onResubmitOvertime={(o) => {
            setOt({ date: o.date, hours: o.hours, note: o.note });
            setOtMsg(['Copied from your rejected request. Change what you need, then send it as a new request.', true]);
            prefill(otReason.current);
          }}
        />
      </Panel>
    </>
  );
}
