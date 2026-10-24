// Three screen languages: English (default), Bahasa Melayu, Mandarin (简体中文). One dictionary (lib/i18n-dict.ts) keyed by
// the English text, so `t('Save rates')` reads like the screen and a missing entry simply shows English.
// - t(key, params): screen text. "{name}" in a key is filled from params.
// - tx(text): text the app generated in English and stored (WhatsApp alerts, activity log, server errors). It is matched
//   against the dictionary's templates, so stored data needs no change and old data is translated too. Free text
//   (names, notes, leave reasons, the AI's explanation) has no template and stays as written.
// The display language is module state set by components/LangProvider.tsx, which remounts the app when it changes.
// Stored data is always built in English: lib/engine.ts and lib/payroll.ts pass 'en' to the date helpers.
import { Fragment, type ReactNode } from 'react';
import { ENTRIES, GENERATED } from './i18n-dict';

export type Lang = 'en' | 'ms' | 'zh';
export const LANGS: { id: Lang; short: string; name: string; html: string }[] = [
  { id: 'en', short: 'EN', name: 'English', html: 'en' },
  { id: 'ms', short: 'BM', name: 'Bahasa Melayu', html: 'ms' },
  { id: 'zh', short: '中文', name: '简体中文', html: 'zh-Hans' },
];

let current: Lang = 'en';
export const getLang = (): Lang => current;
export const setDisplayLang = (lang: Lang): void => {
  current = lang;
};

type Params = Record<string, string | number>;
const BY_KEY = new Map(ENTRIES.map(([en, ms, zh]) => [en, { ms, zh }]));

const fill = (template: string, params: Params) => template.replace(/\{(\w+)\}/g, (all, k: string) => (k in params ? String(params[k]) : all));

/** Screen text in `lang` (default: the display language). */
export function tr(key: string, params: Params = {}, lang: Lang = current): string {
  const template = lang === 'en' ? key : BY_KEY.get(key)?.[lang] || key;
  return fill(template, params);
}
export const t = (key: string, params?: Params) => tr(key, params);

// ---- Dates and months inside generated English text ----
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MON_MS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
export const MONTH_MS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

/** "14 Oct 2026, 09:15" / "14 Oct" / "October 2026" / "2026-10-14" / ISO timestamps inside a sentence, in `lang`. */
export function localizeDates(text: string, lang: Lang): string {
  if (lang === 'en') return text;
  return text
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g, (iso) => {
      const myt = new Date(Date.parse(iso) + 8 * 3_600_000); // Malaysia time, like dateTime()
      const [y, m, d, hh, mm] = [myt.getUTCFullYear(), myt.getUTCMonth(), myt.getUTCDate(), myt.getUTCHours(), myt.getUTCMinutes()];
      const hm = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      return lang === 'ms' ? `${d} ${MON_MS[m]} ${y}, ${hm}` : `${y}年${m + 1}月${d}日 ${hm}`;
    })
    .replace(new RegExp(`\\b(\\d{1,2}) (${MON.join('|')})(?: (\\d{4}))?(?:, (\\d{2}:\\d{2}))?\\b`, 'g'), (_, d: string, m: string, y?: string, hm?: string) => {
      const i = MON.indexOf(m);
      if (lang === 'ms') return `${d} ${MON_MS[i]}${y ? ` ${y}` : ''}${hm ? `, ${hm}` : ''}`;
      return `${y ? `${y}年` : ''}${i + 1}月${d}日${hm ? ` ${hm}` : ''}`;
    })
    .replace(new RegExp(`\\b(${MONTH.join('|')}) (\\d{4})\\b`, 'g'), (_, m: string, y: string) => {
      const i = MONTH.indexOf(m);
      return lang === 'ms' ? `${MONTH_MS[i]} ${y}` : `${y}年${i + 1}月`;
    })
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, y: string, m: string, d: string) =>
      (lang === 'ms' ? `${Number(d)} ${MON_MS[Number(m) - 1]} ${y}` : `${y}年${Number(m)}月${Number(d)}日`));
}

// ---- Generated text: match dictionary templates ----
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Only generated-text templates: short screen patterns ("{first} and {second}") would rewrite free text.
const TEMPLATES = GENERATED.filter(([en]) => /\{\w+\}/.test(en))
  .map(([en]) => {
    const names = [...en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const source = escape(en).replace(/\\\{\w+\\\}/g, '(.+?)');
    return { en, names, re: new RegExp(`^${source}$`, 's'), fixed: en.replace(/\{\w+\}/g, '').length };
  })
  .sort((a, b) => b.fixed - a.fixed); // the most specific template wins

const cache: Record<Lang, Map<string, string>> = { en: new Map(), ms: new Map(), zh: new Map() };
// What people typed stays as typed: names are never translated; a note or reason only when it is itself generated
// text (e.g. a keyword-check reason), never by matching a template, so free text can't be half-translated.
const RAW = new Set(['name', 'first', 'who', 'email', 'query', 'code', 'space', 'example', 'ref']);
const EXACT_ONLY = new Set(['reason', 'note', 'word']);
const exactOf = (text: string, lang: Lang) => (lang !== 'en' && BY_KEY.get(text)?.[lang]) || text;
// A date range "2026-11-03 to 2026-11-04" or "PAY-1 to PAY-6": single tokens only, so " to " inside a sentence is left alone.
const TOKEN = new Set(['start', 'end']);

/** Company data typed by people (positions, departments, names): a dictionary match only, never a template. */
export const td = (text: string, lang: Lang = current) => exactOf(text, lang);

function translate(text: string, lang: Lang, depth: number): string {
  if (BY_KEY.has(text)) return exactOf(text, lang);
  if (depth < 4) {
    for (const { en, names, re } of TEMPLATES) {
      const m = re.exec(text);
      if (!m || names.some((n, i) => TOKEN.has(n) && /\s/.test(m[i + 1]))) continue;
      const params = Object.fromEntries(names.map((n, i) => [n,
        RAW.has(n) ? m[i + 1] : EXACT_ONLY.has(n) ? exactOf(m[i + 1], lang) : translate(m[i + 1], lang, depth + 1)]));
      return tr(en, params, lang);
    }
    for (const sep of ['; ', ' · ']) {
      if (text.includes(sep)) return text.split(sep).map((part) => translate(part, lang, depth + 1)).join(sep);
    }
  }
  return text;
}

/** Generated English text (stored messages, log entries, errors) in `lang` (default: the display language). */
export function tx(text: string, lang: Lang = current): string {
  if (lang === 'en' || !text) return text;
  let hit = cache[lang].get(text);
  if (hit === undefined) {
    hit = localizeDates(translate(text, lang, 0), lang);
    cache[lang].set(text, hit);
  }
  return hit;
}

/** For tests: does generated text match a dictionary entry or template (so it gets translated)? */
export function isKnown(text: string): boolean {
  if (BY_KEY.has(text) || /^(RM [\d,.]+|[^A-Za-z]*)$/.test(text)) return true;
  if (TEMPLATES.some(({ re, names }) => { const m = re.exec(text); return !!m && !names.some((n, i) => TOKEN.has(n) && /\s/.test(m[i + 1])); })) return true;
  return ['; ', ' · '].some((sep) => text.includes(sep) && text.split(sep).every(isKnown));
}

/** Screen text with React parts (bold words, links) in its placeholders, so each language can order them its own way. */
export function rt(key: string, parts: Record<string, ReactNode>): ReactNode[] {
  return tr(key, {}).split(/\{(\w+)\}/).map((piece, i) => (i % 2 ? <Fragment key={i}>{parts[piece] ?? `{${piece}}`}</Fragment> : piece));
}

/** English singular/plural keys (the other languages have one form for both), e.g. tn(3, ONE_KEY, MANY_KEY). */
export const tn = (n: number, one: string, many: string, params: Params = {}) => t(n === 1 ? one : many, { n, ...params });
