'use client';
// Workers & pay, one tab at a time: workers (search, grouped by department, pay with live preview, add a worker),
// overtime offers, leave allowance. The tab follows the address hash, so /hr/salary#overtime (and /hr/offers) opens Overtime.
// The rates themselves are on /hr/rates.
import { useEffect, useState, type FormEvent } from 'react';
import { LeaveAllowance } from '@/components/controls/LeaveAllowance';
import { OvertimeControls } from '@/components/controls/OvertimeControls';
import { Badge, Empty, Money, Notice, PageHead, Panel, TABLE, TD, TH } from '@/components/ui';
import { attendanceOf, isPaid, overtimeRate, payrollFor } from '@/lib/engine';
import { date, monthName } from '@/lib/format';
import { computePayroll } from '@/lib/payroll';
import { accountsOf, DEMO_MONTH, DIVISIONS } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { Employee } from '@/lib/types';
import { rt, t, td } from '@/lib/i18n';

const TABS = [['workers', 'Workers'], ['overtime', 'Overtime'], ['leave-allowance', 'Leave allowance']] as const;
type Tab = (typeof TABS)[number][0];
const tabOf = (hash: string): Tab => TABS.find(([id]) => `#${id}` === hash)?.[0] ?? 'workers';
const BLANK = { name: '', position: '', division: DIVISIONS[0], baseSalary: 2500, bonus: 0 };

export default function SalaryControls() {
  const { data, updateEmployeePay, addEmployee } = useStore();
  const [tab, setTab] = useState<Tab>('workers');
  const [query, setQuery] = useState('');
  const [pay, setPay] = useState<Record<string, { base: number; bonus: number }>>({});
  const [adding, setAdding] = useState(false);
  const [worker, setWorker] = useState(BLANK);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [addedName, setAddedName] = useState<string | null>(null);
  useEffect(() => {
    const follow = () => setTab(tabOf(location.hash));
    follow();
    addEventListener('hashchange', follow);
    return () => removeEventListener('hashchange', follow);
  }, []);

  const open = (id: Tab) => {
    setTab(id);
    setSaved(null);
    history.replaceState(null, '', `#${id}`);
  };
  const payOf = (e: Employee) => pay[e.id] ?? { base: e.baseSalary, bonus: e.bonus };
  const preview = (e: Employee) => computePayroll({
    employee: { ...e, baseSalary: payOf(e).base, bonus: payOf(e).bonus }, month: DEMO_MONTH, today: data.today,
    config: { ...data.config, overtimeRatePerHour: overtimeRate(data, e) },
    attendance: attendanceOf(data, e.id), leaves: data.leaves.filter((l) => l.employeeId === e.id), overtime: data.overtime.filter((o) => o.employeeId === e.id),
  });
  const act = (fn: () => void, message: string) => {
    setError(null);
    try {
      fn();
      setSaved(message);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const add = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      addEmployee(worker);
      setAddedName(worker.name.trim().replace(/s+/g, ' '));
      setWorker(BLANK);
      setAdding(false);
    } catch (e) {
      setError((e as Error).message); // the form stays filled so HR can fix it
    }
  };
  const added = data.employees.find((e) => e.name === addedName); // names are unique (engine.addEmployee)

  const needle = query.trim().toLowerCase();
  const found = data.employees.filter((e) => !needle || e.name.toLowerCase().includes(needle));
  const groups = DIVISIONS.map((d) => [d, found.filter((e) => e.division === d)] as const).filter(([, people]) => people.length);

  return (
    <>
      <PageHead eyebrow={t('Workers & pay')} title={t('Workers, pay and overtime')}>
        {t('Find a worker, change their pay, add a new worker, offer overtime and set leave allowances. Rates are on the Rates page.')}
      </PageHead>
      {isPaid(data, DEMO_MONTH) && <p className="mb-6 rounded-[var(--radius-sm)] bg-gray px-4 py-3 text-sm"><Badge tone="success">{t('{month} is paid', { month: monthName(DEMO_MONTH) })}</Badge> <span className="ml-2 text-muted">{t('Its amounts are frozen; changes here apply to the next payroll.')}</span></p>}

      <div role="tablist" aria-label={t('Sections')} className="flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => open(id)} className={`btn shrink-0 !px-4 !py-2 ${tab === id ? 'btn-primary' : 'btn-ghost'}`}>{t(label)}</button>
        ))}
      </div>

      {tab === 'workers' && (
        <Panel className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="field !mb-0 w-full sm:w-80">
              <label htmlFor="search">{t('Search by name')}</label>
              <input id="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('e.g. {example}', { example: 'Ravi' })} autoComplete="off" />
            </div>
            <button type="button" className={`btn ${adding ? 'btn-ghost' : 'btn-primary'}`} aria-expanded={adding} onClick={() => { setAdding(!adding); setSaved(null); setError(null); setAddedName(null); }}>
              {t(adding ? 'Close' : '+ Add a worker')}
            </button>
          </div>

          {adding && (
            <form onSubmit={add} className="mt-5 rounded-[var(--radius)] bg-gray p-5" aria-label={t('Add a worker')}>
              <h2 className="text-[1.15rem]">{t('Add a worker')}</h2>
              <p className="mt-1 text-sm text-muted">{rt('They get a sign-in at once (password {pw}) and start today, so earlier days are never counted as absent.', { pw: <code>demo</code> })}</p>
              <div className="mt-4 grid grid-cols-2 gap-x-3 sm:gap-x-6 lg:grid-cols-5">
                <div className="field col-span-2 lg:col-span-1"><label htmlFor="w-name">{t('Full name')}</label><input id="w-name" value={worker.name} onChange={(e) => setWorker({ ...worker, name: e.target.value })} required minLength={2} maxLength={60} /></div>
                <div className="field col-span-2 lg:col-span-1"><label htmlFor="w-position">{t('Position')}</label><input id="w-position" value={worker.position} onChange={(e) => setWorker({ ...worker, position: e.target.value })} required minLength={2} maxLength={60} /></div>
                <div className="field col-span-2 lg:col-span-1">
                  <label htmlFor="w-division">{t('Department')}</label>
                  <select id="w-division" value={worker.division} onChange={(e) => setWorker({ ...worker, division: e.target.value })}>
                    {DIVISIONS.map((d) => <option key={d} value={d}>{td(d)}</option>)}
                  </select>
                </div>
                <div className="field"><label htmlFor="w-base">{t('Base salary (RM)')}</label><input id="w-base" type="number" min={0} max={100000} step={50} value={worker.baseSalary} onChange={(e) => setWorker({ ...worker, baseSalary: Number(e.target.value) })} required className="tabular" /></div>
                <div className="field"><label htmlFor="w-bonus">{t('Bonus (RM)')}</label><input id="w-bonus" type="number" min={0} max={100000} step={50} value={worker.bonus} onChange={(e) => setWorker({ ...worker, bonus: Number(e.target.value) })} required className="tabular" /></div>
              </div>
              <button type="submit" className="btn btn-primary">{t('Add worker')}</button>
              <Notice error={error} />
            </form>
          )}
          {added && (
            <p role="status" className="mt-4 rounded-[var(--radius-sm)] bg-success/10 px-4 py-3 text-sm font-medium text-success">
              {t('{name} added to {department}. They sign in as {email} (password demo).', { name: added.name, department: td(added.division), email: accountsOf(data.employees).find((a) => a.employeeId === added.id)?.email ?? '' })}
            </p>
          )}
          {!adding && <Notice error={error} success={saved} />}

          {groups.length === 0 ? (
            <div className="mt-6">
              <Empty>{rt('No worker matches “{query}”. Check the spelling, or {reset}.', { query, reset: <button type="button" className="font-medium text-royal underline" onClick={() => setQuery('')}>{t('show everyone')}</button> })}</Empty>
            </div>
          ) : groups.map(([division, people]) => (
            <div key={division} role="group" aria-labelledby={`dept-${division}`} className="mt-8">
              <h2 id={`dept-${division}`} className="flex items-center gap-2 text-[1.15rem]">{td(division)} <span className="text-sm font-normal text-muted">({people.length})</span></h2>
              <div className="mt-3 overflow-x-auto">
                <table className={TABLE}>
                  <thead><tr>{['Worker', 'Base salary (RM)', 'Bonus (RM)', 'Take-home now', 'After saving', ''].map((h) => <th key={h} className={TH}>{t(h)}</th>)}</tr></thead>
                  <tbody>
                    {people.map((e) => {
                      const current = payrollFor(data, e.id, DEMO_MONTH).netPay;
                      const next = preview(e).netPay;
                      const value = payOf(e);
                      const dirty = value.base !== e.baseSalary || value.bonus !== e.bonus;
                      return (
                        <tr key={e.id}>
                          <td className={TD}><span className="font-semibold">{e.name}</span><span className="block text-xs text-muted">{td(e.position)}{e.startDate && ` · ${t('joined {date}', { date: date(e.startDate, { year: false }) })}`}</span></td>
                          {(['base', 'bonus'] as const).map((f) => (
                            <td key={f} className={TD}>
                              <input
                                aria-label={t(f === 'base' ? 'Base salary for {name}' : 'Bonus for {name}', { name: e.name })}
                                type="number" min={0} step={50} value={value[f]}
                                onChange={(ev) => setPay({ ...pay, [e.id]: { ...value, [f]: Number(ev.target.value) } })}
                                className="tabular w-28 rounded-[var(--radius-sm)] border border-line px-3 py-2"
                              />
                            </td>
                          ))}
                          <td className={TD}><Money amount={current} /></td>
                          <td className={`${TD} font-semibold ${next > current ? 'text-success' : next < current ? 'text-danger' : ''}`}><Money amount={next} /></td>
                          <td className={TD}>
                            <button type="button" className="btn btn-ghost !px-4 !py-2" disabled={!dirty} onClick={() => act(() => updateEmployeePay(e.id, value.base, value.bonus), t("{name}'s pay saved.", { name: e.name }))}>{t('Save')}</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Panel>
      )}
      {tab === 'overtime' && <OvertimeControls />}
      {tab === 'leave-allowance' && <LeaveAllowance />}
    </>
  );
}
