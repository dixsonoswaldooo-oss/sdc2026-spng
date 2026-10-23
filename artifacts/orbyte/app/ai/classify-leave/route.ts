// Classifies a leave reason with SEA-LION on RunPod. Runs on the server only: the key never reaches the browser.
// No key, an error, a timeout or an unusable answer → keyword fallback, marked "Fallback".
import { keywordClassify, looksLikeGaming, parseAiAnswer, SYSTEM_PROMPT, userPrompt } from '@/lib/leaveClassifier';
import type { LeaveClassification, LeaveType } from '@/lib/types';

const TYPES: LeaveType[] = ['LEAVE', 'PERMISSION', 'SICK', 'DAY_OFF'];
const TIMEOUT_MS = 180_000; // a sleeping worker took up to ~144 s to load the model; the app no longer makes anyone wait for it

/** Sends one user message, like the team's /ai-test (some Gemma-based chat templates reject a system role). Null without config. */
function askRunpod(content: string, maxTokens: number): Promise<Response> | null {
  const { RUNPOD_API_KEY: apiKey, RUNPOD_ENDPOINT_ID: endpointId, RUNPOD_MODEL: model } = process.env;
  if (!apiKey || !endpointId || !model) return null;
  return fetch(`https://api.runpod.ai/v2/${encodeURIComponent(endpointId)}/openai/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content }], max_tokens: maxTokens, temperature: 0 }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const { type, reason, warmup } = (body ?? {}) as { type?: unknown; reason?: unknown; warmup?: unknown };

  // Sent by the sign-in page, so the worker is awake by the time someone asks for leave.
  if (warmup === true) {
    await askRunpod('Reply with OK.', 1)?.catch(() => null);
    return new Response(null, { status: 204 });
  }

  if (typeof reason !== 'string' || !TYPES.includes(type as LeaveType)) {
    return Response.json({ error: 'Send { type, reason }.' }, { status: 400 });
  }
  const leaveType = type as LeaveType;
  const fallback = () => Response.json(keywordClassify(leaveType, reason));
  if (looksLikeGaming(reason)) return fallback(); // never shown to the AI; HR reviews it

  try {
    const response = await askRunpod(`${SYSTEM_PROMPT}\n\n${userPrompt(leaveType, reason)}`, 150);
    if (!response?.ok) return fallback();
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const answer = parseAiAnswer(data.choices?.[0]?.message?.content ?? '');
    if (!answer) return fallback();
    const result: LeaveClassification = { ...answer, source: 'AI' };
    return Response.json(result);
  } catch {
    return fallback();
  }
}
