/**
 * Confluence REST API Client
 * Uses Atlassian REST API v2 with Basic Auth (email + API token).
 */

import { prisma } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────

export interface ConfluencePageResult {
  id: string;
  title: string;
  spaceKey: string;
  excerpt: string;
  url: string;
}

export interface ConfluencePageContent {
  id: string;
  title: string;
  spaceKey: string;
  body: string; // cleaned plain text
  url: string;
}

interface ConfluenceCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

// ─── Config ─────────────────────────────────────────────

export async function getConfluenceConfig(): Promise<ConfluenceCredentials | null> {
  const config = await prisma.confluenceConfig.findFirst();
  if (!config) return null;
  return {
    baseUrl: config.baseUrl.replace(/\/+$/, ""), // strip trailing slash
    email: config.email,
    apiToken: config.apiToken,
  };
}

export async function saveConfluenceConfig(
  baseUrl: string,
  email: string,
  apiToken: string
): Promise<void> {
  const existing = await prisma.confluenceConfig.findFirst();
  if (existing) {
    await prisma.confluenceConfig.update({
      where: { id: existing.id },
      data: { baseUrl, email, apiToken },
    });
  } else {
    await prisma.confluenceConfig.create({
      data: { baseUrl, email, apiToken },
    });
  }
}

// ─── API Helpers ────────────────────────────────────────

async function confluenceFetch(
  creds: ConfluenceCredentials,
  path: string
): Promise<Response> {
  const auth = Buffer.from(`${creds.email}:${creds.apiToken}`).toString("base64");
  const url = `${creds.baseUrl}${path}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Confluence API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res;
}

// ─── Public API ─────────────────────────────────────────

/**
 * Search Confluence pages using CQL.
 */
export async function searchPages(
  query: string,
  limit = 10
): Promise<ConfluencePageResult[]> {
  const creds = await getConfluenceConfig();
  if (!creds) throw new Error("Confluence not configured");

  const cql = encodeURIComponent(`type=page AND text~"${query.replace(/"/g, '\\"')}"`);
  const res = await confluenceFetch(
    creds,
    `/rest/api/content/search?cql=${cql}&limit=${limit}&expand=space`
  );

  const data = await res.json();
  const results: ConfluencePageResult[] = (data.results || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      id: r.id,
      title: r.title,
      spaceKey: r.space?.key || "",
      excerpt: r.excerpt || "",
      url: `${creds.baseUrl}${r._links?.webui || ""}`,
    })
  );

  return results;
}

/**
 * Fetch a single Confluence page by ID and return its content as plain text.
 */
export async function fetchPage(pageId: string): Promise<ConfluencePageContent> {
  const creds = await getConfluenceConfig();
  if (!creds) throw new Error("Confluence not configured");

  const res = await confluenceFetch(
    creds,
    `/rest/api/content/${pageId}?expand=body.storage,space,version`
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const storageHtml = data.body?.storage?.value || "";
  const plainText = convertStorageToText(storageHtml);

  return {
    id: data.id,
    title: data.title,
    spaceKey: data.space?.key || "",
    body: plainText,
    url: `${creds.baseUrl}${data._links?.webui || ""}`,
  };
}

// ─── HTML → Text Converter ──────────────────────────────

/**
 * Convert Confluence storage-format HTML to clean plain text.
 * Handles tables, lists, headings, panels, macros, etc.
 */
export function convertStorageToText(html: string): string {
  if (!html) return "";

  let text = html;

  // Remove Confluence macros (ac:* tags) but keep their body content
  text = text.replace(/<ac:[^>]*>/gi, "");
  text = text.replace(/<\/ac:[^>]*>/gi, "");

  // Remove ri:* tags (resource identifiers)
  text = text.replace(/<ri:[^>]*\/>/gi, "");
  text = text.replace(/<ri:[^>]*>[\s\S]*?<\/ri:[^>]*>/gi, "");

  // Convert headings
  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, level, content) => {
    const prefix = "#".repeat(parseInt(level));
    return `\n${prefix} ${stripTags(content).trim()}\n`;
  });

  // Convert tables to markdown-ish format
  text = text.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
    const rows: string[] = [];
    const rowMatches = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const row of rowMatches) {
      const cells = (row.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) || []).map(
        (cell: string) => stripTags(cell.replace(/<t[hd][^>]*>/i, "").replace(/<\/t[hd]>/i, "")).trim()
      );
      rows.push(`| ${cells.join(" | ")} |`);
    }
    return "\n" + rows.join("\n") + "\n";
  });

  // Convert lists
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => `- ${stripTags(content).trim()}\n`);
  text = text.replace(/<\/?[uo]l[^>]*>/gi, "\n");

  // Convert line breaks and paragraphs
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<p[^>]*>/gi, "");

  // Convert bold/italic/code
  text = text.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  text = text.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n");

  // Strip remaining HTML tags
  text = stripTags(text);

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}
