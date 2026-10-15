import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { prisma } from "@tlm/db";
import {
  SESSION_COOKIE,
  createSessionToken,
  readSessionToken,
  type SessionPayload,
} from "./session";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 32)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const hash = (await scryptAsync(password, salt, 32)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return readSessionToken(jar.get(SESSION_COOKIE)?.value);
}

export function siteFilter(session: SessionPayload) {
  return session.role === "admin" ? {} : { ownerId: session.uid };
}

export async function ensureAdmin() {
  const count = await prisma.user.count();
  if (count > 0) return;
  const username = process.env.TLM_ADMIN_USER || "admin";
  const password = process.env.TLM_ADMIN_PASSWORD || "admin";
  const admin = await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      role: "admin",
    },
  });
  await prisma.site.updateMany({
    where: { ownerId: null },
    data: { ownerId: admin.id },
  });
}

export const sessionCookie = {
  name: SESSION_COOKIE,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 14 * 24 * 60 * 60,
  },
};

export async function sessionTokenFor(user: {
  id: string;
  username: string;
  role: string;
}) {
  return createSessionToken({
    uid: user.id,
    username: user.username,
    role: user.role === "admin" ? "admin" : "user",
  });
}
