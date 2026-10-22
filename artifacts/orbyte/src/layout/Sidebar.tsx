import { FileText, House, ListChecks, Plug, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getSummary } from '@/api/client';
import { STATUS_META } from '@/lib/status';
import { useApi, useWorkspace } from '@/lib/useApi';

export const MODULES = [
  { path: '/home', label: 'Home', icon: House },
  { path: '/people', label: 'People', icon: Users },
  { path: '/hiring', label: 'Hiring', icon: UserPlus },
  { path: '/work', label: 'Work', icon: ListChecks },
  { path: '/esign', label: 'eSign', icon: FileText },
  { path: '/connect', label: 'Connect', icon: Plug },
];

const ITEM = 'flex h-9 items-center gap-3 rounded-input px-3 text-sm transition-colors';
const itemState = (active: boolean) => (active ? 'bg-accent/10 font-medium text-accent' : 'text-ink hover:bg-canvas');

/** Orbyte's left menu. Cash Guard sits under "Smart Features" with its live status. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const summary = useApi(getSummary);
  const workspace = useWorkspace();
  const status = summary.data && STATUS_META[summary.data.status];

  return (
    <nav aria-label="Orbyte modules" className="flex h-full flex-col gap-6 px-3 py-5">
      <div className="px-3">
        <p className="text-lg font-semibold tracking-tight">
          orbyte<span className="text-accent">.</span>
        </p>
        <p className="mt-1 h-4 truncate text-xs text-muted">{workspace?.shortName}</p>
      </div>

      <ul className="space-y-0.5">
        {MODULES.map(({ path, label, icon: Icon }) => (
          <li key={path}>
            <Link href={path} onClick={onNavigate} aria-current={location === path ? 'page' : undefined} className={`${ITEM} ${itemState(location === path)}`}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>

      <div>
        <p className="px-3 text-xs font-medium uppercase tracking-wide text-muted">Smart Features</p>
        <Link
          href="/cash-guard"
          onClick={onNavigate}
          aria-current={location.startsWith('/cash-guard') ? 'page' : undefined}
          className={`${ITEM} mt-2 ${itemState(location.startsWith('/cash-guard'))}`}
        >
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">Cash Guard</span>
          {status && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${status.text}`}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
              {status.label}
            </span>
          )}
        </Link>
      </div>
    </nav>
  );
}
