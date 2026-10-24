// Sign in / out for the database mode. Sign-in is still the demo kind (password "demo"), but the server now knows who
// is signed in (signed httpOnly cookie) and checks every change against it. Without a database: 503, the browser handles it.
import * as engine from '@/lib/engine';
import { accountsOf } from '@/lib/seed';
import { currentAccount, endSession, startSession } from '@/lib/server/session';
import { currentSpace } from '@/lib/server/space';
import { hasDatabase, stateOf } from '@/lib/server/state';

const browserMode = () => Response.json({ mode: 'browser' }, { status: 503 });
/** The accounts of this visitor's demo space: HR plus every worker, including workers HR added. */
const accountsHere = async () => accountsOf((await stateOf(await currentSpace()).load({ actor: 'System', now: new Date().toISOString() })).data.employees);

export async function GET(): Promise<Response> {
  if (!hasDatabase()) return browserMode();
  return Response.json({ account: await currentAccount(await accountsHere()) });
}

export async function POST(request: Request): Promise<Response> {
  if (!hasDatabase()) return browserMode();
  const body = (await request.json().catch(() => null)) as { accountId?: unknown; email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const account = (await accountsHere()).find((a) => a.id === body?.accountId || (email && a.email.toLowerCase() === email));
  if (!account || body?.password !== 'demo') return Response.json({ error: 'Unknown email or wrong password.' }, { status: 401 });
  await startSession(account);
  const who = account.role === 'HR' ? `HR: ${account.name}` : account.name;
  const now = new Date().toISOString();
  await stateOf(await currentSpace()).mutate({ actor: 'System', now }, (d) => engine.logLogin(d, { actor: who, now }, who));
  return Response.json({ account });
}

export async function DELETE(): Promise<Response> {
  await endSession();
  return new Response(null, { status: 204 });
}
