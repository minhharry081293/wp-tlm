import { NextResponse } from "next/server";
import { prisma } from "@tlm/db";
import { getSession, hashPassword } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const password = body.password !== undefined ? String(body.password) : "";
  const role = body.role === "admin" || body.role === "user" ? body.role : undefined;

  if (password && password.length < 4) {
    return NextResponse.json({ error: "Mật khẩu tối thiểu 4 ký tự" }, { status: 400 });
  }
  if (role === "user" && id === session.uid) {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) {
      return NextResponse.json({ error: "Cần giữ ít nhất 1 admin" }, { status: 400 });
    }
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
        ...(role ? { role } : {}),
      },
      select: { id: true, username: true, role: true, createdAt: true },
    });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (id === session.uid) {
    return NextResponse.json({ error: "Không xóa được chính mình" }, { status: 400 });
  }
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });
  if (target.role === "admin") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) {
      return NextResponse.json({ error: "Cần giữ ít nhất 1 admin" }, { status: 400 });
    }
  }
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
