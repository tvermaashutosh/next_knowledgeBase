/**
 * Audit Logger — Records all significant actions for compliance and debugging.
 */

import { prisma } from "./db";

export type AuditAction = "created" | "updated" | "deleted" | "submitted" | "approved" | "rejected" | "role_changed" | "config_changed" | "ingested" | "smart-fix";
export type AuditEntity = "feature" | "product" | "module" | "scenario" | "tenant" | "glossary" | "user" | "llm_config" | "review" | "embedding";

export async function logAudit(
  userId: string | null,
  action: AuditAction,
  entity: AuditEntity,
  entityId: string,
  details?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details: details || null,
      },
    });
  } catch (error) {
    // Never let audit logging break the main flow
    console.error("Audit log error:", error);
  }
}

export async function getAuditLogs(options?: {
  entity?: string;
  entityId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {};
  if (options?.entity) where.entity = options.entity;
  if (options?.entityId) where.entityId = options.entityId;
  if (options?.userId) where.userId = options.userId;

  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  });
}
