import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth/server";
import { getRepository } from "@/lib/db";

export async function POST(req: Request) {
  const authenticated = await isRequestAuthenticated(req);
  if (!authenticated) {
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const { id, name } = body;
  if (typeof id !== "number" || id < 0 || id > 2 || !name || typeof name !== "string") {
    return NextResponse.json({ error: "Dati coinquilino non validi" }, { status: 400 });
  }

  const repo = getRepository();
  await repo.updateRoommate(id, name.trim());
  const roommates = await repo.getRoommates();

  return NextResponse.json({ success: true, roommates });
}
