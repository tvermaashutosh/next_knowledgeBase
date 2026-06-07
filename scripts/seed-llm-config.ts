/**
 * Re-seeds the single LlmConfig row after a DB reset, so you never have to
 * re-enter provider settings in Admin → LLM Config after a nuke.
 *
 * Reads the Groq key from GROQ_API_KEY (keep secrets out of source). Everything
 * else has a sensible default but can be overridden via env. Runs as the last
 * step of `npm run db:reset`.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
});
const adapter = new PrismaPg(pool as never);
const prisma = new PrismaClient({ adapter } as never);

// PrismaClient is built with `as never` (the pg adapter typings), so re-expose
// just the LlmConfig ops we need with a minimal local type.
type Db = {
  llmConfig: {
    deleteMany: () => Promise<unknown>;
    create: (args: { data: Record<string, string> }) => Promise<unknown>;
  };
};
const db = prisma as unknown as Db;

async function main() {
  const generationApiKey = process.env.GROQ_API_KEY;
  if (!generationApiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to .env (or your host env) before running db:reset."
    );
  }

  const data: Record<string, string> = {
    generationProvider: process.env.GEN_PROVIDER ?? "groq",
    generationModel: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    generationApiKey,
    embeddingProvider: process.env.EMBED_PROVIDER ?? "ollama",
    embeddingModel: process.env.EMBED_MODEL ?? "nomic-embed-text",
    embeddingApiKey:
      process.env.OLLAMA_BASE_URL ?? "https://tvermaashutosh-ollama-embed.hf.space",
  };

  // Single-row config table: clear any existing row, then insert fresh.
  await db.llmConfig.deleteMany();
  await db.llmConfig.create({ data });

  console.log(
    `✅ LlmConfig seeded: ${data.generationProvider}/${data.generationModel} + ` +
      `${data.embeddingProvider}/${data.embeddingModel} @ ${data.embeddingApiKey}`
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
