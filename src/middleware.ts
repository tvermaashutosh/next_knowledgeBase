import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — important for SSR
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow seed/script access via API key (for seeding, re-embedding, etc.)
  const seedApiKey = process.env.SEED_API_KEY;
  if (seedApiKey && request.headers.get("authorization") === `Bearer ${seedApiKey}`) {
    return supabaseResponse;
  }

  // Public routes that don't need Supabase auth.
  // /api/heartbeat is guarded by its own HEARTBEAT_SECRET, not the session.
  const publicRoutes = ["/login", "/api/auth", "/api/heartbeat"];
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (!user && !isPublicRoute) {
    // Not logged in → redirect to login.
    // Build the Location as a raw string: NextResponse.redirect()/NextURL
    // re-encode the path's slashes to %2F (e.g. ?redirect=%2Fadmin). A '/' is
    // legal unencoded in a query value, and a raw header keeps it literal.
    // Skip the redirect param for the root path — '/' is the default anyway.
    const path = request.nextUrl.pathname;
    const origin = request.nextUrl.origin;
    const location =
      path === "/" ? `${origin}/login` : `${origin}/login?redirect=${path}`;
    return new NextResponse(null, { status: 307, headers: { Location: location } });
  }

  if (user && request.nextUrl.pathname === "/login") {
    // Already logged in → redirect to dashboard
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
