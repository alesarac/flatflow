import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth/server";
import { getRepository } from "@/lib/db";
import { declineCleaningTask, getWeekKey, uncompleteCleaningTask } from "@/lib/domain/logic";
import { CleaningTask } from "@/lib/domain/types";

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
    // e ID stabile del coinquilino per autorizzare l'eventuale annullamento
    const taskToSave: CleaningTask = {
      ...task,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      completedByName: roommate.name,
      completedBy: roommateId,
      assignedTo: task.assignedTo !== null ? task.assignedTo : null,
      assignedToName: task.assignedToName !== null ? task.assignedToName : null,
    };

    // P1-02: Aggiornamento condizionale atomico: verifica che non sia già completato
    // e che assigned_to sia ancora esattamente quello verificato (incluso null se era privo di incaricato)
    const updated = await repo.updateCleaningTask(taskToSave, {
      isCompleted: false,
      assignedTo: task.assignedTo,
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

  if (action === "uncomplete" || action === "undo_complete") {
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

    if (!task.isCompleted) {
      return NextResponse.json(
        { error: "L'attività non risulta completata o è già stata annullata." },
        { status: 409 }
      );
    }

    // Consenti l'annullamento soltanto al profilo che ha registrato il completamento via ID stabile
    const canUndo =
      task.completedBy !== null && task.completedBy !== undefined
        ? task.completedBy === roommateId
        : task.completedByName === roommate.name;

    if (!canUndo) {
      return NextResponse.json(
        { error: "Solo il coinquilino che ha registrato il completamento può annullarlo." },
        { status: 403 }
      );
    }

    // Ripristina lo stato precedente e l'assegnatario legittimo
    const uncompletedTask = uncompleteCleaningTask(
      task,
      weekState.absentRoommates,
      roommates
    );

    // Aggiornamento condizionale atomico: verifica che l'attività sia ancora completata
    const updated = await repo.updateCleaningTask(uncompletedTask, {
      isCompleted: true,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "L'attività è già stata annullata o modificata da un'altra operazione." },
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
