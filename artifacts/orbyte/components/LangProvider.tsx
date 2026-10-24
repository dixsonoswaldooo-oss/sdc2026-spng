'use client';
// Holds the display language (remembered in this browser) and remounts the app when it changes, so every t()/tx()/date()
// call re-renders in the new language. Sits inside StoreProvider, so switching never reloads or resets the demo data.
import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from 'react';
import { LANGS, setDisplayLang, t, type Lang } from '@/lib/i18n';

const KEY = 'esg-lang';
const LangContext = createContext<{ lang: Lang; change: (lang: Lang) => void }>({ lang: 'en', change: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en'); // the server renders English; the saved choice is applied after mount
  setDisplayLang(lang); // before the children render

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Lang | null;
      if (saved && LANGS.some((l) => l.id === saved)) setLang(saved);
    } catch {
      // storage blocked: English for this visit
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = LANGS.find((l) => l.id === lang)!.html;
  }, [lang]);

  const change = (next: Lang) => {
    setLang(next);
    try { localStorage.setItem(KEY, next); } catch { /* not remembered, still switched */ }
  };
  return (
    <LangContext.Provider value={{ lang, change }}>
      <Fragment key={lang}>{children}</Fragment>
    </LangContext.Provider>
  );
}

/** EN · BM · 中文 switch. Compact on phones (short names), full names in the menu for screen readers. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, change } = useContext(LangContext);
  return (
    <div role="group" aria-label={t('Language')} className={`inline-flex rounded-full border border-line bg-white p-0.5 ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l.id} type="button" lang={l.html} aria-pressed={lang === l.id} title={l.name} aria-label={l.name}
          onClick={() => change(l.id)}
          className={`min-h-9 min-w-10 cursor-pointer whitespace-nowrap rounded-full px-2.5 text-xs font-semibold transition ${lang === l.id ? 'bg-navy text-white' : 'text-text-70 hover:text-navy'}`}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
