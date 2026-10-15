import { NextResponse } from "next/server";
import { prisma } from "@tlm/db";
import { ensureAdmin, sessionCookie, sessionTokenFor, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
  await ensureAdmin();
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  if (!username || !password) {
    return NextResponse.json({ error: "Nhập username và mật khẩu" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Sai username hoặc mật khẩu" }, { status: 401 });
  }

  const token = await sessionTokenFor(user);
  const res = NextResponse.json({
    user: { id: user.id, username: user.username, role: user.role },
  });
  res.cookies.set(sessionCookie.name, token, sessionCookie.options);
  return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
