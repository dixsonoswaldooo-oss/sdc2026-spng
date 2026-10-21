import { Sparkles, Wrench } from 'lucide-react';

/** Labels AI text (CLAUDE.md §6). In fallback mode it says the text is rules-based instead. */
export function AiBadge({ fallback = false }: { fallback?: boolean }) {
  if (fallback) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs font-medium text-muted">
        <Wrench className="size-3" aria-hidden="true" />
        Fallback (rules-based)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ai/10 px-2 py-0.5 text-xs font-semibold text-ai">
      <Sparkles className="size-3" aria-hidden="true" />
      AI
    </span>
  );
}
