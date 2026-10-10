import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/server";

export async function GET(req: Request) {
  const session = await getRequestSession(req);
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    roommateId: session.roommateId,
  });
}
