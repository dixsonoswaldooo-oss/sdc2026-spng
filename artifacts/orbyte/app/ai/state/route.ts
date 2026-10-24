// The shared demo state (database mode). Lives under /ai because Replit sends every /api request to T1's api-server.
// Each visitor works in their own demo space (lib/server/space.ts).
//   GET  ?v=N          → { data, version, space }, or 204 when the browser already has version N. 503 = no database (browser mode).
//   POST { actions: [{ action, args }, …] } → each checked against the signed-in account (lib/server/actions.ts) and run in
//        order, saved once → { data, version }. A refusal keeps the earlier actions and returns { error, data, version }.
//   POST { action: "readReason", args: [leaveId] } → the AI reads a pending reason (inside this request) and labels it.
import * as engine from '@/lib/engine';
import { performAll, Refused, type Step } from '@/lib/server/actions';
import { accountsOf } from '@/lib/seed';
import { classifyReason } from '@/lib/server/classify';
import { currentAccount } from '@/lib/server/session';
import { currentSpace } from '@/lib/server/space';
import { hasDatabase, stateOf } from '@/lib/server/state';

const browserMode = () => Response.json({ mode: 'browser' }, { status: 503 });
const ctx = () => ({ actor: 'System', now: new Date().toISOString() });

export async function GET(request: Request): Promise<Response> {
  if (!hasDatabase()) return browserMode();
  const space = await currentSpace();
  const saved = await stateOf(space).load(ctx());
  const known = new URL(request.url).searchParams.get('v');
  if (known !== null && Number(known) === saved.version) return new Response(null, { status: 204 });
  return Response.json({ ...saved, space });
}

export async function POST(request: Request): Promise<Response> {
  if (!hasDatabase()) return browserMode();
  const body = (await request.json().catch(() => null)) as { action?: unknown; args?: unknown; actions?: unknown } | null;
  const state = stateOf(await currentSpace());
  const account = await currentAccount(accountsOf((await state.load(ctx())).data.employees));
  try {
    if (body?.action === 'readReason') {
      const [id] = Array.isArray(body.args) ? body.args : [];
      if (!account) throw new Refused('Please sign in again.', 401);
      const leave = (await state.load(ctx())).data.leaves.find((l) => l.id === id);
      if (!leave || !leave.aiPending || leave.status !== 'PENDING') return Response.json(await state.load(ctx()));
      const ai = await classifyReason(leave.type, leave.reason);
      return Response.json(await state.mutate(ctx(), (d) => engine.applyAiLabel(d, { actor: 'AI', now: new Date().toISOString() }, leave.id, ai, leave.reason)));
    }
    const steps: Step[] = Array.isArray(body?.actions) ? body.actions : [{ action: body?.action, args: body?.args }];
    if (steps.length === 0 || steps.length > 50) throw new Refused('That request is not valid.', 400);
    let refused: { action: string; error: Error } | undefined;
    const saved = await state.mutate(ctx(), (d) => {
      const result = performAll(d, account, steps, new Date().toISOString());
      refused = result.refused;
      return result.data;
    });
    if (!refused) return Response.json(saved);
    const status = refused.error instanceof Refused ? refused.error.status : 400;
    console.warn(`[e-Salary Guard] refused ${refused.action} (${status}) for ${account?.id ?? 'no session'}: ${refused.error.message}`);
    return Response.json({ ...saved, error: refused.error.message }, { status });
  } catch (e) {
    console.warn(`[e-Salary Guard] request failed for ${account?.id ?? 'no session'}: ${(e as Error).message}`);
    if (e instanceof Refused) return Response.json({ error: e.message }, { status: e.status });
    // Database/driver errors carry a code; their text is not for the browser.
    if ((e as { code?: unknown }).code !== undefined) return Response.json({ error: 'The database could not be reached. Please try again.' }, { status: 500 });
    return Response.json({ error: (e as Error).message }, { status: 400 }); // a business rule from engine.ts
  }
}
