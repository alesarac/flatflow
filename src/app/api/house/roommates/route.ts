import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/server";
import { getRepository } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getRequestSession(req);
  if (!session) {
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const { id, name } = body;

  // Rifiuta con 403 se il client tenta di modificare l'identità di un altro coinquilino
  if (id !== undefined && id !== session.roommateId) {
    return NextResponse.json(
      { error: "Puoi modificare esclusivamente il tuo profilo coinquilino." },
      { status: 403 }
    );
  }

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Nome non valido" }, { status: 400 });
  }

  const targetId = session.roommateId;
  const repo = getRepository();
  await repo.updateRoommate(targetId, name.trim());
  const roommates = await repo.getRoommates();

  return NextResponse.json({ success: true, roommates });
}
