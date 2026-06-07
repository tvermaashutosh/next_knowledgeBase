/**
 * Embedding Pipeline — Chunks features, embeds via LLM adapter, stores in pgvector.
 * Supports context transparency: returns chunks used for generation.
 */

import { prisma } from "./db";
import { embed, type LLMConfig } from "./llm-adapter";

// ─── Chunking ───────────────────────────────────────────

export type Chunk = {
  section: string;
  text: string;
  metadata: {
    productSlug: string;
    moduleSlug?: string;
    featureSlug: string;
    featureTitle: string;
    scenarioSlug?: string;
    scenarioTitle?: string;
  };
};

/**
 * Split a feature's markdown content into section-based chunks.
 * Each ## heading becomes a separate chunk.
 */
export function chunkFeature(
  contentMd: string,
  meta: { productSlug: string; moduleSlug?: string; featureSlug: string; featureTitle: string }
): Chunk[] {
  const chunks: Chunk[] = [];
  const sectionRegex = /^## (.+)$/gm;
  const matches: { title: string; index: number }[] = [];
  let match;

  while ((match = sectionRegex.exec(contentMd)) !== null) {
    matches.push({ title: match[1], index: match.index });
  }

  if (matches.length === 0) {
    // No sections — treat entire content as one chunk
    const text = contentMd.trim();
    if (text) {
      chunks.push({ section: "Overview", text, metadata: meta });
    }
    return chunks;
  }

  // Content before first section heading
  const preamble = contentMd.slice(0, matches[0].index).trim();
  if (preamble) {
    chunks.push({ section: "Overview", text: preamble, metadata: meta });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].title.length + 3; // skip "## title\n"
    const end = i + 1 < matches.length ? matches[i + 1].index : contentMd.length;
    const text = contentMd.slice(start, end).trim();
    if (text) {
      chunks.push({ section: matches[i].title, text, metadata: meta });
    }
  }

  return chunks;
}

// ─── Embed & Store ──────────────────────────────────────

/**
 * Delete existing embeddings for a feature, re-chunk, embed, and store.
 */
export async function embedFeature(
  featureId: string,
  contentMd: string,
  meta: { productSlug: string; moduleSlug?: string; featureSlug: string; featureTitle: string },
  llmConfig: LLMConfig
): Promise<number> {
  // 1. Delete old embeddings
  await deleteEmbeddings(featureId);

  // 2. Chunk
  const chunks = chunkFeature(contentMd, meta);
  if (chunks.length === 0) return 0;

  // 3. Embed each chunk and store
  for (const chunk of chunks) {
    const chunkText = `[${meta.featureTitle}] [${chunk.section}]\n${chunk.text}`;
    const result = await embed(llmConfig, chunkText);

    // Store using raw SQL since Prisma doesn't natively support pgvector insert
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Embedding" (id, "featureId", section, "chunkText", embedding, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, NOW())`,
      featureId,
      chunk.section,
      chunkText,
      `[${result.embedding.join(",")}]`
    );
  }

  return chunks.length;
}

/**
 * Delete all embeddings for a feature.
 */
export async function deleteEmbeddings(featureId: string): Promise<void> {
  await prisma.embedding.deleteMany({ where: { featureId } });
}

/**
 * Embed a scenario's contentMd under the parent feature's embedding group.
 * Scenario chunks are prefixed with [Feature Title > Scenario Title] so search
 * naturally returns them when the scenario content is relevant.
 */
export async function embedScenario(
  featureId: string,
  scenarioSlug: string,
  scenarioTitle: string,
  contentMd: string,
  meta: { productSlug: string; moduleSlug?: string; featureSlug: string; featureTitle: string },
  llmConfig: LLMConfig
): Promise<number> {
  // Delete old scenario-specific embeddings (section prefix identifies them)
  await prisma.embedding.deleteMany({
    where: { featureId, section: { startsWith: `scenario:${scenarioSlug}:` } },
  });

  const chunks = chunkFeature(contentMd, meta);
  if (chunks.length === 0) return 0;

  for (const chunk of chunks) {
    const chunkText = `[${meta.featureTitle} > ${scenarioTitle}] [${chunk.section}]\n${chunk.text}`;
    const result = await embed(llmConfig, chunkText);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Embedding" (id, "featureId", section, "chunkText", embedding, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, NOW())`,
      featureId,
      `scenario:${scenarioSlug}:${chunk.section}`,
      chunkText,
      `[${result.embedding.join(",")}]`
    );
  }

  return chunks.length;
}

// ─── Vector Search ──────────────────────────────────────

export type SearchResult = {
  id: string;
  featureId: string;
  section: string;
  chunkText: string;
  similarity: number;
};

/**
 * Find the top-K most similar chunks to a query.
 */
export async function searchSimilar(
  queryEmbedding: number[],
  topK: number = 10,
  productFilter?: string
): Promise<SearchResult[]> {
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  // Use cosine distance with optional product filter
  let query: string;
  let params: unknown[];

  if (productFilter) {
    query = `
      SELECT e.id, e."featureId", e.section, e."chunkText",
             1 - (e.embedding <=> $1::vector) as similarity
      FROM "Embedding" e
      JOIN "Feature" f ON f.id = e."featureId"
      JOIN "Module" m ON m.id = f."moduleId"
      JOIN "ProductModule" pm ON pm."moduleId" = m.id
      JOIN "Product" p ON p.id = pm."productId"
      WHERE p.slug = $2
      ORDER BY e.embedding <=> $1::vector
      LIMIT $3
    `;
    params = [vectorStr, productFilter, topK];
  } else {
    query = `
      SELECT e.id, e."featureId", e.section, e."chunkText",
             1 - (e.embedding <=> $1::vector) as similarity
      FROM "Embedding" e
      ORDER BY e.embedding <=> $1::vector
      LIMIT $2
    `;
    params = [vectorStr, topK];
  }

  const results = await prisma.$queryRawUnsafe(query, ...params) as SearchResult[];
  return results;
}

/**
 * Embed a query string and search for similar chunks.
 */
export async function searchByText(
  queryText: string,
  llmConfig: LLMConfig,
  topK: number = 10,
  productFilter?: string
): Promise<SearchResult[]> {
  const result = await embed(llmConfig, queryText);
  return searchSimilar(result.embedding, topK, productFilter);
}

// ─── Context Assembly ───────────────────────────────────

/**
 * Assemble context for LLM generation from search results.
 * Returns the assembled context string and the chunks used.
 */
export function assembleContext(
  chunks: SearchResult[],
  excludeIds: string[] = [],
  glossary?: { term: string; definition: string }[],
  options?: {
    featureGlossaryTerms?: { featureTitle: string; terms: { term: string; definition: string; dontSay?: string[] }[] }[];
    scenarioOverrides?: { tenantName: string; scenarioTitle: string; contentMd: string }[];
  }
): { context: string; usedChunks: SearchResult[] } {
  const usedChunks = chunks.filter((c) => !excludeIds.includes(c.id));

  let context = "";

  // Add global glossary if available
  if (glossary && glossary.length > 0) {
    context += "## Glossary (Global Terms)\n";
    for (const g of glossary) {
      context += `- **${g.term}**: ${g.definition}\n`;
    }
    context += "\n";
  }

  // Add feature-level glossary terms
  if (options?.featureGlossaryTerms && options.featureGlossaryTerms.length > 0) {
    context += "## Feature-Specific Terms\n";
    for (const fg of options.featureGlossaryTerms) {
      for (const t of fg.terms) {
        context += `- **${t.term}** (${fg.featureTitle}): ${t.definition}`;
        if (t.dontSay && t.dontSay.length > 0) {
          context += ` [Don't say: ${t.dontSay.join(", ")}]`;
        }
        context += "\n";
      }
    }
    context += "\n";
  }

  // Add KB context chunks
  context += "## Knowledge Base Context\n\n";
  for (const chunk of usedChunks) {
    context += `### ${chunk.section} (similarity: ${(chunk.similarity * 100).toFixed(1)}%)\n`;
    context += chunk.chunkText + "\n\n";
  }

  // Add scenario overrides at the end (priority note)
  if (options?.scenarioOverrides && options.scenarioOverrides.length > 0) {
    context += "\n## Scenario-Level Tenant Overrides\n\n";
    context += "> These describe how specific scenarios work DIFFERENTLY for the selected tenant.\n> They OVERRIDE the default scenario flow described above.\n\n";
    for (const so of options.scenarioOverrides) {
      context += `### Scenario Override: "${so.scenarioTitle}" (${so.tenantName})\n`;
      context += so.contentMd + "\n\n";
    }
  }

  return { context, usedChunks };
}
