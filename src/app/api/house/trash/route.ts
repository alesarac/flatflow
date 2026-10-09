import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth/server";
import { getRepository } from "@/lib/db";
import { getWeekKey, reportTrash, declineTrash, completeTrash } from "@/lib/domain/logic";

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

  const { action, roommateId, roommateName } = body;
  const repo = getRepository();
  const currentWeekKey = getWeekKey(new Date());

  const [queue, openTask, currentWeek] = await Promise.all([
    repo.getTrashQueue(),
    repo.getOpenTrashTask(),
    repo.getWeekState(currentWeekKey),
  ]);

  if (action === "report") {
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

    const updatedTask = declineTrash(openTask, queue, currentWeek.absentRoommates, roommateId);
    await repo.updateTrashTask(updatedTask);
    return NextResponse.json({ success: true, openTrashTask: updatedTask, trashQueue: queue });
  }

  if (action === "complete") {
    if (!openTask) {
      return NextResponse.json({ error: "Nessun incarico di spazzatura aperto" }, { status: 404 });
    }

    const { updatedTask, updatedQueue } = completeTrash(
      openTask,
      queue,
      roommateId,
      roommateName || "Coinquilino"
    );

    await Promise.all([
      repo.updateTrashTask(updatedTask),
      repo.updateTrashQueue(updatedQueue),
    ]);

    return NextResponse.json({ success: true, openTrashTask: null, trashQueue: updatedQueue });
  }

  if (action === "claim") {
    if (!openTask) {
      return NextResponse.json({ error: "Nessun incarico di spazzatura aperto" }, { status: 404 });
    }

    openTask.assignedTo = roommateId;
    await repo.updateTrashTask(openTask);
    return NextResponse.json({ success: true, openTrashTask: openTask, trashQueue: queue });
  }

  return NextResponse.json({ error: "Azione non riconosciuta" }, { status: 400 });
}
