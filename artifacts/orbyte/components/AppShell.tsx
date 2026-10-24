'use client';
// The frame around every signed-in screen, built from Orbyte's own header/footer styles.
// Also guards access: signed-out → login; an employee opening an HR page → back to their own dashboard.
// Phones get a bottom tab bar (HR: four main pages + "More"); tables turn into cards (globals.css), so every cell is
// given its column name as data-label here.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { DEMO_MONTH } from '@/lib/seed';
import { monthName } from '@/lib/format';
import { DemoSpace } from './DemoSpace';
import { Icon, type IconName } from './Icon';
import { ConfirmDialog, type Confirm } from './ui';
import { useStore } from '@/lib/store';
import type { Role } from '@/lib/types';

/** [href, label, short label for the phone tab bar, icon, on the phone tab bar (HR) or under "More"] */
type Item = [string, string, string, IconName, boolean];
const NAV: Record<Role, Item[]> = {
  HR: [
    ['/hr', 'Dashboard', 'Home', 'home', true], ['/hr/salary', 'Pay & leave rules', 'Rules', 'sliders', true],
    ['/hr/approvals', 'Approvals', 'Approvals', 'check', true], ['/hr/attendance', 'Attendance', 'Attendance', 'calendar', false],
    ['/hr/payroll', 'Payroll', 'Payroll', 'wallet', true], ['/hr/payments', 'Payment history', 'Payments', 'history', false],
    ['/hr/whatsapp', 'WhatsApp sent', 'WhatsApp', 'chat', false], ['/hr/activity', 'Activity log', 'Activity', 'list', false],
  ],
  EMPLOYEE: [
    ['/employee', 'My salary', 'Salary', 'wallet', true], ['/employee/requests', 'Requests', 'Requests', 'file', true],
    ['/employee/offers', 'Overtime', 'Overtime', 'clock', true], ['/employee/inbox', 'WhatsApp', 'WhatsApp', 'chat', true],
    ['/employee/payslips', 'Payslips', 'Payslips', 'receipt', true],
  ],
};

/** Copies each table's column headers into its cells (data-label), for the card layout on phones. */
function useTableLabels() {
  useEffect(() => {
    const label = () => document.querySelectorAll('table.rtable').forEach((table) => {
      const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim() ?? '');
      table.querySelectorAll('tbody > tr').forEach((row) => {
        let column = 0;
        for (const cell of row.children as HTMLCollectionOf<HTMLTableCellElement>) {
          if (cell.colSpan === 1 && cell.dataset.label !== heads[column]) cell.dataset.label = heads[column] ?? '';
          column += cell.colSpan;
        }
      });
    });
    label();
    const watcher = new MutationObserver(label);
    watcher.observe(document.body, { childList: true, subtree: true });
    return () => watcher.disconnect();
  }, []);
}

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const { account, signOut, resetDemo, data, mode, space, serverError, clearServerError } = useStore();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [more, setMore] = useState(false);
  const router = useRouter();
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const allowed = account?.role === role;
  useTableLabels();

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

  useEffect(() => setMore(false), [path]);
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMore(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [more]);

  if (!allowed) return <div className="grid min-h-screen place-items-center text-sm text-muted">Checking access…</div>;
  const home = role === 'HR' ? '/hr' : '/employee';
  const isActive = (href: string) => (href === home ? path === home : path.startsWith(href));
  // Everything waiting for HR: requests, cancellation requests and unread updates (withdrawn or edited requests).
  const forHr = data.leaves.filter((l) => l.status === 'PENDING' || l.cancelRequestedAt).length
    + data.overtime.filter((o) => o.status === 'REQUESTED' || o.cancelRequestedAt).length
    + data.notifications.filter((n) => !n.read).length;
  const badge = (href: string, className: string) => href === '/hr/approvals' && forHr > 0 && (
    <span className={`rounded-full bg-royal font-semibold text-white ${className}`} aria-label={`${forHr} waiting`}>{forHr}</span>
  );
  const tabs = NAV[role].filter((i) => i[4]);
  const extra = NAV[role].filter((i) => !i[4]);
  const extraActive = extra.some(([href]) => isActive(href));

  return (
    <div className="app flex min-h-screen flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom))] sm:pb-0">
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
            <div className="text-right leading-tight">
              <p className="max-w-[9rem] truncate text-[0.85rem] font-semibold text-navy sm:max-w-none">{account.name}</p>
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
        <nav aria-label="e-Salary Guard" className="mx-auto hidden max-w-[var(--max)] overflow-x-auto overflow-y-hidden [scrollbar-width:none] px-[22px] sm:block sm:px-8">
          <ul className="flex gap-7 whitespace-nowrap">
            {NAV[role].map(([href, label]) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive(href) ? 'page' : undefined}
                  className={`-mb-px inline-block border-b-2 py-3 text-[0.85rem] no-underline transition-colors ${isActive(href) ? 'border-royal font-semibold text-navy' : 'border-transparent text-text-70 hover:text-navy'}`}
                >
                  {label}
                  {badge(href, 'ml-1.5 px-1.5 py-px text-[0.7rem]')}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="wrap w-full flex-1 py-7 sm:py-14">
        {serverError && (
          <p role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            {serverError}
            <button type="button" className="btn btn-ghost !px-4 !py-1.5" onClick={clearServerError}>Dismiss</button>
          </p>
        )}
        {children}
      </main>

      <footer className="site-footer !py-8">
        <div className="wrap footer-bottom !border-t-0 !pt-0">
          <span>e-Salary Guard · a smart feature on Orbyte · demo with synthetic data</span>
          <span>WhatsApp and payments are simulated. No real money is moved.</span>
          <DemoSpace compact />
          {role === 'HR' && (
            <button
              type="button"
              className="btn-line btn cursor-pointer"
              onClick={() => setConfirm({
                title: 'Reset all demo data?',
                body: mode === 'server'
                  ? `This resets demo space ${space} (and every device that joined it): every request, decision, payment and log goes back to the start.`
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

      {/* Phones: bottom tab bar. HR's remaining pages sit under "More". */}
      {more && (
        <div className="fixed inset-0 z-40 bg-navy-deep/40 sm:hidden" onClick={() => setMore(false)} aria-hidden="true" />
      )}
      {more && (
        <div id="more-pages" role="dialog" aria-label="More pages" className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 rounded-[var(--radius)] bg-white p-2 shadow-[0_30px_70px_-20px_rgba(11,11,12,0.35)] sm:hidden">
          {extra.map(([href, label, , icon]) => (
            <Link
              key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-[var(--radius-sm)] px-4 text-[0.95rem] no-underline ${isActive(href) ? 'bg-royal/10 font-semibold text-royal' : 'text-navy'}`}
            >
              <Icon name={icon} />{label}
            </Link>
          ))}
        </div>
      )}
      <nav aria-label="e-Salary Guard (phone)" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length + (extra.length ? 1 : 0)}, minmax(0, 1fr))` }}>
          {tabs.map(([href, , short, icon]) => (
            <li key={href}>
              <Link
                href={href} aria-current={isActive(href) ? 'page' : undefined}
                className={`relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 text-[0.7rem] no-underline ${isActive(href) ? 'font-semibold text-royal' : 'text-text-70'}`}
              >
                <Icon name={icon} />
                {short}
                {badge(href, 'absolute top-2 left-1/2 ml-2 min-w-[1.1rem] px-1 text-center text-[0.65rem] leading-[1.1rem]')}
              </Link>
            </li>
          ))}
          {extra.length > 0 && (
            <li>
              <button
                type="button" aria-expanded={more} aria-controls="more-pages" onClick={() => setMore(!more)}
                className={`flex min-h-[4.25rem] w-full flex-col items-center justify-center gap-1 text-[0.7rem] ${more || extraActive ? 'font-semibold text-royal' : 'text-text-70'}`}
              >
                <Icon name="more" />
                More
              </button>
            </li>
          )}
        </ul>
      </nav>
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
