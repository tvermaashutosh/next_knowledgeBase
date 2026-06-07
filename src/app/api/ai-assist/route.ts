import { NextRequest, NextResponse } from "next/server";
import { searchByText } from "@/lib/embed-pipeline";
import { generate } from "@/lib/llm-adapter";
import { prisma } from "@/lib/db";
import type { LLMConfig } from "@/lib/llm-adapter";

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

async function getGlossaryContext(): Promise<string> {
  const glossary = await prisma.glossaryEntry.findMany({
    select: { term: true, definition: true },
  });
  if (glossary.length === 0) return "";
  return (
    "## Glossary\n" +
    glossary.map((g) => `- **${g.term}**: ${g.definition}`).join("\n") +
    "\n\n"
  );
}

async function getRAGContext(
  query: string,
  llmConfig: LLMConfig,
  productSlug?: string,
  topK = 8
): Promise<string> {
  try {
    const results = await searchByText(query, llmConfig, topK, productSlug);
    if (results.length === 0) return "";
    return (
      "## Related Knowledge Base Content\n\n" +
      results
        .map(
          (r) =>
            `### ${r.section} (similarity: ${(r.similarity * 100).toFixed(1)}%)\n${r.chunkText}`
        )
        .join("\n\n") +
      "\n\n"
    );
  } catch {
    return "";
  }
}

async function getFeatureContent(
  moduleSlug: string,
  featureSlug: string
): Promise<{ title: string; contentMd: string; globalContext: unknown; glossaryTerms: unknown } | null> {
  const feature = await prisma.feature.findFirst({
    where: {
      slug: featureSlug,
      module: { slug: moduleSlug },
    },
    select: {
      title: true,
      contentMd: true,
      globalContext: true,
    },
  });
  if (!feature) return null;
  return { ...feature, glossaryTerms: [] };
}

async function getScenarios(
  moduleSlug: string,
  featureSlug: string
): Promise<{ title: string; slug: string; contentMd: string }[]> {
  const feature = await prisma.feature.findFirst({
    where: { slug: featureSlug, module: { slug: moduleSlug } },
    select: { id: true },
  });
  if (!feature) return [];
  return prisma.scenario.findMany({
    where: { featureId: feature.id },
    select: { title: true, slug: true, contentMd: true },
  });
}

async function getTenantOverview(tenantSlug: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { name: true, overview: true },
  });
  if (!tenant) return "";
  return `Tenant: ${tenant.name}\nOverview: ${tenant.overview}`;
}

// ─── System Prompts ─────────────────────────────────────

const COMMON_ROLE = `You are an expert in FMCG/distribution enterprise software.
You write precise, structured, testable requirements documentation.
Accuracy is paramount — only state what can be reasonably inferred from the input.
If something is uncertain, add it to openQuestions rather than guessing.
Use the glossary and KB context (if provided) to ensure terminology consistency.`;

function buildDraftFeaturePrompt(ragContext: string, glossary: string): string {
  return `${COMMON_ROLE}

Given a natural language description of a software feature, generate structured documentation as a JSON object.

${glossary}${ragContext}

You MUST respond with a valid JSON object (no markdown fences, no explanation, just JSON) with these keys:
{
  "featureName": "string — concise title",
  "module": "string — which module/area this belongs to (e.g., Sales & Trade, Inventory, Finance)",
  "tags": ["string array — relevant keywords"],
  "whatItDoes": "string — 2-3 sentence summary",
  "inScope": ["string array — what this feature handles, one bullet per item"],
  "outOfScope": ["string array — what this feature does NOT do"],
  "whoUsesIt": "string — markdown with **Role** — description format",
  "rules": ["string array — clear, testable statements. Aim for 5-10 rules."],
  "acceptanceCriteria": [{"desc":"string","given":"string","when":"string","then":"string"}],
  "userFlows": [{"name":"string — flow title","steps":"string — numbered steps"}],
  "dataFields": [{"field":"string","description":"string","required":true/false,"example":"string"}],
  "domainEvents": "string — markdown table with Event | When It Happens | Who Cares columns",
  "productBehavior": "string — standard behavior that applies to all tenants",
  "tenantConfigurable": true/false,
  "tenantConfigs": [{"configPoint":"string","options":"string","defaultValue":"string","example":"string"}],
  "edgeCases": ["string array — When [X] → [System should Y] format"],
  "examples": "string — real-world example scenarios in markdown",
  "openQuestions": ["string array — anything that's unclear or needs clarification"],
  "glossaryTerms": [{"term":"string","definition":"string","dontSay":"string — comma-separated alternatives to avoid"}]
}

Rules:
1. Rules must be testable: "X must/must not Y when Z"
2. Acceptance criteria must use Given/When/Then format
3. User flows must have numbered steps
4. Data fields: include realistic examples
5. Edge cases: use "When [X] → [System should Y]" format
6. If uncertain about something, put it in openQuestions
7. Be comprehensive but don't fabricate rules that aren't implied by the description`;
}

function buildDraftScenarioPrompt(
  featureContent: string,
  ragContext: string,
  glossary: string
): string {
  return `${COMMON_ROLE}

Given a description of a specific scenario/use case that belongs to a feature, generate structured documentation.

## Parent Feature Documentation
${featureContent}

${glossary}${ragContext}

You MUST respond with a valid JSON object (no markdown fences, no explanation, just JSON) with these keys:
{
  "scenarioName": "string — concise title",
  "tags": ["string array — keywords"],
  "userFlow": "string — numbered steps for this specific scenario",
  "rules": ["string array — rules specific to this scenario"],
  "additionalContent": "string — edge cases, configuration, examples in markdown format"
}

Rules:
1. The scenario should be consistent with the parent feature's rules
2. Focus on what's SPECIFIC to this scenario, don't repeat the parent feature's general content
3. Use the same terminology as the parent feature
4. Rules should be testable
5. Include edge cases specific to this scenario in additionalContent`;
}

function buildSuggestSectionPrompt(
  section: string,
  currentForm: Record<string, unknown>,
  ragContext: string,
  glossary: string
): string {
  const contextMap: Record<string, string[]> = {
    rules: ["whatItDoes", "inScope", "whoUsesIt"],
    acceptanceCriteria: ["rules", "userFlows", "whatItDoes"],
    userFlows: ["whatItDoes", "rules", "whoUsesIt"],
    dataFields: ["whatItDoes", "rules", "userFlows"],
    edgeCases: ["rules", "userFlows", "acceptanceCriteria"],
    domainEvents: ["userFlows", "rules"],
    openQuestions: ["whatItDoes", "rules", "edgeCases"],
    glossaryTerms: ["whatItDoes", "rules", "productBehavior"],
    tenantConfigs: ["rules", "productBehavior"],
    inScope: ["whatItDoes", "whoUsesIt"],
    outOfScope: ["whatItDoes", "inScope"],
    whoUsesIt: ["whatItDoes", "inScope"],
    examples: ["rules", "userFlows", "edgeCases"],
    productBehavior: ["whatItDoes", "rules"],
  };

  const relevantKeys = contextMap[section] || Object.keys(currentForm);
  const formContext = relevantKeys
    .filter((k) => currentForm[k])
    .map((k) => {
      const val = currentForm[k];
      const display = Array.isArray(val) ? JSON.stringify(val) : String(val);
      return `### ${k}\n${display}`;
    })
    .join("\n\n");

  // Show existing content for this section if any
  const existingContent = currentForm[section];
  const existingNote = existingContent
    ? `\n\n## Already Written for ${section}\n${Array.isArray(existingContent) ? JSON.stringify(existingContent) : String(existingContent)}\n\nDo NOT duplicate these. Only add NEW items that are missing.`
    : "";

  const formatHints: Record<string, string> = {
    rules: 'Return a JSON array of strings. Each rule should be testable: "X must/must not Y when Z".',
    acceptanceCriteria:
      'Return a JSON array of objects: [{"desc":"string","given":"string","when":"string","then":"string"}].',
    userFlows:
      'Return a JSON array of objects: [{"name":"string","steps":"string with numbered steps"}].',
    dataFields:
      'Return a JSON array of objects: [{"field":"string","description":"string","required":true/false,"example":"string"}].',
    edgeCases:
      'Return a JSON array of strings in "When [X] → [System should Y]" format.',
    domainEvents: "Return a string containing a markdown table: | Event | When It Happens | Who Cares |",
    openQuestions: "Return a JSON array of strings — each a question that needs clarification.",
    glossaryTerms:
      'Return a JSON array of objects: [{"term":"string","definition":"string","dontSay":"string"}].',
    tenantConfigs:
      'Return a JSON array of objects: [{"configPoint":"string","options":"string","defaultValue":"string","example":"string"}].',
    inScope: "Return a JSON array of strings — each an in-scope capability.",
    outOfScope: "Return a JSON array of strings — each an out-of-scope item.",
    whoUsesIt: 'Return a string with **Role** — description format, one per line.',
    examples: "Return a string with real-world example scenarios in markdown format.",
    productBehavior: "Return a string describing standard behavior that applies to all tenants.",
  };

  return `${COMMON_ROLE}

You are helping fill out the "${section}" section of a feature document.

## Context from other sections
${formContext}

${glossary}${ragContext}${existingNote}

${formatHints[section] || `Return content appropriate for the "${section}" section.`}

Respond with ONLY the data — no explanation, no markdown fences. Just the raw JSON or string as specified above.`;
}

function buildSuggestScenariosPrompt(featureContent: string): string {
  return `${COMMON_ROLE}

Given a feature's documentation, suggest distinct scenarios/use cases that should be documented separately.
Each scenario should cover a specific workflow or variation of the feature.

## Feature Documentation
${featureContent}

You MUST respond with a valid JSON array (no markdown fences, no explanation) of objects:
[
  {
    "title": "string — concise scenario title",
    "description": "string — one sentence explaining what this scenario covers",
    "priority": "high" | "medium" | "low"
  }
]

Rules:
1. Suggest 5-10 scenarios covering the main use cases
2. Include both happy paths and important edge case scenarios
3. Each scenario should be distinct — no overlap
4. Order by priority (high first)
5. Consider: CRUD operations, approval flows, error handling, batch operations, reports
6. Don't suggest scenarios that are too granular (single field validation) or too broad (entire feature)`;
}

function buildDraftOverridePrompt(
  standardContent: string,
  tenantOverview: string,
  existingOverrides: string
): string {
  return `${COMMON_ROLE}

You need to document how a feature/scenario behaves DIFFERENTLY for a specific tenant.

## Standard Feature/Scenario Documentation
${standardContent}

## Tenant Information
${tenantOverview}

${existingOverrides ? `## Existing Overrides for This Tenant (other features)\n${existingOverrides}\n\n` : ""}

Given the description of what's different, generate a structured override document in markdown format.

Structure your response as:
## Configuration Differences
(Table: | Setting | Standard | This Tenant | with actual values)

## Custom Rules
(Numbered list of tenant-specific rules)

## Impact on User Flow
(Which steps change and how)

## Special Notes
(Any other important differences)

Only include sections that are relevant based on the description. 
Respond with ONLY the markdown content — no fences, no explanation.`;
}

function buildReviewQualityPrompt(): string {
  return `${COMMON_ROLE}

Review the following feature/scenario documentation for quality. Check:

1. **Completeness** — are important sections empty or too thin?
2. **Testability** — are rules and ACs testable? Do ACs use Given/When/Then?
3. **Consistency** — do any rules contradict each other?
4. **Terminology** — are domain terms used consistently? Any terms that should be in the glossary?
5. **Coverage** — are there obvious edge cases missing?

You MUST respond with a valid JSON array (no markdown fences) of review items:
[
  {
    "type": "warning" | "suggestion" | "success",
    "section": "string — which section this applies to",
    "message": "string — clear description of the issue or praise"
  }
]

Rules:
1. Be specific and actionable in your feedback
2. Include at least 2-3 "success" items for things done well
3. Don't nitpick — focus on substantive issues
4. Order: warnings first, then suggestions, then successes`;
}

function buildRefinePrompt(section: string, currentContent: string): string {
  return `${COMMON_ROLE}

Refine the "${section}" section of the feature documentation.

## Current Content
${currentContent}

Apply the instruction to modify this content. Return ONLY the updated content in the same format as the current content (if it's a JSON array, return a JSON array; if it's a string, return a string). No explanation, no markdown fences.`;
}

function buildDraftProductPrompt(): string {
  return `${COMMON_ROLE}

Given a description of a software product, generate a structured product overview.

You MUST respond with a valid JSON object (no markdown fences, no explanation):
{
  "name": "string — the product's proper name",
  "overview": "string — 3-5 sentence overview: what it does, who it's for, key capabilities"
}`;
}

function buildDraftTenantPrompt(): string {
  return `${COMMON_ROLE}

Given a description of a tenant/client, generate a structured tenant profile.

You MUST respond with a valid JSON object (no markdown fences, no explanation):
{
  "name": "string — the tenant's proper name",
  "overview": "string — 3-5 sentence overview: region, channel, contract type, key differences, special requirements"
}`;
}

// ─── Main Handler ───────────────────────────────────────

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
      // ─── Draft Feature ──────────────────────────────
      case "draft-feature": {
        const { description, productSlug } = body;
        if (!description) {
          return NextResponse.json({ error: "Missing description" }, { status: 400 });
        }

        const [ragContext, glossary] = await Promise.all([
          getRAGContext(description, llmConfig, productSlug),
          getGlossaryContext(),
        ]);

        const systemPrompt = buildDraftFeaturePrompt(ragContext, glossary);
        const result = await generate(llmConfig, {
          systemPrompt,
          userPrompt: description,
          temperature: 0.3,
          maxTokens: 4096,
        });

        const parsed = parseJSON(result.text);
        return NextResponse.json({ data: parsed, usage: result.usage });
      }

      // ─── Draft Scenario ─────────────────────────────
      case "draft-scenario": {
        const { description, productSlug, featureSlug } = body;
        if (!description || !productSlug || !featureSlug) {
          return NextResponse.json(
            { error: "Missing description, productSlug, or featureSlug" },
            { status: 400 }
          );
        }

        const feature = await getFeatureContent(productSlug, featureSlug);
        const featureContent = feature
          ? `# ${feature.title}\n${feature.contentMd}`
          : "No parent feature documentation available.";

        const [ragContext, glossary] = await Promise.all([
          getRAGContext(description, llmConfig, productSlug),
          getGlossaryContext(),
        ]);

        const systemPrompt = buildDraftScenarioPrompt(featureContent, ragContext, glossary);
        const result = await generate(llmConfig, {
          systemPrompt,
          userPrompt: description,
          temperature: 0.3,
          maxTokens: 3000,
        });

        const parsed = parseJSON(result.text);
        return NextResponse.json({ data: parsed, usage: result.usage });
      }

      // ─── Draft Product ──────────────────────────────
      case "draft-product": {
        const { description } = body;
        if (!description) {
          return NextResponse.json({ error: "Missing description" }, { status: 400 });
        }

        const systemPrompt = buildDraftProductPrompt();
        const result = await generate(llmConfig, {
          systemPrompt,
          userPrompt: description,
          temperature: 0.2,
          maxTokens: 500,
        });

        const parsed = parseJSON(result.text);
        return NextResponse.json({ data: parsed, usage: result.usage });
      }

      // ─── Draft Tenant ───────────────────────────────
      case "draft-tenant": {
        const { description } = body;
        if (!description) {
          return NextResponse.json({ error: "Missing description" }, { status: 400 });
        }

        const systemPrompt = buildDraftTenantPrompt();
        const result = await generate(llmConfig, {
          systemPrompt,
          userPrompt: description,
          temperature: 0.2,
          maxTokens: 500,
        });

        const parsed = parseJSON(result.text);
        return NextResponse.json({ data: parsed, usage: result.usage });
      }

      // ─── Draft Override ─────────────────────────────
      case "draft-override": {
        const { description, tenantSlug, productSlug, featureSlug, scenarioSlug } = body;
        if (!description || !tenantSlug || !featureSlug) {
          return NextResponse.json(
            { error: "Missing description, tenantSlug, or featureSlug" },
            { status: 400 }
          );
        }

        // Get standard content
        let standardContent = "";
        if (scenarioSlug) {
          const scenarios = await getScenarios(productSlug, featureSlug);
          const sc = scenarios.find((s) => s.slug === scenarioSlug);
          standardContent = sc ? `# ${sc.title}\n${sc.contentMd}` : "";
        } else {
          const feature = await getFeatureContent(productSlug, featureSlug);
          standardContent = feature ? `# ${feature.title}\n${feature.contentMd}` : "";
        }

        // Get tenant overview
        const tenantOverview = await getTenantOverview(tenantSlug);

        // Get existing overrides for this tenant (to learn patterns)
        const existingOverrides = await prisma.tenantOverride.findMany({
          where: { tenant: { slug: tenantSlug } },
          include: { feature: { select: { title: true } } },
          take: 3,
        });
        const existingOverridesText = existingOverrides
          .map((o) => `### ${o.feature.title}\n${o.contentMd}`)
          .join("\n\n");

        const systemPrompt = buildDraftOverridePrompt(
          standardContent,
          tenantOverview,
          existingOverridesText
        );
        const result = await generate(llmConfig, {
          systemPrompt,
          userPrompt: description,
          temperature: 0.3,
          maxTokens: 2000,
        });

        return NextResponse.json({ data: result.text, usage: result.usage });
      }

      // ─── Suggest Section ────────────────────────────
      case "suggest-section": {
        const { section, currentForm, productSlug } = body;
        if (!section) {
          return NextResponse.json({ error: "Missing section" }, { status: 400 });
        }

        // Build a query from existing form data for RAG
        const queryParts: string[] = [];
        if (currentForm?.featureName) queryParts.push(currentForm.featureName);
        if (currentForm?.whatItDoes) queryParts.push(currentForm.whatItDoes);
        const ragQuery = queryParts.join(" — ") || section;

        const [ragContext, glossary] = await Promise.all([
          getRAGContext(ragQuery, llmConfig, productSlug, 5),
          getGlossaryContext(),
        ]);

        const systemPrompt = buildSuggestSectionPrompt(
          section,
          currentForm || {},
          ragContext,
          glossary
        );
        const result = await generate(llmConfig, {
          systemPrompt,
          userPrompt: `Generate content for the "${section}" section based on the context provided.`,
          temperature: 0.3,
          maxTokens: 2000,
        });

        // Try to parse as JSON, fallback to string
        const parsed = parseJSON(result.text, true);
        return NextResponse.json({ data: parsed, usage: result.usage });
      }

      // ─── Suggest Scenarios ──────────────────────────
      case "suggest-scenarios": {
        const { productSlug, featureSlug } = body;
        if (!productSlug || !featureSlug) {
          return NextResponse.json(
            { error: "Missing productSlug or featureSlug" },
            { status: 400 }
          );
        }

        const feature = await getFeatureContent(productSlug, featureSlug);
        if (!feature) {
          return NextResponse.json({ error: "Feature not found" }, { status: 404 });
        }

        // Also get existing scenarios so we don't suggest duplicates
        const existingScenarios = await getScenarios(productSlug, featureSlug);
        const existingNote =
          existingScenarios.length > 0
            ? `\n\nAlready documented scenarios (do NOT suggest these again):\n${existingScenarios.map((s) => `- ${s.title}`).join("\n")}`
            : "";

        const systemPrompt = buildSuggestScenariosPrompt(
          `# ${feature.title}\n${feature.contentMd}${existingNote}`
        );
        const result = await generate(llmConfig, {
          systemPrompt,
          userPrompt: "Suggest scenarios for this feature.",
          temperature: 0.4,
          maxTokens: 2000,
        });

        const parsed = parseJSON(result.text);
        return NextResponse.json({ data: parsed, usage: result.usage });
      }

      // ─── Review Quality ─────────────────────────────
      case "review-quality": {
        const { formData, entityType } = body;
        if (!formData) {
          return NextResponse.json({ error: "Missing formData" }, { status: 400 });
        }

        const systemPrompt = buildReviewQualityPrompt();
        const result = await generate(llmConfig, {
          systemPrompt,
          userPrompt: `Review this ${entityType || "feature"} documentation:\n\n${JSON.stringify(formData, null, 2)}`,
          temperature: 0.2,
          maxTokens: 2000,
        });

        const parsed = parseJSON(result.text);
        return NextResponse.json({ data: parsed, usage: result.usage });
      }

      // ─── Refine Section ─────────────────────────────
      case "refine-section": {
        const { section, currentContent, instruction } = body;
        if (!section || !instruction) {
          return NextResponse.json(
            { error: "Missing section or instruction" },
            { status: 400 }
          );
        }

        const contentStr =
          typeof currentContent === "string"
            ? currentContent
            : JSON.stringify(currentContent, null, 2);

        const systemPrompt = buildRefinePrompt(section, contentStr);
        const result = await generate(llmConfig, {
          systemPrompt,
          userPrompt: instruction,
          temperature: 0.3,
          maxTokens: 2000,
        });

        const parsed = parseJSON(result.text, true);
        return NextResponse.json({ data: parsed, usage: result.usage });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("AI assist error:", error);
    const message = error instanceof Error ? error.message : "AI assist failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── JSON Parser ────────────────────────────────────────

function parseJSON(text: string, allowString = false): unknown {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    if (allowString) return cleaned;
    // Try to find JSON within the text
    const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return allowString ? cleaned : { error: "Failed to parse LLM response", raw: cleaned };
      }
    }
    return { error: "Failed to parse LLM response", raw: cleaned };
  }
}
