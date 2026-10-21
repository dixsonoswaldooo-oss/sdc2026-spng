import { ArrowRight, Construction } from 'lucide-react';
import { Button } from '@/components/Button';

/** Stand-in for Orbyte modules outside this demo, and for Cash Guard tabs still being built. */
export function PlaceholderPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface p-10 text-center">
      <Construction className="mx-auto size-6 text-muted" aria-hidden="true" />
      <h1 className="mt-3 text-xl font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{message}</p>
      <Button href="~/cash-guard" variant="secondary" className="mt-6">
        Go to Cash Guard
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
