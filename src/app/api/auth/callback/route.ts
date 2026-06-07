import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { findOrCreateUser } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const cookieStore = await cookies();

  // Prefer redirect path from cookie (set before OAuth to avoid query-string
  // in redirectTo, which breaks Supabase allowlist validation).
  // Fall back to query param for backward compatibility.
  const cookieRedirect = cookieStore.get("redirect_after_login")?.value;
  const redirect = cookieRedirect ? decodeURIComponent(cookieRedirect) : (searchParams.get("redirect") || "/");

  // Clear the one-time redirect cookie
  if (cookieRedirect) {
    try { cookieStore.delete("redirect_after_login"); } catch { /* ignore */ }
  }

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore — called from server component
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Sync user to our DB (creates if new, updates name/avatar if exists)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try { await findOrCreateUser(user); } catch { /* DB sync non-fatal */ }
      }

      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
