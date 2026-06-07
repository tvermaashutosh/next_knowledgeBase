import { prisma } from "./db";
import type { Role } from "@prisma/client";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
};

// ─── Permission Checks ───────────────────────────────────

const ROLE_HIERARCHY: Record<Role, number> = {
  VIEWER: 0,
  CONTRIBUTOR: 1,
  REVIEWER: 2,
  ADMIN: 3,
};

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canView(role: Role): boolean {
  return hasRole(role, "VIEWER");
}

export function canContribute(role: Role): boolean {
  return hasRole(role, "CONTRIBUTOR");
}

export function canReview(role: Role): boolean {
  return hasRole(role, "REVIEWER");
}

export function isAdmin(role: Role): boolean {
  return hasRole(role, "ADMIN");
}

// ─── User Management ─────────────────────────────────────

/**
 * Find or create a user from Supabase Auth.
 * Called after OAuth callback to sync Supabase user → our User table.
 */
export async function findOrCreateUser(supabaseUser: {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string; avatar_url?: string };
}): Promise<AppUser> {
  const email = supabaseUser.email || "";
  const name =
    supabaseUser.user_metadata?.full_name ||
    supabaseUser.user_metadata?.name ||
    email.split("@")[0];
  const avatarUrl = supabaseUser.user_metadata?.avatar_url || null;

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      avatarUrl,
      role: "VIEWER", // Default role for new users
    },
    update: {
      name,
      avatarUrl,
    },
  });

  return user;
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function getAllUsers(): Promise<AppUser[]> {
  return prisma.user.findMany({ orderBy: { name: "asc" } });
}

export async function updateUserRole(email: string, role: Role): Promise<AppUser> {
  return prisma.user.update({
    where: { email },
    data: { role },
  });
}
