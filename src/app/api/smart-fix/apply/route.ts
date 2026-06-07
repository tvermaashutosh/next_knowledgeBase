import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { embed } from "@/lib/llm-adapter";
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

interface EditFix {
  action: "edit";
  chunkId: string;
  currentText: string;
  suggestedText: string;
  reason: string;
}

interface CreateFix {
  action: "create";
  entityType: "scenario" | "feature";
  moduleSlug: string;
  featureSlug?: string;
  title: string;
  content: string;
  reason: string;
}

// POST: Apply approved fixes (edits + creates) in batch
export async function POST(request: NextRequest) {
  try {
    const { fixes, creates, query } = await request.json();

    const llmConfig = await getLLMConfig();
    if (!llmConfig) {
      return NextResponse.json({ error: "LLM not configured." }, { status: 400 });
    }

    const results: { type: string; id: string; status: string; error?: string }[] = [];

    // ── Apply chunk edits ──
    if (fixes?.length) {
      for (const fix of fixes as EditFix[]) {
        try {
          // Verify chunk exists
          const existing = await prisma.embedding.findUnique({ where: { id: fix.chunkId } });
          if (!existing) {
            results.push({ type: "edit", id: fix.chunkId, status: "skipped", error: "Chunk not found" });
            continue;
          }

          // Re-embed the updated text
          const embResult = await embed(llmConfig, fix.suggestedText);

          // Update chunk text + vector
          await prisma.$executeRawUnsafe(
            `UPDATE "Embedding" SET "chunkText" = $1, embedding = $2::vector WHERE id = $3`,
            fix.suggestedText,
            `[${embResult.embedding.join(",")}]`,
            fix.chunkId
          );

          // Audit log
          await prisma.auditLog.create({
            data: {
              action: "smart-fix",
              entity: "embedding",
              entityId: fix.chunkId,
              details: JSON.stringify({
                query,
                fixType: "edit",
                before: fix.currentText,
                after: fix.suggestedText,
                reason: fix.reason,
              }),
            },
          });

          results.push({ type: "edit", id: fix.chunkId, status: "applied" });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          results.push({ type: "edit", id: fix.chunkId, status: "error", error: msg });
        }
      }
    }

    // ── Apply new entity creations ──
    if (creates?.length) {
      for (const create of creates as CreateFix[]) {
        try {
          if (create.entityType === "scenario" && create.featureSlug && create.moduleSlug) {
            // Find parent feature
            const feature = await prisma.feature.findFirst({
              where: { slug: create.featureSlug, module: { slug: create.moduleSlug } },
            });
            if (!feature) {
              results.push({ type: "create-scenario", id: create.title, status: "skipped", error: "Parent feature not found" });
              continue;
            }

            const slug = create.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

            // Check if scenario already exists
            const existing = await prisma.scenario.findFirst({
              where: { slug, featureId: feature.id },
            });
            if (existing) {
              results.push({ type: "create-scenario", id: slug, status: "skipped", error: "Scenario already exists" });
              continue;
            }

            const scenario = await prisma.scenario.create({
              data: {
                slug,
                title: create.title,
                contentMd: create.content,
                featureId: feature.id,
                status: "DRAFT",
              },
            });

            // Audit log
            await prisma.auditLog.create({
              data: {
                action: "smart-fix",
                entity: "scenario",
                entityId: scenario.id,
                details: JSON.stringify({
                  query,
                  fixType: "create",
                  title: create.title,
                  reason: create.reason,
                }),
              },
            });

            results.push({ type: "create-scenario", id: scenario.id, status: "applied" });
          } else if (create.entityType === "feature" && create.moduleSlug) {
            // Find parent module
            const mod = await prisma.module.findUnique({ where: { slug: create.moduleSlug } });
            if (!mod) {
              results.push({ type: "create-feature", id: create.title, status: "skipped", error: "Parent module not found" });
              continue;
            }

            const slug = create.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

            const existingFeature = await prisma.feature.findFirst({
              where: { slug, moduleId: mod.id },
            });
            if (existingFeature) {
              results.push({ type: "create-feature", id: slug, status: "skipped", error: "Feature already exists" });
              continue;
            }

            const feature = await prisma.feature.create({
              data: {
                slug,
                title: create.title,
                moduleId: mod.id,
                status: "DRAFT",
                contentMd: create.content,
              },
            });

            // Audit log
            await prisma.auditLog.create({
              data: {
                action: "smart-fix",
                entity: "feature",
                entityId: feature.id,
                details: JSON.stringify({
                  query,
                  fixType: "create",
                  title: create.title,
                  reason: create.reason,
                }),
              },
            });

            results.push({ type: "create-feature", id: feature.id, status: "applied" });
          } else {
            results.push({ type: "create", id: create.title, status: "skipped", error: "Invalid entity type or missing slugs" });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          results.push({ type: "create", id: create.title, status: "error", error: msg });
        }
      }
    }

    const applied = results.filter((r) => r.status === "applied").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      success: true,
      applied,
      skipped,
      errors,
      results,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Smart Fix Apply error:", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
