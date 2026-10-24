// Classifies a leave reason with SEA-LION on RunPod. Server only: the key never reaches the browser.
// No key, an error, a timeout or an unusable answer → keyword fallback, marked "Fallback".
import { keywordClassify, looksLikeGaming, parseAiAnswer, SYSTEM_PROMPT, userPrompt } from '../leaveClassifier';
import type { LeaveClassification, LeaveType } from '../types';

const TIMEOUT_MS = 180_000; // a sleeping worker took up to ~144 s to load the model; nobody waits on this

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

/** Wakes a sleeping RunPod worker; the answer is ignored. */
export async function warmUp(): Promise<void> {
  await askRunpod('Reply with OK.', 1)?.catch(() => null);
}

export async function classifyReason(type: LeaveType, reason: string): Promise<LeaveClassification> {
  if (looksLikeGaming(reason)) return keywordClassify(type, reason); // never shown to the AI; HR reviews it
  try {
    const response = await askRunpod(`${SYSTEM_PROMPT}\n\n${userPrompt(type, reason)}`, 150);
    if (!response?.ok) return keywordClassify(type, reason);
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const answer = parseAiAnswer(data.choices?.[0]?.message?.content ?? '');
    return answer ? { ...answer, source: 'AI' } : keywordClassify(type, reason);
  } catch {
    return keywordClassify(type, reason);
  }
}
