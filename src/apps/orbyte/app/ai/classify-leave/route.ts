// Leave-reason classifier for the browser mode (no database), and the warm-up call sent by the sign-in page.
// In database mode the server reads reasons itself (POST /ai/state, action readReason).
import { classifyReason, warmUp } from '@/lib/server/classify';
import type { LeaveType } from '@/lib/types';

const TYPES: LeaveType[] = ['LEAVE', 'PERMISSION', 'SICK', 'DAY_OFF'];

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const { type, reason, warmup } = (body ?? {}) as { type?: unknown; reason?: unknown; warmup?: unknown };

  // Sent by the sign-in page, so the worker is awake by the time someone asks for leave.
  if (warmup === true) {
    await warmUp();
    return new Response(null, { status: 204 });
  }
  if (typeof reason !== 'string' || !TYPES.includes(type as LeaveType)) {
    return Response.json({ error: 'Send { type, reason }.' }, { status: 400 });
  }
  return Response.json(await classifyReason(type as LeaveType, reason));
}
