import { Lock } from 'lucide-react';
import { useState } from 'react';
import { updateSettings } from '@/api/client';
import type { ActionType, Settings } from '@/api/types';
import { Button } from '@/components/Button';
import { useRole } from '@/lib/role';
import { ACTION_TYPE_META } from './actionMeta';

const FIELD = 'mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 text-sm disabled:bg-canvas disabled:text-muted';
const ACTION_TYPES = Object.keys(ACTION_TYPE_META) as ActionType[];

export function SettingsForm({ settings, onSaved }: { settings: Settings; onSaved: (message: string) => void }) {
  const { role } = useRole();
  const readOnly = role !== 'OWNER';
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggleAction = (type: ActionType) =>
    set('enabledActions', form.enabledActions.includes(type) ? form.enabledActions.filter((t) => t !== type) : [...form.enabledActions, type]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateSettings(form);
      onSaved('Settings saved. The projection uses them right away.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {readOnly && (
        <p className="mb-5 flex items-center gap-2 rounded-input bg-canvas p-3 text-sm text-muted">
          <Lock className="size-4" aria-hidden="true" />
          Only the Owner can change settings. You are viewing them as Finance Admin.
        </p>
      )}

      <fieldset disabled={readOnly || busy} className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Payday (day of the month)
          <input type="number" min={1} max={28} required value={form.paydayDayOfMonth} onChange={(e) => set('paydayDayOfMonth', Number(e.target.value))} className={FIELD} />
        </label>
        <label className="text-sm font-medium">
          Alert lead time (days before payday)
          <input type="number" min={1} max={30} required value={form.leadTimeDays} onChange={(e) => set('leadTimeDays', Number(e.target.value))} className={FIELD} />
        </label>
        <label className="text-sm font-medium">
          Safety buffer (RM)
          <input type="number" min={0} step={100} required value={form.safetyBuffer} onChange={(e) => set('safetyBuffer', Number(e.target.value))} className={`${FIELD} tabular-nums`} />
          <span className="mt-1 block text-xs font-normal text-muted">The minimum you want left in the bank after payroll.</span>
        </label>
        <label className="text-sm font-medium">
          Default message language
          <select value={form.defaultLanguage} onChange={(e) => set('defaultLanguage', e.target.value as Settings['defaultLanguage'])} className={FIELD}>
            <option value="EN">English</option>
            <option value="BM">Bahasa Melayu</option>
          </select>
        </label>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">Actions Cash Guard may suggest</legend>
          <ul className="mt-2 divide-y divide-line rounded-input border border-line">
            {ACTION_TYPES.map((type) => (
              <li key={type}>
                <label className="flex items-center gap-3 p-3 text-sm">
                  <input type="checkbox" className="size-4 accent-accent" checked={form.enabledActions.includes(type)} onChange={() => toggleAction(type)} />
                  {ACTION_TYPE_META[type].label}
                </label>
              </li>
            ))}
            <li className="flex items-start gap-3 bg-canvas p-3 text-sm">
              <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>
                <span className="font-medium">Never propose delaying or reducing salaries</span>
                <span className="ml-2 rounded-full border border-line px-2 text-xs text-muted">Always on</span>
                <span className="mt-0.5 block text-xs text-muted">Malaysian law requires wages to be paid on time, so this rule cannot be switched off.</span>
              </span>
            </li>
          </ul>
        </fieldset>
      </fieldset>

      {error && (
        <p role="alert" className="mt-4 text-sm text-shortfall">
          {error}
        </p>
      )}
      {!readOnly && (
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setForm(settings)} disabled={busy}>
            Undo changes
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      )}
    </form>
  );
}
