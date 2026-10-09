import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth/server";
import { getRepository } from "@/lib/db";

export async function GET(req: Request) {
  const authenticated = await isRequestAuthenticated(req);
  if (!authenticated) {
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "30", 10), 1), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  const repo = getRepository();
  const result = await repo.getHistory(limit, offset);

  return NextResponse.json(result);
}
