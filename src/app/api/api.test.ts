import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { LocalHouseRepository } from "@/lib/db/local";
import { setTestRepository } from "@/lib/db";
import { POST as loginRoute } from "./auth/login/route";
import { POST as logoutRoute } from "./auth/logout/route";
import { GET as checkRoute } from "./auth/check/route";
import { GET as authRoommatesRoute } from "./auth/roommates/route";
import { GET as houseDataRoute } from "./house/data/route";
import { POST as cleaningsRoute } from "./house/cleanings/route";
import { POST as trashRoute } from "./house/trash/route";
import { POST as roommatesRoute } from "./house/roommates/route";
import { GET as historyRoute } from "./house/history/route";
import { GET as getShoppingRoute, POST as postShoppingRoute } from "./house/shopping/route";
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
    // Tentativo fallito: codice errato
    const failedReq = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.1" },
      body: JSON.stringify({ code: "wrong", roommateId: 0 }),
    });

    const res1 = await loginRoute(failedReq);
    expect(res1.status).toBe(401);

    // Altri 4 tentativi falliti dallo stesso IP
    for (let i = 0; i < 4; i++) {
      await loginRoute(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.1" },
          body: JSON.stringify({ code: "wrong", roommateId: 0 }),
        })
      );
    }

    // Il 6° tentativo viene bloccato con 429
    const resLimited = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.1" },
        body: JSON.stringify({ code: "segreto123", roommateId: 0 }),
      })
    );
    expect(resLimited.status).toBe(429);

    // Da un altro IP, il login corretto riesce
    const successReq = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.2" },
      body: JSON.stringify({ code: "segreto123", roommateId: 0 }),
    });

    const resSuccess = await loginRoute(successReq);
    expect(resSuccess.status).toBe(200);
    const cookie = resSuccess.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBeDefined();
    const successData = await resSuccess.json();
    expect(successData.roommateId).toBe(0);
    expect(successData.name).toBe("Coinquilino 1");
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
    const token = createSessionToken(0);
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
    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];
    const assignedId = task.assignedTo!;
    const otherId = (assignedId + 1) % 3;

    const tokenOther = createSessionToken(otherId);
    const authHeadersOther = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${tokenOther}`,
    };

    // Roommate 'otherId' tenta di completare il task assegnato a 'assignedId'
    const wrongCompleteReq = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeadersOther,
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
      headers: authHeadersOther,
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
    // 1. Segnala spazzatura piena
    const report1 = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(0)}`,
        },
        body: JSON.stringify({ action: "report" }),
      })
    );
    expect(report1.status).toBe(200);

    // 2. Seconda segnalazione simultanea deve fallire con 409 (P1-01)
    const report2 = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(0)}`,
        },
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
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(otherId)}`,
        },
        body: JSON.stringify({ action: "complete", roommateId: otherId }),
      })
    );
    expect(wrongComplete.status).toBe(403);

    // 4. L'assegnatario corretto completa con successo
    const correctComplete = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(assignedId)}`,
        },
        body: JSON.stringify({ action: "complete", roommateId: assignedId }),
      })
    );
    expect(correctComplete.status).toBe(200);
  });

  it("supports pagination in history API (P1-07)", async () => {
    const token = createSessionToken(0);
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

  it("prevents lost updates and handles concurrent completion, decline, and absence (P1-02)", async () => {
    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];
    const assignedId = task.assignedTo!;

    const token = createSessionToken(assignedId);
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    // 1. Primo completamento riesce
    const completeReq1 = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        action: "complete",
        weekKey: currentWeekKey,
        taskId: task.id,
        roommateId: assignedId,
      }),
    });
    const res1 = await cleaningsRoute(completeReq1);
    expect(res1.status).toBe(200);

    // 2. Secondo completamento simultaneo/ripetuto riceve 409 Conflict
    const completeReq2 = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        action: "complete",
        weekKey: currentWeekKey,
        taskId: task.id,
        roommateId: assignedId,
      }),
    });
    const res2 = await cleaningsRoute(completeReq2);
    expect(res2.status).toBe(409);

    // 3. Tentativo di rinuncia su compito già completato riceve 409 Conflict
    const declineReq = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        action: "decline",
        weekKey: currentWeekKey,
        taskId: task.id,
        roommateId: assignedId,
      }),
    });
    const resDecline = await cleaningsRoute(declineReq);
    expect(resDecline.status).toBe(409);

    const updatedWeek = await repo.getWeekState(currentWeekKey);
    const completedTask = updatedWeek.cleanings.find((t) => t.id === task.id);
    expect(completedTask?.isCompleted).toBe(true);
    expect(completedTask?.assignedTo).toBe(assignedId);
    expect(completedTask?.completedByName).toBeDefined();
  });

  it("prevents completed trash from ever being reopened by concurrent reassignment or decline (P1-01)", async () => {
    const token0 = createSessionToken(0);
    const authHeaders0 = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token0}`,
    };

    // 1. Segnala spazzatura (assegnata a Roommate 0)
    const reportRes = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders0,
        body: JSON.stringify({ action: "report" }),
      })
    );
    expect(reportRes.status).toBe(200);

    const openTask = await repo.getOpenTrashTask();
    expect(openTask).toBeDefined();
    const taskId = openTask!.id;

    // 2. Roommate 0 completa la spazzatura via completamento atomico
    const completeRes = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders0,
        body: JSON.stringify({ action: "complete", roommateId: 0 }),
      })
    );
    expect(completeRes.status).toBe(200);

    // Ora il compito risulta completato e nessun compito risulta aperto
    expect(await repo.getOpenTrashTask()).toBeNull();

    // 3. Una richiesta concorrente tenta di rinunciare
    const declineRes = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders0,
        body: JSON.stringify({ action: "decline", roommateId: 0 }),
      })
    );
    expect([404, 409]).toContain(declineRes.status);

    // 4. Tentativo diretto di updateTrashTask condizionale sul task completato deve fallire
    const staleTask = {
      id: taskId,
      status: "open" as const,
      assignedTo: 1,
      declinedBy: [0],
      reportedAt: new Date().toISOString(),
      completedAt: null,
      completedByName: null,
    };
    const updateSuccess = await repo.updateTrashTask(staleTask, {
      status: "open",
      assignedTo: 0,
    });
    expect(updateSuccess).toBe(false);

    // 5. Verifica assoluta: nel repository il task DEVE rimanere rigorosamente completato
    const allTasks = (repo as any).data.trashTasks;
    const taskInDb = allTasks.find((t: any) => t.id === taskId);
    expect(taskInDb.status).toBe("completed");
    expect(taskInDb.completedByName).toBe("Coinquilino 1");
    expect(await repo.getOpenTrashTask()).toBeNull();
  });

  it("prevents completing an unassigned cleaning if assigned_to is no longer null (P1-02)", async () => {
    const token1 = createSessionToken(1);
    const authHeaders1 = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token1}`,
    };

    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];

    // 1. Il task è inizialmente privo di assegnatario (tutti assenti/rinunce)
    task.assignedTo = null;
    task.assignedToName = null;
    await repo.updateCleaningTask(task);

    // 2. Simula race condition concorrente
    const originalGetWeekState = repo.getWeekState.bind(repo);
    let readCount = 0;
    const spy = vi.spyOn(repo, "getWeekState").mockImplementation(async (key) => {
      readCount++;
      const state = await originalGetWeekState(key);
      if (readCount === 1) {
        const clonedCleanings = state.cleanings.map((c) => ({ ...c }));
        clonedCleanings[0].assignedTo = null;
        clonedCleanings[0].assignedToName = null;

        (repo as any).data.cleanings[key][0].assignedTo = 2;
        (repo as any).data.cleanings[key][0].assignedToName = "Coinquilino 3";

        return { ...state, cleanings: clonedCleanings };
      }
      return state;
    });

    const completeReq = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders1,
      body: JSON.stringify({
        action: "complete",
        weekKey: currentWeekKey,
        taskId: task.id,
        roommateId: 1,
      }),
    });

    const res = await cleaningsRoute(completeReq);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("completata o modificata");

    spy.mockRestore();

    const directUpdate = await repo.updateCleaningTask(
      { ...task, isCompleted: true },
      { isCompleted: false, assignedTo: null }
    );
    expect(directUpdate).toBe(false);
  });

  it("ensures cascading declines never assign a cleaning to a declined roommate and results in null when all decline (P1-02)", async () => {
    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0]; // Area 0 assegnata a Roommate 0
    expect(task.assignedTo).toBe(0);

    // 1. Roommate 0 rinuncia all'area 0 con la propria sessione
    const declineRes1 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(0)}`,
        },
        body: JSON.stringify({
          action: "decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: 0,
        }),
      })
    );
    expect(declineRes1.status).toBe(200);

    let currentWeek = await repo.getWeekState(currentWeekKey);
    let area0 = currentWeek.cleanings.find((t) => t.id === task.id)!;
    expect(area0.assignedTo).toBe(1);
    expect(area0.declinedBy).toEqual([0]);

    // 2. Roommate 1 rinuncia con la propria sessione
    const declineRes2 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(1)}`,
        },
        body: JSON.stringify({
          action: "decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: 1,
        }),
      })
    );
    expect(declineRes2.status).toBe(200);

    currentWeek = await repo.getWeekState(currentWeekKey);
    area0 = currentWeek.cleanings.find((t) => t.id === task.id)!;
    expect(area0.assignedTo).toBe(2);
    expect(area0.declinedBy).toEqual([0, 1]);

    // 3. Roommate 2 rinuncia con la propria sessione
    const declineRes3 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(2)}`,
        },
        body: JSON.stringify({
          action: "decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: 2,
        }),
      })
    );
    expect(declineRes3.status).toBe(200);

    currentWeek = await repo.getWeekState(currentWeekKey);
    area0 = currentWeek.cleanings.find((t) => t.id === task.id)!;
    expect(area0.assignedTo).toBeNull();
    expect(area0.declinedBy).toEqual([0, 1, 2]);
  });

  it("allows undoing cleaning completion in current week by the profile that completed it, maintaining consistent history", async () => {
    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];
    const assignedId = task.assignedTo!;

    const token = createSessionToken(assignedId);
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    // 1. Completa il compito
    const completeRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "complete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: assignedId,
        }),
      })
    );
    expect(completeRes.status).toBe(200);

    let updatedWeek = await repo.getWeekState(currentWeekKey);
    let updatedTask = updatedWeek.cleanings.find((t) => t.id === task.id)!;
    expect(updatedTask.isCompleted).toBe(true);
    expect(updatedTask.completedByName).toBe("Coinquilino 1");

    let historyRes = await historyRoute(
      new Request("http://localhost/api/house/history", {
        headers: authHeaders,
      })
    );
    let historyData = await historyRes.json();
    const foundInHistory = historyData.items.find((item: any) => item.id === `clean-${task.id}`);
    expect(foundInHistory).toBeDefined();
    expect(foundInHistory.status).toBe("completed");

    // 2. Annulla il completamento con il profilo corretto
    const undoRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "uncomplete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: assignedId,
        }),
      })
    );
    expect(undoRes.status).toBe(200);

    updatedWeek = await repo.getWeekState(currentWeekKey);
    updatedTask = updatedWeek.cleanings.find((t) => t.id === task.id)!;
    expect(updatedTask.isCompleted).toBe(false);
    expect(updatedTask.completedAt).toBeNull();
    expect(updatedTask.completedByName).toBeNull();
    expect(updatedTask.assignedTo).toBe(assignedId);

    historyRes = await historyRoute(
      new Request("http://localhost/api/house/history", {
        headers: authHeaders,
      })
    );
    historyData = await historyRes.json();
    const notFoundInHistory = historyData.items.find((item: any) => item.id === `clean-${task.id}`);
    expect(notFoundInHistory).toBeUndefined();
  });

  it("verifies server-side authorization and error cases for cleaning undo (profile mismatch, past week, already undone)", async () => {
    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[1];
    const assignedId = task.assignedTo!;

    const tokenAssigned = createSessionToken(assignedId);
    const authHeadersAssigned = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${tokenAssigned}`,
    };

    // Completa il compito
    await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersAssigned,
        body: JSON.stringify({
          action: "complete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: assignedId,
        }),
      })
    );

    // 1. Profilo non corrispondente riceve 403 Forbidden
    const otherId = (assignedId + 1) % 3;
    const tokenOther = createSessionToken(otherId);
    const authHeadersOther = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${tokenOther}`,
    };

    const wrongProfileRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersOther,
        body: JSON.stringify({
          action: "uncomplete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: otherId,
        }),
      })
    );
    expect(wrongProfileRes.status).toBe(403);
    const wrongData = await wrongProfileRes.json();
    expect(wrongData.error).toContain("registrato il completamento");

    // 2. Richiesta per settimana passata riceve 400 Bad Request
    const pastWeekRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersAssigned,
        body: JSON.stringify({
          action: "uncomplete",
          weekKey: "2026-01-05",
          taskId: task.id,
          roommateId: assignedId,
        }),
      })
    );
    expect(pastWeekRes.status).toBe(400);

    // 3. Annullamento riuscito con profilo legittimo
    const validUndo = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersAssigned,
        body: JSON.stringify({
          action: "uncomplete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: assignedId,
        }),
      })
    );
    expect(validUndo.status).toBe(200);

    // 4. Tentativo ripetuto su compito già non completato riceve 409 Conflict
    const repeatedUndo = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersAssigned,
        body: JSON.stringify({
          action: "uncomplete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: assignedId,
        }),
      })
    );
    expect(repeatedUndo.status).toBe(409);
  });

  it("handles concurrent uncomplete requests and restores unassigned tasks correctly (assignedTo: null)", async () => {
    const token0 = createSessionToken(0);
    const authHeaders0 = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token0}`,
    };

    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[2];

    // 1. Simula attività originariamente senza incaricato
    task.assignedTo = null;
    task.assignedToName = null;
    task.declinedBy = [];
    await repo.updateCleaningTask(task);

    // 2. Coinquilino 0 completa il compito
    const completeRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders0,
        body: JSON.stringify({
          action: "complete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: 0,
        }),
      })
    );
    expect(completeRes.status).toBe(200);

    // 3. Simula richieste concorrenti di annullamento
    const undoReq1 = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders0,
      body: JSON.stringify({
        action: "uncomplete",
        weekKey: currentWeekKey,
        taskId: task.id,
        roommateId: 0,
      }),
    });
    const undoReq2 = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders0,
      body: JSON.stringify({
        action: "uncomplete",
        weekKey: currentWeekKey,
        taskId: task.id,
        roommateId: 0,
      }),
    });

    const [res1, res2] = await Promise.all([
      cleaningsRoute(undoReq1),
      cleaningsRoute(undoReq2),
    ]);
    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    const finalWeek = await repo.getWeekState(currentWeekKey);
    const finalTask = finalWeek.cleanings.find((t) => t.id === task.id)!;
    expect(finalTask.isCompleted).toBe(false);
    expect(finalTask.completedAt).toBeNull();
    expect(finalTask.completedByName).toBeNull();
    expect(finalTask.completedBy).toBeNull();
    expect(finalTask.assignedTo).toBeNull();
    expect(finalTask.assignedToName).toBeNull();
  });

  it("authorizes uncomplete via stable roommate ID even if roommate changes name or shares identical name (Bug 1)", async () => {
    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[1];
    const assignedId = task.assignedTo!;

    const tokenAssigned = createSessionToken(assignedId);
    const authHeadersAssigned = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${tokenAssigned}`,
    };

    // 1. Il coinquilino completa il compito
    const completeRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersAssigned,
        body: JSON.stringify({
          action: "complete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: assignedId,
        }),
      })
    );
    expect(completeRes.status).toBe(200);

    // 2. Il coinquilino cambia il suo nome
    await repo.updateRoommate(assignedId, "Nome Modificato");

    // 3. Un altro coinquilino con ID diverso tenta di annullare -> 403 Forbidden
    const otherId = (assignedId + 1) % 3;
    const tokenOther = createSessionToken(otherId);
    const unauthorizedRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${tokenOther}`,
        },
        body: JSON.stringify({
          action: "uncomplete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: otherId,
        }),
      })
    );
    expect(unauthorizedRes.status).toBe(403);

    // 4. Il coinquilino originale con ID stabile annulla con successo
    const authorizedRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersAssigned,
        body: JSON.stringify({
          action: "uncomplete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: assignedId,
        }),
      })
    );
    expect(authorizedRes.status).toBe(200);

    // 5. Ripristina il nome originale del coinquilino
    await repo.updateRoommate(assignedId, `Coinquilino ${assignedId + 1}`);
  });

  it("preserves previous reassignment from decline when uncompleting (Bug 2)", async () => {
    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];
    const originalAssignee = task.assignedTo!;

    // 1. L'assegnatario originale rinuncia con la propria sessione
    const declineRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(originalAssignee)}`,
        },
        body: JSON.stringify({
          action: "decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: originalAssignee,
        }),
      })
    );
    expect(declineRes.status).toBe(200);
    const declinedWeek = (await declineRes.json()).week;
    const declinedTask = declinedWeek.cleanings.find((t: any) => t.id === task.id);
    const substituteId = declinedTask.assignedTo;
    expect(substituteId).not.toBe(originalAssignee);
    expect(declinedTask.declinedBy).toContain(originalAssignee);

    // 2. Il sostituto completa il compito con la propria sessione
    const completeRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(substituteId)}`,
        },
        body: JSON.stringify({
          action: "complete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: substituteId,
        }),
      })
    );
    expect(completeRes.status).toBe(200);

    // 3. Il sostituto annulla il completamento con la propria sessione
    const undoRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(substituteId)}`,
        },
        body: JSON.stringify({
          action: "uncomplete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: substituteId,
        }),
      })
    );
    expect(undoRes.status).toBe(200);

    // 4. L'assegnazione DEVE restare al sostituto e NON tornare all'assegnatario originale
    const finalWeek = (await undoRes.json()).week;
    const finalTask = finalWeek.cleanings.find((t: any) => t.id === task.id);
    expect(finalTask.isCompleted).toBe(false);
    expect(finalTask.assignedTo).toBe(substituteId);
    expect(finalTask.declinedBy).toContain(originalAssignee);
  });

  it("allows a roommate to undo their decline ('Non posso') and restores previous task state", async () => {
    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];
    const originalAssignee = task.assignedTo!;

    // 1. L'assegnatario rinuncia con 'decline'
    const declineRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(originalAssignee)}`,
        },
        body: JSON.stringify({
          action: "decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: originalAssignee,
        }),
      })
    );
    expect(declineRes.status).toBe(200);
    const declinedWeek = (await declineRes.json()).week;
    const declinedTask = declinedWeek.cleanings.find((t: any) => t.id === task.id);
    expect(declinedTask.assignedTo).not.toBe(originalAssignee);
    expect(declinedTask.declinedBy).toEqual([originalAssignee]);

    // 2. L'assegnatario annulla la rinuncia con 'undo_decline'
    const undoRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(originalAssignee)}`,
        },
        body: JSON.stringify({
          action: "undo_decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: originalAssignee,
        }),
      })
    );
    expect(undoRes.status).toBe(200);
    const restoredWeek = (await undoRes.json()).week;
    const restoredTask = restoredWeek.cleanings.find((t: any) => t.id === task.id);
    expect(restoredTask.assignedTo).toBe(originalAssignee);
    expect(restoredTask.declinedBy).toEqual([]);
    expect(restoredTask.isCompleted).toBe(false);
  });

  it("verifies server-side authorization and restrictions for undo_decline (profile mismatch, past week, impersonation)", async () => {
    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[1];
    const originalAssignee = task.assignedTo!;
    const otherRoommate = (originalAssignee + 1) % 3;

    // 1. Rinuncia legittima
    await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(originalAssignee)}`,
        },
        body: JSON.stringify({
          action: "decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: originalAssignee,
        }),
      })
    );

    // Impersonation (token originale ma body con ID altrui) -> 403
    const impersonateRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(originalAssignee)}`,
        },
        body: JSON.stringify({
          action: "undo_decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: otherRoommate,
        }),
      })
    );
    expect(impersonateRes.status).toBe(403);

    // Profilo non autorizzato (token di un coinquilino che non ha rinunciato) -> 409
    const unauthorizedRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(otherRoommate)}`,
        },
        body: JSON.stringify({
          action: "undo_decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: otherRoommate,
        }),
      })
    );
    expect(unauthorizedRes.status).toBe(409);

    // Settimana passata -> 400
    const pastWeekRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(originalAssignee)}`,
        },
        body: JSON.stringify({
          action: "undo_decline",
          weekKey: "2026-01-05",
          taskId: task.id,
          roommateId: originalAssignee,
        }),
      })
    );
    expect(pastWeekRes.status).toBe(400);

    // Cleanup: ripristina il compito
    await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(originalAssignee)}`,
        },
        body: JSON.stringify({
          action: "undo_decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: originalAssignee,
        }),
      })
    );
  });

  it("blocks undo_decline if the new assignee has already acted (declined or completed)", async () => {
    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[2];
    const firstAssignee = task.assignedTo!;

    // 1. Primo coinquilino rinuncia
    const decline1Res = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(firstAssignee)}`,
        },
        body: JSON.stringify({
          action: "decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: firstAssignee,
        }),
      })
    );
    const secondAssignee = (await decline1Res.json()).week.cleanings.find((t: any) => t.id === task.id).assignedTo;

    // 2. Secondo coinquilino rinuncia a sua volta
    const decline2Res = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(secondAssignee)}`,
        },
        body: JSON.stringify({
          action: "decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: secondAssignee,
        }),
      })
    );
    expect(decline2Res.status).toBe(200);

    // 3. Il primo coinquilino tenta di annullare la vecchia rinuncia -> 409 Conflict
    const blockedUndo1 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(firstAssignee)}`,
        },
        body: JSON.stringify({
          action: "undo_decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: firstAssignee,
        }),
      })
    );
    expect(blockedUndo1.status).toBe(409);

    // 4. Il secondo coinquilino (l'ultimo) PUÒ annullare la sua rinuncia
    const validUndo2 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(secondAssignee)}`,
        },
        body: JSON.stringify({
          action: "undo_decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: secondAssignee,
        }),
      })
    );
    expect(validUndo2.status).toBe(200);

    // 5. Ora che il secondo ha annullato, il primo può a sua volta annullare la prima rinuncia!
    const validUndo1 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(firstAssignee)}`,
        },
        body: JSON.stringify({
          action: "undo_decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: firstAssignee,
        }),
      })
    );
    expect(validUndo1.status).toBe(200);
  });
});

describe("Profilo Univoco & Sicurezza Sessione Coinquilino", () => {
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

  it("recupera l'elenco dei coinquilini per la schermata di login da GET /api/auth/roommates", async () => {
    const res = await authRoommatesRoute();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.roommates).toBeDefined();
    expect(Array.isArray(data.roommates)).toBe(true);
    expect(data.roommates.length).toBe(3);
    expect(data.roommates[0]).toEqual({ id: 0, name: "Coinquilino 1" });
    expect(data.roommates[1]).toEqual({ id: 1, name: "Coinquilino 2" });
    expect(data.roommates[2]).toEqual({ id: 2, name: "Coinquilino 3" });
  });

  it("consente il login iniziale valido per ciascuno dei tre ID (0, 1, 2) salvando il profilo in sessione", async () => {
    for (const id of [0, 1, 2]) {
      const req = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "segreto123", roommateId: id }),
      });
      const res = await loginRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.roommateId).toBe(id);
      expect(data.name).toBe(`Coinquilino ${id + 1}`);

      const cookieVal = res.cookies.get(SESSION_COOKIE_NAME)?.value;
      expect(cookieVal).toBeDefined();

      // Verifica GET /api/auth/check
      const checkRes = await checkRoute(
        new Request("http://localhost/api/auth/check", {
          headers: { Cookie: `${SESSION_COOKIE_NAME}=${cookieVal}` },
        })
      );
      const checkData = await checkRes.json();
      expect(checkData.authenticated).toBe(true);
      expect(checkData.roommateId).toBe(id);
    }
  });

  it("richiede sia il codice casa sia il roommateId valido al login", async () => {
    // Mancanza di roommateId
    const reqNoProfile = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "segreto123" }),
    });
    const resNoProfile = await loginRoute(reqNoProfile);
    expect(resNoProfile.status).toBe(400);

    // ID coinquilino non valido (es. 5)
    const reqInvalidProfile = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "segreto123", roommateId: 5 }),
    });
    const resInvalidProfile = await loginRoute(reqInvalidProfile);
    expect(resInvalidProfile.status).toBe(400);
  });

  it("rifiuta con HTTP 409 un secondo login se esiste già una sessione attiva valida", async () => {
    // 1. Primo login valido come Coinquilino 0
    const loginReq = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "segreto123", roommateId: 0 }),
    });
    const loginRes = await loginRoute(loginReq);
    expect(loginRes.status).toBe(200);
    const validCookie = loginRes.cookies.get(SESSION_COOKIE_NAME)!.value;

    // 2. Tentativo di secondo login inviando il cookie di sessione attivo (anche con ID diverso) -> 409 Conflict
    const secondLoginReq = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${validCookie}`,
      },
      body: JSON.stringify({ code: "segreto123", roommateId: 1 }),
    });
    const secondLoginRes = await loginRoute(secondLoginReq);
    expect(secondLoginRes.status).toBe(409);
    const secondLoginData = await secondLoginRes.json();
    expect(secondLoginData.error).toContain("logout");
  });

  it("consente il logout e il successivo login con un altro profilo", async () => {
    // 1. Login iniziale come Coinquilino 0
    const login0 = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "segreto123", roommateId: 0 }),
      })
    );
    expect(login0.status).toBe(200);

    // 2. Esecuzione logout
    const logoutRes = await logoutRoute();
    expect(logoutRes.status).toBe(200);

    // 3. Nuovo login senza cookie o dopo logout come Coinquilino 2 -> 200 OK
    const login2 = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "segreto123", roommateId: 2 }),
      })
    );
    expect(login2.status).toBe(200);
    const data2 = await login2.json();
    expect(data2.roommateId).toBe(2);
    expect(data2.name).toBe("Coinquilino 3");
  });

  it("invalida le vecchie sessioni prive di roommateId ma non impedisce un nuovo accesso", async () => {
    // Genera un vecchio token valido per HMAC ma privo del campo roommateId
    const oldPayload = {
      houseId: "default",
      authenticatedAt: Date.now(),
    };
    const payloadB64 = Buffer.from(JSON.stringify(oldPayload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", process.env.SESSION_SECRET!)
      .update(payloadB64)
      .digest("base64url");
    const legacyToken = `${payloadB64}.${signature}`;
    const legacyHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${legacyToken}`,
    };

    // 1. Le API protette restituiscono 401
    const checkRes = await checkRoute(
      new Request("http://localhost/api/auth/check", { headers: legacyHeaders })
    );
    expect((await checkRes.json()).authenticated).toBe(false);

    const dataRes = await houseDataRoute(
      new Request("http://localhost/api/house/data", { headers: legacyHeaders })
    );
    expect(dataRes.status).toBe(401);

    const cleaningsRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: legacyHeaders,
        body: JSON.stringify({ action: "complete" }),
      })
    );
    expect(cleaningsRes.status).toBe(401);

    const trashRes = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: legacyHeaders,
        body: JSON.stringify({ action: "report" }),
      })
    );
    expect(trashRes.status).toBe(401);

    const roommatesRes = await roommatesRoute(
      new Request("http://localhost/api/house/roommates", {
        method: "POST",
        headers: legacyHeaders,
        body: JSON.stringify({ id: 0, name: "Test" }),
      })
    );
    expect(roommatesRes.status).toBe(401);

    const historyRes = await historyRoute(
      new Request("http://localhost/api/house/history", { headers: legacyHeaders })
    );
    expect(historyRes.status).toBe(401);

    // 2. Un nuovo login NON viene bloccato da 409 anche se la richiesta presenta il vecchio token
    const loginWithLegacy = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${SESSION_COOKIE_NAME}=${legacyToken}`,
        },
        body: JSON.stringify({ code: "segreto123", roommateId: 1 }),
      })
    );
    expect(loginWithLegacy.status).toBe(200);
    const newSessionData = await loginWithLegacy.json();
    expect(newSessionData.roommateId).toBe(1);
  });

  it("rifiuta con 403 Forbidden tentativi di impersonificazione o modifica di altri coinquilini", async () => {
    // Sessione collegata al coinquilino 0
    const token0 = createSessionToken(0);
    const authHeaders0 = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token0}`,
    };

    // 1. Modifica nome: Coinquilino 0 tenta di rinominare Coinquilino 1 -> 403
    const editOtherNameRes = await roommatesRoute(
      new Request("http://localhost/api/house/roommates", {
        method: "POST",
        headers: authHeaders0,
        body: JSON.stringify({ id: 1, name: "Intruso" }),
      })
    );
    expect(editOtherNameRes.status).toBe(403);
    const editOtherData = await editOtherNameRes.json();
    expect(editOtherData.error).toContain("esclusivamente il tuo profilo");

    // 2. Modifica nome: Coinquilino 0 rinomina se stesso -> 200 OK
    const editOwnNameRes = await roommatesRoute(
      new Request("http://localhost/api/house/roommates", {
        method: "POST",
        headers: authHeaders0,
        body: JSON.stringify({ id: 0, name: "Utente A" }),
      })
    );
    expect(editOwnNameRes.status).toBe(200);

    // 3. Pulizie: Coinquilino 0 invia richiesta specificando roommateId = 1 nel body -> 403
    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];

    const mismatchedCleaningRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders0,
        body: JSON.stringify({
          action: "complete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: 1,
        }),
      })
    );
    expect(mismatchedCleaningRes.status).toBe(403);
    const cleanErr = await mismatchedCleaningRes.json();
    expect(cleanErr.error).toContain("Non puoi eseguire azioni per conto di un altro coinquilino");

    // 4. Spazzatura: Coinquilino 0 invia richiesta specificando roommateId = 1 nel body -> 403
    const mismatchedTrashRes = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders0,
        body: JSON.stringify({
          action: "decline",
          roommateId: 1,
        }),
      })
    );
    expect(mismatchedTrashRes.status).toBe(403);
    const trashErr = await mismatchedTrashRes.json();
    expect(trashErr.error).toContain("Non puoi eseguire azioni per conto di un altro coinquilino");
  });

  it("applica anche lato server il limite di 30 caratteri per il nome del coinquilino", async () => {
    const token0 = createSessionToken(0);
    const authHeaders0 = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token0}`,
    };

    // 31 caratteri -> 400 Bad Request
    const longName = "A".repeat(31);
    const resTooLong = await roommatesRoute(
      new Request("http://localhost/api/house/roommates", {
        method: "POST",
        headers: authHeaders0,
        body: JSON.stringify({ id: 0, name: longName }),
      })
    );
    expect(resTooLong.status).toBe(400);
    const errData = await resTooLong.json();
    expect(errData.error).toContain("30 caratteri");

    // 30 caratteri esatti -> 200 OK
    const valid30Name = "A".repeat(30);
    const resValid30 = await roommatesRoute(
      new Request("http://localhost/api/house/roommates", {
        method: "POST",
        headers: authHeaders0,
        body: JSON.stringify({ id: 0, name: valid30Name }),
      })
    );
    expect(resValid30.status).toBe(200);
    const updated = (await resValid30.json()).roommates;
    expect(updated.find((r: any) => r.id === 0).name).toBe(valid30Name);
  });
});

describe("Gestione Attività Senza Incaricato & Concorrenza (Scenari 1-8) [LocalHouseRepository]", () => {
  let repo: LocalHouseRepository;
  const currentWeekKey = getWeekKey(new Date());

  const authHeadersFor = (roommateId: number) => ({
    "Content-Type": "application/json",
    Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken(roommateId)}`,
  });

  beforeEach(() => {
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
    repo = new LocalHouseRepository(TEST_DB);
    setTestRepository(repo);
    process.env.SESSION_SECRET = "super-secret-key-that-is-at-least-32-chars-long!";
    process.env.HOUSE_SECRET_CODE = "segreto123";
  });

  // Scenario 1: Tutti rinunciano a una pulizia → attività senza incaricato → uno cambia idea → prende l'incarico → completa.
  it("Scenario 1: Tutti rinunciano a una pulizia -> senza incaricato -> uno cambia idea -> prende incarico -> completa", async () => {
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];
    const firstAssignee = task.assignedTo!;

    // 1. Il primo rinuncia
    const dec1 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersFor(firstAssignee),
        body: JSON.stringify({ action: "decline", weekKey: currentWeekKey, taskId: task.id, roommateId: firstAssignee }),
      })
    );
    expect(dec1.status).toBe(200);
    const secondAssignee = (await dec1.json()).week.cleanings.find((t: any) => t.id === task.id).assignedTo;

    // 2. Il secondo rinuncia
    const dec2 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersFor(secondAssignee),
        body: JSON.stringify({ action: "decline", weekKey: currentWeekKey, taskId: task.id, roommateId: secondAssignee }),
      })
    );
    expect(dec2.status).toBe(200);
    const thirdAssignee = (await dec2.json()).week.cleanings.find((t: any) => t.id === task.id).assignedTo;

    // 3. Il terzo rinuncia -> attività senza incaricato (null)
    const dec3 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersFor(thirdAssignee),
        body: JSON.stringify({ action: "decline", weekKey: currentWeekKey, taskId: task.id, roommateId: thirdAssignee }),
      })
    );
    expect(dec3.status).toBe(200);
    const unassignedTask = (await dec3.json()).week.cleanings.find((t: any) => t.id === task.id);
    expect(unassignedTask.assignedTo).toBeNull();
    expect(unassignedTask.declinedBy).toContain(firstAssignee);

    // 4. Il primo cambia idea e prende l'incarico («Me ne occupo io»)
    const claimRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersFor(firstAssignee),
        body: JSON.stringify({ action: "claim", weekKey: currentWeekKey, taskId: task.id, roommateId: firstAssignee }),
      })
    );
    expect(claimRes.status).toBe(200);
    const claimedTask = (await claimRes.json()).week.cleanings.find((t: any) => t.id === task.id);
    expect(claimedTask.assignedTo).toBe(firstAssignee);
    expect(claimedTask.declinedBy).not.toContain(firstAssignee);
    expect(claimedTask.isCompleted).toBe(false);

    // 5. Completa l'attività («Ho pulito»)
    const completeRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersFor(firstAssignee),
        body: JSON.stringify({ action: "complete", weekKey: currentWeekKey, taskId: task.id, roommateId: firstAssignee }),
      })
    );
    expect(completeRes.status).toBe(200);
    const completedTask = (await completeRes.json()).week.cleanings.find((t: any) => t.id === task.id);
    expect(completedTask.isCompleted).toBe(true);
    expect(completedTask.completedBy).toBe(firstAssignee);
  });

  // Scenario 2: Tutti rinunciano alla spazzatura → uno cambia idea → prende l'incarico → completa → coda equa aggiornata.
  it("Scenario 2: Tutti rinunciano alla spazzatura -> senza incaricato -> uno cambia idea -> prende incarico -> completa -> coda equa aggiornata", async () => {
    // 1. Segnala spazzatura
    const repRes = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeadersFor(0),
        body: JSON.stringify({ action: "report" }),
      })
    );
    expect(repRes.status).toBe(200);
    const repData = await repRes.json();
    let openTask = repData.openTrashTask;
    const initialQueue = repData.trashQueue;
    expect(openTask.assignedTo).toBe(0);

    // 2. Tutti e 3 rinunciano in sequenza ciascuno con la propria sessione
    const dec0 = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeadersFor(0),
        body: JSON.stringify({ action: "decline", roommateId: 0 }),
      })
    );
    expect(dec0.status).toBe(200);

    const dec1 = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeadersFor(1),
        body: JSON.stringify({ action: "decline", roommateId: 1 }),
      })
    );
    expect(dec1.status).toBe(200);

    const dec2 = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeadersFor(2),
        body: JSON.stringify({ action: "decline", roommateId: 2 }),
      })
    );
    expect(dec2.status).toBe(200);
    const dec2Json = await dec2.json();
    const unassignedTrash = dec2Json.openTrashTask;
    expect(unassignedTrash.assignedTo).toBeNull();
    expect(unassignedTrash.declinedBy).toEqual([0, 1, 2]);
    expect(dec2Json.trashQueue).toEqual(initialQueue);

    // 3. Coinquilino 1 cambia idea e prende in carico («Me ne occupo io»)
    const claimRes = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeadersFor(1),
        body: JSON.stringify({ action: "claim", roommateId: 1 }),
      })
    );
    expect(claimRes.status).toBe(200);
    const claimData = await claimRes.json();
    const claimedTrash = claimData.openTrashTask;
    expect(claimedTrash.assignedTo).toBe(1);
    expect(claimedTrash.declinedBy).not.toContain(1);
    expect(claimedTrash.status).toBe("open");
    expect(claimData.trashQueue).toEqual(initialQueue);

    // 4. Coinquilino 1 completa («Ho buttato la spazzatura»)
    const compRes = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeadersFor(1),
        body: JSON.stringify({ action: "complete", roommateId: 1 }),
      })
    );
    expect(compRes.status).toBe(200);
    const compData = await compRes.json();
    const finalQueue = compData.trashQueue;
    expect(finalQueue).toEqual([0, 2, 1]);
    expect(compData.openTrashTask).toBeNull();
  });

  // Scenario 5: Due coinquilini tentano contemporaneamente di prendere lo stesso incarico → soltanto uno riesce.
  it("Scenario 5: Due coinquilini concorrenti tentano di prendere lo stesso incarico -> solo uno riesce (200 vs 409)", async () => {
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[2];
    await repo.updateCleaningTask({ ...task, assignedTo: null, assignedToName: null, declinedBy: [0, 1, 2] });

    const reqA = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeadersFor(0),
      body: JSON.stringify({ action: "claim", weekKey: currentWeekKey, taskId: task.id, roommateId: 0 }),
    });
    const reqB = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeadersFor(1),
      body: JSON.stringify({ action: "claim", weekKey: currentWeekKey, taskId: task.id, roommateId: 1 }),
    });

    const [resA, resB] = await Promise.all([cleaningsRoute(reqA), cleaningsRoute(reqB)]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    // Stessa verifica per la spazzatura
    await repo.createTrashTask({
      id: "trash-concurrent",
      status: "open",
      assignedTo: null,
      declinedBy: [0, 1, 2],
      reportedAt: new Date().toISOString(),
      completedAt: null,
      completedByName: null,
    });

    const trashReqA = new Request("http://localhost/api/house/trash", {
      method: "POST",
      headers: authHeadersFor(0),
      body: JSON.stringify({ action: "claim", roommateId: 0 }),
    });
    const trashReqB = new Request("http://localhost/api/house/trash", {
      method: "POST",
      headers: authHeadersFor(1),
      body: JSON.stringify({ action: "claim", roommateId: 1 }),
    });

    const [tResA, tResB] = await Promise.all([trashRoute(trashReqA), trashRoute(trashReqB)]);
    const tStatuses = [tResA.status, tResB.status].sort();
    expect(tStatuses).toEqual([200, 409]);
  });

  // Scenario 6: Un'attività già assegnata non può essere presa da un altro coinquilino.
  it("Scenario 6: Un'attività già assegnata non può essere presa da un altro coinquilino (409)", async () => {
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];
    expect(task.assignedTo).not.toBeNull();

    const otherId = (task.assignedTo! + 1) % 3;
    const claimCleaningRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersFor(otherId),
        body: JSON.stringify({ action: "claim", weekKey: currentWeekKey, taskId: task.id, roommateId: otherId }),
      })
    );
    expect(claimCleaningRes.status).toBe(409);

    // Spazzatura già assegnata
    await repo.createTrashTask({
      id: "trash-already-assigned",
      status: "open",
      assignedTo: 0,
      declinedBy: [],
      reportedAt: new Date().toISOString(),
      completedAt: null,
      completedByName: null,
    });

    const claimTrashRes = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeadersFor(1),
        body: JSON.stringify({ action: "claim", roommateId: 1 }),
      })
    );
    expect(claimTrashRes.status).toBe(409);
  });

  // Scenario 7: La presa in carico non crea falsi completamenti nello storico.
  it("Scenario 7: La presa in carico non crea falsi completamenti nello storico", async () => {
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];
    await repo.updateCleaningTask({ ...task, assignedTo: null, assignedToName: null, declinedBy: [0, 1, 2] });

    await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersFor(0),
        body: JSON.stringify({ action: "claim", weekKey: currentWeekKey, taskId: task.id, roommateId: 0 }),
      })
    );

    const histRes = await historyRoute(
      new Request("http://localhost/api/house/history", {
        method: "GET",
        headers: authHeadersFor(0),
      })
    );
    expect(histRes.status).toBe(200);
    const histData = await histRes.json();
    const matchingCleaning = histData.items.find((item: any) => item.id === `clean-${task.id}`);
    expect(matchingCleaning).toBeUndefined();
  });

  // Scenario 8: Le pulizie completate e il pulsante «Annulla» continuano a funzionare.
  it("Scenario 8: Le pulizie completate e il pulsante Annulla continuano a funzionare dopo un claim", async () => {
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];
    await repo.updateCleaningTask({ ...task, assignedTo: null, assignedToName: null, declinedBy: [1, 2] });

    // 1. Claim da parte di 0
    await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersFor(0),
        body: JSON.stringify({ action: "claim", weekKey: currentWeekKey, taskId: task.id, roommateId: 0 }),
      })
    );

    // 2. Completamento da parte di 0
    const compRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersFor(0),
        body: JSON.stringify({ action: "complete", weekKey: currentWeekKey, taskId: task.id, roommateId: 0 }),
      })
    );
    expect(compRes.status).toBe(200);

    // 3. Annullamento da parte del completatore (0)
    const undoRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersFor(0),
        body: JSON.stringify({ action: "uncomplete", weekKey: currentWeekKey, taskId: task.id, roommateId: 0 }),
      })
    );
    expect(undoRes.status).toBe(200);
    const restoredWeek = (await undoRes.json()).week;
    const restoredTask = restoredWeek.cleanings.find((t: any) => t.id === task.id);
    expect(restoredTask.isCompleted).toBe(false);
    expect(restoredTask.completedBy).toBeNull();
    expect(restoredTask.assignedTo).toBe(0);
  });

  // Criticità 3: Concorrenza degli aggiornamenti delle pulizie con verifica di declinedBy
  it("Criticità 3: rifiuta con 409 una richiesta basata su uno stato precedente di declinedBy anche se l'assegnatario torna allo stesso ID", async () => {
    // 1. Attività inizialmente assegnata a 0, declinedBy = []
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];
    await repo.updateCleaningTask({
      ...task,
      assignedTo: 0,
      assignedToName: "Coinquilino 1",
      declinedBy: [],
      undoableDeclines: [],
      isCompleted: false,
    });

    // 2. Interviene una successione di rinunce e presa in carico:
    // 0 rinuncia -> assegnata a 1
    // 1 rinuncia -> assegnata a 2
    // 2 rinuncia -> priva di assegnatario (null)
    // 0 prende in carico ("claim") -> torna assegnata a 0, ma declinedBy è ora [1, 2]!
    await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersFor(0),
        body: JSON.stringify({ action: "decline", weekKey: currentWeekKey, taskId: task.id, roommateId: 0 }),
      })
    );
    await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersFor(1),
        body: JSON.stringify({ action: "decline", weekKey: currentWeekKey, taskId: task.id, roommateId: 1 }),
      })
    );
    await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersFor(2),
        body: JSON.stringify({ action: "decline", weekKey: currentWeekKey, taskId: task.id, roommateId: 2 }),
      })
    );
    await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeadersFor(0),
        body: JSON.stringify({ action: "claim", weekKey: currentWeekKey, taskId: task.id, roommateId: 0 }),
      })
    );

    // Lo stato attuale nel repository ha assignedTo: 0, ma declinedBy: [1, 2]
    const updatedState = await repo.getWeekState(currentWeekKey);
    const currentTask = updatedState.cleanings.find((t) => t.id === task.id)!;
    expect(currentTask.assignedTo).toBe(0);
    expect(currentTask.declinedBy).toEqual([1, 2]);

    // 3. Ora una richiesta ritardata/concorrente basata sul vecchio stato (quando declinedBy era [])
    // tenta di eseguire un'operazione atomica condizionale su tale attività.
    const staleUpdateResult = await repo.updateCleaningTask(
      { ...currentTask, isCompleted: true },
      { isCompleted: false, assignedTo: 0, declinedBy: [] }
    );
    // Deve essere rifiutata atomicamente perché declinedBy non corrisponde!
    expect(staleUpdateResult).toBe(false);
  });

  describe("Shared Shopping List API (/api/house/shopping)", () => {
    function authHeadersFor(rId: number) {
      const token = createSessionToken(rId);
      return {
        "Content-Type": "application/json",
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      };
    }

    it("rejects unauthenticated requests with 401", async () => {
      const unauthGet = new Request("http://localhost/api/house/shopping");
      const resGet = await getShoppingRoute(unauthGet);
      expect(resGet.status).toBe(401);

      const unauthPost = new Request("http://localhost/api/house/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", name: "Latte" }),
      });
      const resPost = await postShoppingRoute(unauthPost);
      expect(resPost.status).toBe(401);
    });

    it("validates input on adding products", async () => {
      // Empty name
      const emptyReq = new Request("http://localhost/api/house/shopping", {
        method: "POST",
        headers: authHeadersFor(0),
        body: JSON.stringify({ action: "add", name: "   " }),
      });
      const emptyRes = await postShoppingRoute(emptyReq);
      expect(emptyRes.status).toBe(400);

      // Too long name (> 80 chars)
      const longReq = new Request("http://localhost/api/house/shopping", {
        method: "POST",
        headers: authHeadersFor(0),
        body: JSON.stringify({ action: "add", name: "a".repeat(81) }),
      });
      const longRes = await postShoppingRoute(longReq);
      expect(longRes.status).toBe(400);
    });

    it("handles full lifecycle: add, toggle by another roommate, uncheck, and delete", async () => {
      // 1. Roommate 0 ("Coinquilino 1") adds "Carta igienica"
      const addReq = new Request("http://localhost/api/house/shopping", {
        method: "POST",
        headers: authHeadersFor(0),
        body: JSON.stringify({ action: "add", name: "Carta igienica" }),
      });
      const addRes = await postShoppingRoute(addReq);
      expect(addRes.status).toBe(200);
      const addJson = await addRes.json();
      expect(addJson.success).toBe(true);
      expect(addJson.item.name).toBe("Carta igienica");
      expect(addJson.item.addedBy).toBe(0);
      expect(addJson.item.addedByName).toBe("Coinquilino 1");
      expect(addJson.item.isBought).toBe(false);
      const itemId = addJson.item.id;

      // 2. Roommate 1 ("Coinquilino 2") fetches list and sees it
      const getReq = new Request("http://localhost/api/house/shopping", {
        headers: authHeadersFor(1),
      });
      const getRes = await getShoppingRoute(getReq);
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.items).toHaveLength(1);
      expect(getJson.items[0].name).toBe("Carta igienica");

      // 3. Roommate 1 toggles "Carta igienica" to bought
      const toggleReq = new Request("http://localhost/api/house/shopping", {
        method: "POST",
        headers: authHeadersFor(1),
        body: JSON.stringify({ action: "toggle", id: itemId, isBought: true }),
      });
      const toggleRes = await postShoppingRoute(toggleReq);
      expect(toggleRes.status).toBe(200);
      const toggleJson = await toggleRes.json();
      expect(toggleJson.item.isBought).toBe(true);
      expect(toggleJson.item.boughtBy).toBe(1);
      expect(toggleJson.item.boughtByName).toBe("Coinquilino 2");
      expect(toggleJson.item.boughtAt).toBeDefined();

      // 4. Roommate 2 ("Coinquilino 3") unchecks it back to unbought
      const uncheckReq = new Request("http://localhost/api/house/shopping", {
        method: "POST",
        headers: authHeadersFor(2),
        body: JSON.stringify({ action: "toggle", id: itemId, isBought: false }),
      });
      const uncheckRes = await postShoppingRoute(uncheckReq);
      expect(uncheckRes.status).toBe(200);
      const uncheckJson = await uncheckRes.json();
      expect(uncheckJson.item.isBought).toBe(false);
      expect(uncheckJson.item.boughtBy).toBeNull();
      expect(uncheckJson.item.boughtByName).toBeNull();
      expect(uncheckJson.item.boughtAt).toBeNull();
      // original author still Coinquilino 1
      expect(uncheckJson.item.addedByName).toBe("Coinquilino 1");

      // 5. Roommate 0 deletes the item
      const delReq = new Request("http://localhost/api/house/shopping", {
        method: "POST",
        headers: authHeadersFor(0),
        body: JSON.stringify({ action: "delete", id: itemId }),
      });
      const delRes = await postShoppingRoute(delReq);
      expect(delRes.status).toBe(200);
      const delJson = await delRes.json();
      expect(delJson.items).toHaveLength(0);

      // 6. Delete again returns 404
      const delAgainReq = new Request("http://localhost/api/house/shopping", {
        method: "POST",
        headers: authHeadersFor(0),
        body: JSON.stringify({ action: "delete", id: itemId }),
      });
      const delAgainRes = await postShoppingRoute(delAgainReq);
      expect(delAgainRes.status).toBe(404);
      const delAgainJson = await delAgainRes.json();
      expect(delAgainJson.error).toBe("Prodotto non trovato.");

      // 7. Toggle on non-existent item returns 404
      const toggleNonExistentReq = new Request("http://localhost/api/house/shopping", {
        method: "POST",
        headers: authHeadersFor(0),
        body: JSON.stringify({ action: "toggle", id: itemId, isBought: true }),
      });
      const toggleNonExistentRes = await postShoppingRoute(toggleNonExistentReq);
      expect(toggleNonExistentRes.status).toBe(404);
      const toggleNonExistentJson = await toggleNonExistentRes.json();
      expect(toggleNonExistentJson.error).toBe("Prodotto non trovato.");
    });
  });
});
