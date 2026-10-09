import crypto from "crypto";

const SESSION_COOKIE_NAME = "flatflow_session";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      "Configurazione di sicurezza mancante: SESSION_SECRET deve essere definito e contenere almeno 32 caratteri casuali."
    );
  }
  return secret.trim();
}

export function getExpectedHouseCode(): string {
  const code = process.env.HOUSE_SECRET_CODE;
  if (!code || code.trim().length === 0) {
    throw new Error(
      "Configurazione di sicurezza mancante: HOUSE_SECRET_CODE deve essere configurato."
    );
  }
  return code.trim();
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
  if (!token || typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return false;

  let secret: string;
  try {
    secret = getSessionSecret();
  } catch {
    // Se la chiave segreta non è configurata sul server, rifiuta la sessione
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);

  // Previene eccezioni RangeError non controllate se i buffer hanno lunghezza differente
  if (sigBuf.length !== expBuf.length) {
    return false;
  }

  try {
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
      return false;
    }
  } catch {
    return false;
  }

  try {
    const raw = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload: SessionPayload = JSON.parse(raw);
    // Token valido per 1 anno (365 giorni)
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
