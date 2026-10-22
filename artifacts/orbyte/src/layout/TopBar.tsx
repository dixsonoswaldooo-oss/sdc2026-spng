import { Coins, FlaskConical, Menu } from 'lucide-react';
import type { Role } from '@/api/types';
import { USE_MOCK } from '@/lib/env';
import { ROLE_LABELS, useRole } from '@/lib/role';
import { useDataSource, useWorkspace } from '@/lib/useApi';

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { role, setRole } = useRole();
  const workspace = useWorkspace(); // undefined for a moment while the Google Sheet loads
  const source = useDataSource();
  const user = workspace?.users[role];

  return (
    <header className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4">
      <button type="button" onClick={onOpenMenu} className="rounded-input p-2 hover:bg-canvas lg:hidden" aria-label="Open menu">
        <Menu className="size-5" aria-hidden="true" />
      </button>
      {/* On phones the company name is in the menu, so the top bar keeps room for the role switch. */}
      <p className="min-w-0 flex-1 truncate text-sm font-medium">
        <span className="hidden sm:inline">{workspace?.companyName}</span>
      </p>

      {USE_MOCK && (
        <span
          title={source.kind === 'sheet' ? 'Data from your Google Sheet, with sample AI text. Not connected to the backend yet.' : 'Sample data and sample AI text. Not connected to the backend yet.'}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-at-risk/40 bg-at-risk/10 px-2 py-1 text-xs font-medium text-at-risk sm:px-2.5"
        >
          <FlaskConical className="size-3.5" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{source.kind === 'sheet' ? 'Demo data · Sheet' : 'Demo data'}</span>
        </span>
      )}

      {workspace && (
        <span className="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-muted sm:inline-flex">
          <Coins className="size-3.5" aria-hidden="true" />
          Credits: <span className="tabular-nums text-ink">{workspace.credits.toLocaleString('en-MY')}</span>
        </span>
      )}

      <label className="flex items-center gap-2 text-xs text-muted">
        <span className="hidden sm:inline">View as</span>
        <span className="sr-only sm:hidden">View as</span>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
          className="rounded-input border border-line bg-surface px-2 py-1.5 text-sm text-ink"
        >
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>

      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white" title={user ? `${user.name} (${ROLE_LABELS[role]})` : undefined}>
        <span aria-hidden="true">{user?.initials}</span>
        {user && (
          <span className="sr-only">
            Signed in as {user.name}, {ROLE_LABELS[role]}
          </span>
        )}
      </span>
    </header>
  );
}
