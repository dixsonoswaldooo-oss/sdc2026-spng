import { describe, expect, it } from 'vitest';
import * as engine from '../engine';
import { stateIn, type Saved, type Storage } from './state';

const ctx = { actor: 'System', now: '2026-10-23T02:00:00.000Z' };

/** In-memory stand-in for the Postgres row, with the same "only if the version is unchanged" rule. */
function memory(initial: Saved | null = null) {
  let row = initial ? structuredClone(initial) : null;
  let writes = 0;
  const storage: Storage = {
    async read() {
      return row ? structuredClone(row) : null;
    },
    async write(data, version) {
      writes++;
      if ((row?.version ?? null) !== version) return false;
      row = { data: structuredClone(data), version: (version ?? 0) + 1 };
      return true;
    },
  };
  return { storage, peek: () => row, writes: () => writes, bump: (edit: (d: engine.Data) => engine.Data) => { row = { data: edit(row!.data), version: row!.version + 1 }; } };
}

describe('shared state in the database', () => {
  it('starts from the demo data and saves it once', async () => {
    const m = memory();
    const saved = await stateIn(m.storage).load(ctx);
    expect(saved.version).toBe(1);
    expect(saved.data.employees).toHaveLength(6);
    expect((await stateIn(m.storage).load(ctx)).version).toBe(1); // same day: read only, no new save
    expect(m.writes()).toBe(1);
  });

  it('when someone else saves in between, the change is applied on top of theirs (nothing lost)', async () => {
    const m = memory();
    const state = stateIn(m.storage);
    await state.load(ctx);
    let first = true;
    const saved = await state.mutate(ctx, (d) => {
      if (first) {
        first = false;
        m.bump((x) => engine.decideLeave(x, ctx, 'LV-2', false)); // another server rejects Nurul's leave meanwhile
      }
      return engine.decideLeave(d, ctx, 'LV-1', true);
    });
    expect(saved.version).toBe(3);
    const statuses = Object.fromEntries(m.peek()!.data.leaves.map((l) => [l.id, l.status]));
    expect(statuses).toMatchObject({ 'LV-1': 'APPROVED', 'LV-2': 'REJECTED' });
  });

  it('a refused change saves nothing', async () => {
    const m = memory();
    const state = stateIn(m.storage);
    await state.load(ctx);
    await expect(state.mutate(ctx, () => { throw new Error('Only HR can do this.'); })).rejects.toThrow(/Only HR/);
    expect(m.peek()!.version).toBe(1);
  });

  it('data saved by an older version, or on an earlier day, is brought up to date when read', async () => {
    const old = engine.freshData({ ...ctx, now: '2026-10-20T02:00:00.000Z' });
    const m = memory({ data: old, version: 7 });
    const saved = await stateIn(m.storage).load(ctx);
    expect([saved.version, saved.data.today]).toEqual([8, '2026-10-23']);
  });
});
