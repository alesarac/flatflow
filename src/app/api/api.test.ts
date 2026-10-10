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

    // 4. Segnalazione successiva di assenza per l'assegnatario NON sovrascrive né annulla il compito già completato
    const absenceReq = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        action: "set_absence",
        weekKey: currentWeekKey,
        roommateId: assignedId,
        isAbsent: true,
      }),
    });
    const resAbsence = await cleaningsRoute(absenceReq);
    expect(resAbsence.status).toBe(200);

    const updatedWeek = await repo.getWeekState(currentWeekKey);
    const completedTask = updatedWeek.cleanings.find((t) => t.id === task.id);
    expect(completedTask?.isCompleted).toBe(true);
    expect(completedTask?.assignedTo).toBe(assignedId);
    expect(completedTask?.completedByName).toBeDefined();
  });

  it("automatically reconciles unassigned open trash on week change via GET /api/house/data (P1-03)", async () => {
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    // Crea un compito di spazzatura aperto senza assegnatario (come se lasciato dalla settimana scorsa con tutti assenti)
    const unassignedTrash = {
      id: "trash-unassigned-week1",
      status: "open" as const,
      assignedTo: null,
      declinedBy: [],
      reportedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      completedAt: null,
      completedByName: null,
    };
    await repo.createTrashTask(unassignedTrash);

    const openBefore = await repo.getOpenTrashTask();
    expect(openBefore?.assignedTo).toBeNull();

    // Quando i coinquilini aprono l'app nella nuova settimana, GET /api/house/data riconcilia il compito
    const dataReq = new Request("http://localhost/api/house/data", {
      headers: authHeaders,
    });
    const dataRes = await houseDataRoute(dataReq);
    expect(dataRes.status).toBe(200);
    const data = await dataRes.json();

    // Il compito è stato assegnato automaticamente al primo disponibile nella coda
    expect(data.openTrashTask).toBeDefined();
    expect(data.openTrashTask.assignedTo).toBe(0);
    expect(data.openTrashTask.status).toBe("open");

    // Anche il repository è stato aggiornato in modo persistente
    const openAfter = await repo.getOpenTrashTask();
    expect(openAfter?.assignedTo).toBe(0);
    expect(openAfter?.status).toBe("open");
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


  it("ensures simultaneous absences and declines never assign a cleaning to an absent or declined roommate (P1-02)", async () => {
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
    const declineRes = await cleaningsRoute(
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
    expect(declineRes.status).toBe(200);

    // L'area 0 viene riassegnata a Roommate 1, con declinedBy: [0]
    let currentWeek = await repo.getWeekState(currentWeekKey);
    let area0 = currentWeek.cleanings.find((t) => t.id === task.id)!;
    expect(area0.assignedTo).toBe(1);
    expect(area0.declinedBy).toEqual([0]);

    // 2. Simultaneamente, Roommate 1 dichiara assenza per quella settimana
    const absRes1 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "set_absence",
          weekKey: currentWeekKey,
          roommateId: 1,
          isAbsent: true,
        }),
      })
    );
    expect(absRes1.status).toBe(200);

    // L'area 0 deve passare a Roommate 2 (non può tornare a 0 che ha rinunciato, né restare a 1 che è assente)
    currentWeek = await repo.getWeekState(currentWeekKey);
    area0 = currentWeek.cleanings.find((t) => t.id === task.id)!;
    expect(area0.assignedTo).toBe(2);
    expect(area0.assignedTo).not.toBe(0);
    expect(area0.assignedTo).not.toBe(1);

    // 3. Anche Roommate 2 dichiara assenza
    const absRes2 = await cleaningsRoute(
      new Request("http://localhost/api/house/cleanings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "set_absence",
          weekKey: currentWeekKey,
          roommateId: 2,
          isAbsent: true,
        }),
      })
    );
    expect(absRes2.status).toBe(200);

    // Con tutti e tre non disponibili (0 ha rinunciato, 1 e 2 assenti), l'attività DEVE essere null
    // e non tornare MAI a una persona assente o che ha rinunciato
    currentWeek = await repo.getWeekState(currentWeekKey);
    area0 = currentWeek.cleanings.find((t) => t.id === task.id)!;
    expect(area0.assignedTo).toBeNull();
  });
});


