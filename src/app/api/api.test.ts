import { describe, it, expect, beforeEach, vi } from "vitest";
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

  it("prevents lost updates and handles concurrent completion, decline, and absence (P1-02)", async () => {
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];
    const assignedId = task.assignedTo!;

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
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    // 1. Segnala spazzatura (assegnata a Roommate 0)
    const reportRes = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders,
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
        headers: authHeaders,
        body: JSON.stringify({ action: "complete", roommateId: 0 }),
      })
    );
    expect(completeRes.status).toBe(200);

    // Ora il compito risulta completato e nessun compito risulta aperto
    expect(await repo.getOpenTrashTask()).toBeNull();

    // 3. Una richiesta concorrente basata su dati precedenti tenta di rinunciare o riassegnare il compito
    const declineRes = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "decline", roommateId: 0 }),
      })
    );
    // Non trovando compiti aperti (o tentando un aggiornamento con status = open su un task completato), la richiesta viene respinta
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
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];

    // 1. Il task è inizialmente privo di assegnatario (tutti assenti/rinunce)
    task.assignedTo = null;
    task.assignedToName = null;
    await repo.updateCleaningTask(task);

    // 2. Simula race condition concorrente: la route legge il task senza assegnatario (assignedTo: null),
    // ma prima che chiami updateCleaningTask un'operazione concorrente assegna il compito a Roommate 2
    const originalGetWeekState = repo.getWeekState.bind(repo);
    let readCount = 0;
    const spy = vi.spyOn(repo, "getWeekState").mockImplementation(async (key) => {
      readCount++;
      const state = await originalGetWeekState(key);
      if (readCount === 1) {
        // Restituisce alla route iniziale un clone con assignedTo: null
        const clonedCleanings = state.cleanings.map((c) => ({ ...c }));
        clonedCleanings[0].assignedTo = null;
        clonedCleanings[0].assignedToName = null;

        // Nel DB, un'operazione concorrente ha appena assegnato il compito a Roommate 2
        (repo as any).data.cleanings[key][0].assignedTo = 2;
        (repo as any).data.cleanings[key][0].assignedToName = "Coinquilino 3";

        return { ...state, cleanings: clonedCleanings };
      }
      return state;
    });


    // Roommate 1 tenta di completare il compito credendo che sia ancora privo di incaricato
    // La route verifica condizionalmente { isCompleted: false, assignedTo: null } e riceve 409 Conflict
    const completeReq = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders,
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

    // 3. Verifica diretta su repository: updateCleaningTask con condition assignedTo: null fallisce se è 2
    const directUpdate = await repo.updateCleaningTask(
      { ...task, isCompleted: true },
      { isCompleted: false, assignedTo: null }
    );
    expect(directUpdate).toBe(false);
  });


  it("ensures cascading declines never assign a cleaning to a declined roommate and results in null when all decline (P1-02)", async () => {
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0]; // Area 0 assegnata a Roommate 0
    expect(task.assignedTo).toBe(0);

    // 1. Roommate 0 rinuncia all'area 0
    const declineRes1 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: 0,
        }),
      })
    );
    expect(declineRes1.status).toBe(200);

    // L'area 0 viene riassegnata a Roommate 1, con declinedBy: [0]
    let currentWeek = await repo.getWeekState(currentWeekKey);
    let area0 = currentWeek.cleanings.find((t) => t.id === task.id)!;
    expect(area0.assignedTo).toBe(1);
    expect(area0.declinedBy).toEqual([0]);

    // 2. Roommate 1 rinuncia
    const declineRes2 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
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

    // 3. Roommate 2 rinuncia
    const declineRes3 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "decline",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: 2,
        }),
      })
    );
    expect(declineRes3.status).toBe(200);

    // Con tutti e tre che hanno rinunciato, l'attività DEVE essere null
    currentWeek = await repo.getWeekState(currentWeekKey);
    area0 = currentWeek.cleanings.find((t) => t.id === task.id)!;
    expect(area0.assignedTo).toBeNull();
    expect(area0.declinedBy).toEqual([0, 1, 2]);
  });

  it("allows undoing cleaning completion in current week by the profile that completed it, maintaining consistent history", async () => {
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];
    const assignedId = task.assignedTo!;

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

    // Verifica che sia completato e presente nello storico
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

    // 3. Verifica che il compito sia ripristinato allo stato non completato e dati di completamento cancellati
    updatedWeek = await repo.getWeekState(currentWeekKey);
    updatedTask = updatedWeek.cleanings.find((t) => t.id === task.id)!;
    expect(updatedTask.isCompleted).toBe(false);
    expect(updatedTask.completedAt).toBeNull();
    expect(updatedTask.completedByName).toBeNull();
    expect(updatedTask.assignedTo).toBe(assignedId);

    // 4. Verifica che nello storico non compaia più
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
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[1];
    const assignedId = task.assignedTo!;

    // Completa il compito
    await cleaningsRoute(
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

    // 1. Profilo non corrispondente riceve 403 Forbidden
    const otherId = (assignedId + 1) % 3;
    const wrongProfileRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
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
        headers: authHeaders,
        body: JSON.stringify({
          action: "uncomplete",
          weekKey: "2026-01-05",
          taskId: task.id,
          roommateId: assignedId,
        }),
      })
    );
    expect(pastWeekRes.status).toBe(400);

    // 3. Annullamento riuscito
    const validUndo = await cleaningsRoute(
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
    expect(validUndo.status).toBe(200);

    // 4. Tentativo ripetuto su compito già non completato riceve 409 Conflict
    const repeatedUndo = await cleaningsRoute(
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
    expect(repeatedUndo.status).toBe(409);
  });

  it("handles concurrent uncomplete requests and restores unassigned tasks correctly (assignedTo: null)", async () => {
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[2];

    // 1. Simula attività originariamente senza incaricato
    task.assignedTo = null;
    task.assignedToName = null;
    task.declinedBy = [];
    await repo.updateCleaningTask(task);

    // 2. Un coinquilino completa il compito
    const completeRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "complete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: 0,
        }),
      })
    );
    // Completa riuscita (o con volunteer)
    expect(completeRes.status).toBe(200);

    // 3. Simula richieste concorrenti di annullamento:
    // La prima richiesta deve riuscire, la seconda simultanea riceve 409 Conflict
    const undoReq1 = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        action: "uncomplete",
        weekKey: currentWeekKey,
        taskId: task.id,
        roommateId: 0,
      }),
    });
    const undoReq2 = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders,
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

    // 4. Verifica che il compito originariamente senza incaricato torni con assignedTo = null
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
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[1];
    const assignedId = task.assignedTo!;

    // 1. Il coinquilino completa il compito
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

    // 2. Il coinquilino cambia il suo nome
    await repo.updateRoommate(assignedId, "Nome Modificato");

    // 3. Un altro coinquilino con ID diverso tenta di annullare -> 403 Forbidden
    const otherId = (assignedId + 1) % 3;
    const unauthorizedRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "uncomplete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: otherId,
        }),
      })
    );
    expect(unauthorizedRes.status).toBe(403);

    // 4. Il coinquilino originale con ID stabile (anche se ha cambiato nome!) annulla con successo
    const authorizedRes = await cleaningsRoute(
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
    expect(authorizedRes.status).toBe(200);

    // 5. Ripristina il nome originale del coinquilino
    await repo.updateRoommate(assignedId, `Coinquilino ${assignedId + 1}`);
  });

  it("preserves previous reassignment from decline when uncompleting (Bug 2)", async () => {
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    const currentWeekKey = getWeekKey(new Date());
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[0];
    const originalAssignee = task.assignedTo!;

    // 1. L'assegnatario originale rinuncia -> il compito viene riassegnato a un sostituto
    const declineRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
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

    // 2. Il sostituto completa il compito
    const completeRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "complete",
          weekKey: currentWeekKey,
          taskId: task.id,
          roommateId: substituteId,
        }),
      })
    );
    expect(completeRes.status).toBe(200);

    // 3. Il sostituto annulla il completamento
    const undoRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
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
});

describe("Gestione Attività Senza Incaricato & Concorrenza (Scenari 1-8) [LocalHouseRepository]", () => {
  let repo: LocalHouseRepository;
  let authHeaders: Record<string, string>;
  const currentWeekKey = getWeekKey(new Date());

  beforeEach(() => {
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
    repo = new LocalHouseRepository(TEST_DB);
    setTestRepository(repo);
    process.env.SESSION_SECRET = "super-secret-key-that-is-at-least-32-chars-long!";
    process.env.HOUSE_SECRET_CODE = "segreto123";

    const token = createSessionToken();
    authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };
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
        headers: authHeaders,
        body: JSON.stringify({ action: "decline", weekKey: currentWeekKey, taskId: task.id, roommateId: firstAssignee }),
      })
    );
    expect(dec1.status).toBe(200);
    const secondAssignee = (await dec1.json()).week.cleanings.find((t: any) => t.id === task.id).assignedTo;

    // 2. Il secondo rinuncia
    const dec2 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "decline", weekKey: currentWeekKey, taskId: task.id, roommateId: secondAssignee }),
      })
    );
    expect(dec2.status).toBe(200);
    const thirdAssignee = (await dec2.json()).week.cleanings.find((t: any) => t.id === task.id).assignedTo;

    // 3. Il terzo rinuncia -> attività senza incaricato (null)
    const dec3 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
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
        headers: authHeaders,
        body: JSON.stringify({ action: "claim", weekKey: currentWeekKey, taskId: task.id, roommateId: firstAssignee }),
      })
    );
    expect(claimRes.status).toBe(200);
    const claimedTask = (await claimRes.json()).week.cleanings.find((t: any) => t.id === task.id);
    expect(claimedTask.assignedTo).toBe(firstAssignee);
    expect(claimedTask.declinedBy).not.toContain(firstAssignee); // rimossa rinuncia precedente
    expect(claimedTask.isCompleted).toBe(false);

    // 5. Completa l'attività («Ho pulito»)
    const completeRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
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
        headers: authHeaders,
        body: JSON.stringify({ action: "report" }),
      })
    );
    expect(repRes.status).toBe(200);
    const repData = await repRes.json();
    let openTask = repData.openTrashTask;
    const initialQueue = repData.trashQueue; // [0, 1, 2]
    expect(openTask.assignedTo).toBe(0);

    // 2. Tutti e 3 rinunciano in sequenza
    const dec0 = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "decline", roommateId: 0 }),
      })
    );
    expect(dec0.status).toBe(200);

    const dec1 = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "decline", roommateId: 1 }),
      })
    );
    expect(dec1.status).toBe(200);

    const dec2 = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "decline", roommateId: 2 }),
      })
    );
    expect(dec2.status).toBe(200);
    const dec2Json = await dec2.json();
    const unassignedTrash = dec2Json.openTrashTask;
    expect(unassignedTrash.assignedTo).toBeNull();
    expect(unassignedTrash.declinedBy).toEqual([0, 1, 2]);
    // La coda NON deve essere modificata dalle rinunce
    expect(dec2Json.trashQueue).toEqual(initialQueue);

    // 3. Coinquilino 1 cambia idea e prende in carico («Me ne occupo io»)
    const claimRes = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "claim", roommateId: 1 }),
      })
    );
    expect(claimRes.status).toBe(200);
    const claimData = await claimRes.json();
    const claimedTrash = claimData.openTrashTask;
    expect(claimedTrash.assignedTo).toBe(1);
    expect(claimedTrash.declinedBy).not.toContain(1); // 1 rimosso da declinedBy
    expect(claimedTrash.status).toBe("open");
    // Coda NON toccata al momento del claim
    expect(claimData.trashQueue).toEqual(initialQueue);

    // 4. Coinquilino 1 completa («Ho buttato la spazzatura»)
    const compRes = await trashRoute(
      new Request("http://localhost/api/house/trash", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "complete", roommateId: 1 }),
      })
    );
    expect(compRes.status).toBe(200);
    const compData = await compRes.json();
    const finalQueue = compData.trashQueue;
    // 1 deve essere passato in fondo alla coda equa: [0, 2, 1]
    expect(finalQueue).toEqual([0, 2, 1]);
    expect(compData.openTrashTask).toBeNull();
  });

  // Scenario 5: Due coinquilini tentano contemporaneamente di prendere lo stesso incarico → soltanto uno riesce.
  it("Scenario 5: Due coinquilini concorrenti tentano di prendere lo stesso incarico -> solo uno riesce (200 vs 409)", async () => {
    const week = await repo.getWeekState(currentWeekKey);
    const task = week.cleanings[2];
    await repo.updateCleaningTask({ ...task, assignedTo: null, assignedToName: null, declinedBy: [0, 1, 2] });

    // Due richieste di claim contemporanee per la stessa pulizia
    const reqA = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ action: "claim", weekKey: currentWeekKey, taskId: task.id, roommateId: 0 }),
    });
    const reqB = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ action: "claim", weekKey: currentWeekKey, taskId: task.id, roommateId: 1 }),
    });

    const [resA, resB] = await Promise.all([cleaningsRoute(reqA), cleaningsRoute(reqB)]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    // Stessa verifica atomica concorrente per la spazzatura
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
      headers: authHeaders,
      body: JSON.stringify({ action: "claim", roommateId: 0 }),
    });
    const trashReqB = new Request("http://localhost/api/house/trash", {
      method: "POST",
      headers: authHeaders,
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
        headers: authHeaders,
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
        headers: authHeaders,
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

    // Presa in carico
    await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "claim", weekKey: currentWeekKey, taskId: task.id, roommateId: 0 }),
      })
    );

    // Controlla lo storico: l'attività in corso presa in carico NON deve figurare come completata
    const histRes = await historyRoute(
      new Request("http://localhost/api/house/history", {
        method: "GET",
        headers: authHeaders,
      })
    );
    expect(histRes.status).toBe(200);
    const histData = await histRes.json();
    const matchingCleaning = histData.items.find((item: any) => item.id === task.id);
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
        headers: authHeaders,
        body: JSON.stringify({ action: "claim", weekKey: currentWeekKey, taskId: task.id, roommateId: 0 }),
      })
    );

    // 2. Completamento da parte di 0
    const compRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "complete", weekKey: currentWeekKey, taskId: task.id, roommateId: 0 }),
      })
    );
    expect(compRes.status).toBe(200);

    // 3. Annullamento da parte del completatore (0)
    const undoRes = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "uncomplete", weekKey: currentWeekKey, taskId: task.id, roommateId: 0 }),
      })
    );
    expect(undoRes.status).toBe(200);
    const restoredWeek = (await undoRes.json()).week;
    const restoredTask = restoredWeek.cleanings.find((t: any) => t.id === task.id);
    expect(restoredTask.isCompleted).toBe(false);
    expect(restoredTask.completedBy).toBeNull();
    // L'assegnatario resta 0
    expect(restoredTask.assignedTo).toBe(0);
  });
});



