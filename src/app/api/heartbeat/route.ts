import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { embed, generate } from "@/lib/llm-adapter";
import type { LLMConfig } from "@/lib/llm-adapter";

/**
 * Heartbeat — exercises all three external services so free-tier providers
 * (Supabase DB, the Ollama embedding Space, the Groq chat model) don't get
 * paused/spun down for inactivity. Hit it from a free scheduler (cron-job.org,
 * GitHub Actions, etc.) on whatever cadence each provider's idle timeout needs.
 *
 *   curl -H "Authorization: Bearer $HEARTBEAT_SECRET" https://<app>/api/heartbeat
 *
 * Auth is a single shared secret in HEARTBEAT_SECRET (Bearer header or ?secret=).
 * Each task runs independently and reports ok/failed — one failing service does
 * not mask the others. Returns 200 if all pass, 207 if any task failed.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getLLMConfig(): Promise<LLMConfig | null> {
  const config = await prisma.llmConfig.findFirst();
  if (!config) return null;
  return {
    generationProvider: config.generationProvider as LLMConfig["generationProvider"],
    generationModel: config.generationModel,
    generationApiKey: config.generationApiKey,
    embeddingProvider: config.embeddingProvider as LLMConfig["embeddingProvider"],
    embeddingModel: config.embeddingModel,
    embeddingApiKey: config.embeddingApiKey,
  };
}

type TaskResult = { ok: boolean; detail?: string; error?: string };

async function run(fn: () => Promise<string>): Promise<TaskResult> {
  try {
    return { ok: true, detail: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.HEARTBEAT_SECRET;
  if (!secret) return false; // fail closed if unconfigured
  const bearer = req.headers.get("authorization") === `Bearer ${secret}`;
  const query = req.nextUrl.searchParams.get("secret") === secret;
  return bearer || query;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getLLMConfig();

  // 1. Database — a trivial query keeps the Supabase project active.
  const db = await run(async () => {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    return `select returned ${rows[0]?.ok}`;
  });

  // 2. Embedding model — embed a tiny string to wake the Ollama Space.
  const embedding = await run(async () => {
    if (!config) throw new Error("No LlmConfig saved");
    const { dimensions } = await embed(config, "heartbeat");
    return `embedded ${dimensions} dims`;
  });

  // 3. Chat model — a minimal completion keeps the Groq path warm.
  const chat = await run(async () => {
    if (!config) throw new Error("No LlmConfig saved");
    const { text } = await generate(config, {
      systemPrompt: "Reply with a single word.",
      userPrompt: "ping",
      maxTokens: 5,
      temperature: 0,
    });
    return `replied "${text.trim().slice(0, 20)}"`;
  });

  const allOk = db.ok && embedding.ok && chat.ok;
  return NextResponse.json(
    { ok: allOk, ts: new Date().toISOString(), db, embedding, chat },
    { status: allOk ? 200 : 207 }
  );
}
