import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { getUserByEmail, isAdmin } from "@/lib/rbac";
import { getAuditLogs } from "@/lib/audit";

// GET: Audit log (admin only)
export async function GET(request: NextRequest) {
  try {
    const supaUser = await getUser();
    if (!supaUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await getUserByEmail(supaUser.email);
    if (!appUser || !isAdmin(appUser.role)) {
      return NextResponse.json({ error: "Forbidden — Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const entity = searchParams.get("entity") || undefined;
    const entityId = searchParams.get("entityId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const logs = await getAuditLogs({ entity, entityId, limit, offset });
    return NextResponse.json(logs);
  } catch (error) {
    console.error("Audit GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
