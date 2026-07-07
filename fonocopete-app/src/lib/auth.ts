import { cookies } from "next/headers";
import crypto from "node:crypto";

const sessionCookieName = "fonocopete_admin";
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "fonocopete-local-session-secret-change-me";
  throw new Error("ADMIN_SESSION_SECRET is required in production");
}

function timingSafeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function verifyPassword(password: string) {
  const configuredHash = (process.env.ADMIN_PASSWORD_HASH || "").trim().replace(/^["']|["']$/g, "");
  if (configuredHash.split("$").length !== 4) return false;
  const encoded = configuredHash;
  const [algorithm, iterations, salt, expectedHash] = encoded.split("$");

  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !expectedHash) return false;

  const actualHash = crypto
    .pbkdf2Sync(password, salt, Number(iterations), 32, "sha256")
    .toString("base64");

  return timingSafeEqual(actualHash, expectedHash);
}

function sign(payload: string) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createSessionValue(username: string) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      exp: Date.now() + 1000 * sessionMaxAgeSeconds,
    }),
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function readSessionValue(value?: string) {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !timingSafeEqual(signature, sign(payload))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      username: string;
      exp: number;
    };
    if (!session.username || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return readSessionValue(cookieStore.get(sessionCookieName)?.value);
}

export async function requireAdmin() {
  return Boolean(await getAdminSession());
}

export async function setAdminSession(username: string) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, createSessionValue(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}
