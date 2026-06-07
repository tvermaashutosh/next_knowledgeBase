import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/supabase-server";
import { getUserByEmail, isAdmin } from "@/lib/rbac";
import { getProviderOptions } from "@/lib/llm-adapter";

// GET: Get current LLM config + available options
export async function GET() {
  try {
    const config = await prisma.llmConfig.findFirst();
    const options = getProviderOptions();

    return NextResponse.json({
      config: config
        ? {
            id: config.id,
            generationProvider: config.generationProvider,
            generationModel: config.generationModel,
            hasGenerationKey: !!config.generationApiKey,
            embeddingProvider: config.embeddingProvider,
            embeddingModel: config.embeddingModel,
            hasEmbeddingKey: !!config.embeddingApiKey,
          }
        : null,
      options,
    });
  } catch (error) {
    console.error("LLM config GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Save LLM config (admin only)
export async function POST(request: NextRequest) {
  try {
    const supaUser = await getUser();
    if (!supaUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await getUserByEmail(supaUser.email);
    if (!appUser || !isAdmin(appUser.role)) {
      return NextResponse.json({ error: "Forbidden — Admin only" }, { status: 403 });
    }

    const body = await request.json();
    const {
      generationProvider,
      generationModel,
      generationApiKey,
      embeddingProvider,
      embeddingModel,
      embeddingApiKey,
    } = body;

    // Upsert — we only keep one config row
    const existing = await prisma.llmConfig.findFirst();

    const data = {
      generationProvider: generationProvider || "groq",
      generationModel: generationModel || "llama-3.3-70b-versatile",
      generationApiKey: generationApiKey || existing?.generationApiKey || "",
      embeddingProvider: embeddingProvider || "ollama",
      embeddingModel: embeddingModel || "nomic-embed-text",
      embeddingApiKey: embeddingApiKey || existing?.embeddingApiKey || "",
    };

    let config;
    if (existing) {
      config = await prisma.llmConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      config = await prisma.llmConfig.create({ data });
    }

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        generationProvider: config.generationProvider,
        generationModel: config.generationModel,
        embeddingProvider: config.embeddingProvider,
        embeddingModel: config.embeddingModel,
      },
    });
  } catch (error) {
    console.error("LLM config POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
