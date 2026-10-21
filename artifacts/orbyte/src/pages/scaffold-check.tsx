import { Link } from 'wouter';
import { API_BASE_URL, DEMO_MODE, USE_MOCK } from '@/lib/env';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';

// Temporary Phase 1 check page: shows the colours, font, formatting and settings working.
// Phase 2 replaces it with the Orbyte shell.

type Row = [label: string, value: string];

const FORMAT_SAMPLES: Row[] = [
  ['Payroll due', formatMoney(18000)],
  ['Projected after payroll', formatMoney(-8400)],
  ['With actions 1 + 2', formatMoney(1380, { signed: true })],
  ['Payday', formatDate('2026-10-25')],
  ['Oldest overdue invoice due', formatDate('2026-09-30')],
  ['Last checked', formatDateTime('2026-10-21T08:00:00+08:00')],
];

const SWATCHES = [
  ['Accent', 'bg-accent'],
  ['Safe', 'bg-safe'],
  ['At risk', 'bg-at-risk'],
  ['Shortfall', 'bg-shortfall'],
  ['AI', 'bg-ai'],
];

export function ScaffoldCheckPage() {
  const settings: Row[] = [
    ['Data source', USE_MOCK ? 'Mock data' : `Backend at ${API_BASE_URL || 'this server'}`],
    ['Demo button', DEMO_MODE ? 'On' : 'Off'],
  ];
  const panels = [
    { title: 'Formatting', rows: FORMAT_SAMPLES },
    { title: 'Settings', rows: settings },
  ];

  return (
    <main className="mx-auto max-w-content px-4 py-12">
      <p className="text-sm text-muted">Phase 1 · scaffold check</p>
      <h1 className="mt-1 text-title font-semibold">Payroll Cash Guard</h1>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {panels.map(({ title, rows }) => (
          <section key={title} className="rounded-card border border-line bg-surface p-6 shadow-soft">
            <h2 className="text-base font-semibold">{title}</h2>
            <dl className="mt-4 space-y-2 text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-medium tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {SWATCHES.map(([name, swatch]) => (
          <li key={name} className="flex items-center gap-2">
            <span className={`size-4 rounded-input ${swatch}`} aria-hidden="true" />
            {name}
          </li>
        ))}
      </ul>

      <Link href="/tes-ai" className="mt-8 inline-block text-sm text-accent underline">
        Open AI test page
      </Link>
    </main>
  );
}
