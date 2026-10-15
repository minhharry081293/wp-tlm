import { NextResponse } from "next/server";
import { prisma } from "@tlm/db";
import { listLinksByUrl } from "@tlm/shared";
import { getSession, siteFilter } from "@/lib/auth";

/**
 * Find which PBN sites have a given target URL.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owned = siteFilter(session);
  const targetUrl = String(searchParams.get("url") || "").trim();
  const live = searchParams.get("live") === "1";

  if (!targetUrl) {
    return NextResponse.json({ error: "url query required" }, { status: 400 });
  }

  const indexed = await prisma.linkIndex.findMany({
    where: { targetUrl, site: owned },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          baseUrl: true,
          status: true,
        },
      },
    },
  });

  if (!live) {
    const bySite = new Map<
      string,
      {
        site: { id: string; name: string; baseUrl: string; status: string };
        anchors: string[];
        remoteIds: (number | null)[];
      }
    >();

    for (const row of indexed) {
      const existing = bySite.get(row.siteId);
      if (existing) {
        existing.anchors.push(row.anchorText);
        existing.remoteIds.push(row.remoteId);
      } else {
        bySite.set(row.siteId, {
          site: {
            id: row.site.id,
            name: row.site.name,
            baseUrl: row.site.baseUrl,
            status: row.site.status,
          },
          anchors: [row.anchorText],
          remoteIds: [row.remoteId],
        });
      }
    }

    return NextResponse.json({
      targetUrl,
      source: "index",
      matches: Array.from(bySite.values()),
    });
  }

  const sites = await prisma.site.findMany({ where: owned });
  const matches: {
    site: { id: string; name: string; baseUrl: string; status: string };
    anchors: string[];
    remoteIds: number[];
    error?: string;
  }[] = [];

  for (const site of sites) {
    try {
      const links = await listLinksByUrl(site.baseUrl, targetUrl);
      if (links.length > 0) {
        matches.push({
          site: {
            id: site.id,
            name: site.name,
            baseUrl: site.baseUrl,
            status: site.status,
          },
          anchors: links.map((l) => l.anchor_text),
          remoteIds: links.map((l) => l.id),
        });

        await prisma.linkIndex.deleteMany({
          where: { siteId: site.id, targetUrl },
        });
        await prisma.linkIndex.createMany({
          data: links.map((l) => ({
            siteId: site.id,
            targetUrl: l.target_url,
            anchorText: l.anchor_text,
            remoteId: typeof l.id === "number" && l.id > 0 ? l.id : null,
          })),
        });
      }
    } catch (err) {
      matches.push({
        site: {
          id: site.id,
          name: site.name,
          baseUrl: site.baseUrl,
          status: site.status,
        },
        anchors: [],
        remoteIds: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    targetUrl,
    source: "live",
    matches: matches.filter((m) => m.anchors.length > 0 || m.error),
  });
}
