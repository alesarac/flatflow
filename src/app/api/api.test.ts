import { describe, it, expect, beforeEach } from "vitest";
import path from "path";
import fs from "fs";
import { LocalHouseRepository } from "@/lib/db/local";
import { setTestRepository } from "@/lib/db";
import { POST as loginRoute } from "./auth/login/route";
import { GET as checkRoute } from "./auth/check/route";
import { GET as houseDataRoute } from "./house/data/route";
import { POST as cleaningsRoute } from "./house/cleanings/route";
import { POST as trashRoute } from "./house/trash/route";
import { POST as roommatesRoute } from "./house/roommates/route";
import { GET as historyRoute } from "./house/history/route";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getWeekKey } from "@/lib/domain/logic";

const TEST_DB = path.join(process.cwd(), "data", "test-api-db.json");

describe("API Routes Integration Tests (P0, P1, P2)", () => {
  let repo: LocalHouseRepository;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
    repo = new LocalHouseRepository(TEST_DB);
    setTestRepository(repo);
    process.env.SESSION_SECRET = "super-secret-key-that-is-at-least-32-chars-long!";
    process.env.HOUSE_SECRET_CODE = "segreto123";
  });

  it("handles login verification and rate limiting (P0-02)", async () => {
    // Tentativo fallito
    const failedReq = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.1" },
      body: JSON.stringify({ code: "wrong" }),
    });

    const res1 = await loginRoute(failedReq);
    expect(res1.status).toBe(401);

    // Altri 4 tentativi falliti dallo stesso IP
    for (let i = 0; i < 4; i++) {
      await loginRoute(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.1" },
          body: JSON.stringify({ code: "wrong" }),
        })
      );
    }

    // Il 6° tentativo viene bloccato con 429
    const resLimited = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.1" },
        body: JSON.stringify({ code: "segreto123" }),
      })
    );
    expect(resLimited.status).toBe(429);

    // Da un altro IP, il login corretto riesce
    const successReq = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.2" },
      body: JSON.stringify({ code: "segreto123" }),
    });

    const resSuccess = await loginRoute(successReq);
    expect(resSuccess.status).toBe(200);
    const cookie = resSuccess.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBeDefined();
  });

  it("blocks unauthenticated access to house data and history", async () => {
    const unauthReq = new Request("http://localhost/api/house/data");
    const unauthRes = await houseDataRoute(unauthReq);
    expect(unauthRes.status).toBe(401);

    const checkReq = new Request("http://localhost/api/auth/check");
    const checkRes = await checkRoute(checkReq);
    const checkData = await checkRes.json();
    expect(checkData.authenticated).toBe(false);

    const historyReq = new Request("http://localhost/api/house/history");
    const historyRes = await historyRoute(historyReq);
    expect(historyRes.status).toBe(401);
  });

  it("rejects cleaning mutations on past or future weeks (P1-03)", async () => {
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    // Richiesta con settimana passata
    const pastWeekReq = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        action: "complete",
        weekKey: "2020-01-06", // Settimana passata arbitraria
        taskId: "2020-01-06-area-0",
        roommateId: 0,
      }),
    });

    const res = await cleaningsRoute(pastWeekReq);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("settimana corrente");
  });

  it("strictly rejects cleaning complete or decline if not performed by current assignee (P1-02)", async () => {
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];
    const assignedId = task.assignedTo!;
    const otherId = (assignedId + 1) % 3;

    // Roommate 'otherId' tenta di completare il task assegnato a 'assignedId'
    const wrongCompleteReq = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        action: "complete",
        weekKey: currentWeekKey,
        taskId: task.id,
        roommateId: otherId,
      }),
    });
    const resComplete = await cleaningsRoute(wrongCompleteReq);
    expect(resComplete.status).toBe(403);

    // Roommate 'otherId' tenta di rinunciare al task assegnato a 'assignedId'
    const wrongDeclineReq = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        action: "decline",
        weekKey: currentWeekKey,
        taskId: task.id,
        roommateId: otherId,
      }),
    });
    const resDecline = await cleaningsRoute(wrongDeclineReq);
    expect(resDecline.status).toBe(403);
  });

  it("enforces single open trash task and rejects actions from non-assignees (P1-01, P1-02)", async () => {
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    // 1. Segnala spazzatura piena
    const report1 = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "report" }),
      })
    );
    expect(report1.status).toBe(200);

    // 2. Seconda segnalazione simultanea deve fallire con 409 (P1-01)
    const report2 = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "report" }),
      })
    );
    expect(report2.status).toBe(409);

    const openTask = await repo.getOpenTrashTask();
    const assignedId = openTask!.assignedTo!;
    const otherId = (assignedId + 1) % 3;

    // 3. Altro coinquilino tenta di completare la spazzatura assegnata a un altro -> 403 (P1-02)
    const wrongComplete = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "complete", roommateId: otherId }),
      })
    );
    expect(wrongComplete.status).toBe(403);

    // 4. L'assegnatario corretto completa con successo
    const correctComplete = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "complete", roommateId: assignedId }),
      })
    );
    expect(correctComplete.status).toBe(200);
  });

  it("supports pagination in history API (P1-07)", async () => {
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    const histReq = new Request("http://localhost/api/house/history?limit=1&offset=0", {
      headers: authHeaders,
    });
    const histRes = await historyRoute(histReq);
    expect(histRes.status).toBe(200);
    const data = await histRes.json();
    expect(data.items).toBeDefined();
    expect(Array.isArray(data.items)).toBe(true);
  });
});
