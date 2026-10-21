/** Grey placeholder block shown while data loads (instead of a spinner on a blank page). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-input bg-line/70 ${className}`} aria-hidden="true" />;
}
