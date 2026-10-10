import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth/server";
import { getRepository } from "@/lib/db";
import { declineCleaningTask, getWeekKey } from "@/lib/domain/logic";

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

  const { action, weekKey, taskId, roommateId, isAbsent } = body;
  const repo = getRepository();

  // P1-03: È consentito modificare ESCLUSIVAMENTE la settimana corrente
  const currentWeekKey = getWeekKey(new Date());
  if (!weekKey || weekKey !== currentWeekKey) {
    return NextResponse.json(
      { error: "È possibile modificare soltanto le attività della settimana corrente." },
      { status: 400 }
    );
  }

  const [weekState, roommates] = await Promise.all([
    repo.getWeekState(weekKey),
    repo.getRoommates(),
  ]);

  if (action === "complete") {
    if (typeof roommateId !== "number") {
      return NextResponse.json({ error: "Profilo coinquilino non specificato" }, { status: 400 });
    }

    const roommate = roommates.find((r) => r.id === roommateId);
    if (!roommate) {
      return NextResponse.json({ error: "Coinquilino non trovato" }, { status: 404 });
    }

    const task = weekState.cleanings.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json({ error: "Attività non trovata" }, { status: 404 });
    }

    if (task.isCompleted) {
      return NextResponse.json({ error: "L'attività risulta già completata." }, { status: 409 });
    }

    // P1-02: Verifica rigorosa dell'incaricato
    if (task.assignedTo !== null) {
      if (task.assignedTo !== roommateId) {
        return NextResponse.json(
          { error: "Solo l'incaricato assegnato a quest'area può contrassegnarla come completata." },
          { status: 403 }
        );
      }
    } else {
      // Se l'attività era senza incaricato (tutti assenti/rinunce), chi la esegue non deve essere assente o aver già rinunciato
      if (weekState.absentRoommates.includes(roommateId) || task.declinedBy.includes(roommateId)) {
        return NextResponse.json(
          { error: "Un coinquilino assente o che ha già rinunciato non può farsi carico dell'attività." },
          { status: 403 }
        );
      }
    }

    // Snapshot del nome ricavato direttamente dal database (non dal payload del client)
    const taskToSave = {
      ...task,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      completedByName: roommate.name,
      assignedTo: roommateId,
      assignedToName: roommate.name,
    };

    // P1-02: Aggiornamento condizionale atomico: verifica che non sia già completato
    const updated = await repo.updateCleaningTask(taskToSave, {
      isCompleted: false,
      ...(task.assignedTo !== null ? { assignedTo: roommateId } : {}),
    });

    if (!updated) {
      return NextResponse.json(
        { error: "L'attività è già stata completata o modificata da un'altra operazione." },
        { status: 409 }
      );
    }

    const updatedWeek = await repo.getWeekState(weekKey);
    return NextResponse.json({ success: true, week: updatedWeek });
  }

  if (action === "decline") {
    if (typeof roommateId !== "number") {
      return NextResponse.json({ error: "Profilo coinquilino non specificato" }, { status: 400 });
    }

    const task = weekState.cleanings.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json({ error: "Attività non trovata" }, { status: 404 });
    }

    if (task.isCompleted) {
      return NextResponse.json({ error: "L'attività è già completata." }, { status: 409 });
    }

    // P1-02: Solo l'attuale assegnatario può rinunciare
    if (task.assignedTo !== roommateId) {
      return NextResponse.json(
        { error: "Solo l'incaricato attuale dell'area può rinunciare." },
        { status: 403 }
      );
    }

    const updatedTask = declineCleaningTask(
      task,
      weekState.absentRoommates,
      roommateId,
      roommates
    );

    // P1-02: Aggiornamento condizionale atomico: verifica che sia ancora assegnato e non completato
    const updated = await repo.updateCleaningTask(updatedTask, {
      isCompleted: false,
      assignedTo: roommateId,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "L'attività è già stata modificata o completata da un'altra operazione." },
        { status: 409 }
      );
    }

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
