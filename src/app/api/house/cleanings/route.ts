import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth/server";
import { getRepository } from "@/lib/db";
import { declineCleaningTask } from "@/lib/domain/logic";

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

  const { action, weekKey, taskId, roommateId, roommateName, isAbsent } = body;
  const repo = getRepository();
  const weekState = await repo.getWeekState(weekKey);

  if (action === "complete") {
    const task = weekState.cleanings.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json({ error: "Attività non trovata" }, { status: 404 });
    }

    task.isCompleted = true;
    task.completedAt = new Date().toISOString();
    task.completedByName = roommateName || "Coinquilino";
    await repo.updateCleaningTask(task);

    const updatedWeek = await repo.getWeekState(weekKey);
    return NextResponse.json({ success: true, week: updatedWeek });
  }

  if (action === "decline") {
    const task = weekState.cleanings.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json({ error: "Attività non trovata" }, { status: 404 });
    }

    const updatedTask = declineCleaningTask(task, weekState.absentRoommates, roommateId);
    await repo.updateCleaningTask(updatedTask);

    const updatedWeek = await repo.getWeekState(weekKey);
    return NextResponse.json({ success: true, week: updatedWeek });
  }

  if (action === "set_absence") {
    if (typeof roommateId !== "number" || typeof isAbsent !== "boolean") {
      return NextResponse.json({ error: "Parametri assenza non validi" }, { status: 400 });
    }

    const updatedWeek = await repo.setRoommateAbsence(weekKey, roommateId, isAbsent);
    return NextResponse.json({ success: true, week: updatedWeek });
  }

  return NextResponse.json({ error: "Azione non riconosciuta" }, { status: 400 });
}
