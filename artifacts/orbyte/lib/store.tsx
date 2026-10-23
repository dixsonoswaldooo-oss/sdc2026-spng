'use client';
// Holds the demo data in the browser (localStorage) and the signed-in account (sessionStorage, per tab).
// Screens call the actions below; each one runs the matching engine function and saves the result.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as engine from './engine';
import { keywordClassify } from './leaveClassifier';
import { ACCOUNTS } from './seed';
import type { Account, LeaveClassification, LeaveLabel, LeaveType, PayrollConfig } from './types';

const DATA_KEY = 'esalary-guard-data-v1';
const SESSION_KEY = 'esalary-guard-session';
const QUICK_MS = 8_000; // an awake AI answers in ~2 s; past this the worker is waking up, so don't keep the employee waiting

type Data = engine.Data;
type OvertimeMove = 'APPROVED' | 'REJECTED' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED';

interface Store {
  data: Data;
  account: Account | null;
  signIn: (accountId: string) => void;
  signOut: () => void;
  resetDemo: () => void;
  updateEmployeePay: (id: string, baseSalary: number, bonus: number) => void;
  updateConfig: (config: PayrollConfig) => void;
  /** aiPending: sent with the keyword label because the AI is slow; its label replaces it when it arrives. */
  submitLeave: (input: { type: LeaveType; startDate: string; endDate: string; reason: string }) => Promise<{ ai: LeaveClassification; aiPending: boolean }>;
  setLeaveLabel: (id: string, label: LeaveLabel) => void;
  decideLeave: (id: string, approve: boolean) => void;
  requestOvertime: (input: { date: string; hours: number; note: string }) => void;
  offerOvertime: (employeeIds: string[], input: { date: string; hours: number; note: string }) => void;
  moveOvertime: (id: string, to: OvertimeMove) => void;
  payMonth: (month: string) => void;
}

const StoreContext = createContext<Store | null>(null);

const now = () => new Date().toISOString();
const actorFor = (account: Account | null) => (account?.role === 'HR' ? `HR: ${account.name}` : account?.name ?? 'System');

function loadData(): Data {
  try {
    const saved = localStorage.getItem(DATA_KEY);
    if (saved) return JSON.parse(saved) as Data;
  } catch {
    // unreadable or blocked storage: start from the demo data
  }
  return engine.freshData({ actor: 'System', now: now() });
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

  useEffect(() => {
    const loaded = loadData();
    dataRef.current = loaded;
    setData(loaded);
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(loaded));
      const id = sessionStorage.getItem(SESSION_KEY);
      setAccount(ACCOUNTS.find((a) => a.id === id) ?? null);
    } catch {
      // storage blocked: the demo still works until the page is closed
    }
  }, []);

  const save = useCallback((next: Data) => {
    dataRef.current = next;
    setData(next);
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(next));
    } catch {
      // not saved; still shown
    }
  }, []);

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
      resetDemo: () => save(engine.freshData({ actor: 'System', now: now() })),
      updateEmployeePay: (id, base, bonus) => run((d) => engine.updateEmployeePay(d, ctx(), id, base, bonus)),
      updateConfig: (config) => run((d) => engine.updateConfig(d, ctx(), config)),
      submitLeave: async (input) => {
        const employeeId = myEmployeeId();
        const answer = classify(input.type, input.reason);
        const quick = await Promise.race([answer, new Promise<null>((resolve) => setTimeout(() => resolve(null), QUICK_MS))]);
        const first = quick ?? keywordClassify(input.type, input.reason);
        run((d) => engine.submitLeave(d, ctx(), employeeId, input, first));
        if (quick) return { ai: quick, aiPending: false };
        const id = dataRef.current!.leaves[0].id; // submitLeave puts the new request first
        void answer.then((ai) => run((d) => engine.applyAiLabel(d, ctx(), id, ai)));
        return { ai: first, aiPending: true };
      },
      setLeaveLabel: (id, label) => run((d) => engine.setLeaveLabel(d, ctx(), id, label)),
      decideLeave: (id, approve) => run((d) => engine.decideLeave(d, ctx(), id, approve)),
      requestOvertime: (input) => run((d) => engine.requestOvertime(d, ctx(), myEmployeeId(), input)),
      offerOvertime: (ids, input) => run((d) => engine.offerOvertime(d, ctx(), ids, input)),
      moveOvertime: (id, to) => run((d) => engine.moveOvertime(d, ctx(), id, to)),
      payMonth: (month) => run((d) => engine.payMonth(d, ctx(), month)),
    };
  }, [data, account, save]);

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
