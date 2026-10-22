// Reads the demo data from a Google Sheet (4 tabs) and turns it into a Scenario for the engine.
// The sheet must be shared as "Anyone with the link can view". Each tab is read as CSV through Google's export link,
// which allows browsers on other sites to read it. Tabs are found by their fixed ID (gid), so renaming a tab is fine
// but deleting and re-creating one is not.
import type { ActionType, Bill, ISODate, Language, PurchaseOrder, Receivable } from '../api/types.ts';
import type { Scenario } from './fixtures.ts';

export const SHEET_TABS = { settings: 0, invoices: 1, bills: 2, orders: 3 } as const;
export type SheetTab = keyof typeof SHEET_TABS;
const TAB_NAMES: Record<SheetTab, string> = { settings: 'Settings', invoices: 'Invoices', bills: 'Bills', orders: 'Orders' };

/** A problem in the sheet, written for the person editing it. */
export class SheetError extends Error {}

// ---------- CSV ----------

/** Splits CSV text into rows and cells. Handles quotes, commas and line breaks inside quoted cells. */
export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"' && csv[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && csv[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

/** "Likely to pay %" → "likely_to_pay": header names can be written naturally. */
const key = (label: string) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

interface Row { line: number; cells: Record<string, string> }

function table(csv: string, tab: SheetTab): Row[] {
  const [header = [], ...body] = parseCsv(csv);
  const names = header.map(key);
  if (!names.some(Boolean)) fail(tab, 1, 'the first row must hold the column names');
  return body
    .map((cells, i) => ({ line: i + 2, cells: Object.fromEntries(names.map((n, c) => [n, (cells[c] ?? '').trim()])) }))
    .filter((r) => Object.values(r.cells).some((v) => v !== '')); // skip empty rows
}

function fail(tab: SheetTab, line: number, message: string): never {
  throw new SheetError(`${TAB_NAMES[tab]} tab, row ${line}: ${message}.`);
}

// ---------- values ----------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

type Where = [SheetTab, number, string]; // tab, row, column name (for error messages)

function text(value: string, [tab, line, column]: Where, required = true): string {
  if (required && !value) fail(tab, line, `"${column}" is empty`);
  return value;
}

/** "RM 7,400.00", "7400" → 7400 */
function money(value: string, where: Where, required = true): number {
  if (!value && !required) return 0;
  const n = Number(value.replace(/rm|,|\s/gi, ''));
  if (!value || !Number.isFinite(n) || n < 0) fail(where[0], where[1], `"${where[2]}" must be an amount like 2600 or RM 2,600.00 (found "${value}")`);
  return Math.round(n * 100) / 100;
}

function wholeNumber(value: string, where: Where, min: number, max: number): number {
  const n = Number(value.replace(/,/g, ''));
  if (!Number.isInteger(n) || n < min || n > max) fail(where[0], where[1], `"${where[2]}" must be a whole number from ${min} to ${max} (found "${value}")`);
  return n;
}

/** "90%", "0.9" or "90" → 0.9 */
function likelihood(value: string, where: Where): number {
  const n = Number(value.replace('%', '').trim());
  const ratio = value.includes('%') || n > 1 ? n / 100 : n;
  if (!value || !Number.isFinite(ratio) || ratio < 0 || ratio > 1) fail(where[0], where[1], `"${where[2]}" must be a percentage like 90% (found "${value}")`);
  return ratio;
}

/** Accepts 2026-10-25, 25/10/2026 (day first, as in Malaysia), 25-10-2026, 25 Oct 2026. */
export function sheetDate(value: string, where: Where, required = true): ISODate | undefined {
  if (!value && !required) return undefined;
  const v = value.trim();
  let y = 0, m = 0, d = 0;
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const numeric = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const named = v.match(/^(\d{1,2})\s+([a-z]+)\.?,?\s+(\d{4})$/i);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (numeric) {
    const [a, b] = [Number(numeric[1]), Number(numeric[2])];
    [y, m, d] = b > 12 && a <= 12 ? [Number(numeric[3]), a, b] : [Number(numeric[3]), b, a]; // month first only when it must be
  } else if (named) [y, m, d] = [Number(named[3]), MONTHS.indexOf(named[2].slice(0, 3).toLowerCase()) + 1, Number(named[1])];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (!y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    fail(where[0], where[1], `"${where[2]}" must be a date like 2026-10-25 or 25/10/2026 (found "${value}")`);
  }
  return date.toISOString().slice(0, 10);
}

/** "08:00", "8:00", "8:00 AM", "08:00:00" → "08:00" */
function time(value: string, where: Where): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (!match) fail(where[0], where[1], `"${where[2]}" must be a time like 08:00 (found "${value}")`);
  let hours = Number(match[1]) % 12;
  if (!match[3]) hours = Number(match[1]);
  else if (match[3].toLowerCase() === 'pm') hours += 12;
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

function yesNo(value: string, where: Where, blank: boolean): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return blank;
  if (['yes', 'y', 'ya', 'true', '1', 'on'].includes(v)) return true;
  if (['no', 'n', 'tidak', 'false', '0', 'off'].includes(v)) return false;
  return fail(where[0], where[1], `"${where[2]}" must be yes or no (found "${value}")`);
}

function language(value: string, where: Where): Language {
  const v = value.trim().toLowerCase();
  if (['en', 'english'].includes(v)) return 'EN';
  if (['bm', 'ms', 'malay', 'bahasa', 'bahasa melayu'].includes(v)) return 'BM';
  return fail(where[0], where[1], `"${where[2]}" must be EN or BM (found "${value}")`);
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

function uniqueIds<T extends { id: string }>(items: T[], tab: SheetTab, rows: Row[]): T[] {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    if (seen.has(item.id)) fail(tab, rows[i].line, `ID "${item.id}" is used twice`);
    seen.add(item.id);
  });
  return items;
}

// ---------- tabs → scenario ----------

/** Turns the four tabs (as CSV text) into a Scenario. Throws SheetError naming the tab, row and column of any problem. */
export function buildScenario(csv: Record<SheetTab, string>): Scenario {
  const settingsRows = table(csv.settings, 'settings');
  const settings = new Map(settingsRows.map((r) => [key(Object.values(r.cells)[0] ?? ''), { value: Object.values(r.cells)[1] ?? '', line: r.line }]));
  const get = (name: string, label: string, required = true) => {
    const found = settings.get(key(name));
    if (!found && required) throw new SheetError(`Settings tab: the row "${label}" is missing.`);
    return { value: found?.value ?? '', where: ['settings', found?.line ?? 0, label] as Where };
  };
  const s = (name: string, label = name) => get(name, label);

  const today = sheetDate(s('demo_today', 'Demo today').value, s('demo_today', 'Demo today').where)!;
  const checkTime = time(s('daily_check_time', 'Daily check time').value || '08:00', s('daily_check_time', 'Daily check time').where);
  const owner = text(s('owner_name', 'Owner name').value, s('owner_name', 'Owner name').where);
  const financeAdmin = text(s('finance_admin_name', 'Finance Admin name').value, s('finance_admin_name', 'Finance Admin name').where);
  const allowed: [string, string, ActionType][] = [
    ['allow_chase_invoices', 'Allow chase invoices', 'CHASE_RECEIVABLE'],
    ['allow_move_bills', 'Allow move bills', 'RESCHEDULE_BILL'],
    ['allow_hold_orders', 'Allow hold orders', 'HOLD_PURCHASE'],
  ];

  const invoiceRows = table(csv.invoices, 'invoices');
  const receivables: Receivable[] = uniqueIds(invoiceRows.map(({ line, cells: c }) => ({
    id: text(c.invoice_id ?? '', ['invoices', line, 'Invoice ID']),
    customer: text(c.customer ?? '', ['invoices', line, 'Customer']),
    contactName: text(c.contact_name ?? '', ['invoices', line, 'Contact name']),
    amount: money(c.amount ?? '', ['invoices', line, 'Amount']),
    dueDate: sheetDate(c.due_date ?? '', ['invoices', line, 'Due date'])!,
    daysOverdue: 0,
    likelihood: likelihood(c.likely_to_pay ?? '', ['invoices', line, 'Likely to pay %']),
    reminderStatus: 'NONE',
    countedInProjection: false,
  })), 'invoices', invoiceRows);

  const billRows = table(csv.bills, 'bills');
  const bills: Bill[] = uniqueIds(billRows.map(({ line, cells: c }) => {
    const dueDate = sheetDate(c.due_date ?? '', ['bills', line, 'Due date'])!;
    const shiftableTo = sheetDate(c.can_move_to ?? '', ['bills', line, 'Can move to'], false);
    if (shiftableTo && shiftableTo <= dueDate) fail('bills', line, '"Can move to" must be later than the due date');
    return {
      id: text(c.bill_id ?? '', ['bills', line, 'Bill ID']),
      vendor: text(c.supplier ?? '', ['bills', line, 'Supplier']),
      description: c.description ?? '',
      amount: money(c.amount ?? '', ['bills', line, 'Amount']),
      dueDate,
      shiftable: Boolean(shiftableTo),
      shiftableTo,
      termNote: c.why || undefined,
      penalty: money(c.penalty ?? '', ['bills', line, 'Penalty'], false),
    };
  }), 'bills', billRows);

  const orderRows = table(csv.orders, 'orders');
  const purchaseOrders: PurchaseOrder[] = uniqueIds(orderRows.map(({ line, cells: c }) => ({
    id: text(c.order_id ?? '', ['orders', line, 'Order ID']),
    vendor: text(c.supplier ?? '', ['orders', line, 'Supplier']),
    description: text(c.description ?? '', ['orders', line, 'Description']),
    amount: money(c.amount ?? '', ['orders', line, 'Amount']),
    urgent: yesNo(c.urgent ?? '', ['orders', line, 'Urgent'], false),
    dueDate: sheetDate(c.pay_date ?? '', ['orders', line, 'Pay date'])!,
    suggestedDate: sheetDate(c.can_wait_until ?? '', ['orders', line, 'Can wait until'], false),
  })), 'orders', orderRows);

  const channels: Scenario['channels'] = {};
  const drafts: Scenario['drafts'] = {};
  invoiceRows.forEach(({ line, cells: c }, i) => {
    const id = receivables[i].id;
    const channel = (c.channel ?? '').toLowerCase();
    if (channel && !['whatsapp', 'wa', 'email', 'e-mail'].includes(channel)) fail('invoices', line, `"Channel" must be WhatsApp or Email (found "${c.channel}")`);
    channels[id] = channel.startsWith('e') ? 'EMAIL' : 'WHATSAPP';
    drafts[id] = { EN: c.message_en ? [c.message_en] : [], BM: c.message_bm ? [c.message_bm] : [] };
  });

  return {
    workspace: {
      companyName: text(s('company_name', 'Company name').value, s('company_name', 'Company name').where),
      shortName: get('short_name', 'Short name', false).value || s('company_name', 'Company name').value,
      credits: wholeNumber(get('credits', 'Credits', false).value || '0', get('credits', 'Credits', false).where, 0, 10_000_000),
      users: { OWNER: { name: owner, initials: initials(owner) }, FINANCE_ADMIN: { name: financeAdmin, initials: initials(financeAdmin) } },
    },
    today,
    checkedAt: `${today}T${checkTime}:00+08:00`,
    settings: {
      paydayDayOfMonth: wholeNumber(s('payday_day', 'Payday day').value, s('payday_day', 'Payday day').where, 1, 28),
      leadTimeDays: wholeNumber(get('alert_lead_time_days', 'Alert lead time days', false).value || '10', get('alert_lead_time_days', 'Alert lead time days', false).where, 1, 30),
      safetyBuffer: money(s('safety_buffer', 'Safety buffer').value, s('safety_buffer', 'Safety buffer').where),
      defaultLanguage: language(get('message_language', 'Message language', false).value || 'EN', get('message_language', 'Message language', false).where),
      enabledActions: allowed.filter(([name, label]) => yesNo(get(name, label, false).value, get(name, label, false).where, true)).map(([, , type]) => type),
    },
    bankBalance: money(s('bank_balance', 'Bank balance').value, s('bank_balance', 'Bank balance').where),
    posDailyAverage: money(s('daily_sales_average', 'Daily sales average').value, s('daily_sales_average', 'Daily sales average').where),
    payroll: {
      total: money(s('payroll_total', 'Payroll total').value, s('payroll_total', 'Payroll total').where),
      headcount: wholeNumber(s('staff_count', 'Staff count').value, s('staff_count', 'Staff count').where, 1, 100_000),
    },
    receivables,
    bills,
    purchaseOrders,
    channels,
    drafts,
    aiExplanation: get('ai_explanation', 'AI explanation', false).value || undefined,
  };
}

/** Downloads the four tabs and builds the scenario. */
export async function fetchSheetScenario(sheetId: string): Promise<Scenario> {
  const read = async (tab: SheetTab) => {
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv&gid=${SHEET_TABS[tab]}`;
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new SheetError('Could not open the Google Sheet. Check that it is shared as "Anyone with the link can view" and that you are online.');
    }
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('text/csv')) {
      throw new SheetError(`Could not read the ${TAB_NAMES[tab]} tab. Check the sheet is shared as "Anyone with the link can view" and the tab was not deleted.`);
    }
    return response.text();
  };
  const [settings, invoices, bills, orders] = await Promise.all([read('settings'), read('invoices'), read('bills'), read('orders')]);
  return buildScenario({ settings, invoices, bills, orders });
}
