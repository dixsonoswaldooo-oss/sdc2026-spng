import { Bot, ChevronRight, Cog, UserRound } from 'lucide-react';
import type { AuditEvent } from '@/api/types';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/role';

const KIND_LABEL: Record<string, string> = {
  AGENT_RUN: 'Agent run',
  DATA_READ: 'Data read',
  PROJECTION: 'Projection',
  AI_OUTPUT: 'AI output',
  DRAFT_GENERATED: 'Draft',
  ACTION_SUBMITTED: 'Submitted',
  ACTION_APPROVED: 'Approved',
  ACTION_REJECTED: 'Rejected',
  ACTION_EXECUTED: 'Done',
  SETTINGS_CHANGED: 'Settings',
  DEMO_SIMULATION: 'Demo',
};

const HUMAN_KINDS = ['ACTION_APPROVED', 'ACTION_REJECTED', 'ACTION_SUBMITTED', 'SETTINGS_CHANGED'];

/** Turns a detail value into readable text (lists, numbers, nested objects). */
function show(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) return Object.entries(value).map(([k, v]) => `${k}: ${show(v)}`).join(' · ');
  return String(value);
}

export function ActivityItem({ event }: { event: AuditEvent }) {
  const Icon = event.role === 'AGENT' ? Bot : event.role === 'SYSTEM' ? Cog : UserRound;
  const who = event.role === 'AGENT' || event.role === 'SYSTEM' ? event.actor : `${event.actor} (${ROLE_LABELS[event.role]})`;
  const human = HUMAN_KINDS.includes(event.kind);
  const details = Object.entries(event.details ?? {});

  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${human ? 'bg-accent text-white' : 'bg-canvas text-muted'}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 border-b border-line pb-4">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className={`text-sm ${human ? 'font-semibold' : 'font-medium'}`}>{event.summary}</p>
          <span className="rounded-full border border-line px-2 text-xs text-muted">{KIND_LABEL[event.kind] ?? event.kind}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {who} · {formatDateTime(event.at)}
        </p>
        {details.length > 0 && (
          <details className="group mt-2 text-xs">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-accent">
              <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
              Details
            </summary>
            <dl className="mt-2 space-y-1 rounded-input bg-canvas p-3">
              {details.map(([key, value]) => (
                <div key={key} className="grid grid-cols-[7rem_1fr] gap-2">
                  <dt className="text-muted">{key}</dt>
                  <dd className="break-words">{show(value)}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>
    </li>
  );
}
