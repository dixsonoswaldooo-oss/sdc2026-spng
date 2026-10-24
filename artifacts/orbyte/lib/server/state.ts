// The shared demo state: one JSON row per demo space in Postgres (table esalary_state in lib/db; see space.ts). Used only when DATABASE_URL is set;
// without it the app keeps its data in the browser, as before.
// Saves use optimistic locking: a save only succeeds if nobody else saved since we read, otherwise we read again and retry.
import { Pool } from 'pg';
import * as engine from '../engine';

type Data = engine.Data;
export interface Saved {
  data: Data;
  version: number;
}
export interface Storage {
  read(): Promise<Saved | null>;
  /** Writes `data` if the stored version is still `version` (null = no row yet). False when someone else saved first. */
  write(data: Data, version: number | null): Promise<boolean>;
}

const KEEP_DAYS = 14; // spaces untouched this long are removed when a new one starts
export const hasDatabase = () => !!process.env.DATABASE_URL;

// The table is declared in lib/db (so Replit's drizzle push creates and keeps it); the pool is ours, so this app also runs
// outside the team repo. Created on first use: nothing connects without DATABASE_URL.
let pool: Pool | undefined;
const db = () => (pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }));

/** The row of one demo space. */
export const postgres = (space: string): Storage => ({
  async read() {
    const r = await db().query<{ data: Data; version: number }>('SELECT data, version FROM esalary_state WHERE id = $1', [space]);
    return r.rows[0] ?? null;
  },
  async write(data, version) {
    if (version === null) await db().query(`DELETE FROM esalary_state WHERE updated_at < now() - interval '${KEEP_DAYS} days'`);
    const r = version === null
      ? await db().query('INSERT INTO esalary_state (id, data, version) VALUES ($1, $2, 1) ON CONFLICT (id) DO NOTHING', [space, JSON.stringify(data)])
      : await db().query('UPDATE esalary_state SET data = $2, version = version + 1, updated_at = now() WHERE id = $1 AND version = $3', [space, JSON.stringify(data), version]);
    return r.rowCount === 1;
  },
});

export function stateIn(storage: Storage) {
  /** Reads, applies `edit`, saves; retries when another save got there first. Starts from the demo data if empty. */
  async function mutate(ctx: engine.Ctx, edit: (d: Data) => Data): Promise<Saved> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const row = await storage.read();
      const base = row ? engine.migrate(row.data, ctx) : engine.freshData(ctx);
      const next = edit(base);
      if (await storage.write(next, row?.version ?? null)) return { data: next, version: (row?.version ?? 0) + 1 };
    }
    throw new Error('Too many changes at the same time. Please try again.');
  }

  /** The current state. A new day (or older saved data) is brought up to date and saved once. */
  async function load(ctx: engine.Ctx): Promise<Saved> {
    const row = await storage.read();
    if (row && row.data.version === engine.DATA_VERSION && row.data.today === engine.todayOf(ctx.now)) return row;
    return mutate(ctx, (d) => d);
  }

  return { load, mutate };
}

export const stateOf = (space: string) => stateIn(postgres(space));
