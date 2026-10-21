import { Mail, MessageCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { regenerateDraft } from '@/api/client';
import type { DraftMessage, Language } from '@/api/types';
import { AiBadge } from '@/components/AiBadge';

interface Props {
  actionId: string;
  customer: string;
  draft: DraftMessage;
  editable: boolean;
  onChange: (draft: DraftMessage) => void;
}

const LANGUAGES: Language[] = ['EN', 'BM'];

/** One customer's reminder: switch EN/BM, edit the text, or ask the AI for a new version. */
export function DraftEditor({ actionId, customer, draft, editable, onChange }: Props) {
  const [cache, setCache] = useState<Partial<Record<Language, DraftMessage>>>({ [draft.language]: draft });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = `draft-${draft.receivableId}`;
  const ChannelIcon = draft.channel === 'WHATSAPP' ? MessageCircle : Mail;

  const update = (next: DraftMessage) => {
    setCache((c) => ({ ...c, [next.language]: next }));
    onChange(next);
  };

  const load = async (language: Language, fresh: boolean) => {
    const cached = cache[language];
    if (!fresh && cached) return onChange(cached);
    setBusy(true);
    setError(null);
    try {
      update(await regenerateDraft(actionId, draft.receivableId, language));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-input border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium">
          {customer}
        </label>
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <ChannelIcon className="size-3.5" aria-hidden="true" />
          {draft.channel === 'WHATSAPP' ? 'WhatsApp' : 'Email'}
        </span>
        <AiBadge fallback={draft.isFallback} />
        <div role="group" aria-label={`Language for ${customer}`} className="ml-auto flex rounded-input border border-line p-0.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              disabled={busy}
              aria-pressed={draft.language === lang}
              onClick={() => lang !== draft.language && load(lang, false)}
              className={`rounded px-2 py-0.5 text-xs font-medium ${draft.language === lang ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      <textarea
        id={fieldId}
        value={draft.body}
        readOnly={!editable}
        onChange={(e) => update({ ...draft, body: e.target.value })}
        rows={5}
        className="mt-2 w-full rounded-input border border-line bg-surface p-2.5 text-sm leading-relaxed read-only:bg-canvas"
      />

      <div className="mt-1 flex flex-wrap items-center gap-3">
        {draft.isFallback && <p className="text-xs text-muted">Template text: the AI is unavailable.</p>}
        {error && (
          <p role="alert" className="text-xs text-shortfall">
            {error}
          </p>
        )}
        {editable && (
          <button type="button" onClick={() => load(draft.language, true)} disabled={busy} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent disabled:opacity-50">
            <RefreshCw className={`size-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
            {busy ? 'Writing…' : 'Regenerate draft'}
          </button>
        )}
      </div>
    </div>
  );
}
