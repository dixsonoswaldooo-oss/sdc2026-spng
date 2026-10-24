import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as engine from './engine';
import { date, monthName } from './format';
import { isKnown, localizeDates, setDisplayLang, tr, tx } from './i18n';
import { ENTRIES } from './i18n-dict';
import { keywordClassify } from './leaveClassifier';
import * as words from './words';

const ROOT = join(__dirname, '..');
const sources = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) return /node_modules|\.next|tes-ai/.test(p) ? [] : sources(p);
  return /\.tsx?$/.test(f) && !/\.test\.|i18n-dict/.test(f) ? [p] : [];
});
const STR = String.raw`'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"`;
const unquote = (m: RegExpMatchArray, i = 1) => (m[i] ?? m[i + 1]).replace(/\\'/g, "'").replace(/\\"/g, '"');

/** Every literal key handed to t / tn / rt / tr, and every value of a label map rendered through t(). */
function screenKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of [...sources(join(ROOT, 'app')), ...sources(join(ROOT, 'components')), ...sources(join(ROOT, 'lib'))]) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(new RegExp(String.raw`\b(?:t|rt|tr)\((?:${STR})`, 'g'))) keys.add(unquote(m));
    for (const m of src.matchAll(new RegExp(String.raw`\btn\([^,]+,\s*(?:${STR}),\s*(?:${STR})`, 'g'))) { keys.add(unquote(m)); keys.add(unquote(m, 3)); }
    for (const m of src.matchAll(/\bt\(([^()]*\?[^()]*)\)/g)) for (const s of m[1].matchAll(new RegExp(String.raw`[?:]\s*(?:${STR})`, 'g'))) keys.add(unquote(s));
    for (const m of src.matchAll(/\[('[^']*'(?:, '[^']*')*)\]\.map\(\(h\) => <th key=\{h\} className=\{TH\}>\{t\(h\)\}/g)) for (const s of m[1].matchAll(/'([^']*)'/g)) keys.add(s[1]);
  }
  for (const m of readFileSync(join(ROOT, 'app/hr/approvals/page.tsx'), 'utf8').matchAll(/filterButton\('[a-z]+', '([^']+)'/g)) keys.add(m[1]);
  const requests = readFileSync(join(ROOT, 'components/requests.tsx'), 'utf8');
  for (const m of requests.matchAll(/[A-Z_]+: \['([^']+)'/g)) keys.add(m[1]); // LEAVE_STATUS, OT_STATUS
  for (const m of requests.matchAll(/[A-Z_]+: '([^']+)'/g)) keys.add(m[1]); // LEAVE_TYPE
  const shell = readFileSync(join(ROOT, 'components/AppShell.tsx'), 'utf8');
  for (const m of shell.matchAll(/\['\/[^']*', '([^']+)', '([^']+)'/g)) { keys.add(m[1]); keys.add(m[2]); }
  for (const map of [words.LEAVE_PAY, words.LEAVE_PAY_LONG, words.LABEL_BY, words.RATE_KIND]) Object.values(map).forEach((v) => keys.add(v));
  keys.add(words.PLEASE_CHECK);
  keys.delete('');
  return keys;
}

describe('dictionary', () => {
  const byKey = new Map(ENTRIES.map((e) => [e[0], e]));

  it('has Bahasa Melayu and 简体中文 for every screen text', () => {
    const missing = [...screenKeys()].filter((k) => /[A-Za-z]/.test(k) && !(byKey.get(k)?.[1] && byKey.get(k)?.[2]));
    expect(missing).toEqual([]);
  });

  it('keeps the same {placeholders} in all three languages, and no key twice with different text', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    expect(ENTRIES.filter(([en, ms, zh]) => names(en) !== names(ms) || names(en) !== names(zh)).map((e) => e[0])).toEqual([]);
    const seen = new Map<string, string>();
    const clashes = ENTRIES.filter(([en, ms, zh]) => {
      const before = seen.get(en);
      seen.set(en, `${ms}|${zh}`);
      return before !== undefined && before !== `${ms}|${zh}`;
    });
    expect(clashes.map((e) => e[0])).toEqual([]);
  });

  it('fills placeholders and falls back to English for unknown text', () => {
    expect(tr('{n} employees', { n: 6 }, 'ms')).toBe('6 pekerja');
    expect(tr('{n} employees', { n: 6 }, 'zh')).toBe('6位员工');
    expect(tr('Not in the dictionary', {}, 'zh')).toBe('Not in the dictionary');
  });
});

describe('dates follow the language', () => {
  it('formats dates and months per language, and inside generated text', () => {
    expect([date('2026-10-14', {}, 'en'), date('2026-10-14', {}, 'ms'), date('2026-10-14', {}, 'zh')]).toEqual(['14 Oct 2026', '14 Okt 2026', '2026年10月14日']);
    expect([monthName('2026-10', 'ms'), monthName('2026-10', 'zh')]).toEqual(['Oktober 2026', '2026年10月']);
    expect(localizeDates('late on 14 Oct (October 2026), 2026-10-09', 'zh')).toBe('late on 10月14日 (2026年10月), 2026年10月9日');
    expect(localizeDates('at 2026-10-24T01:05:00.000Z', 'ms')).toBe('at 24 Okt 2026, 09:05');
  });
});

describe('generated text', () => {
  const NOW = '2026-10-31T17:00:00.000Z'; // 1 Nov in Malaysia
  const hr: engine.Ctx = { actor: 'HR: Nur Farah Hanim', now: NOW };
  const as = (actor: string): engine.Ctx => ({ actor, now: NOW });

  /** A run through most actions, so most kinds of log entries, messages and notifications exist. */
  function busyDay(): engine.Data {
    let d = engine.freshData(hr);
    d = engine.updateConfig(d, hr, { ...d.config, lateRatePerMinute: 1, lateToleranceMinutes: 5 });
    d = engine.updateEmployeePay(d, hr, 'E3', 2500, 200);
    d = engine.setDivisionOvertime(d, hr, 'Roastery', 25);
    d = engine.updateLeaveAllowance(d, hr, 'E5', 10);
    d = engine.addEmployee(d, hr, { name: 'Aina Sofea', position: 'Barista', division: 'Café floor', baseSalary: 2300, bonus: 100 });
    d = engine.sendMessage(d, hr, 'E1', 'Please bring your MC slip.');
    d = engine.sendMessage(d, as('Ahmad Faiz'), 'E1', 'Noted.', 'WORKER');
    d = engine.simulateEvent(d, hr, 'E4', 'LATE');
    const reason = 'mau nonton konser';
    d = engine.submitLeave(d, as('Ahmad Faiz'), 'E1', { type: 'LEAVE', startDate: '2026-11-03', endDate: '2026-11-04', reason }, keywordClassify('LEAVE', reason), true);
    const lv = d.leaves[0].id;
    d = engine.editLeave(d, as('Ahmad Faiz'), lv, { type: 'LEAVE', startDate: '2026-11-03', endDate: '2026-11-05', reason }, keywordClassify('LEAVE', reason));
    d = engine.setLeaveLabel(d, hr, lv, 'DITOLERANSI');
    d = engine.decideLeave(d, hr, lv, true);
    d = engine.revertLeave(d, hr, lv);
    d = engine.decideLeave(d, hr, 'LV-2', false);
    d = engine.requestOvertime(d, as('Ahmad Faiz'), 'E1', { date: '2026-11-06', hours: 2, note: 'Stock count' });
    d = engine.withdrawOvertime(d, as('Ahmad Faiz'), d.overtime[0].id);
    d = engine.offerOvertime(d, hr, ['E2', 'E3'], { date: '2026-11-07', hours: 3, note: 'Weekend market.' });
    d = engine.moveOvertime(d, hr, 'OT-1', 'APPROVED');
    d = engine.revertOvertime(d, hr, 'OT-1');
    d = engine.payMonth(d, hr, '2026-10');
    return engine.logLogin(d, as('Ravi Kumar'), 'Ravi Kumar');
  }

  it('every message, log entry and notification the engine writes has a translation template', () => {
    const d = busyDay();
    const people = new Set([...d.employees.map((e) => e.name), 'HR: Nur Farah Hanim', 'HR', 'October 2026']);
    const unknown = [
      ...d.whatsapp.filter((m) => m.kind !== 'HR_MESSAGE' && m.kind !== 'REPLY').map((m) => m.text),
      ...d.activity.flatMap((a) => [a.action, a.detail, people.has(a.actor) ? '' : a.actor, people.has(a.target) || DIVISION_OR_NAME.test(a.target) ? '' : a.target]),
      ...d.notifications.map((n) => n.text),
    ].filter((s) => /[A-Za-z]/.test(s) && !isKnown(s) && !/^Please bring|^Noted/.test(s))
      // the position HR typed for the new worker is free text
      .filter((s) => s !== 'Barista · Café floor · base RM 2,300.00 · signs in as aina@kopikawan.my');
    expect([...new Set(unknown)]).toEqual([]);
  });

  it('is stored in English even when the screen shows another language', () => {
    setDisplayLang('zh');
    try {
      const d = engine.freshData(hr);
      expect(d.whatsapp[0].text).toMatch(/^Hi \w+, your October 2026 salary has a deduction of RM [\d.,]+ because you were/);
    } finally {
      setDisplayLang('en');
    }
  });

  it('translates generated text, and leaves free text (names, notes, the AI explanation) as written', () => {
    const msg = 'Hi Ravi, your October 2026 salary has a deduction of RM 7.50 because you were 25 minutes late on 14 Oct (tolerance 10 minutes). Your estimated take-home pay is now RM 2,538.50. Please contact HR if anything is wrong.';
    expect(tx(msg, 'ms')).toBe('Hai Ravi, gaji Oktober 2026 anda ada potongan RM 7.50 kerana anda lewat 25 minit pada 14 Okt (had toleransi 10 minit). Anggaran gaji bersih anda kini RM 2,538.50. Sila hubungi HR jika ada yang tidak betul.');
    expect(tx(msg, 'zh')).toContain('您在10月14日迟到25分钟（宽限10分钟）');
    expect(tx('Going to a concert is entertainment.', 'ms')).toBe('Going to a concert is entertainment.');
    expect(tx('leave 2026-11-03 to 2026-11-04: "I go to KL and back"', 'ms')).toBe('cuti 3 Nov 2026 hingga 4 Nov 2026: "I go to KL and back"');
    expect(tx('Accompanying a sick child (confidence 90%)', 'zh')).toBe('Accompanying a sick child（置信度 90%）');
  });
});

const DIVISION_OR_NAME = /^(Café floor|Roastery|Logistics|Office|\d+ employees)$/;
