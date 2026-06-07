import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool as never);
const prisma = new PrismaClient({ adapter } as never);

// Dimension must match the embedding model. nomic-embed-text => 768.
// Override with EMBED_DIM if you switch models (e.g. mxbai-embed-large => 1024).
const EMBED_DIM = Number(process.env.EMBED_DIM) || 768;

async function main() {
  console.log("🔧 Ensuring pgvector extension exists...");
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);

  // Changing the embedding model changes the vector dimension, which a fixed
  // pgvector column can't alter in place — so drop the index + column and
  // recreate at the new dimension. (Any existing vectors are invalid under a
  // different model anyway and must be re-embedded.)
  console.log(`🔧 (Re)creating embedding column as vector(${EMBED_DIM})...`);
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS embedding_hnsw_idx`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Embedding" DROP COLUMN IF EXISTS embedding`);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Embedding" ADD COLUMN embedding vector(${EMBED_DIM})`
  );

  console.log("🔧 Creating HNSW index for fast similarity search...");
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS embedding_hnsw_idx ON "Embedding" USING hnsw (embedding vector_cosine_ops)`
  );

  console.log("✅ Done. Embedding table is ready for vector storage.");

  // Verify
  const cols = await prisma.$queryRawUnsafe<{ column_name: string; data_type: string }[]>(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Embedding' ORDER BY ordinal_position`
  );
  console.log("Columns:", JSON.stringify(cols, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
