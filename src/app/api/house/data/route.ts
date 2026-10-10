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
  // P1-03: Riconcilia la segnalazione aperta con le disponibilità della nuova settimana
  if (openTrashTask && openTrashTask.status === "open") {
    const reconciled = reconcileOpenTrash(
      openTrashTask,
      trashQueue,
      currentWeek.absentRoommates
    );
    if (reconciled && reconciled.assignedTo !== openTrashTask.assignedTo) {
      await repo.updateTrashTask(reconciled);
      openTrashTask = reconciled;
    }
  }

  return NextResponse.json({
    roommates,
    currentWeek,
    openTrashTask,
    trashQueue,
  });
}

