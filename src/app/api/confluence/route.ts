import { NextRequest, NextResponse } from "next/server";
import {
  getConfluenceConfig,
  saveConfluenceConfig,
  searchPages,
  fetchPage,
} from "@/lib/confluence";

// ─── GET: Search & Fetch ──────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    switch (action) {
      case "config": {
        const config = await getConfluenceConfig();
        return NextResponse.json({
          configured: !!config,
          baseUrl: config?.baseUrl || null,
          email: config?.email || null,
        });
      }

      case "search": {
        const q = searchParams.get("q");
        if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });
        const results = await searchPages(q, 10);
        return NextResponse.json(results);
      }

      case "page": {
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Missing page id" }, { status: 400 });
        const page = await fetchPage(id);
        return NextResponse.json(page);
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Confluence API]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── POST: Save Config ────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, email, apiToken } = await request.json();

    if (!baseUrl || !email || !apiToken) {
      return NextResponse.json(
        { error: "Missing baseUrl, email, or apiToken" },
        { status: 400 }
      );
    }

    await saveConfluenceConfig(baseUrl, email, apiToken);
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Confluence Config]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
