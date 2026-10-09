import crypto from "crypto";

const SESSION_COOKIE_NAME = "flatflow_session";
const DEFAULT_SESSION_SECRET = "flatflow-super-secure-secret-token-key-2026";
const HOUSE_SECRET_CODE = process.env.HOUSE_SECRET_CODE || "flatflow2026";

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;
}

export function getExpectedHouseCode(): string {
  return process.env.HOUSE_SECRET_CODE || HOUSE_SECRET_CODE;
}

export interface SessionPayload {
  houseId: string;
  authenticatedAt: number;
}

export function createSessionToken(): string {
  const secret = getSessionSecret();
  const payload: SessionPayload = {
    houseId: "default",
    authenticatedAt: Date.now(),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token: string | null | undefined): boolean {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [payloadB64, signature] = parts;
  const secret = getSessionSecret();

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return false;
  }

  try {
    const raw = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload: SessionPayload = JSON.parse(raw);
    // Token is valid for 1 year (365 days)
    const maxAgeMs = 365 * 24 * 60 * 60 * 1000;
    if (Date.now() - payload.authenticatedAt > maxAgeMs) {
      return false;
    }
    return payload.houseId === "default";
  } catch {
    return false;
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

export { SESSION_COOKIE_NAME };
