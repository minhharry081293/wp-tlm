export const SESSION_COOKIE = "tlm_session";

export type SessionPayload = {
  uid: string;
  username: string;
  role: "admin" | "user";
  exp: number;
};

const encoder = new TextEncoder();

function bytesToB64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlToBytes(value: string) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function authSecret() {
  return process.env.AUTH_SECRET || "";
}

async function sign(data: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return bytesToB64url(new Uint8Array(sig));
}

export async function createSessionToken(input: Omit<SessionPayload, "exp">) {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const body: SessionPayload = {
    ...input,
    exp: Date.now() + 14 * 24 * 60 * 60 * 1000,
  };
  const data = bytesToB64url(encoder.encode(JSON.stringify(body)));
  return `${data}.${await sign(data, secret)}`;
}

export async function readSessionToken(token: string | undefined | null) {
  const secret = authSecret();
  if (!token || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await sign(data, secret);
  if (expected.length !== sig.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  if (mismatch !== 0) return null;
  try {
    const body = JSON.parse(new TextDecoder().decode(b64urlToBytes(data))) as SessionPayload;
    if (!body.uid || !body.username || body.exp < Date.now()) return null;
    if (body.role !== "admin" && body.role !== "user") return null;
    return body;
  } catch {
    return null;
  }
}
