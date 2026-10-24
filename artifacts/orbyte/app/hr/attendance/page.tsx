'use client';
// HR corrects attendance day by day. Corrections sit on top of the imported data (never overwritten) and can be reset.
// The monthly counts and everyone's pay update after each save.
import { useState } from 'react';
import { Badge, Notice, PageHead, Panel, TABLE, TD, TH } from '@/components/ui';
import { attendanceOf, attendanceSummary, paidReason } from '@/lib/engine';
import { date, monthName } from '@/lib/format';
import { DEMO_MONTH } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { AttendanceOverride, AttendanceRecord } from '@/lib/types';
import { DAY_STATUS } from '@/lib/words';

type Status = AttendanceOverride['status'];
const statusOf = (r: AttendanceRecord): Status => (r.izin ? 'IZIN' : r.clockIn ? 'PRESENT' : 'ABSENT');
const describe = (r: AttendanceRecord) => (r.izin ? DAY_STATUS.IZIN : !r.clockIn ? 'Absent' : r.lateMinutes ? `In ${r.clockIn} · ${r.lateMinutes} min late` : `In ${r.clockIn} · on time`);

export default function AttendancePage() {
  const { data, setAttendance } = useStore();
  const [who, setWho] = useState(data.employees[0].id);
  const [draft, setDraft] = useState<Record<string, { status: Status; late: number }>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const locked = paidReason(data, [`${DEMO_MONTH}-01`]);
  const person = data.employees.find((e) => e.id === who)!;
  const imported = data.attendance.filter((a) => a.employeeId === who && a.date.startsWith(DEMO_MONTH));
  const current = new Map(attendanceOf(data, who).map((a) => [a.date, a]));
  const onLeave = (day: string) => data.leaves.some((l) => l.employeeId === who && l.status === 'APPROVED' && day >= l.startDate && day <= l.endDate);

  const act = (fn: () => void, message: string, day: string) => {
    setError(null);
    try {
      fn();
      setDraft(({ [day]: _, ...rest }) => rest);
      setSaved(message);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <PageHead eyebrow="Attendance" title={`Attendance · ${monthName(DEMO_MONTH)}`}>
        Fix a day when the imported attendance is wrong. Your fix is marked &ldquo;Edited by HR&rdquo;, logged and can be reset; pay updates at once.
      </PageHead>
      {locked && <p className="mb-6 rounded-[var(--radius-sm)] bg-gray px-4 py-3 text-sm"><Badge tone="success">Locked</Badge> <span className="ml-2 text-muted">{locked}, so attendance can no longer be edited.</span></p>}

      <Panel>
        <h2>Monthly summary</h2>
        <div className="mt-4 overflow-x-auto">
          <table className={TABLE}>
            <thead><tr>{['Employee', 'Absent', 'Permitted absence', 'Late (past tolerance)', 'Edited by HR', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {data.employees.map((e) => {
                const s = attendanceSummary(data, e.id, DEMO_MONTH);
                return (
                  <tr key={e.id} className={e.id === who ? 'bg-royal/5' : ''}>
                    <td className={TD}><span className="font-semibold">{e.name}</span><span className="block text-xs text-muted">{e.position}</span></td>
                    <td className={`${TD} tabular`}>{s.absent} day{s.absent === 1 ? '' : 's'}</td>
                    <td className={`${TD} tabular`}>{s.izin} day{s.izin === 1 ? '' : 's'}</td>
                    <td className={`${TD} tabular`}>{s.late} day{s.late === 1 ? '' : 's'}</td>
                    <td className={TD}>{s.edited ? <Badge tone="royal">{s.edited} day{s.edited === 1 ? '' : 's'} edited</Badge> : <span className="text-xs text-muted">None</span>}</td>
                    <td className={TD}>
                      <button type="button" className="btn btn-ghost !px-4 !py-2" aria-pressed={e.id === who} onClick={() => { setWho(e.id); setDraft({}); setSaved(null); }}>Edit days</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">Permitted absence counts days you marked as permitted plus approved &ldquo;Permission&rdquo; requests; they are not cut from pay. Days from today on have not happened yet and are not shown below.</p>
      </Panel>

      <Panel className="mt-8">
        <h2>{person.name} · day by day</h2>
        <Notice error={error} success={saved} />
        <div className="mt-4 overflow-x-auto">
          <table className={TABLE}>
            <thead><tr>{['Date', 'Imported', 'Status', 'Minutes late', '', ''].map((h, i) => <th key={`${h}${i}`} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {imported.map((raw) => {
                const now = current.get(raw.date)!;
                const value = draft[raw.date] ?? { status: statusOf(now), late: now.lateMinutes };
                const dirty = !!draft[raw.date] && (value.status !== statusOf(now) || (value.status === 'PRESENT' && value.late !== now.lateMinutes));
                const lateInvalid = value.status === 'PRESENT' && (!Number.isInteger(value.late) || value.late < 0 || value.late > 600);
                return (
                  <tr key={raw.date}>
                    <td className={TD}>
                      {date(raw.date, { year: false })}
                      {onLeave(raw.date) && <span className="block text-xs text-muted">On approved leave</span>}
                    </td>
                    <td className={`${TD} text-text-70`}>{describe(raw)}</td>
                    <td className={TD}>
                      <select
                        aria-label={`Status on ${raw.date}`} disabled={!!locked} value={value.status}
                        onChange={(e) => setDraft({ ...draft, [raw.date]: { ...value, status: e.target.value as Status } })}
                        className="rounded-[var(--radius-sm)] border border-line bg-white px-3 py-2 text-sm"
                      >
                        <option value="PRESENT">{DAY_STATUS.PRESENT}</option>
                        <option value="ABSENT">{DAY_STATUS.ABSENT}</option>
                        <option value="IZIN">{DAY_STATUS.IZIN}</option>
                      </select>
                    </td>
                    <td className={TD}>
                      <input
                        aria-label={`Minutes late on ${raw.date}`} type="number" min={0} max={600} step={1}
                        disabled={!!locked || value.status !== 'PRESENT'} value={value.status === 'PRESENT' ? value.late : 0}
                        onChange={(e) => setDraft({ ...draft, [raw.date]: { ...value, late: Number(e.target.value) } })}
                        className={`tabular w-20 rounded-[var(--radius-sm)] border px-3 py-2 ${lateInvalid ? 'border-danger' : 'border-line'}`}
                      />
                      {lateInvalid && <span className="mt-1 block text-xs text-danger">0 to 600 whole minutes</span>}
                    </td>
                    <td className={TD}>{now.editedByHr && <Badge tone="royal">Edited by HR</Badge>}</td>
                    <td className={TD}>
                      <span className="flex gap-2">
                        <button
                          type="button" className="btn btn-ghost !px-4 !py-2" disabled={!!locked || !dirty || lateInvalid}
                          onClick={() => act(() => setAttendance(who, raw.date, { status: value.status, lateMinutes: value.late }), `${date(raw.date, { year: false })} saved. Pay recalculated.`, raw.date)}
                        >Save</button>
                        {now.editedByHr && (
                          <button
                            type="button" className="btn btn-ghost !px-4 !py-2" disabled={!!locked}
                            onClick={() => act(() => setAttendance(who, raw.date, null), `${date(raw.date, { year: false })} back to the imported value.`, raw.date)}
                          >Reset</button>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
