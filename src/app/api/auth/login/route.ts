import { NextResponse } from "next/server";
import { getRepository } from "@/lib/db";
import {
  createSessionToken,
  getClientIp,
  getExpectedHouseCode,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

export async function POST(req: Request) {
  const repo = getRepository();
  const ip = getClientIp(req);

  // Check rate limit
  const isLimited = await repo.isRateLimited(ip);
  if (isLimited) {
    return NextResponse.json(
      { error: "Troppi tentativi falliti. Riprova tra 15 minuti." },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Formato richiesta non valido" }, { status: 400 });
  }

  const { code } = body;
  const expectedCode = getExpectedHouseCode();

  if (!code || typeof code !== "string" || code.trim() !== expectedCode.trim()) {
    await repo.recordFailedLogin(ip);
    return NextResponse.json({ error: "Codice segreto non corretto" }, { status: 401 });
  }

  // Success: reset rate limit
  await repo.resetRateLimit(ip);

  const token = createSessionToken();
  const response = NextResponse.json({ success: true });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60, // 1 year
  });

  return response;
}
