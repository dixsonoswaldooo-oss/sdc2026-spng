'use client';
// Holds the demo data and the signed-in account. Two modes, picked at load:
// - database mode (the server has DATABASE_URL): one shared state on the server. Every action runs here first (instant
//   screen, rule errors at once), then goes to the server, which checks who may do it and saves; the server's answer wins.
//   Changes from other devices arrive by polling every few seconds. Sign-in is a signed cookie set by the server.
// - browser mode (no database, e.g. the zip on a laptop): data in localStorage, account in sessionStorage, as before.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as engine from './engine';
import { keywordClassify } from './leaveClassifier';
import { ACCOUNTS } from './seed';
import type { Account, AttendanceOverride, ISODate, LeaveClassification, LeaveLabel, LeaveType, PayrollConfig } from './types';

const DATA_KEY = 'esalary-guard-data-v1'; // same key as before: older saved data is migrated in place, not lost
const SESSION_KEY = 'esalary-guard-session';
const POLL_MS = 4_000;

type Data = engine.Data;
type Mode = 'browser' | 'server';
type Saved = { data: Data; version: number };
type OvertimeMove = 'APPROVED' | 'REJECTED' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED';
type LeaveInput = { type: LeaveType; startDate: string; endDate: string; reason: string };
type OvertimeInput = { date: string; hours: number; note: string };

interface Store {
  data: Data;
  account: Account | null;
  mode: Mode;
  /** The server refused or could not save the last change (database mode); shown as a banner. */
  serverError: string | null;
  clearServerError: () => void;
  signIn: (accountId: string, password?: string) => Promise<void>;
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
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function loadBrowserData(): Data {
  try {
    const saved = localStorage.getItem(DATA_KEY);
    if (saved) return engine.migrate(JSON.parse(saved) as Data, system());
  } catch {
    // unreadable or blocked storage: start from the demo data
  }
  return engine.freshData(system());
}

/** Browser mode: asks the server route (SEA-LION on RunPod); if it can't be reached, classifies by keywords here. */
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
  const [mode, setMode] = useState<Mode>('browser');
  const [serverError, setServerError] = useState<string | null>(null);
  const dataRef = useRef<Data | null>(null);
  const modeRef = useRef<Mode>('browser');
  const versionRef = useRef(0);
  const accountRef = useRef<Account | null>(null);
  const reading = useRef(new Set<string>()); // "LV-7|reason" already sent to the AI from this tab
  const queue = useRef<{ action: string; args: unknown[] }[]>([]); // database mode: made here, not yet sent
  const sending = useRef(false);
  const signingOut = useRef<Promise<unknown>>(Promise.resolve()); // a sign-in waits for the previous sign-out

  const show = useCallback((next: Data) => {
    dataRef.current = next;
    setData(next);
  }, []);

  /** Browser mode keeps a copy in localStorage; database mode only shows (the server keeps it). */
  const save = useCallback((next: Data) => {
    show(next);
    if (modeRef.current === 'server') return;
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(next));
    } catch {
      // not saved; still shown
    }
  }, [show]);

  /** Sends a pending reason to the AI once per tab; the label is attached to the request when it comes back. */
  const readInBackground = useCallback((id: string, type: LeaveType, reason: string) => {
    const key = `${id}|${reason}`;
    if (reading.current.has(key)) return;
    reading.current.add(key);
    if (modeRef.current === 'server') {
      void post('/ai/state', { action: 'readReason', args: [id] }).then(async (r) => r.ok && accept((await r.json()) as Saved)).catch(() => {});
    } else {
      void classify(type, reason).then((ai) => save(engine.applyAiLabel(dataRef.current!, { actor: 'AI', now: now() }, id, ai, reason)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- accept is stable (refs only)
  }, [save]);

  /** Reasons still waiting for the AI: read by the requester, or by HR (in case the requester's tab was closed). */
  const readPending = useCallback((d: Data) => {
    const me = accountRef.current;
    for (const l of d.leaves) {
      if (l.aiPending && l.status === 'PENDING' && (modeRef.current === 'browser' || me?.role === 'HR' || l.employeeId === me?.employeeId)) {
        readInBackground(l.id, l.type, l.reason);
      }
    }
  }, [readInBackground]);

  /** Database mode: take the server's state if it is newer than what is shown, unless changes made here are still on their way. */
  function accept(saved: Saved) {
    if (saved.version < versionRef.current || queue.current.length || sending.current) return;
    versionRef.current = saved.version;
    show(saved.data);
    readPending(saved.data);
  }

  const pull = useCallback(async (force = false) => {
    try {
      const r = await fetch(`/ai/state${force ? '' : `?v=${versionRef.current}`}`, { cache: 'no-store' });
      if (r.status === 200) accept((await r.json()) as Saved);
    } catch {
      // offline for a moment; the next poll tries again
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- accept is stable (refs only)
  }, []);

  /**
   * Database mode: actions go to the server one batch at a time, in the order they were made, so a later action never
   * reaches the server before the one it depends on (e.g. "Mark as done" before "Accept"). keepalive lets a batch finish
   * even if the page is left right after a click. A refusal shows the reason and the server's real state.
   */
  const flush = useCallback(async () => {
    if (sending.current || !queue.current.length) return;
    const actions = queue.current.splice(0);
    sending.current = true;
    let reply: (Saved & { error?: string }) | null = null;
    try {
      const r = await fetch('/ai/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actions }), keepalive: true });
      reply = (await r.json()) as Saved & { error?: string };
      if (!r.ok) setServerError(reply.error ?? 'Your change could not be saved.');
    } catch {
      setServerError('The server could not be reached, so your last change may not be saved.');
    } finally {
      sending.current = false;
    }
    if (queue.current.length) return void flush();
    if (reply?.data) accept(reply);
    else {
      versionRef.current = 0;
      await pull(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- accept is stable (refs only)
  }, [pull]);

  /** Resolves once everything made in this tab has been answered by the server. */
  const drained = useCallback(async () => {
    while (sending.current || queue.current.length) await new Promise((resolve) => setTimeout(resolve, 50));
  }, []);

  const send = useCallback((action: string, args: unknown[]) => {
    queue.current.push({ action, args });
    void flush();
  }, [flush]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const onVisible = () => document.visibilityState === 'visible' && void pull();
    // Leaving the page: whatever is still queued goes out now (keepalive survives the unload).
    const onLeave = () => {
      if (modeRef.current !== 'server' || !queue.current.length) return;
      const actions = queue.current.splice(0);
      void fetch('/ai/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actions }), keepalive: true });
    };
    window.addEventListener('pagehide', onLeave);
    const onStorage = (event: StorageEvent) => {
      if (modeRef.current !== 'browser' || event.key !== DATA_KEY || !event.newValue) return;
      show(JSON.parse(event.newValue) as Data);
    };
    (async () => {
      const r = await fetch('/ai/state', { cache: 'no-store' }).catch(() => null);
      if (stopped) return;
      if (r?.ok) {
        modeRef.current = 'server';
        setMode('server');
        const saved = (await r.json()) as Saved;
        const who = (await (await fetch('/ai/session', { cache: 'no-store' })).json()) as { account: Account | null };
        accountRef.current = who.account;
        setAccount(who.account);
        accept(saved);
        timer = setInterval(() => document.visibilityState === 'visible' && void pull(), POLL_MS);
        document.addEventListener('visibilitychange', onVisible);
        return;
      }
      if (r && r.status !== 503) setServerError('The shared database is not reachable, so this browser keeps its own copy for now.');
      const loaded = loadBrowserData();
      save(loaded);
      try {
        const id = sessionStorage.getItem(SESSION_KEY);
        const found = ACCOUNTS.find((a) => a.id === id) ?? null;
        accountRef.current = found;
        setAccount(found);
      } catch {
        // storage blocked: the demo still works until the page is closed
      }
      readPending(loaded); // requests whose AI answer never arrived (tab closed meanwhile) are read again
      window.addEventListener('storage', onStorage);
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pagehide', onLeave);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on load
  }, []);

  const store = useMemo<Store | null>(() => {
    if (!data) return null;
    const ctx = () => ({ actor: actorFor(account), now: now() });
    const myEmployeeId = () => {
      if (!account?.employeeId) throw new Error('Sign in as an employee first.');
      return account.employeeId;
    };
    /** Runs the change here (instant, throws on rule errors); in database mode then sends it to the server. */
    const act = (action: string, args: unknown[], edit: (d: Data) => Data) => {
      save(edit(dataRef.current!));
      if (modeRef.current === 'server') void send(action, args);
    };
    return {
      data,
      account,
      mode,
      serverError,
      clearServerError: () => setServerError(null),
      signIn: async (accountId, password = 'demo') => {
        const next = ACCOUNTS.find((a) => a.id === accountId)!;
        if (modeRef.current === 'server') {
          await drained();
          await signingOut.current;
          const r = await post('/ai/session', { accountId, password });
          if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? 'Could not sign in.');
          await pull(true);
        } else {
          sessionStorage.setItem(SESSION_KEY, next.id);
          save(engine.logLogin(dataRef.current!, { actor: actorFor(next), now: now() }, next.role === 'HR' ? `HR: ${next.name}` : next.name));
        }
        accountRef.current = next;
        setAccount(next);
      },
      signOut: () => {
        if (modeRef.current === 'server') signingOut.current = drained().then(() => fetch('/ai/session', { method: 'DELETE' })).catch(() => {});
        else sessionStorage.removeItem(SESSION_KEY);
        accountRef.current = null;
        setAccount(null);
      },
      resetDemo: () => act('resetDemo', [], () => engine.freshData(system())),
      updateEmployeePay: (id, base, bonus) => act('updateEmployeePay', [id, base, bonus], (d) => engine.updateEmployeePay(d, ctx(), id, base, bonus)),
      updateConfig: (config) => act('updateConfig', [config], (d) => engine.updateConfig(d, ctx(), config)),
      setDivisionOvertime: (division, rate) => act('setDivisionOvertime', [division, rate], (d) => engine.setDivisionOvertime(d, ctx(), division, rate)),
      updateLeaveAllowance: (id, days) => act('updateLeaveAllowance', [id, days], (d) => engine.updateLeaveAllowance(d, ctx(), id, days)),
      setAttendance: (employeeId, day, value) => act('setAttendance', [employeeId, day, value], (d) => engine.setAttendance(d, ctx(), employeeId, day, value)),
      submitLeave: (input) => {
        const employeeId = myEmployeeId();
        act('submitLeave', [input], (d) => engine.submitLeave(d, ctx(), employeeId, input, keywordClassify(input.type, input.reason), true));
        if (modeRef.current === 'browser') readInBackground(dataRef.current!.leaves[0].id, input.type, input.reason); // submitLeave puts it first
      },
      editLeave: (id, input) => {
        act('editLeave', [id, input], (d) => engine.editLeave(d, ctx(), id, input, keywordClassify(input.type, input.reason)));
        if (modeRef.current === 'browser') readInBackground(id, input.type, input.reason);
      },
      withdrawLeave: (id) => act('withdrawLeave', [id], (d) => engine.withdrawLeave(d, ctx(), id)),
      requestLeaveCancellation: (id) => act('requestLeaveCancellation', [id], (d) => engine.requestLeaveCancellation(d, ctx(), id)),
      decideLeaveCancellation: (id, approve) => act('decideLeaveCancellation', [id, approve], (d) => engine.decideLeaveCancellation(d, ctx(), id, approve)),
      setLeaveLabel: (id, label) => act('setLeaveLabel', [id, label], (d) => engine.setLeaveLabel(d, ctx(), id, label)),
      decideLeave: (id, approve) => act('decideLeave', [id, approve], (d) => engine.decideLeave(d, ctx(), id, approve)),
      revertLeave: (id) => act('revertLeave', [id], (d) => engine.revertLeave(d, ctx(), id)),
      requestOvertime: (input) => {
        const employeeId = myEmployeeId();
        act('requestOvertime', [input], (d) => engine.requestOvertime(d, ctx(), employeeId, input));
      },
      editOvertime: (id, input) => act('editOvertime', [id, input], (d) => engine.editOvertime(d, ctx(), id, input)),
      withdrawOvertime: (id) => act('withdrawOvertime', [id], (d) => engine.withdrawOvertime(d, ctx(), id)),
      requestOvertimeCancellation: (id) => act('requestOvertimeCancellation', [id], (d) => engine.requestOvertimeCancellation(d, ctx(), id)),
      decideOvertimeCancellation: (id, approve) => act('decideOvertimeCancellation', [id, approve], (d) => engine.decideOvertimeCancellation(d, ctx(), id, approve)),
      offerOvertime: (ids, input) => act('offerOvertime', [ids, input], (d) => engine.offerOvertime(d, ctx(), ids, input)),
      moveOvertime: (id, to) => act('moveOvertime', [id, to], (d) => engine.moveOvertime(d, ctx(), id, to)),
      revertOvertime: (id) => act('revertOvertime', [id], (d) => engine.revertOvertime(d, ctx(), id)),
      payMonth: (month) => act('payMonth', [month], (d) => engine.payMonth(d, ctx(), month)),
      markNotificationsRead: () => act('markNotificationsRead', [], (d) => engine.markNotificationsRead(d)),
    };
  }, [data, account, mode, serverError, save, send, pull, drained, readInBackground]);

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
