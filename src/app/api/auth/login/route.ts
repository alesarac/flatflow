import { NextResponse } from "next/server";
import { getRepository } from "@/lib/db";
import {
  createSessionToken,
  getClientIp,
  getExpectedHouseCode,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { getRequestSession } from "@/lib/auth/server";

export async function POST(req: Request) {
  // Se esiste già una sessione valida, rifiuta con HTTP 409 richiedendo il logout preventivo
  const existingSession = await getRequestSession(req);
  if (existingSession) {
    return NextResponse.json(
      {
        error:
          "Una sessione è già attiva su questo dispositivo. Effettua prima il logout per accedere con un altro profilo.",
      },
      { status: 409 }
    );
  }

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

  const { code, roommateId } = body;
  const expectedCode = getExpectedHouseCode();

  if (!code || typeof code !== "string" || code.trim() !== expectedCode.trim()) {
    await repo.recordFailedLogin(ip);
    return NextResponse.json({ error: "Codice segreto non corretto" }, { status: 401 });
  }

  if (typeof roommateId !== "number" || ![0, 1, 2].includes(roommateId)) {
    return NextResponse.json(
      { error: "Seleziona il tuo profilo coinquilino (ID 0, 1 o 2)." },
      { status: 400 }
    );
  }

  const roommates = await repo.getRoommates();
  const roommate = roommates.find((r) => r.id === roommateId);
  if (!roommate) {
    return NextResponse.json({ error: "Profilo coinquilino non trovato nel database." }, { status: 404 });
  }

  // Success: reset rate limit
  await repo.resetRateLimit(ip);

  const token = createSessionToken(roommateId);
  const response = NextResponse.json({
    success: true,
    roommateId,
    name: roommate.name,
  });

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
