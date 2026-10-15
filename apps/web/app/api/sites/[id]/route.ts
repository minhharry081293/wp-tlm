import { NextResponse } from "next/server";
import { prisma } from "@tlm/db";
import { normalizeBaseUrl } from "@tlm/shared";
import { audit } from "@/lib/audit";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

async function ownedSite(id: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const site = await prisma.site.findFirst({
    where: { id, ...(session.role === "admin" ? {} : { ownerId: session.uid }) },
    select: { id: true },
  });
  if (!site) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { session };
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const access = await ownedSite(id);
  if (access.error) return access.error;
  const site = await prisma.site.findUnique({
    where: { id },
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
  if (!site) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ site });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const access = await ownedSite(id);
  if (access.error) return access.error;
  const body = await req.json();
  const data: { name?: string; baseUrl?: string } = {};

  if (body.name !== undefined) {
    data.name = String(body.name).trim();
  }
  if (body.baseUrl !== undefined) {
    data.baseUrl = normalizeBaseUrl(String(body.baseUrl));
  }

  try {
    const site = await prisma.site.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        baseUrl: true,
        status: true,
        linkCount: true,
      },
    });
    await audit("site.update", { siteId: id });
    return NextResponse.json({ site });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const access = await ownedSite(id);
  if (access.error) return access.error;
  try {
    await prisma.site.delete({ where: { id } });
    await audit("site.delete", { siteId: id });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
