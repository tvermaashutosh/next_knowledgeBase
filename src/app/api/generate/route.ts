import { NextRequest, NextResponse } from "next/server";
import { searchByText, assembleContext } from "@/lib/embed-pipeline";
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

// POST: Generate with RAG (Retrieval-Augmented Generation)
export async function POST(request: NextRequest) {
  try {
    const { query, product, tenant, topK = 10, excludeChunkIds = [], customSystemPrompt } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "Missing 'query' field" }, { status: 400 });
    }

    const llmConfig = await getLLMConfig();
    if (!llmConfig) {
      return NextResponse.json({ error: "LLM not configured. Go to Admin → LLM Config." }, { status: 400 });
    }

    // 1. Search for relevant chunks
    const searchResults = await searchByText(query, llmConfig, topK, product);

    // 2. Get global glossary for context
    const glossary = await prisma.glossaryEntry.findMany({
      select: { term: true, definition: true },
    });

    // 3. Get feature-level glossaryTerms for the features returned in search results
    const featureIds = [...new Set(searchResults.map((r) => r.featureId))];
    type GlossaryTerm = { term: string; definition: string; dontSay?: string[] };

    const featureGlossaryTerms: { featureTitle: string; terms: GlossaryTerm[] }[] = [];
    if (featureIds.length > 0) {
      const features = await prisma.feature.findMany({
        where: { id: { in: featureIds } },
        select: { id: true, title: true, glossaryTerms: true },
      });
      for (const f of features) {
        const terms = (f.glossaryTerms as GlossaryTerm[] | null) || [];
        if (terms.length > 0) {
          featureGlossaryTerms.push({ featureTitle: f.title, terms });
        }
      }
    }

    // 4. Get tenant overrides (feature-level + scenario-level) if tenant selected
    let tenantContext = "";
    let tenantOverridesCount = 0;
    const scenarioOverridesList: { tenantName: string; tenantSlug: string; scenarioTitle: string; scenarioSlug: string; featureTitle: string; featureSlug: string; moduleName: string; moduleSlug: string; contentMd: string }[] = [];

    if (tenant) {
      // 4a. Feature-level overrides — fetch ALL for this tenant
      // (not limited to search results, because the user explicitly selected a tenant)
      const overrides = await prisma.tenantOverride.findMany({
        where: { tenant: { slug: tenant } },
        include: {
          feature: { select: { id: true, title: true, slug: true } },
          tenant: { select: { name: true } },
        },
      });

      if (overrides.length > 0) {
        const tenantName = overrides[0].tenant.name;

        // Split into: overrides for features in search results (high priority) vs others
        const relevantOverrides = overrides.filter((o) => featureIds.includes(o.feature.id));
        const otherOverrides = overrides.filter((o) => !featureIds.includes(o.feature.id));

        if (relevantOverrides.length > 0) {
          tenantContext += `\n## Tenant-Specific Feature Overrides (${tenantName}) — Directly Relevant\n\n`;
          tenantContext += `> These overrides apply specifically for tenant "${tenantName}" and match the features found in context.\n`;
          tenantContext += `> These take PRIORITY over the default feature behavior described above.\n\n`;
          for (const o of relevantOverrides) {
            tenantContext += `### Override: ${o.feature.title}\n`;
            tenantContext += o.contentMd + "\n\n";
            tenantOverridesCount++;
          }
        }

        if (otherOverrides.length > 0) {
          tenantContext += `\n## Other Tenant Overrides (${tenantName})\n\n`;
          tenantContext += `> Additional feature overrides for this tenant (may be relevant to the question).\n\n`;
          for (const o of otherOverrides) {
            tenantContext += `### Override: ${o.feature.title}\n`;
            tenantContext += o.contentMd + "\n\n";
            tenantOverridesCount++;
          }
        }
      }

      // 4b. Scenario-level overrides — fetch ALL for this tenant
      // Previously filtered by featureIds from search, which caused overrides to be missed
      // when the parent feature wasn't in the RAG results
      const scenarioOverrides = await prisma.scenarioOverride.findMany({
        where: {
          tenant: { slug: tenant },
        },
        include: {
          tenant: { select: { name: true, slug: true } },
          scenario: {
            select: {
              title: true, slug: true,
              feature: { select: { id: true, title: true, slug: true, module: { select: { name: true, slug: true } } } },
            },
          },
        },
      });

      for (const so of scenarioOverrides) {
        scenarioOverridesList.push({
          tenantName: so.tenant.name,
          tenantSlug: so.tenant.slug,
          scenarioTitle: so.scenario.title,
          scenarioSlug: so.scenario.slug,
          featureTitle: so.scenario.feature.title,
          featureSlug: so.scenario.feature.slug,
          moduleName: so.scenario.feature.module.name,
          moduleSlug: so.scenario.feature.module.slug,
          contentMd: so.contentMd,
        });
        tenantOverridesCount++;
      }
    }

    // 5. Assemble context (with chunk exclusion, feature glossaryTerms, scenario overrides)
    const { context, usedChunks } = assembleContext(
      searchResults,
      excludeChunkIds,
      glossary,
      {
        featureGlossaryTerms,
        scenarioOverrides: scenarioOverridesList,
      }
    );

    // 6. Build system prompt — base context + tenant feature overrides
    const fullContext = context + tenantContext;

    const systemPrompt = customSystemPrompt
      ? customSystemPrompt + "\n\n" + fullContext
      : `You are an expert in FMCG/distribution software.
You write precise, structured requirements documentation.
Use the Knowledge Base context below to answer the user's question.
If tenant-specific overrides are present, they take PRIORITY over default behavior.
Feature-specific terms in the glossary define exact terminology — use these in your answer.
If the context doesn't contain enough information, say so clearly.
Always cite which feature/section your answer is based on.

${fullContext}`;

    // 7. Generate
    const result = await generate(llmConfig, {
      systemPrompt,
      userPrompt: query,
    });

    // 8. Enrich chunks with product/feature/scenario metadata
    const featureLookup = await prisma.feature.findMany({
      where: { id: { in: featureIds } },
      select: { id: true, title: true, slug: true, module: { select: { name: true, slug: true, products: { include: { product: { select: { name: true, slug: true } } } } } } },
    });
    const featureMap = new Map(featureLookup.map((f) => [f.id, f]));

    const enrichedChunks = usedChunks.map((c) => {
      const feature = featureMap.get(c.featureId);
      // Parse section to detect scenario chunks (section format: "scenario:<slug>:<section>" or just "<section>")
      const sectionParts = c.section.split(":");
      const isScenario = sectionParts.length >= 2 && c.section.startsWith("scenario:");
      const scenarioSlug = isScenario ? sectionParts[1] : null;
      const sectionName = isScenario ? sectionParts.slice(2).join(":") || "Overview" : c.section;

      // Prefer the product the user selected; fall back to first linked product
      const matchedProduct = product
        ? feature?.module?.products?.find((p) => p.product.slug === product)?.product
        : null;
      const displayProduct = matchedProduct || feature?.module?.products?.[0]?.product;

      return {
        id: c.id,
        featureId: c.featureId,
        section: c.section,
        chunkText: c.chunkText,
        similarity: c.similarity,
        // Enriched metadata
        moduleName: feature?.module?.name || "Unknown",
        moduleSlug: feature?.module?.slug || "",
        productName: displayProduct?.name || "Unknown",
        productSlug: displayProduct?.slug || "",
        featureTitle: feature?.title || "Unknown",
        featureSlug: feature?.slug || "",
        scenarioSlug,
        sectionName,
        type: isScenario ? "scenario" : "feature",
        tenantSlug: null as string | null,
      };
    });

    // Add tenant override entries as virtual chunks for visibility
    if (tenant && tenantOverridesCount > 0) {
      // Feature overrides
      const featureOverrideEntries = await prisma.tenantOverride.findMany({
        where: { tenant: { slug: tenant } },
        include: {
          feature: { select: { id: true, title: true, slug: true, module: { select: { name: true, slug: true, products: { include: { product: { select: { name: true, slug: true } } } } } } } },
          tenant: { select: { name: true } },
        },
      });
      for (const fo of featureOverrideEntries) {
        enrichedChunks.push({
          id: `override-feature-${fo.id}`,
          featureId: fo.feature.id,
          section: `override:${fo.feature.slug}`,
          chunkText: fo.contentMd,
          similarity: 1.0,
          moduleName: fo.feature.module.name,
          moduleSlug: fo.feature.module.slug,
          productName: fo.feature.module.products?.[0]?.product?.name || "",
          productSlug: fo.feature.module.products?.[0]?.product?.slug || "",
          featureTitle: fo.feature.title,
          featureSlug: fo.feature.slug,
          scenarioSlug: null,
          sectionName: `🏢 ${fo.tenant.name} Override`,
          type: "override" as const,
          tenantSlug: tenant,
        });
      }

      // Scenario overrides
      for (const so of scenarioOverridesList) {
        enrichedChunks.push({
          id: `override-scenario-${so.scenarioSlug}`,
          featureId: "",
          section: `override:scenario:${so.scenarioSlug}`,
          chunkText: so.contentMd,
          similarity: 1.0,
          moduleName: so.moduleName,
          moduleSlug: so.moduleSlug,
          productName: so.moduleName,       // Use module name as product fallback
          productSlug: so.moduleSlug,
          featureTitle: so.featureTitle,
          featureSlug: so.featureSlug,
          scenarioSlug: so.scenarioSlug,
          sectionName: `🏢 ${so.tenantName} Scenario Override`,
          type: "override" as const,
          tenantSlug: so.tenantSlug,
        });
      }
    }

    return NextResponse.json({
      output: result.text,
      usage: result.usage,
      model: `${llmConfig.generationProvider}/${llmConfig.generationModel}`,
      tenant: tenant || null,
      tenantOverrides: tenantOverridesCount,
      contextChunks: enrichedChunks,
      totalChunksFound: searchResults.length,
      chunksUsed: usedChunks.length,
      chunksExcluded: excludeChunkIds.length,
    });
  } catch (error) {
    console.error("Generate error:", error);
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
