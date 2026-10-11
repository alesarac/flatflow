import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/server";
import { getRepository } from "@/lib/db";
import {
  canUndoCleaningDecline,
  claimCleaningTask,
  declineCleaningTask,
  getWeekKey,
  uncompleteCleaningTask,
  undoDeclineCleaningTask,
} from "@/lib/domain/logic";
import { CleaningTask } from "@/lib/domain/types";

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

  const { action, weekKey, taskId, roommateId: requestedRoommateId } = body;

  // Sicurezza: se il client invia un ID diverso da quello in sessione, rifiuta con HTTP 403
  if (requestedRoommateId !== undefined && requestedRoommateId !== session.roommateId) {
    return NextResponse.json(
      { error: "Non puoi eseguire azioni per conto di un altro coinquilino." },
      { status: 403 }
    );
  }

  // L'ID del coinquilino è ricavato direttamente e con certezza dalla sessione firmata
  const roommateId = session.roommateId;
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
      // Se l'attività era senza incaricato (rinunce), chi la esegue non deve aver già rinunciato
      if (task.declinedBy.includes(roommateId)) {
        return NextResponse.json(
          { error: "Un coinquilino che ha rinunciato non può farsi carico dell'attività senza prima offrirsi volontario." },
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

  if (action === "claim") {
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

    // Il claim è consentito SOLO se l'attività è attualmente senza incaricato
    if (task.assignedTo !== null) {
      return NextResponse.json(
        { error: "L'attività ha già un incaricato assegnato." },
        { status: 409 }
      );
    }

    // Assegna al volontario e rimuove l'eventuale sua precedente rinuncia da declinedBy
    const updatedTask = claimCleaningTask(
      task,
      roommateId,
      roommates
    );

    // Aggiornamento condizionale atomico: verifica che non sia completata e sia ancora senza incaricato
    const updated = await repo.updateCleaningTask(updatedTask, {
      isCompleted: false,
      assignedTo: null,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "L'attività è già stata presa in carico o modificata da un'altra operazione." },
        { status: 409 }
      );
    }

    const updatedWeek = await repo.getWeekState(weekKey);
    return NextResponse.json({ success: true, week: updatedWeek });
  }

  if (action === "uncomplete" || action === "undo_complete") {
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

  if (action === "undo_decline") {
    const roommate = roommates.find((r) => r.id === roommateId);
    if (!roommate) {
      return NextResponse.json({ error: "Coinquilino non trovato" }, { status: 404 });
    }

    const task = weekState.cleanings.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json({ error: "Attività non trovata" }, { status: 404 });
    }

    if (task.isCompleted) {
      return NextResponse.json(
        { error: "L'attività è già stata completata; non è più possibile annullare la rinuncia." },
        { status: 409 }
      );
    }

    if (!canUndoCleaningDecline(task, roommateId)) {
      return NextResponse.json(
        {
          error:
            "Non è possibile annullare la rinuncia: un altro coinquilino ha già agito o non sei l'autore dell'ultima rinuncia.",
        },
        { status: 409 }
      );
    }

    const updatedTask = undoDeclineCleaningTask(task, roommateId, roommates);

    const updated = await repo.updateCleaningTask(updatedTask, {
      isCompleted: false,
      assignedTo: task.assignedTo,
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

  return NextResponse.json({ error: "Azione non riconosciuta" }, { status: 400 });
}
