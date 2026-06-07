import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generate, generateWithVision } from "@/lib/llm-adapter";
import type { LLMConfig, VisionImage } from "@/lib/llm-adapter";
import { searchByText } from "@/lib/embed-pipeline";
import { fetchPage } from "@/lib/confluence";
import * as dbStore from "@/lib/db-store";
import { embedFeature, embedScenario } from "@/lib/embed-pipeline";
import { logAudit } from "@/lib/audit";

// ─── Types ──────────────────────────────────────────────

interface SourceItem {
  type: "text" | "confluence" | "image";
  content: string; // text content, page ID for confluence, base64 for image
  meta?: {
    pageTitle?: string;
    pageUrl?: string;
    mimeType?: string;
    fileName?: string;
  };
}

interface ClassifiedEntity {
  id: string; // client-side ID for tracking
  action: "create" | "append";
  entityType: "product" | "module" | "feature" | "scenario";
  targetSlug?: string; // for append — existing entity slug
  targetModuleSlug?: string; // parent module slug
  data: Record<string, unknown>;
  confidence: number; // 0-1
  reason: string;
}

// ─── Helpers ────────────────────────────────────────────

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

async function getKBStructure(): Promise<string> {
  const [products, modules, allFeatures] = await Promise.all([
    dbStore.getProducts(),
    dbStore.getModules(),
    dbStore.getAllFeatures(),
  ]);

  let ctx = "## Existing KB Structure\n\n";
  ctx += "### Products\n";
  for (const p of products) {
    ctx += `- ${p.name} (slug: ${p.slug})\n`;
  }
  ctx += "\n### Modules\n";
  for (const m of modules) {
    ctx += `- ${m.name} (slug: ${m.slug}, features: ${m.featureCount})\n`;
  }
  ctx += "\n### Features\n";
  for (const f of allFeatures) {
    ctx += `- ${f.feature} (slug: ${f.slug}, module: ${f.moduleSlug})\n`;
  }
  return ctx;
}

async function getGlossaryContext(): Promise<string> {
  const glossary = await prisma.glossaryEntry.findMany({
    select: { term: true, definition: true },
  });
  if (glossary.length === 0) return "";
  return (
    "\n## Glossary\n" +
    glossary.map((g) => `- **${g.term}**: ${g.definition}`).join("\n") +
    "\n"
  );
}

function buildClassificationPrompt(kbStructure: string, glossary: string, ragContext: string): string {
  return `You are an expert in FMCG/distribution enterprise software.
You analyze raw source material and classify it into structured Knowledge Base entities.

${kbStructure}
${glossary}
${ragContext}

Given the raw source material, determine:
1. Which KB entities should be created or updated
2. Whether the content maps to an existing product/module/feature or needs a new one
3. Extract all structured fields from the content

You MUST respond with a valid JSON object (no markdown fences, no explanation):
{
  "entities": [
    {
      "id": "e1",
      "action": "create" | "append",
      "entityType": "product" | "module" | "feature" | "scenario",
      "targetSlug": "existing-slug-if-appending",
      "targetModuleSlug": "parent-module-slug-for-features-and-scenarios",
      "data": {
        For product: { "name": "string", "overview": "string" }
        For module: { "name": "string", "overview": "string", "productSlugs": ["string"] }
        For feature: {
          "featureName": "string",
          "tags": ["string"],
          "whatItDoes": "string",
          "inScope": ["string"],
          "outOfScope": ["string"],
          "whoUsesIt": "string",
          "rules": ["string"],
          "acceptanceCriteria": [{"desc":"string","given":"string","when":"string","then":"string"}],
          "userFlows": [{"name":"string","steps":"string"}],
          "dataFields": [{"field":"string","description":"string","required":true/false,"example":"string"}],
          "edgeCases": ["string"],
          "openQuestions": ["string"]
        }
        For scenario: {
          "scenarioName": "string",
          "tags": ["string"],
          "userFlow": "string",
          "rules": ["string"],
          "additionalContent": "string"
        }
      },
      "confidence": 0.0 to 1.0,
      "reason": "string — why this classification was chosen"
    }
  ],
  "summary": "string — one-line summary of what was extracted"
}

Rules:
1. If content clearly describes an existing feature, use action "append" with the existing slug
2. If content describes something new, use action "create"
3. For "append", include ONLY the new information to add (not duplicates)
4. Be conservative — prefer fewer, well-structured entities over many vague ones
5. Use the glossary for consistent terminology
6. Include a confidence score (0-1) for each entity
7. Rules must be testable statements
8. Generate slugs for new entities: lowercase, hyphenated`;
}

// ─── Classify ───────────────────────────────────────────

async function classifySources(
  sources: SourceItem[],
  llmConfig: LLMConfig
): Promise<{ entities: ClassifiedEntity[]; summary: string }> {
  // Step 1: Resolve all sources to text
  const resolvedTexts: string[] = [];
  const images: VisionImage[] = [];

  for (const source of sources) {
    switch (source.type) {
      case "text":
        resolvedTexts.push(source.content);
        break;

      case "confluence": {
        try {
          const page = await fetchPage(source.content);
          resolvedTexts.push(
            `## Confluence Page: ${page.title}\n\n${page.body}`
          );
        } catch (err) {
          resolvedTexts.push(
            `[Failed to fetch Confluence page ${source.content}: ${err instanceof Error ? err.message : String(err)}]`
          );
        }
        break;
      }

      case "image": {
        images.push({
          base64: source.content,
          mimeType: source.meta?.mimeType || "image/png",
        });
        break;
      }
    }
  }

  // Step 2: If we have images, describe them via vision first
  if (images.length > 0) {
    try {
      const visionResult = await generateWithVision(llmConfig, {
        systemPrompt: `You are an expert at extracting requirements from screenshots and diagrams.
Describe the content of these images in detail, focusing on:
- UI elements and their purpose
- Logic shown
- Data fields visible
- User flows depicted
- Any text visible in the image

Output as detailed plain text, not JSON.`,
        userPrompt: "Describe the content in these images in detail.",
        images,
        temperature: 0.2,
        maxTokens: 2000,
      });
      resolvedTexts.push(`## Content Extracted from Images\n\n${visionResult.text}`);
    } catch (err) {
      resolvedTexts.push(`[Image processing failed: ${err instanceof Error ? err.message : String(err)}]`);
    }
  }

  const combinedText = resolvedTexts.join("\n\n---\n\n");

  // Step 3: Get KB context
  const [kbStructure, glossary, ragResults] = await Promise.all([
    getKBStructure(),
    getGlossaryContext(),
    searchByText(combinedText.slice(0, 500), llmConfig, 5).catch(() => []),
  ]);

  const ragContext = ragResults.length > 0
    ? "\n## Related KB Content\n" + ragResults.map((r) => `### ${r.section}\n${r.chunkText}`).join("\n\n")
    : "";

  // Step 4: Classify with LLM
  const systemPrompt = buildClassificationPrompt(kbStructure, glossary, ragContext);
  const result = await generate(llmConfig, {
    systemPrompt,
    userPrompt: `Analyze and classify this source material into KB entities:\n\n${combinedText}`,
    temperature: 0.2,
    maxTokens: 6000,
  });

  // Parse response
  const parsed = parseJSON(result.text);
  if (parsed && typeof parsed === "object" && "entities" in (parsed as Record<string, unknown>)) {
    const obj = parsed as { entities: ClassifiedEntity[]; summary: string };
    return {
      entities: obj.entities || [],
      summary: obj.summary || "Content classified",
    };
  }

  return { entities: [], summary: "Failed to classify content" };
}

// ─── Apply ──────────────────────────────────────────────

async function applyEntities(
  entities: ClassifiedEntity[],
  llmConfig: LLMConfig,
  userId?: string
): Promise<{ applied: Array<{ id: string; entityType: string; slug: string; success: boolean; error?: string }> }> {
  const applied: Array<{ id: string; entityType: string; slug: string; success: boolean; error?: string }> = [];

  for (const entity of entities) {
    try {
      switch (entity.entityType) {
        case "product": {
          const d = entity.data as { name: string; overview?: string };
          const slug = entity.targetSlug || slugify(d.name);
          await dbStore.saveProduct(slug, d.name, d.overview || "");
          await logAudit(userId || null, "ingested", "product", slug, JSON.stringify({ name: d.name, action: entity.action }));
          applied.push({ id: entity.id, entityType: "product", slug, success: true });
          break;
        }

        case "module": {
          const d = entity.data as { name: string; overview?: string; productSlugs?: string[] };
          const slug = entity.targetSlug || slugify(d.name);
          await dbStore.saveModule(slug, d.name, d.overview || "", d.productSlugs || []);
          await logAudit(userId || null, "ingested", "module", slug, JSON.stringify({ name: d.name, action: entity.action }));
          applied.push({ id: entity.id, entityType: "module", slug, success: true });
          break;
        }

        case "feature": {
          const d = entity.data as Record<string, unknown>;
          const featureName = (d.featureName || d.name) as string;
          const moduleSlug = entity.targetModuleSlug || "";
          const featureSlug = entity.targetSlug || slugify(featureName);

          if (!moduleSlug) {
            applied.push({ id: entity.id, entityType: "feature", slug: featureSlug, success: false, error: "No module specified" });
            continue;
          }

          // Build contentMd from structured fields
          const sections: Record<string, string> = {};
          if (d.whatItDoes) sections["What It Does"] = d.whatItDoes as string;
          if (d.inScope && Array.isArray(d.inScope)) {
            sections["Scope"] = `### In Scope\n${(d.inScope as string[]).map((s) => `- ${s}`).join("\n")}`;
            if (d.outOfScope && Array.isArray(d.outOfScope)) {
              sections["Scope"] += `\n\n### Out of Scope\n${(d.outOfScope as string[]).map((s) => `- ${s}`).join("\n")}`;
            }
          }
          if (d.whoUsesIt) sections["Who Uses It"] = d.whoUsesIt as string;
          if (d.rules && Array.isArray(d.rules)) {
            sections["Rules"] = (d.rules as string[]).map((r, i) => `${i + 1}. ${r}`).join("\n");
          }
          if (d.acceptanceCriteria && Array.isArray(d.acceptanceCriteria)) {
            sections["Acceptance Criteria"] = (d.acceptanceCriteria as Array<{ desc: string; given: string; when: string; then: string }>)
              .map((ac, i) => `### AC-${String(i + 1).padStart(3, "0")}: ${ac.desc}\n- **Given** ${ac.given}\n- **When** ${ac.when}\n- **Then** ${ac.then}`)
              .join("\n\n");
          }
          if (d.userFlows && Array.isArray(d.userFlows)) {
            sections["User Flows"] = (d.userFlows as Array<{ name: string; steps: string }>)
              .map((f) => `### ${f.name}\n${f.steps}`)
              .join("\n\n");
          }
          if (d.dataFields && Array.isArray(d.dataFields)) {
            const header = "| Field | Description | Required | Example |\n|-------|-------------|----------|---------|";
            const rows = (d.dataFields as Array<{ field: string; description: string; required: boolean; example: string }>)
              .map((f) => `| ${f.field} | ${f.description} | ${f.required ? "Yes" : "No"} | ${f.example} |`)
              .join("\n");
            sections["Data & Fields"] = `${header}\n${rows}`;
          }
          if (d.edgeCases && Array.isArray(d.edgeCases)) {
            sections["Edge Cases & Exceptions"] = (d.edgeCases as string[]).map((e) => `- ${e}`).join("\n");
          }
          if (d.openQuestions && Array.isArray(d.openQuestions)) {
            sections["Open Questions"] = (d.openQuestions as string[]).map((q) => `- [ ] ${q}`).join("\n");
          }

          const contentMd = Object.entries(sections)
            .map(([heading, text]) => `## ${heading}\n${text}`)
            .join("\n\n");

          const feature = await dbStore.saveFeature(moduleSlug, featureSlug, {
            title: featureName,
            status: "DRAFT",
            contentMd,
            tags: (d.tags as string[]) || [],
            completeness: 0,
          });

          // Auto-embed
          if (contentMd) {
            embedFeature(
              feature.id,
              contentMd,
              { productSlug: moduleSlug, moduleSlug, featureSlug, featureTitle: featureName },
              llmConfig
            ).catch((e) => console.error(`❌ Embed failed for ${featureName}:`, e));
          }

          await logAudit(userId || null, "ingested", "feature", feature.id, JSON.stringify({ name: featureName, moduleSlug, action: entity.action }));
          applied.push({ id: entity.id, entityType: "feature", slug: featureSlug, success: true });
          break;
        }

        case "scenario": {
          const d = entity.data as Record<string, unknown>;
          const scenarioName = (d.scenarioName || d.name) as string;
          const moduleSlug = entity.targetModuleSlug || "";
          const featureSlug = entity.targetSlug || "";
          const scenarioSlug = slugify(scenarioName);

          if (!moduleSlug || !featureSlug) {
            applied.push({
              id: entity.id,
              entityType: "scenario",
              slug: scenarioSlug,
              success: false,
              error: "Missing module or feature slug",
            });
            continue;
          }

          // Build scenario content
          let contentMd = "";
          if (d.userFlow) contentMd += `## User Flow\n${d.userFlow}\n\n`;
          if (d.rules && Array.isArray(d.rules)) {
            contentMd += `## Rules\n${(d.rules as string[]).map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\n`;
          }
          if (d.additionalContent) contentMd += d.additionalContent as string;

          const scenario = await dbStore.saveScenario(moduleSlug, featureSlug, scenarioSlug, {
            title: scenarioName,
            contentMd: contentMd.trim(),
            status: "DRAFT",
            tags: (d.tags as string[]) || [],
          });

          // Auto-embed scenario
          if (contentMd.trim()) {
            const feature = await prisma.feature.findFirst({
              where: { slug: featureSlug, module: { slug: moduleSlug } },
            });
            if (feature) {
              embedScenario(
                feature.id,
                scenarioSlug,
                scenarioName,
                contentMd,
                { productSlug: moduleSlug, moduleSlug, featureSlug, featureTitle: feature.title },
                llmConfig
              ).catch((e) => console.error(`❌ Scenario embed failed for ${scenarioName}:`, e));
            }
          }

          await logAudit(userId || null, "ingested", "scenario", scenario.id, JSON.stringify({ name: scenarioName, moduleSlug, featureSlug, action: entity.action }));
          applied.push({ id: entity.id, entityType: "scenario", slug: scenarioSlug, success: true });
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      applied.push({ id: entity.id, entityType: entity.entityType, slug: entity.targetSlug || "", success: false, error: msg });
    }
  }

  return { applied };
}

// ─── Route Handler ──────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const llmConfig = await getLLMConfig();
    if (!llmConfig) {
      return NextResponse.json(
        { error: "LLM not configured. Go to Admin → LLM Config." },
        { status: 400 }
      );
    }

    switch (action) {
      // ─── Classify ─────────────────────────────────
      case "classify": {
        const { sources } = body as { sources: SourceItem[] };
        if (!sources || !Array.isArray(sources) || sources.length === 0) {
          return NextResponse.json({ error: "No sources provided" }, { status: 400 });
        }

        const result = await classifySources(sources, llmConfig);

        // Persist the job
        const job = await prisma.ingestionJob.create({
          data: {
            status: "classified",
            sources: JSON.parse(JSON.stringify(sources)),
            classified: JSON.parse(JSON.stringify(result)),
          },
        });

        return NextResponse.json({
          jobId: job.id,
          entities: result.entities,
          summary: result.summary,
        });
      }

      // ─── Confirm & Apply ──────────────────────────
      case "confirm": {
        const { jobId, entities } = body as {
          jobId: string;
          entities: ClassifiedEntity[];
        };

        if (!jobId || !entities || entities.length === 0) {
          return NextResponse.json(
            { error: "Missing jobId or entities" },
            { status: 400 }
          );
        }

        // Verify job exists
        const job = await prisma.ingestionJob.findUnique({
          where: { id: jobId },
        });
        if (!job) {
          return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        const result = await applyEntities(entities, llmConfig);

        // Update job status
        await prisma.ingestionJob.update({
          where: { id: jobId },
          data: {
            status: "applied",
            appliedIds: JSON.parse(JSON.stringify(result.applied)),
          },
        });

        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Ingest API]", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Utilities ──────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseJSON(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
