import { NextResponse } from "next/server";
import { prisma } from "@tlm/db";
import { listAllLinks } from "@tlm/shared";
import { getSession, siteFilter } from "@/lib/auth";

/**
 * Placed text links, grouped by target URL.
 * `?live=1` reads each PBN and refreshes the local index first.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owned = siteFilter(session);
  const live = new URL(req.url).searchParams.get("live") === "1";
  const siteErrors: { siteId: string; name: string; error: string }[] = [];

  if (live) {
    const sites = await prisma.site.findMany({ where: owned });
    for (const site of sites) {
      try {
        const links = await listAllLinks(site.baseUrl);
        await prisma.$transaction([
          prisma.linkIndex.deleteMany({ where: { siteId: site.id } }),
          ...(links.length
            ? [
                prisma.linkIndex.createMany({
                  data: links.map((link) => ({
                    siteId: site.id,
                    targetUrl: link.target_url,
                    anchorText: link.anchor_text,
                    remoteId: link.id > 0 ? link.id : null,
                  })),
                }),
              ]
            : []),
        ]);
      } catch (err) {
        siteErrors.push({
          siteId: site.id,
          name: site.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const rows = await prisma.linkIndex.findMany({
    where: { site: owned },
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
    orderBy: { updatedAt: "desc" },
  });

  const byUrl = new Map<
    string,
    {
      targetUrl: string;
      anchors: Set<string>;
      sites: Map<
        string,
        {
          id: string;
          name: string;
          baseUrl: string;
          status: string;
          anchors: string[];
        }
      >;
    }
  >();

  for (const row of rows) {
    let group = byUrl.get(row.targetUrl);
    if (!group) {
      group = {
        targetUrl: row.targetUrl,
        anchors: new Set(),
        sites: new Map(),
      };
      byUrl.set(row.targetUrl, group);
    }
    group.anchors.add(row.anchorText);
    let site = group.sites.get(row.siteId);
    if (!site) {
      site = {
        id: row.site.id,
        name: row.site.name,
        baseUrl: row.site.baseUrl,
        status: row.site.status,
        anchors: [],
      };
      group.sites.set(row.siteId, site);
    }
    site.anchors.push(row.anchorText);
  }

  const links = Array.from(byUrl.values()).map((group) => ({
    targetUrl: group.targetUrl,
    anchors: Array.from(group.anchors),
    sites: Array.from(group.sites.values()),
  }));

  return NextResponse.json({ links, siteErrors });
}
