import { NextRequest, NextResponse } from "next/server";
import { searchByText, type SearchResult } from "@/lib/embed-pipeline";
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

// GET: Vector similarity search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const product = searchParams.get("product") || undefined;
    const topK = parseInt(searchParams.get("topK") || "10");

    if (!query) {
      return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
    }

    const llmConfig = await getLLMConfig();
    if (!llmConfig) {
      return NextResponse.json({ error: "LLM not configured. Go to Admin → LLM Config." }, { status: 400 });
    }

    const results: SearchResult[] = await searchByText(query, llmConfig, topK, product);

    return NextResponse.json({
      query,
      results: results.map((r) => ({
        id: r.id,
        featureId: r.featureId,
        section: r.section,
        chunkText: r.chunkText,
        similarity: r.similarity,
      })),
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
