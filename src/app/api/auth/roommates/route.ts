import { NextResponse } from "next/server";
import { getRepository } from "@/lib/db";

export async function GET() {
  try {
    const repo = getRepository();
    const roommates = await repo.getRoommates();
    return NextResponse.json({ roommates });
  } catch {
    return NextResponse.json(
      { error: "Impossibile recuperare i coinquilini dal server" },
      { status: 500 }
    );
  }
}
