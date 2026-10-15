import { NextResponse } from "next/server";
import { prisma } from "@tlm/db";
import { enqueueTlmJob } from "@/lib/queue";
import { audit } from "@/lib/audit";
import { getSession, siteFilter } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const targetUrl = String(body.targetUrl || "").trim();
  const siteIds: string[] = Array.isArray(body.siteIds)
    ? body.siteIds.map(String)
    : [];

  if (!targetUrl) {
    return NextResponse.json({ error: "targetUrl required" }, { status: 400 });
  }
  try {
    // eslint-disable-next-line no-new
    new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid targetUrl" }, { status: 400 });
  }
  if (siteIds.length === 0) {
    return NextResponse.json({ error: "Select at least one site" }, { status: 400 });
  }

  const sites = await prisma.site.findMany({
    where: { id: { in: siteIds }, ...siteFilter(session) },
    select: { id: true },
  });
  if (sites.length !== siteIds.length) {
    return NextResponse.json({ error: "One or more sites not found" }, { status: 400 });
  }

  const job = await prisma.job.create({
    data: {
      type: "remove",
      status: "pending",
      userId: session.uid,
      payload: JSON.stringify({ targetUrl, siteIds }),
      items: {
        create: sites.map((s) => ({
          siteId: s.id,
          status: "pending",
        })),
      },
    },
  });

  await enqueueTlmJob(job.id);
  await audit("job.remove", {
    jobId: job.id,
    targetUrl,
    siteCount: sites.length,
  });

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
