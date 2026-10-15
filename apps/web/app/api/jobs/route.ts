import { NextResponse } from "next/server";
import { prisma } from "@tlm/db";
import { getSession } from "@/lib/auth";

function parseMaybeJson(raw: string | null | undefined) {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function serializeJob<T extends { payload: string; summary: string | null }>(
  job: T
) {
  return {
    ...job,
    payload: parseMaybeJson(job.payload),
    summary: parseMaybeJson(job.summary),
  };
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owner = session.role === "admin" ? {} : { userId: session.uid };
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));

  if (id) {
    const job = await prisma.job.findFirst({
      where: { id, ...owner },
      include: {
        items: {
          include: {
            site: { select: { id: true, name: true, baseUrl: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      job: {
        ...serializeJob(job),
        items: job.items.map((item) => ({
          ...item,
          result: parseMaybeJson(item.result),
        })),
      },
    });
  }

  const jobs = await prisma.job.findMany({
    where: owner,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      _count: { select: { items: true } },
    },
  });
  return NextResponse.json({ jobs: jobs.map(serializeJob) });
}
