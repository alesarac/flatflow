import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/server";
import { getRepository } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getRequestSession(req);
  if (!session) {
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 401 });
  }

  try {
    const repo = getRepository();
    const items = await repo.getShoppingItems();
    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("Errore caricamento lista della spesa:", err);
    return NextResponse.json(
      { error: "Errore durante il caricamento della lista della spesa" },
      { status: 500 }
    );
  }
}

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

  const { action } = body;
  const roommateId = session.roommateId;
  const repo = getRepository();

  if (action === "add") {
    const { name } = body;
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Il nome del prodotto non può essere vuoto." },
        { status: 400 }
      );
    }
    const trimmed = name.trim();
    if (trimmed.length > 80) {
      return NextResponse.json(
        { error: "Il nome del prodotto è troppo lungo (massimo 80 caratteri)." },
        { status: 400 }
      );
    }

    try {
      const roommates = await repo.getRoommates();
      const currentRoommate = roommates.find((r) => r.id === roommateId);
      const authorName = currentRoommate?.name || `Coinquilino ${roommateId + 1}`;

      const item = await repo.addShoppingItem(trimmed, roommateId, authorName);
      const items = await repo.getShoppingItems();
      return NextResponse.json({ success: true, item, items });
    } catch (err: any) {
      console.error("Errore aggiunta elemento spesa:", err);
      return NextResponse.json(
        { error: "Impossibile aggiungere il prodotto alla spesa." },
        { status: 500 }
      );
    }
  }

  if (action === "toggle") {
    const { id, isBought } = body;
    if (typeof id !== "string" || typeof isBought !== "boolean") {
      return NextResponse.json(
        { error: "Parametri 'id' e 'isBought' obbligatori." },
        { status: 400 }
      );
    }

    try {
      let boughtByName: string | null = null;
      if (isBought) {
        const roommates = await repo.getRoommates();
        const currentRoommate = roommates.find((r) => r.id === roommateId);
        boughtByName = currentRoommate?.name || `Coinquilino ${roommateId + 1}`;
      }

      const boughtBy = isBought ? roommateId : null;
      const updated = await repo.toggleShoppingItem(id, isBought, boughtBy, boughtByName);
      if (!updated) {
        return NextResponse.json({ error: "Prodotto non trovato." }, { status: 404 });
      }
      const items = await repo.getShoppingItems();
      return NextResponse.json({ success: true, item: updated, items });
    } catch (err: any) {
      console.error("Errore aggiornamento elemento spesa:", err);
      return NextResponse.json(
        { error: "Impossibile aggiornare lo stato del prodotto." },
        { status: 500 }
      );
    }
  }

  if (action === "delete") {
    const { id } = body;
    if (typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ error: "Parametro 'id' obbligatorio." }, { status: 400 });
    }

    try {
      const deleted = await repo.deleteShoppingItem(id.trim());
      if (!deleted) {
        return NextResponse.json({ error: "Prodotto non trovato." }, { status: 404 });
      }
      const items = await repo.getShoppingItems();
      return NextResponse.json({ success: true, items });
    } catch (err: any) {
      console.error("Errore cancellazione elemento spesa:", err);
      return NextResponse.json(
        { error: "Impossibile eliminare il prodotto dalla lista." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Azione non riconosciuta." }, { status: 400 });
}
