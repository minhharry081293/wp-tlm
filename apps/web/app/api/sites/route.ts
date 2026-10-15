import { NextResponse } from "next/server";
import { prisma } from "@tlm/db";
import { normalizeBaseUrl } from "@tlm/shared";
import { audit } from "@/lib/audit";
import { getSession, siteFilter } from "@/lib/auth";

function nameFromUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname.replace(/^www\./, "");
  } catch {
    return baseUrl;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sites = await prisma.site.findMany({
    where: siteFilter(session),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      status: true,
      lastCheckedAt: true,
      lastError: true,
      linkCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ sites });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  // Bulk: { urls: string[] } or { urlsText: "one\nper\nline" }
  const rawList: string[] = Array.isArray(body.urls)
    ? body.urls.map(String)
    : typeof body.urlsText === "string"
      ? body.urlsText.split(/\r?\n/)
      : body.baseUrl
        ? [String(body.baseUrl)]
        : [];

  const urls = [
    ...new Set(
      rawList
        .map((u) => u.trim())
        .filter(Boolean)
        .map((u) => normalizeBaseUrl(u))
    ),
  ];

  if (urls.length === 0) {
    return NextResponse.json({ error: "Provide baseUrl or urls" }, { status: 400 });
  }
  if (urls.length > 200) {
    return NextResponse.json({ error: "Maximum 200 URLs per request" }, { status: 400 });
  }

  for (const u of urls) {
    try {
      // eslint-disable-next-line no-new
      new URL(u);
    } catch {
      return NextResponse.json({ error: `Invalid URL: ${u}` }, { status: 400 });
    }
  }

  const created = [];
  const skipped = [];

  for (const baseUrl of urls) {
    const existing = await prisma.site.findUnique({ where: { baseUrl } });
    if (existing) {
      skipped.push(baseUrl);
      continue;
    }
    const name =
      urls.length === 1 && body.name
        ? String(body.name).trim() || nameFromUrl(baseUrl)
        : nameFromUrl(baseUrl);
    const site = await prisma.site.create({
      data: { name, baseUrl, ownerId: session.uid },
      select: {
        id: true,
        name: true,
        baseUrl: true,
        status: true,
        linkCount: true,
        createdAt: true,
      },
    });
    created.push(site);
  }

  await audit("site.create", {
    created: created.length,
    skipped: skipped.length,
  });

  if (created.length === 1 && skipped.length === 0) {
    return NextResponse.json({ site: created[0], sites: created }, { status: 201 });
  }

  return NextResponse.json(
    { sites: created, created: created.length, skipped },
    { status: 201 }
  );
}
