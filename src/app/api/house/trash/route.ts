import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth/server";
import { getRepository } from "@/lib/db";
import { getWeekKey, reportTrash, declineTrash, reconcileOpenTrash } from "@/lib/domain/logic";

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

  const { action, roommateId } = body;
  const repo = getRepository();
  const currentWeekKey = getWeekKey(new Date());

  const [queue, rawOpenTask, currentWeek, roommates] = await Promise.all([
    repo.getTrashQueue(),
    repo.getOpenTrashTask(),
    repo.getWeekState(currentWeekKey),
    repo.getRoommates(),
  ]);

  let openTask = rawOpenTask;
  if (openTask && openTask.status === "open") {
    const reconciled = reconcileOpenTrash(openTask, queue, currentWeek.absentRoommates);
    if (reconciled && reconciled.assignedTo !== openTask.assignedTo) {
      await repo.updateTrashTask(reconciled);
      openTask = reconciled;
    }
  }


  if (action === "report") {
    if (openTask && openTask.status === "open") {
      return NextResponse.json(
        { error: "C'è già una segnalazione di spazzatura aperta." },
        { status: 409 }
      );
    }

    try {
      const newTask = reportTrash(queue, currentWeek.absentRoommates, openTask);
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

    if (typeof roommateId !== "number") {
      return NextResponse.json({ error: "Profilo coinquilino non specificato" }, { status: 400 });
    }

    // P1-02: Solo l'attuale incaricato può rinunciare
    if (openTask.assignedTo !== roommateId) {
      return NextResponse.json(
        { error: "Solo l'incaricato attuale della spazzatura può rinunciare." },
        { status: 403 }
      );
    }

    const updatedTask = declineTrash(openTask, queue, currentWeek.absentRoommates, roommateId);
    await repo.updateTrashTask(updatedTask);
    return NextResponse.json({ success: true, openTrashTask: updatedTask, trashQueue: queue });
  }

  if (action === "complete") {
    if (!openTask) {
      return NextResponse.json({ error: "Nessun incarico di spazzatura aperto" }, { status: 404 });
    }

    if (typeof roommateId !== "number") {
      return NextResponse.json({ error: "Profilo coinquilino non specificato" }, { status: 400 });
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
      // Se era senza assegnatario, chi la butta non deve essere assente
      if (currentWeek.absentRoommates.includes(roommateId)) {
        return NextResponse.json(
          { error: "Un coinquilino assente non può completare la spazzatura." },
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

    // Il claim è consentito SOLO se l'incarico è attualmente privo di assegnatario (tutti assenti/rinunce)
    if (openTask.assignedTo !== null) {
      return NextResponse.json(
        { error: "L'incarico ha già un assegnatario." },
        { status: 400 }
      );
    }

    if (typeof roommateId !== "number" || currentWeek.absentRoommates.includes(roommateId)) {
      return NextResponse.json(
        { error: "Solo un coinquilino disponibile e presente può farsi carico dell'attività." },
        { status: 403 }
      );
    }

    openTask.assignedTo = roommateId;
    await repo.updateTrashTask(openTask);
    return NextResponse.json({ success: true, openTrashTask: openTask, trashQueue: queue });
  }

  return NextResponse.json({ error: "Azione non riconosciuta" }, { status: 400 });
}
