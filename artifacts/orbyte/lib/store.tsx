'use client';
// Holds the demo data in the browser (localStorage) and the signed-in account (sessionStorage, per tab).
// Screens call the actions below; each one runs the matching engine function and saves the result.
// Other tabs of the same browser see every change at once (storage event). There is no server, so other devices don't.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as engine from './engine';
import { keywordClassify } from './leaveClassifier';
import { ACCOUNTS } from './seed';
import type { Account, AttendanceOverride, ISODate, LeaveClassification, LeaveLabel, LeaveType, PayrollConfig } from './types';

const DATA_KEY = 'esalary-guard-data-v1'; // same key as before: older saved data is migrated in place, not lost
const SESSION_KEY = 'esalary-guard-session';

type Data = engine.Data;
type OvertimeMove = 'APPROVED' | 'REJECTED' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED';
type LeaveInput = { type: LeaveType; startDate: string; endDate: string; reason: string };
type OvertimeInput = { date: string; hours: number; note: string };

interface Store {
  data: Data;
  account: Account | null;
  signIn: (accountId: string) => void;
  signOut: () => void;
  resetDemo: () => void;
  updateEmployeePay: (id: string, baseSalary: number, bonus: number) => void;
  updateConfig: (config: PayrollConfig) => void;
  setDivisionOvertime: (division: string, rate: number | null) => void;
  updateLeaveAllowance: (id: string, days: number) => void;
  setAttendance: (employeeId: string, day: ISODate, value: { status: AttendanceOverride['status']; lateMinutes: number } | null) => void;
  /** Saved at once as pending; the AI reads the reason in the background and its label replaces the keyword one. */
  submitLeave: (input: LeaveInput) => void;
  editLeave: (id: string, input: LeaveInput) => void;
  withdrawLeave: (id: string) => void;
  requestLeaveCancellation: (id: string) => void;
  decideLeaveCancellation: (id: string, approve: boolean) => void;
  setLeaveLabel: (id: string, label: LeaveLabel) => void;
  decideLeave: (id: string, approve: boolean) => void;
  revertLeave: (id: string) => void;
  requestOvertime: (input: OvertimeInput) => void;
  editOvertime: (id: string, input: OvertimeInput) => void;
  withdrawOvertime: (id: string) => void;
  requestOvertimeCancellation: (id: string) => void;
  decideOvertimeCancellation: (id: string, approve: boolean) => void;
  offerOvertime: (employeeIds: string[], input: OvertimeInput) => void;
  moveOvertime: (id: string, to: OvertimeMove) => void;
  revertOvertime: (id: string) => void;
  payMonth: (month: string) => void;
  markNotificationsRead: () => void;
}

const StoreContext = createContext<Store | null>(null);

const now = () => new Date().toISOString();
const actorFor = (account: Account | null) => (account?.role === 'HR' ? `HR: ${account.name}` : account?.name ?? 'System');
const system = () => ({ actor: 'System', now: now() });

function loadData(): Data {
  try {
    const saved = localStorage.getItem(DATA_KEY);
    if (saved) return engine.migrate(JSON.parse(saved) as Data, system());
  } catch {
    // unreadable or blocked storage: start from the demo data
  }
  return engine.freshData(system());
}

/** Asks the server (SEA-LION on RunPod); if the server cannot be reached, classifies by keywords here. */
async function classify(type: LeaveType, reason: string): Promise<LeaveClassification> {
  try {
    const response = await fetch('/ai/classify-leave', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, reason }), signal: AbortSignal.timeout(190_000),
    });
    if (response.ok) return (await response.json()) as LeaveClassification;
  } catch {
    // fall through to the keyword rules
  }
  return keywordClassify(type, reason);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const dataRef = useRef<Data | null>(null);
  const reading = useRef(new Set<string>()); // "LV-7|reason" already sent to the AI in this tab

  const save = useCallback((next: Data) => {
    dataRef.current = next;
    setData(next);
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(next));
    } catch {
      // not saved; still shown
    }
  }, []);

  /** Sends a pending reason to the AI once; the answer is attached to the request when it arrives. */
  const readInBackground = useCallback((id: string, type: LeaveType, reason: string) => {
    const key = `${id}|${reason}`;
    if (reading.current.has(key)) return;
    reading.current.add(key);
    void classify(type, reason).then((ai) => save(engine.applyAiLabel(dataRef.current!, { actor: 'AI', now: now() }, id, ai, reason)));
  }, [save]);

  useEffect(() => {
    const loaded = loadData();
    save(loaded);
    try {
      const id = sessionStorage.getItem(SESSION_KEY);
      setAccount(ACCOUNTS.find((a) => a.id === id) ?? null);
    } catch {
      // storage blocked: the demo still works until the page is closed
    }
    // Requests whose AI answer never arrived (tab closed meanwhile) are read again.
    for (const l of loaded.leaves) if (l.aiPending && l.status === 'PENDING') readInBackground(l.id, l.type, l.reason);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== DATA_KEY || !event.newValue) return;
      const next = JSON.parse(event.newValue) as Data;
      dataRef.current = next;
      setData(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [save, readInBackground]);

  const store = useMemo<Store | null>(() => {
    if (!data) return null;
    const ctx = () => ({ actor: actorFor(account), now: now() });
    const run = (edit: (d: Data) => Data) => save(edit(dataRef.current!));
    const myEmployeeId = () => {
      if (!account?.employeeId) throw new Error('Sign in as an employee first.');
      return account.employeeId;
    };
    return {
      data,
      account,
      signIn: (accountId) => {
        const next = ACCOUNTS.find((a) => a.id === accountId)!;
        sessionStorage.setItem(SESSION_KEY, next.id);
        setAccount(next);
        run((d) => engine.logLogin(d, { actor: actorFor(next), now: now() }, next.role === 'HR' ? `HR: ${next.name}` : next.name));
      },
      signOut: () => {
        sessionStorage.removeItem(SESSION_KEY);
        setAccount(null);
      },
      resetDemo: () => save(engine.freshData(system())),
      updateEmployeePay: (id, base, bonus) => run((d) => engine.updateEmployeePay(d, ctx(), id, base, bonus)),
      updateConfig: (config) => run((d) => engine.updateConfig(d, ctx(), config)),
      setDivisionOvertime: (division, rate) => run((d) => engine.setDivisionOvertime(d, ctx(), division, rate)),
      updateLeaveAllowance: (id, days) => run((d) => engine.updateLeaveAllowance(d, ctx(), id, days)),
      setAttendance: (employeeId, day, value) => run((d) => engine.setAttendance(d, ctx(), employeeId, day, value)),
      submitLeave: (input) => {
        const employeeId = myEmployeeId();
        run((d) => engine.submitLeave(d, ctx(), employeeId, input, keywordClassify(input.type, input.reason), true));
        readInBackground(dataRef.current!.leaves[0].id, input.type, input.reason); // submitLeave puts the new request first
      },
      editLeave: (id, input) => {
        run((d) => engine.editLeave(d, ctx(), id, input, keywordClassify(input.type, input.reason)));
        readInBackground(id, input.type, input.reason);
      },
      withdrawLeave: (id) => run((d) => engine.withdrawLeave(d, ctx(), id)),
      requestLeaveCancellation: (id) => run((d) => engine.requestLeaveCancellation(d, ctx(), id)),
      decideLeaveCancellation: (id, approve) => run((d) => engine.decideLeaveCancellation(d, ctx(), id, approve)),
      setLeaveLabel: (id, label) => run((d) => engine.setLeaveLabel(d, ctx(), id, label)),
      decideLeave: (id, approve) => run((d) => engine.decideLeave(d, ctx(), id, approve)),
      revertLeave: (id) => run((d) => engine.revertLeave(d, ctx(), id)),
      requestOvertime: (input) => run((d) => engine.requestOvertime(d, ctx(), myEmployeeId(), input)),
      editOvertime: (id, input) => run((d) => engine.editOvertime(d, ctx(), id, input)),
      withdrawOvertime: (id) => run((d) => engine.withdrawOvertime(d, ctx(), id)),
      requestOvertimeCancellation: (id) => run((d) => engine.requestOvertimeCancellation(d, ctx(), id)),
      decideOvertimeCancellation: (id, approve) => run((d) => engine.decideOvertimeCancellation(d, ctx(), id, approve)),
      offerOvertime: (ids, input) => run((d) => engine.offerOvertime(d, ctx(), ids, input)),
      moveOvertime: (id, to) => run((d) => engine.moveOvertime(d, ctx(), id, to)),
      revertOvertime: (id) => run((d) => engine.revertOvertime(d, ctx(), id)),
      payMonth: (month) => run((d) => engine.payMonth(d, ctx(), month)),
      markNotificationsRead: () => run((d) => engine.markNotificationsRead(d)),
    };
  }, [data, account, save, readInBackground]);

  if (!store) {
    return <div className="grid min-h-screen place-items-center text-sm text-[var(--muted)]">Loading e-Salary Guard…</div>;
  }
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
