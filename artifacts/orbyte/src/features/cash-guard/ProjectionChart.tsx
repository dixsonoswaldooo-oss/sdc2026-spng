import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ProjectionPoint, Status } from '@/api/types';
import { Card } from '@/components/Card';
import { formatDate, formatMoney, formatMoneyShort } from '@/lib/format';
import { STATUS_META, tokenColor } from '@/lib/status';

interface Props {
  points: ProjectionPoint[];
  payday: string;
  buffer: number;
  currentStatus: Status;
  withActionsStatus: Status;
}

const TOGGLE = 'rounded-input px-3 py-1 text-xs font-medium';

export function ProjectionChart({ points, payday, buffer, currentStatus, withActionsStatus }: Props) {
  const [showActions, setShowActions] = useState(false);
  const onPayday = points.find((p) => p.date === payday);
  const [muted, ink] = [tokenColor('muted'), tokenColor('ink')];

  const toggle = (
    <div role="group" aria-label="Which projection" className="flex rounded-input border border-line p-0.5">
      {[false, true].map((value) => (
        <button
          key={String(value)}
          type="button"
          aria-pressed={showActions === value}
          onClick={() => setShowActions(value)}
          className={`${TOGGLE} ${showActions === value ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}
        >
          {value ? 'If actions approved' : 'Current'}
        </button>
      ))}
    </div>
  );

  return (
    <Card title="Cash until payday and after" action={toggle}>
      {onPayday && (
        <p className="sr-only">
          Projected daily balance from {formatDate(points[0].date)} to {formatDate(points[points.length - 1].date)}. After payroll on{' '}
          {formatDate(payday)}: {formatMoney(onPayday.current)} now, {formatMoney(onPayday.withActions)} if the selected actions are approved.
          Safety buffer {formatMoney(buffer)}.
        </p>
      )}
      <div className="h-64 sm:h-72" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={tokenColor('line')} />
            <XAxis dataKey="date" tickFormatter={(d: string) => formatDate(d, { year: false })} tick={{ fontSize: 12, fill: muted }} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 12, fill: muted }} tickLine={false} axisLine={false} width={76} />
            <Tooltip
              formatter={(value: number, name: string) => [formatMoney(value), name === 'current' ? 'Current' : 'If actions approved']}
              labelFormatter={(d: string) => formatDate(d)}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <ReferenceLine y={0} stroke={ink} strokeOpacity={0.4} />
            <ReferenceLine y={buffer} stroke={muted} strokeDasharray="4 4" label={{ value: 'Safety buffer', position: 'insideTopLeft', fontSize: 11, fill: muted }} />
            <ReferenceLine x={payday} stroke={ink} strokeOpacity={0.5} label={{ value: 'Payday', position: 'top', fontSize: 11, fill: ink }} />
            <Line type="linear" dataKey="current" stroke={tokenColor(STATUS_META[currentStatus].token)} strokeWidth={2} dot={false} isAnimationActive={false} />
            {showActions && (
              <Line type="linear" dataKey="withActions" stroke={tokenColor(STATUS_META[withActionsStatus].token)} strokeWidth={2} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted">
        Solid line: current projection{showActions && '. Dashed line: with the actions ticked in "What if"'}. Dashed grey line: safety buffer.
      </p>
    </Card>
  );
}
