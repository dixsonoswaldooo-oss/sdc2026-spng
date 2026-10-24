// Switch demo space (database mode): POST { code } joins that space (e.g. a second device), POST {} starts a fresh one.
// A space that doesn't exist yet starts from the demo data on first use.
import { enterSpace, isSpaceCode, newSpaceCode } from '@/lib/server/space';
import { hasDatabase } from '@/lib/server/state';

export async function POST(request: Request): Promise<Response> {
  if (!hasDatabase()) return Response.json({ mode: 'browser' }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : undefined;
  if (code !== undefined && !isSpaceCode(code)) return Response.json({ error: 'A space code is 6 letters and digits, e.g. K7Q2MX.' }, { status: 400 });
  return Response.json({ space: await enterSpace(code ?? newSpaceCode()) });
}
