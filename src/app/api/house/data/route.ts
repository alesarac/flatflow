import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/server";
import { getRepository } from "@/lib/db";
import { getWeekKey } from "@/lib/domain/logic";

export async function GET(req: Request) {
  const session = await getRequestSession(req);
  if (!session) {
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 401 });
  }

  const repo = getRepository();
  const currentWeekKey = getWeekKey(new Date());

  const [roommates, currentWeek, openTrashTask, trashQueue] = await Promise.all([
    repo.getRoommates(),
    repo.getWeekState(currentWeekKey),
    repo.getOpenTrashTask(),
    repo.getTrashQueue(),
  ]);

  return NextResponse.json({
    roommates,
    currentWeek,
    openTrashTask,
    trashQueue,
    myRoommateId: session.roommateId,
  });
}
