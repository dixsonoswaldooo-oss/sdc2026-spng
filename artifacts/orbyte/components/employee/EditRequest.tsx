'use client';
// Edit a pending leave or overtime request in a dialog. Saving notifies HR; for leave, the AI reads the new reason.
import { useState, type FormEvent } from 'react';
import { LEAVE_TYPE } from '@/components/requests';
import { ErrorNote, Modal } from '@/components/ui';
import { useStore } from '@/lib/store';
import type { LeaveRequest, LeaveType, Overtime } from '@/lib/types';

export type Editing = { kind: 'leave'; item: LeaveRequest } | { kind: 'overtime'; item: Overtime } | null;

export function EditRequest({ editing, onClose, onSaved }: { editing: Editing; onClose: () => void; onSaved: (message: string) => void }) {
  return (
    <Modal open={!!editing} title={editing?.kind === 'overtime' ? 'Edit overtime request' : 'Edit leave request'} onClose={onClose}>
      {editing && <EditForm key={editing.item.id} editing={editing} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function EditForm({ editing, onClose, onSaved }: { editing: NonNullable<Editing>; onClose: () => void; onSaved: (message: string) => void }) {
  const { editLeave, editOvertime } = useStore();
  const leave = editing.kind === 'leave' ? editing.item : null;
  const ot = editing.kind === 'overtime' ? editing.item : null;
  const [lv, setLv] = useState(leave ? { type: leave.type, startDate: leave.startDate, endDate: leave.endDate, reason: leave.reason } : null);
  const [o, setO] = useState(ot ? { date: ot.date, hours: ot.hours, note: ot.note } : null);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      if (lv && leave) editLeave(leave.id, lv);
      if (o && ot) editOvertime(ot.id, o);
      onSaved('Changes saved. HR has been told about the new version.');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <form onSubmit={submit}>
      {lv && (
        <>
          <div className="field">
            <label htmlFor="edit-type">Type</label>
            <select id="edit-type" value={lv.type} onChange={(e) => setLv({ ...lv, type: e.target.value as LeaveType })}>
              {(Object.keys(LEAVE_TYPE) as LeaveType[]).map((t) => <option key={t} value={t}>{LEAVE_TYPE[t]}</option>)}
            </select>
          </div>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <div className="field"><label htmlFor="edit-start">From</label><input id="edit-start" type="date" value={lv.startDate} onChange={(e) => setLv({ ...lv, startDate: e.target.value, endDate: e.target.value > lv.endDate ? e.target.value : lv.endDate })} required /></div>
            <div className="field"><label htmlFor="edit-end">To</label><input id="edit-end" type="date" min={lv.startDate} value={lv.endDate} onChange={(e) => setLv({ ...lv, endDate: e.target.value })} required /></div>
          </div>
          <div className="field"><label htmlFor="edit-reason">Reason</label><textarea id="edit-reason" value={lv.reason} onChange={(e) => setLv({ ...lv, reason: e.target.value })} /></div>
          <p className="text-xs text-muted">The AI reads the new reason in the background; HR makes the final decision.</p>
        </>
      )}
      {o && (
        <>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <div className="field"><label htmlFor="edit-date">Date</label><input id="edit-date" type="date" value={o.date} onChange={(e) => setO({ ...o, date: e.target.value })} required /></div>
            <div className="field"><label htmlFor="edit-hours">Hours</label><input id="edit-hours" type="number" min={0.5} max={12} step={0.5} value={o.hours} onChange={(e) => setO({ ...o, hours: Number(e.target.value) })} required /></div>
          </div>
          <div className="field"><label htmlFor="edit-note">Reason</label><textarea id="edit-note" value={o.note} onChange={(e) => setO({ ...o, note: e.target.value })} required /></div>
        </>
      )}
      <ErrorNote message={error} />
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="btn btn-line" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save changes</button>
      </div>
    </form>
  );
}
