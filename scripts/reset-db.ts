import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

/**
 * Targeted reset — drops ONLY the tables/enums this project's schema defines,
 * leaving any other tables in the same database untouched. Use this instead of
 * `prisma db push --force-reset` when the Supabase DB is shared with other apps.
 *
 * The table/enum list is derived from the Prisma schema at runtime (DMMF), so it
 * stays correct automatically as the schema changes. DROP ... CASCADE handles FK
 * order and takes the pgvector `embedding` column + HNSW index down with the
 * Embedding table.
 *
 * Run `npm run db:reset` (drop → db push → add vector column) rather than this
 * script alone; on its own it only drops.
 */

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool as never);
const prisma = new PrismaClient({ adapter } as never);

async function main() {
  const tables = Prisma.dmmf.datamodel.models.map((m) => m.dbName ?? m.name);
  const enums = Prisma.dmmf.datamodel.enums.map((e) => e.dbName ?? e.name);

  console.log(`🗑  Dropping ${tables.length} tables (this project only)...`);
  for (const t of tables) {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${t}" CASCADE`);
    console.log(`   - ${t}`);
  }

  console.log(`🗑  Dropping ${enums.length} enum types...`);
  for (const e of enums) {
    await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "${e}" CASCADE`);
    console.log(`   - ${e}`);
  }

  console.log("✅ Done. Other tables in this database were left untouched.");
  console.log("   Next: `npx prisma db push` then `npx tsx scripts/add-vector-column.ts`");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
