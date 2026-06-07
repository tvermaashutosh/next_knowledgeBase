import { NextRequest, NextResponse } from "next/server";
import { generate } from "@/lib/llm-adapter";
import { prisma } from "@/lib/db";
import type { LLMConfig } from "@/lib/llm-adapter";

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

// POST: Analyze actual vs expected answer and suggest KB fixes
export async function POST(request: NextRequest) {
  try {
    const { query, actualAnswer, expectedAnswer, contextChunks } = await request.json();

    if (!query || !expectedAnswer || !contextChunks?.length) {
      return NextResponse.json(
        { error: "Missing required fields: query, expectedAnswer, contextChunks" },
        { status: 400 }
      );
    }

    const llmConfig = await getLLMConfig();
    if (!llmConfig) {
      return NextResponse.json(
        { error: "LLM not configured. Go to Admin → LLM Config." },
        { status: 400 }
      );
    }

    // Build the context chunks description for the LLM
    const chunksDescription = contextChunks
      .map(
        (c: { id: string; chunkText: string; featureTitle?: string; sectionName?: string; type?: string; moduleSlug?: string; featureSlug?: string; scenarioSlug?: string }, i: number) =>
          `--- CHUNK ${i + 1} (id: ${c.id}) ---
Type: ${c.type || "feature"}
Feature: ${c.featureTitle || "unknown"} (module: ${c.moduleSlug || "?"}, feature: ${c.featureSlug || "?"})
Section: ${c.sectionName || "unknown"}
${c.scenarioSlug ? `Scenario: ${c.scenarioSlug}` : ""}
Content:
${c.chunkText}
--- END CHUNK ${i + 1} ---`
      )
      .join("\n\n");

    const systemPrompt = `You are a Knowledge Base analyst for a software documentation system. Your job is to compare an AI-generated answer against the user's expected correct answer, and identify what changes need to be made to the underlying KB chunks to make the AI produce the correct answer next time.

You MUST return ONLY valid JSON (no markdown fences, no explanation text outside JSON). The response must be a JSON object with this exact schema:

{
  "fixes": [
    {
      "action": "edit",
      "chunkId": "the chunk id to edit",
      "currentText": "exact current text of the chunk",
      "suggestedText": "the corrected/improved text",
      "reason": "brief explanation of why this change is needed"
    }
  ],
  "creates": [
    {
      "action": "create",
      "entityType": "scenario | feature",
      "moduleSlug": "slug of parent module",
      "featureSlug": "slug of parent feature (for scenarios)",
      "title": "title for the new entity",
      "content": "full markdown content",
      "reason": "why this new entity is needed"
    }
  ],
  "summary": "one-line summary of all suggested changes"
}

Rules:
1. Only suggest changes that would directly fix the gap between actual and expected.
2. For EDIT fixes, include the FULL corrected chunk text (not just the diff).
3. For CREATE fixes, provide complete markdown content following KB conventions.
4. If the actual answer already matches the expected, return empty fixes and creates arrays with summary "No changes needed".
5. Be precise — don't rewrite chunks unnecessarily. Only touch what's wrong.
6. Preserve existing correct information in chunks when editing.`;

    const userPrompt = `## User Query
${query}

## AI-Generated Answer (ACTUAL)
${actualAnswer || "(No answer was generated)"}

## User's Expected Correct Answer
${expectedAnswer}

## Current KB Chunks (the source data the AI used)
${chunksDescription}

Analyze the gap between the actual and expected answers. Identify which chunks need editing and whether any new features/scenarios need to be created. Return ONLY the JSON response.`;

    const result = await generate(llmConfig, {
      systemPrompt,
      userPrompt,
      maxTokens: 8192,
      temperature: 0.2,
    });

    // Parse the LLM response as JSON
    let parsed;
    try {
      // Strip potential markdown fences
      let text = result.text.trim();
      if (text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
      }
      parsed = JSON.parse(text);
    } catch {
      console.error("Smart Fix: Failed to parse LLM response:", result.text);
      return NextResponse.json(
        { error: "AI returned invalid response. Please try again.", rawText: result.text },
        { status: 500 }
      );
    }

    return NextResponse.json({
      fixes: parsed.fixes || [],
      creates: parsed.creates || [],
      summary: parsed.summary || "",
      usage: result.usage,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Smart Fix error:", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
