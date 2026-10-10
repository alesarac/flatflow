import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth/server";
import { getRepository } from "@/lib/db";
import { getWeekKey, reconcileOpenTrash } from "@/lib/domain/logic";

export async function GET(req: Request) {
  const authenticated = await isRequestAuthenticated(req);
  if (!authenticated) {
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 401 });
  }

  const repo = getRepository();
  const currentWeekKey = getWeekKey(new Date());

  const [roommates, currentWeek, initialTrash, trashQueue] = await Promise.all([
    repo.getRoommates(),
    repo.getWeekState(currentWeekKey),
    repo.getOpenTrashTask(),
    repo.getTrashQueue(),
  ]);

  let openTrashTask = initialTrash;
  // P1-03 & P1-01: Riconcilia la segnalazione aperta con le disponibilità della nuova settimana
  if (openTrashTask && openTrashTask.status === "open") {
    const previousAssignee = openTrashTask.assignedTo;
    const reconciled = reconcileOpenTrash(
      openTrashTask,
      trashQueue,
      currentWeek.absentRoommates
    );
    if (reconciled && reconciled.assignedTo !== previousAssignee) {
      const updated = await repo.updateTrashTask(reconciled, {
        status: "open",
        assignedTo: previousAssignee,
      });
      if (updated) {
        openTrashTask = reconciled;
      } else {
        // Se la riassegnazione condizionale non è andata a buon fine (es. compito completato nel frattempo),
        // rileggi lo stato attuale per non restituire dati obsoleti o riaperti
        openTrashTask = await repo.getOpenTrashTask();
      }
    }
  }


  return NextResponse.json({
    roommates,
    currentWeek,
    openTrashTask,
    trashQueue,
  });
}

