import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth/server";

export async function GET(req: Request) {
  const authenticated = await isRequestAuthenticated(req);
  return NextResponse.json({ authenticated });
}
