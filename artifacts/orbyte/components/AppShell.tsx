'use client';
// The frame around every signed-in screen, built from Orbyte's own header/footer styles.
// Also guards access: signed-out → login; an employee opening an HR page → back to their own dashboard.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { DEMO_MONTH } from '@/lib/seed';
import { monthName } from '@/lib/format';
import { ConfirmDialog, type Confirm } from './ui';
import { useStore } from '@/lib/store';
import type { Role } from '@/lib/types';

const NAV: Record<Role, [string, string][]> = {
  HR: [
    ['/hr', 'Dashboard'], ['/hr/salary', 'Salary & leave'], ['/hr/approvals', 'Approvals'], ['/hr/attendance', 'Attendance'],
    ['/hr/payroll', 'Payroll'], ['/hr/payments', 'Payment history'], ['/hr/whatsapp', 'WA outbox'], ['/hr/activity', 'Activity log'],
  ],
  EMPLOYEE: [
    ['/employee', 'My salary'], ['/employee/requests', 'Requests'], ['/employee/offers', 'Overtime offers'],
    ['/employee/inbox', 'WA inbox'], ['/employee/payslips', 'Payslips'],
  ],
};

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const { account, signOut, resetDemo, data, mode, serverError, clearServerError } = useStore();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const router = useRouter();
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const allowed = account?.role === role;

  useEffect(() => {
    if (!account) router.replace('/login');
    else if (account.role !== role) router.replace(account.role === 'HR' ? '/hr' : '/employee');
  }, [account, role, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!allowed) return <div className="grid min-h-screen place-items-center text-sm text-muted">Checking access…</div>;
  const home = role === 'HR' ? '/hr' : '/employee';
  // Everything waiting for HR: requests, cancellation requests and unread updates (withdrawn or edited requests).
  const forHr = data.leaves.filter((l) => l.status === 'PENDING' || l.cancelRequestedAt).length
    + data.overtime.filter((o) => o.status === 'REQUESTED' || o.cancelRequestedAt).length
    + data.notifications.filter((n) => !n.read).length;

  return (
    <div className="app flex min-h-screen flex-col">
      <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="wrap">
          <div className="flex min-w-0 items-center gap-3">
            <a href="/" className="brand" title="Back to orbyte.my home">
              <img src="/assets/orbyte-icon.png" alt="" className="chop-mark" />
              Orbyte
            </a>
            <span className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
            <Link href={home} className="hidden truncate text-[0.95rem] font-semibold text-royal no-underline sm:block">e-Salary Guard</Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-[0.85rem] font-semibold text-navy">{account.name}</p>
              <p className="text-xs text-muted">{role === 'HR' ? 'HR' : 'Employee'} · {monthName(DEMO_MONTH)}</p>
            </div>
            <button
              type="button"
              className="btn btn-ghost !px-4 !py-2"
              onClick={() => {
                signOut();
                router.replace('/login');
              }}
            >
              Sign out
            </button>
          </div>
        </div>
        <nav aria-label="e-Salary Guard" className="mx-auto max-w-[var(--max)] overflow-x-auto overflow-y-hidden [scrollbar-width:none] px-[22px] sm:px-8">
          <ul className="flex gap-7 whitespace-nowrap">
            {NAV[role].map(([href, label]) => {
              const active = href === home ? path === home : path.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`-mb-px inline-block border-b-2 py-3 text-[0.85rem] no-underline transition-colors ${active ? 'border-royal font-semibold text-navy' : 'border-transparent text-text-70 hover:text-navy'}`}
                  >
                    {label}
                    {href === '/hr/approvals' && forHr > 0 && (
                      <span className="ml-1.5 rounded-full bg-royal px-1.5 py-px text-[0.7rem] font-semibold text-white" aria-label={`${forHr} waiting`}>{forHr}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="wrap w-full flex-1 py-10 sm:py-14">
        {serverError && (
          <p role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            {serverError}
            <button type="button" className="btn btn-line !px-4 !py-1.5" onClick={clearServerError}>Dismiss</button>
          </p>
        )}
        {children}
      </main>

      <footer className="site-footer !py-8">
        <div className="wrap footer-bottom !border-t-0 !pt-0">
          <span>e-Salary Guard · a smart feature on Orbyte · demo with synthetic data</span>
          <span>WhatsApp and payments are simulated. No real money is moved.</span>
          {role === 'HR' && (
            <button
              type="button"
              className="btn-line btn cursor-pointer"
              onClick={() => setConfirm({
                title: 'Reset all demo data?',
                body: mode === 'server'
                  ? 'This resets the shared demo data for everyone using e-Salary Guard: every request, decision, payment and log goes back to the start.'
                  : 'Every change made in this browser goes back to the start.',
                confirmLabel: 'Reset demo data',
                onConfirm: resetDemo,
              })}
            >
              Reset demo data
            </button>
          )}
        </div>
      </footer>
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
