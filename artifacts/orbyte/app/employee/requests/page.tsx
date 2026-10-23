'use client';
// Overtime and leave requests, with the history and the AI/HR label for leave.
import { useState, type FormEvent } from 'react';
import { LabelBadge, LEAVE_TYPE, OT_STATUS, STATUS_TONE } from '@/components/requests';
import { Badge, Empty, ErrorNote, PageHead, Panel, TABLE, TD, TH } from '@/components/ui';
import { LABEL_WORDS } from '@/lib/engine';
import { date } from '@/lib/format';
import { useMe } from '@/lib/useMe';
import type { LeaveType } from '@/lib/types';

export default function Requests() {
  const { data, me, requestOvertime, submitLeave } = useMe();
  const [ot, setOt] = useState({ date: '2026-10-28', hours: 3, note: '' });
  const [lv, setLv] = useState({ type: 'LEAVE' as LeaveType, startDate: '2026-10-29', endDate: '2026-10-29', reason: '' });
  const [otMsg, setOtMsg] = useState<[string, boolean] | null>(null);
  const [lvMsg, setLvMsg] = useState<[string, boolean] | null>(null);
  const [busy, setBusy] = useState(false);
  const myLeaves = data.leaves.filter((l) => l.employeeId === me.id);
  const myOt = data.overtime.filter((o) => o.employeeId === me.id && o.origin === 'EMPLOYEE');

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

  const sendLeave = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { ai, aiPending } = await submitLeave(lv);
      setLvMsg([aiPending
        ? `Sent to HR. The AI is still waking up, so the keyword rules labelled it ${LABEL_WORDS[ai.label]} for now. The AI's label will replace it in the list below. HR decides.`
        : `Sent to HR. ${ai.source === 'AI' ? 'AI (SEA-LION)' : 'Fallback rules'} labelled it ${LABEL_WORDS[ai.label]}: ${ai.alasan} HR decides.`, true]);
      setLv({ ...lv, reason: '' });
    } catch (e) {
      setLvMsg([(e as Error).message, false]);
    } finally {
      setBusy(false);
    }
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
              <textarea id="reason" value={lv.reason} onChange={(e) => setLv({ ...lv, reason: e.target.value })} placeholder="e.g. My child has a high fever and needs to see a doctor." />
              <span className="mt-1 block text-xs text-muted">The AI suggests whether this day is paid (tolerated) or unpaid (deducted). HR makes the final decision.</span>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Reading your reason…' : 'Send request'}</button>
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
            <div className="field"><label htmlFor="otnote">Reason</label><textarea id="otnote" value={ot.note} onChange={(e) => setOt({ ...ot, note: e.target.value })} required placeholder="e.g. Stock count after closing." /></div>
            <button type="submit" className="btn btn-primary">Send request</button>
            <p className="mt-3 text-xs text-muted">Once approved and worked, mark it done in Overtime offers. Only completed overtime is paid.</p>
            {note(otMsg)}
          </form>
        </Panel>
      </div>

      <Panel className="mt-8">
        <h2>My requests</h2>
        {myLeaves.length + myOt.length === 0 ? <div className="mt-4"><Empty>No requests yet.</Empty></div> : (
          <div className="mt-4 overflow-x-auto">
            <table className={TABLE}>
              <thead><tr>{['Type', 'Dates', 'Reason', 'Label', 'Status'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {myLeaves.map((l) => (
                  <tr key={l.id}>
                    <td className={TD}>{LEAVE_TYPE[l.type]}</td>
                    <td className={TD}>{date(l.startDate)}{l.endDate !== l.startDate && ` – ${date(l.endDate)}`}</td>
                    <td className={`${TD} max-w-xs`}>“{l.reason}”<span className="mt-1 block text-xs text-muted">{l.labelReason}</span></td>
                    <td className={TD}><LabelBadge leave={l} /></td>
                    <td className={TD}><Badge tone={STATUS_TONE[l.status]}>{l.status === 'PENDING' ? 'Waiting for HR' : l.status === 'APPROVED' ? 'Approved' : 'Rejected'}</Badge></td>
                  </tr>
                ))}
                {myOt.map((o) => (
                  <tr key={o.id}>
                    <td className={TD}>Overtime</td>
                    <td className={TD}>{date(o.date)} · {o.hours} h</td>
                    <td className={`${TD} max-w-xs`}>“{o.note}”</td>
                    <td className={TD}>—</td>
                    <td className={TD}><Badge tone={OT_STATUS[o.status][1]}>{OT_STATUS[o.status][0]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
