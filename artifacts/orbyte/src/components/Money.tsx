import { formatMoney } from '@/lib/format';

/** An amount in RM with tabular figures, so columns of numbers line up. */
export function Money({ amount, signed = false, className = '' }: { amount: number; signed?: boolean; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatMoney(amount, { signed })}</span>;
}
