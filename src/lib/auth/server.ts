import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  getSessionPayload,
  SessionPayload,
} from "./session";

export async function getRequestSession(req?: Request): Promise<SessionPayload | null> {
  if (req) {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match) {
      return getSessionPayload(decodeURIComponent(match[1]));
    }
  }

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    return getSessionPayload(sessionToken);
  } catch {
    return null;
  }
}

export async function isRequestAuthenticated(req?: Request): Promise<boolean> {
  const session = await getRequestSession(req);
  return session !== null;
}
