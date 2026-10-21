import { CircleAlert, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-line bg-surface p-6 text-center shadow-soft">
      <CircleAlert className="mx-auto size-6 text-shortfall" aria-hidden="true" />
      <p className="mt-2 font-medium">Something went wrong</p>
      <p className="mt-1 text-sm text-muted">{message}</p>
      <Button variant="secondary" className="mt-4" onClick={onRetry}>
        <RefreshCw className="size-4" aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
