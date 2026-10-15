import { NextResponse } from "next/server";
import { prisma } from "@tlm/db";
import { createHealthCheckJob } from "@/lib/jobs";
import { audit } from "@/lib/audit";
import { getSession, siteFilter } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const siteIds: string[] | undefined = Array.isArray(body.siteIds)
    ? body.siteIds.map(String)
    : undefined;

  const sites = await prisma.site.findMany({
    where: {
      ...siteFilter(session),
      ...(siteIds?.length ? { id: { in: siteIds } } : {}),
    },
    select: { id: true },
  });

  if (sites.length === 0) {
    return NextResponse.json({ error: "No sites to check" }, { status: 400 });
  }

  const job = await createHealthCheckJob(
    sites.map((s) => s.id),
    session.uid
  );
  await audit("job.health_check", { jobId: job.id, count: sites.length });
  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
