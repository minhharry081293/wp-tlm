import { NextResponse } from "next/server";
import { prisma } from "@tlm/db";
import { getSession, hashPassword } from "@/lib/auth";

function cleanUsername(value: unknown) {
  return String(value || "").trim();
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      _count: { select: { sites: true } },
    },
  });
  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      siteCount: user._count.sites,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const username = cleanUsername(body.username);
  const password = String(body.password || "");
  const role = body.role === "admin" ? "admin" : "user";

  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json(
      { error: "Username 3–32 ký tự, chỉ chữ, số, dấu chấm, gạch" },
      { status: 400 }
    );
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "Mật khẩu tối thiểu 4 ký tự" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "Username đã tồn tại" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { username, passwordHash: await hashPassword(password), role },
    select: { id: true, username: true, role: true, createdAt: true },
  });
  return NextResponse.json({ user: { ...user, siteCount: 0 } }, { status: 201 });
}
