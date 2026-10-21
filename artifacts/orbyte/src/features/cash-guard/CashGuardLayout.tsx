import { ShieldCheck } from 'lucide-react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { PlaceholderPage } from '@/layout/PlaceholderPage';
import { ActionsPage } from './ActionsPage';
import { ActivityPage } from './ActivityPage';
import { BillsPage } from './BillsPage';
import { OverviewPage } from './OverviewPage';
import { ReceivablesPage } from './ReceivablesPage';
import { SettingsPage } from './SettingsPage';

// Paths are relative to /cash-guard (wouter "nest").
const TABS = [
  { href: '/', label: 'Overview' },
  { href: '/actions', label: 'Actions' },
  { href: '/receivables', label: 'Receivables' },
  { href: '/bills', label: 'Bills & Purchases' },
  { href: '/activity', label: 'Activity Log' },
  { href: '/settings', label: 'Settings' },
];

export function CashGuardLayout() {
  const [location] = useLocation();

  return (
    <>
      <header className="mb-5">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Smart feature
        </p>
        <h1 className="mt-1 text-title font-semibold">Cash Guard</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Checks every morning whether cash will cover payroll, explains why if it will not, and suggests what to do. Nothing happens without the Owner's approval.
        </p>
      </header>

      <nav aria-label="Cash Guard sections" className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-1">
          {TABS.map((tab) => {
            const active = location === tab.href;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`-mb-px inline-block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm ${active ? 'border-accent font-medium text-accent' : 'border-transparent text-muted hover:text-ink'}`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Switch>
        <Route path="/" component={OverviewPage} />
        <Route path="/actions" component={ActionsPage} />
        <Route path="/receivables" component={ReceivablesPage} />
        <Route path="/bills" component={BillsPage} />
        <Route path="/activity" component={ActivityPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route>
          <PlaceholderPage title="Page not found" message="This Cash Guard page does not exist." />
        </Route>
      </Switch>
    </>
  );
}
