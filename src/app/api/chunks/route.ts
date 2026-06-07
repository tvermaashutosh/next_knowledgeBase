import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { embed, type LLMConfig } from "@/lib/llm-adapter";

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

// PATCH: Update a chunk's text and re-embed it
export async function PATCH(request: NextRequest) {
  try {
    const { id, chunkText } = await request.json();

    if (!id || !chunkText) {
      return NextResponse.json({ error: "Missing 'id' or 'chunkText'" }, { status: 400 });
    }

    // Verify chunk exists
    const existing = await prisma.embedding.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
    }

    // Get LLM config for re-embedding
    const llmConfig = await getLLMConfig();
    if (!llmConfig) {
      return NextResponse.json({ error: "LLM not configured. Go to Admin → LLM Config." }, { status: 400 });
    }

    // Re-embed the updated text
    const result = await embed(llmConfig, chunkText);

    // Update chunk text and embedding vector
    await prisma.$executeRawUnsafe(
      `UPDATE "Embedding" SET "chunkText" = $1, embedding = $2::vector WHERE id = $3`,
      chunkText,
      `[${result.embedding.join(",")}]`,
      id
    );

    return NextResponse.json({
      success: true,
      id,
      chunkText,
      message: "Chunk updated and re-embedded",
    });
  } catch (error) {
    console.error("Chunk update error:", error);
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
