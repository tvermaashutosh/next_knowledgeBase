import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Always use the pgbouncer transaction mode pooler URL.
// DIRECT_URL (session mode) has a hard max_client limit and gets exhausted in both
// local dev (hot-reloads) and production (serverless). Transaction mode scales for both.
const connectionString = process.env.DATABASE_URL!;

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const pool = new pg.Pool({
    connectionString,
    max: 3,
    // Keep established connections open so the (slow) TLS handshake is paid
    // once and reused — important on slow/high-latency links like a hotspot.
    idleTimeoutMillis: 0,
    keepAlive: true,
    // Allow a generous window to establish a connection on slow networks.
    connectionTimeoutMillis: 60000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
  });
}

export const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
