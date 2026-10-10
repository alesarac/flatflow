import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/server";
import { getRepository } from "@/lib/db";
import {
  reportTrash,
  declineTrash,
  claimTrashTask,
} from "@/lib/domain/logic";

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

  const { action, roommateId: requestedRoommateId } = body;

  // Sicurezza: se il client invia un ID diverso da quello in sessione, rifiuta con HTTP 403
  if (requestedRoommateId !== undefined && requestedRoommateId !== session.roommateId) {
    return NextResponse.json(
      { error: "Non puoi eseguire azioni per conto di un altro coinquilino." },
      { status: 403 }
    );
  }

  // L'ID del coinquilino è ricavato direttamente dalla sessione firmata
  const roommateId = session.roommateId;
  const repo = getRepository();

  const [queue, openTask, roommates] = await Promise.all([
    repo.getTrashQueue(),
    repo.getOpenTrashTask(),
    repo.getRoommates(),
  ]);

  if (action === "report") {
    if (openTask && openTask.status === "open") {
      return NextResponse.json(
        { error: "C'è già una segnalazione di spazzatura aperta." },
        { status: 409 }
      );
    }

    try {
      const newTask = reportTrash(queue, openTask);
      await repo.createTrashTask(newTask);
      return NextResponse.json({ success: true, openTrashTask: newTask, trashQueue: queue });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore nella segnalazione della spazzatura";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (action === "decline") {
    if (!openTask) {
      return NextResponse.json({ error: "Nessun incarico di spazzatura aperto" }, { status: 404 });
    }

    // P1-02: Solo l'attuale incaricato può rinunciare
    if (openTask.assignedTo !== roommateId) {
      return NextResponse.json(
        { error: "Solo l'incaricato attuale della spazzatura può rinunciare." },
        { status: 403 }
      );
    }

    const updatedTask = declineTrash(openTask, queue, roommateId);
    const updated = await repo.updateTrashTask(updatedTask, {
      status: "open",
      assignedTo: roommateId,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "L'incarico di spazzatura è già stato completato o modificato da un'altra operazione." },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, openTrashTask: updatedTask, trashQueue: queue });
  }

  if (action === "complete") {
    if (!openTask) {
      return NextResponse.json({ error: "Nessun incarico di spazzatura aperto" }, { status: 404 });
    }

    const roommate = roommates.find((r) => r.id === roommateId);
    if (!roommate) {
      return NextResponse.json({ error: "Coinquilino non trovato" }, { status: 404 });
    }

    // P1-02: Se c'è un assegnatario, deve corrispondere rigorosamente
    if (openTask.assignedTo !== null) {
      if (openTask.assignedTo !== roommateId) {
        return NextResponse.json(
          { error: "Solo l'incaricato assegnato può contrassegnare la spazzatura come buttata." },
          { status: 403 }
        );
      }
    } else {
      // Se era senza assegnatario, chi la butta non deve aver già rinunciato senza offrirsi volontario
      if (openTask.declinedBy.includes(roommateId)) {
        return NextResponse.json(
          { error: "Un coinquilino che ha rinunciato non può farsi carico della spazzatura senza prima offrirsi volontario." },
          { status: 403 }
        );
      }
    }

    // P1-01: Completamento atomico con snapshot del nome verificato da DB
    const { queue: updatedQueue } = await repo.completeTrashAtomic(
      openTask.id,
      roommateId,
      roommate.name
    );

    return NextResponse.json({ success: true, openTrashTask: null, trashQueue: updatedQueue });
  }

  if (action === "claim") {
    if (!openTask) {
      return NextResponse.json({ error: "Nessun incarico di spazzatura aperto" }, { status: 404 });
    }

    // Il claim è consentito SOLO se l'incarico è attualmente privo di assegnatario (tutti hanno rinunciato)
    if (openTask.assignedTo !== null) {
      return NextResponse.json(
        { error: "L'incarico ha già un assegnatario." },
        { status: 409 }
      );
    }

    const roommate = roommates.find((r) => r.id === roommateId);
    if (!roommate) {
      return NextResponse.json({ error: "Coinquilino non trovato" }, { status: 404 });
    }

    // Assegna al volontario e rimuove l'eventuale sua precedente rinuncia da declinedBy
    const updatedTask = claimTrashTask(openTask, roommateId);
    const updated = await repo.updateTrashTask(updatedTask, {
      status: "open",
      assignedTo: null,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "L'incarico di spazzatura è già stato completato o assegnato ad un altro coinquilino." },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, openTrashTask: updatedTask, trashQueue: queue });
  }

  return NextResponse.json({ error: "Azione non riconosciuta" }, { status: 400 });
}
