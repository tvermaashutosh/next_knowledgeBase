import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, updateUserRole } from "@/lib/rbac";
import { getUser } from "@/lib/supabase-server";
import { getUserByEmail } from "@/lib/rbac";
import type { Role } from "@prisma/client";

// GET: List all users (admin only)
export async function GET() {
  try {
    const supabaseUser = await getUser();
    if (!supabaseUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await getUserByEmail(supabaseUser.email);
    if (!appUser || appUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await getAllUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error("Users GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Update user role (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabaseUser = await getUser();
    if (!supabaseUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await getUserByEmail(supabaseUser.email);
    if (!appUser || appUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { email, role } = await request.json();
    if (!email || !role) {
      return NextResponse.json({ error: "Missing email or role" }, { status: 400 });
    }

    const validRoles: Role[] = ["VIEWER", "CONTRIBUTOR", "REVIEWER", "ADMIN"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const updated = await updateUserRole(email, role);
    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("Users POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
