import { Router, type IRouter } from "express";
import { RunAiTestBody, RunAiTestResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const fallbackMessage = "AI sedang bangun, coba lagi sebentar";

router.post("/ai-test", async (req, res): Promise<void> => {
  const parsed = RunAiTestBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.prompt.trim()) {
    res.status(400).json({ error: "Tulis pertanyaan terlebih dahulu." });
    return;
  }

  const apiKey = process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  const model = process.env.RUNPOD_MODEL;

  if (!apiKey || !endpointId || !model) {
    req.log.warn("RunPod AI is missing required server configuration");
    res.status(503).json({ error: fallbackMessage });
    return;
  }

  try {
    const response = await fetch(
      `https://api.runpod.ai/v2/${encodeURIComponent(endpointId)}/openai/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: parsed.data.prompt }],
          max_tokens: 150,
        }),
        signal: AbortSignal.timeout(120_000),
      },
    );

    if (!response.ok) {
      req.log.warn({ statusCode: response.status }, "RunPod AI request failed");
      res.status(502).json({ error: fallbackMessage });
      return;
    }

    const result: unknown = await response.json();
    const answer =
      typeof result === "object" &&
      result !== null &&
      "choices" in result &&
      Array.isArray(result.choices) &&
      typeof result.choices[0]?.message?.content === "string"
        ? result.choices[0].message.content
        : null;

    if (!answer) {
      req.log.warn("RunPod AI returned an unexpected response");
      res.status(502).json({ error: fallbackMessage });
      return;
    }

    res.json(RunAiTestResponse.parse({ answer }));
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    req.log.warn(
      { failureType: isTimeout ? "timeout" : "request" },
      "RunPod AI request did not complete",
    );
    res.status(isTimeout ? 504 : 502).json({ error: fallbackMessage });
  }
});

export default router;
