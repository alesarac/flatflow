import { describe, it, expect, vi, beforeEach } from "vitest";
import { HouseDataSyncController, HouseDataSyncCallbacks } from "./houseDataSync";
import { HouseData, WeekState, CleaningTask } from "./types";

describe("HouseDataSyncController Concurrency & Race Condition Protection (Issue 2)", () => {
  const mockCleaning0: CleaningTask = {
    id: "task-0",
    weekKey: "2026-W30",
    areaId: 0,
    assignedTo: 0,
    assignedToName: "Coinquilino 1",
    declinedBy: [],
    isCompleted: false,
    completedAt: null,
    completedByName: null,
    completedBy: null,
  };

  const mockCleaning1: CleaningTask = {
    id: "task-1",
    weekKey: "2026-W30",
    areaId: 1,
    assignedTo: 1,
    assignedToName: "Coinquilino 2",
    declinedBy: [],
    isCompleted: false,
    completedAt: null,
    completedByName: null,
    completedBy: null,
  };

  const mockWeek: WeekState = {
    weekKey: "2026-W30",
    startDate: "2026-07-20T00:00:00.000Z",
    endDate: "2026-07-26T23:59:59.999Z",
    label: "Settimana 20 - 26 lug",
    cleanings: [mockCleaning0, mockCleaning1],
  };

  const initialHouseData: HouseData = {
    roommates: [
      { id: 0, name: "Coinquilino 1" },
      { id: 1, name: "Coinquilino 2" },
      { id: 2, name: "Coinquilino 3" },
    ],
    currentWeek: mockWeek,
    openTrashTask: null,
    trashQueue: [0, 1, 2],
    myRoommateId: 0,
  };

  let dataHistory: (HouseData | null)[];
  let errorHistory: (string | null)[];
  let authHistory: (boolean | null)[];
  let submittingTaskIdHistory: (string | null)[];
  let submittingCleaningIdsHistory: Set<string>[];

  beforeEach(() => {
    dataHistory = [];
    errorHistory = [];
    authHistory = [];
    submittingTaskIdHistory = [];
    submittingCleaningIdsHistory = [];
  });

  function createController(
    fetcherMock: any,
    initial: HouseData | null = initialHouseData,
    callbacksOverride?: Partial<HouseDataSyncCallbacks>
  ) {
    return new HouseDataSyncController({
      initialData: initial,
      callbacks: {
        onDataChange: (d) => dataHistory.push(d),
        onLoadingChange: () => {},
        onError: (e) => errorHistory.push(e),
        onAuthenticatedChange: (a) => authHistory.push(a),
        onSubmittingTaskIdChange: (id) => submittingTaskIdHistory.push(id),
        onSubmittingCleaningIdsChange: (ids) => submittingCleaningIdsHistory.push(ids),
        onIsSubmittingChange: () => {},
        ...callbacksOverride,
      },
      fetcher: fetcherMock,
    });
  }

  it("drops stale out-of-order GET response when a newer GET has already committed", async () => {
    let resolveFirstFetch!: (val: any) => void;
    const firstFetchPromise = new Promise((res) => {
      resolveFirstFetch = res;
    });

    let fetchCount = 0;
    const mockFetcher = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/house/data") {
        fetchCount++;
        if (fetchCount === 1) {
          return firstFetchPromise;
        }
        // Secondo fetch ritorna dati freschi (con Area 0 completata)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ...initialHouseData,
            currentWeek: {
              ...mockWeek,
              cleanings: [{ ...mockCleaning0, isCompleted: true }, mockCleaning1],
            },
          }),
        });
      }
      return Promise.reject(new Error("Unknown route"));
    });

    const controller = createController(mockFetcher);

    // 1. Avvia primo fetch lento
    const fetch1 = controller.fetchData();

    // 2. Avvia secondo fetch veloce
    await controller.fetchData();

    // Lo stato attuale ha Area 0 completata
    expect(controller.getData()?.currentWeek.cleanings[0].isCompleted).toBe(true);

    // 3. Ora risponde il primo fetch lento (che aveva Area 0 non completata)
    resolveFirstFetch({
      ok: true,
      status: 200,
      json: async () => initialHouseData, // vecchio stato
    });
    await fetch1;

    // Verifica fondamentale: la risposta obsoleta fuori ordine non deve sovrascrivere lo stato più recente
    expect(controller.getData()?.currentWeek.cleanings[0].isCompleted).toBe(true);
  });

  it("does not overwrite optimistic updates when a background GET arrives while mutations are in-flight", async () => {
    let resolveGet!: (val: any) => void;
    const getPromise = new Promise((res) => {
      resolveGet = res;
    });

    const mockFetcher = vi.fn().mockImplementation((url: string, init?: any) => {
      if (url === "/api/house/data") {
        return getPromise;
      }
      if (url === "/api/house/cleanings") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            week: {
              ...mockWeek,
              cleanings: [{ ...mockCleaning0, isCompleted: true }, mockCleaning1],
            },
          }),
        });
      }
      return Promise.reject(new Error("Unknown route"));
    });

    const controller = createController(mockFetcher);

    // 1. GET lenta avviata (es. su focus)
    const getOp = controller.fetchData();

    // 2. Nel frattempo l'utente clicca "Ho pulito" su Area 0
    const completeOp = controller.completeCleaning("task-0", "2026-W30", 0);

    // Immediatamente ottimistico
    expect(controller.getData()?.currentWeek.cleanings[0].isCompleted).toBe(true);

    // 3. La GET lenta risponde mentre la mutazione è ancora attiva (restituendo Area 0 non completata)
    resolveGet({
      ok: true,
      status: 200,
      json: async () => initialHouseData,
    });
    await getOp;

    // Verifica fondamentale: la GET lenta non ha sovrascritto l'aggiornamento ottimistico
    expect(controller.getData()?.currentWeek.cleanings[0].isCompleted).toBe(true);

    await completeOp;
    expect(controller.getData()?.currentWeek.cleanings[0].isCompleted).toBe(true);
  });

  it("preserves parallel optimistic mutations when concurrent POST responses return", async () => {
    let resolvePost0!: (val: any) => void;
    const post0Promise = new Promise((res) => {
      resolvePost0 = res;
    });

    const mockFetcher = vi.fn().mockImplementation((url: string, init?: any) => {
      const body = JSON.parse(init.body);
      if (body.taskId === "task-0") {
        return post0Promise;
      }
      if (body.taskId === "task-1") {
        // La seconda mutazione risponde prima della prima!
        // Sul server, solo task-1 risulta completata perché task-0 non è ancora terminata
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            week: {
              ...mockWeek,
              cleanings: [mockCleaning0, { ...mockCleaning1, isCompleted: true }],
            },
          }),
        });
      }
      return Promise.reject(new Error("Unknown route"));
    });

    const controller = createController(mockFetcher);

    // 1. Completa Area 0
    const op0 = controller.completeCleaning("task-0", "2026-W30", 0);
    // 2. Completa concorrentemente Area 1
    const op1 = controller.completeCleaning("task-1", "2026-W30", 1);

    // Entrambe ottimisticamente completate
    expect(controller.getData()?.currentWeek.cleanings[0].isCompleted).toBe(true);
    expect(controller.getData()?.currentWeek.cleanings[1].isCompleted).toBe(true);

    // Aspetta che la mutazione 1 risponda per prima
    await op1;

    // Verifica fondamentale: la risposta del server per task-1 NON deve cancellare il completamento ottimistico di task-0!
    expect(controller.getData()?.currentWeek.cleanings[0].isCompleted).toBe(true);
    expect(controller.getData()?.currentWeek.cleanings[1].isCompleted).toBe(true);

    // Ora risponde la mutazione 0
    resolvePost0({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        week: {
          ...mockWeek,
          cleanings: [{ ...mockCleaning0, isCompleted: true }, { ...mockCleaning1, isCompleted: true }],
        },
      }),
    });
    await op0;

    expect(controller.getData()?.currentWeek.cleanings[0].isCompleted).toBe(true);
    expect(controller.getData()?.currentWeek.cleanings[1].isCompleted).toBe(true);
  });

  it("rolls back optimistic update to server state when a mutation fails", async () => {
    let getCalled = false;
    const mockFetcher = vi.fn().mockImplementation((url: string, init?: any) => {
      if (url === "/api/house/cleanings") {
        // Fallimento mutazione (409 conflitto)
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ error: "Attività già modificata da un altro coinquilino." }),
        });
      }
      if (url === "/api/house/data") {
        getCalled = true;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => initialHouseData, // Area 0 non completata sul server
        });
      }
      return Promise.reject(new Error("Unknown route"));
    });

    const controller = createController(mockFetcher);

    // Avvia mutazione
    const op = controller.completeCleaning("task-0", "2026-W30", 0);

    // Immediatamente ottimistico
    expect(controller.getData()?.currentWeek.cleanings[0].isCompleted).toBe(true);

    const ok = await op;
    expect(ok).toBe(false);

    // Aspetta riconciliazione automatica con il server
    await new Promise((r) => setTimeout(r, 20));

    expect(getCalled).toBe(true);
    // È stato eseguito il rollback automatico
    expect(controller.getData()?.currentWeek.cleanings[0].isCompleted).toBe(false);
    expect(errorHistory).toContain("Attività già modificata da un altro coinquilino.");
  });

  it("does not restore data or authenticated state if a slow GET completes after logout (Issue 1)", async () => {
    let resolveSlowGet!: (val: any) => void;
    const slowGetPromise = new Promise((res) => {
      resolveSlowGet = res;
    });

    const mockFetcher = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/house/data") {
        return slowGetPromise;
      }
      if (url === "/api/auth/logout") {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) });
      }
      return Promise.reject(new Error("Unknown route"));
    });

    const controller = createController(mockFetcher);

    // 1. GET lenta avviata prima del logout
    const slowFetchOp = controller.fetchData();

    // 2. L'utente effettua il logout mentre la GET è ancora in volo
    await controller.logout();

    expect(controller.getData()).toBeNull();
    expect(authHistory[authHistory.length - 1]).toBe(false);

    // 3. Ora la GET lenta risponde con successo 200 OK con i vecchi dati
    resolveSlowGet({
      ok: true,
      status: 200,
      json: async () => initialHouseData,
    });
    await slowFetchOp;

    // Verifica fondamentale: la GET obsoleta non deve ripristinare i dati né lo stato autenticato
    expect(controller.getData()).toBeNull();
    expect(authHistory[authHistory.length - 1]).toBe(false);
  });

  it("invalidating pending requests on new login prevents previous session requests from modifying state (Issue 1)", async () => {
    let resolveStaleGet!: (val: any) => void;
    const staleGetPromise = new Promise((res) => {
      resolveStaleGet = res;
    });

    let fetchCount = 0;
    const mockFetcher = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/house/data") {
        fetchCount++;
        if (fetchCount === 1) {
          return staleGetPromise;
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ...initialHouseData,
            myRoommateId: 1, // nuovo utente loggato
          }),
        });
      }
      return Promise.reject(new Error("Unknown route"));
    });

    const controller = createController(mockFetcher, null);

    // 1. Schermata precedente/non autenticata avvia un fetch lento
    const staleGetOp = controller.fetchData();

    // 2. Nuovo login: invalida tutte le richieste precedenti
    controller.invalidatePendingRequests();

    // 3. Avvia fetch della nuova sessione autenticata
    await controller.fetchData();
    expect(controller.getData()?.myRoommateId).toBe(1);
    expect(authHistory[authHistory.length - 1]).toBe(true);

    // 4. Ora risponde la richiesta lenta della vecchia sessione (es. con 401 Unauthorized)
    resolveStaleGet({
      ok: false,
      status: 401,
      json: async () => ({ error: "Non autorizzato" }),
    });
    await staleGetOp;

    // Verifica fondamentale: la vecchia richiesta scartata non deve disconnettere la nuova sessione
    expect(controller.getData()?.myRoommateId).toBe(1);
    expect(authHistory[authHistory.length - 1]).toBe(true);
  });

  it("preserves active error banner during automatic reconciliation after failed mutation (Issue 2)", async () => {
    let reconciliationCalled = false;
    const mockFetcher = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/house/cleanings") {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ error: "Attività già modificata da un altro coinquilino." }),
        });
      }
      if (url === "/api/house/data") {
        reconciliationCalled = true;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => initialHouseData,
        });
      }
      return Promise.reject(new Error("Unknown route"));
    });

    const controller = createController(mockFetcher);

    // Mutazione che fallisce
    const op = controller.completeCleaning("task-0", "2026-W30", 0);
    const ok = await op;
    expect(ok).toBe(false);

    // Aspetta riconciliazione automatica con il server
    await new Promise((r) => setTimeout(r, 20));

    expect(reconciliationCalled).toBe(true);
    // Verifica fondamentale: l'errore deve essere ancora presente e non cancellato a null da fetchData(false)
    expect(errorHistory[errorHistory.length - 1]).toBe("Attività già modificata da un altro coinquilino.");

    // Un refresh manuale invece azzera l'errore
    await controller.fetchData(true);
    expect(errorHistory[errorHistory.length - 1]).toBeNull();
  });

  it("does not re-enable buttons of in-flight tasks when one of two parallel mutations completes (Issue 3)", async () => {
    let resolvePost0!: (val: any) => void;
    const post0Promise = new Promise((res) => {
      resolvePost0 = res;
    });

    let resolvePost1!: (val: any) => void;
    const post1Promise = new Promise((res) => {
      resolvePost1 = res;
    });

    const mockFetcher = vi.fn().mockImplementation((url: string, init?: any) => {
      const body = JSON.parse(init.body);
      if (body.taskId === "task-0") {
        return post0Promise;
      }
      if (body.taskId === "task-1") {
        return post1Promise;
      }
      return Promise.reject(new Error("Unknown route"));
    });

    const controller = createController(mockFetcher);

    // 1. Avvia due POST parallele per due pulizie contemporanee
    const op0 = controller.completeCleaning("task-0", "2026-W30", 0);
    const op1 = controller.completeCleaning("task-1", "2026-W30", 1);

    // Entrambe risultano submitting
    expect(controller.isCleaningSubmitting("task-0")).toBe(true);
    expect(controller.isCleaningSubmitting("task-1")).toBe(true);
    const latestCleaningIds = submittingCleaningIdsHistory[submittingCleaningIdsHistory.length - 1];
    expect(latestCleaningIds.has("task-0")).toBe(true);
    expect(latestCleaningIds.has("task-1")).toBe(true);

    // 2. Risponde per prima la mutazione di task-0
    resolvePost0({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        week: {
          ...mockWeek,
          cleanings: [{ ...mockCleaning0, isCompleted: true }, mockCleaning1],
        },
      }),
    });
    await op0;

    // Verifica fondamentale: task-0 ha terminato, ma task-1 DEVE rimanere in stato submitting!
    expect(controller.isCleaningSubmitting("task-0")).toBe(false);
    expect(controller.isCleaningSubmitting("task-1")).toBe(true);

    const cleaningIdsAfterOp0 = submittingCleaningIdsHistory[submittingCleaningIdsHistory.length - 1];
    expect(cleaningIdsAfterOp0.has("task-0")).toBe(false);
    expect(cleaningIdsAfterOp0.has("task-1")).toBe(true);
    expect(submittingTaskIdHistory[submittingTaskIdHistory.length - 1]).toBe("task-1");

    // 3. Risponde ora la mutazione di task-1
    resolvePost1({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        week: {
          ...mockWeek,
          cleanings: [{ ...mockCleaning0, isCompleted: true }, { ...mockCleaning1, isCompleted: true }],
        },
      }),
    });
    await op1;

    // Entrambe hanno completato
    expect(controller.isCleaningSubmitting("task-0")).toBe(false);
    expect(controller.isCleaningSubmitting("task-1")).toBe(false);
    const finalCleaningIds = submittingCleaningIdsHistory[submittingCleaningIdsHistory.length - 1];
    expect(finalCleaningIds.size).toBe(0);
    expect(submittingTaskIdHistory[submittingTaskIdHistory.length - 1]).toBeNull();
  });

  it("prevents slow POST of previous session from altering state, counters, or inFlight status of new session via catch/finally", async () => {
    let resolveOldPost!: (val: any) => void;
    const oldPostPromise = new Promise((res) => {
      resolveOldPost = res;
    });

    let resolveNewPost!: (val: any) => void;
    const newPostPromise = new Promise((res) => {
      resolveNewPost = res;
    });

    let postCount = 0;
    const mockFetcher = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/house/cleanings") {
        postCount++;
        if (postCount === 1) {
          // Vecchia POST lenta della prima sessione
          return oldPostPromise;
        }
        // Nuova POST della seconda sessione
        return newPostPromise;
      }
      if (url === "/api/auth/logout") {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) });
      }
      if (url === "/api/house/data") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ...initialHouseData,
            myRoommateId: 1, // nuovo utente
          }),
        });
      }
      return Promise.reject(new Error("Unknown route"));
    });

    const controller = createController(mockFetcher);

    // 1. Sessione 1: POST lenta avviata per task-0
    const oldOp = controller.completeCleaning("task-0", "2026-W30", 0);
    expect(controller.isCleaningSubmitting("task-0")).toBe(true);
    expect(controller.getActiveMutationsCount()).toBe(1);

    // 2. Logout mentre la vecchia POST è ancora in corso
    await controller.logout();
    expect(controller.getData()).toBeNull();
    expect(controller.getActiveMutationsCount()).toBe(0);
    expect(controller.isCleaningSubmitting("task-0")).toBe(false);

    // 3. Nuovo login (Sessione 2)
    controller.invalidatePendingRequests();
    await controller.fetchData();
    expect(controller.getData()?.myRoommateId).toBe(1);

    // 4. Nuova mutazione nella Sessione 2: completa task-0
    const newOp = controller.completeCleaning("task-0", "2026-W30", 1);
    expect(controller.getActiveMutationsCount()).toBe(1);
    expect(controller.isCleaningSubmitting("task-0")).toBe(true);
    expect(submittingTaskIdHistory[submittingTaskIdHistory.length - 1]).toBe("task-0");

    // 5. Completamento tardivo della vecchia POST (della Sessione 1): risposta 409
    resolveOldPost({
      ok: false,
      status: 409,
      json: async () => ({ error: "Attività vecchia fallita" }),
    });
    await oldOp;

    // VERIFICA FONDAMENTALE:
    // La vecchia POST non deve aver modificato l'errore della nuova sessione,
    // né aver decrementato activeMutationsCount, né aver rimosso task-0 da inFlightCleaningIds,
    // né aver reimpostato submittingTaskId a null!
    expect(errorHistory[errorHistory.length - 1]).toBeNull();
    expect(controller.getActiveMutationsCount()).toBe(1);
    expect(controller.isCleaningSubmitting("task-0")).toBe(true);
    expect(submittingTaskIdHistory[submittingTaskIdHistory.length - 1]).toBe("task-0");

    // 6. Ora risponde con successo la nuova mutazione della Sessione 2
    resolveNewPost({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        week: {
          ...mockWeek,
          cleanings: [{ ...mockCleaning0, isCompleted: true, completedBy: 1 }, mockCleaning1],
        },
      }),
    });
    await newOp;

    // Ora che la nuova mutazione ha completato regolarmente, lo stato si aggiorna
    expect(controller.getActiveMutationsCount()).toBe(0);
    expect(controller.isCleaningSubmitting("task-0")).toBe(false);
    expect(submittingTaskIdHistory[submittingTaskIdHistory.length - 1]).toBeNull();
    expect(controller.getData()?.currentWeek.cleanings[0].isCompleted).toBe(true);
    expect(controller.getData()?.currentWeek.cleanings[0].completedBy).toBe(1);
  });

  it("prevents slow POST rejection/network error from injecting errors or clearing inFlight state in new session", async () => {
    let rejectOldPost!: (err: any) => void;
    const oldPostPromise = new Promise((_, rej) => {
      rejectOldPost = rej;
    });

    let resolveNewPost!: (val: any) => void;
    const newPostPromise = new Promise((res) => {
      resolveNewPost = res;
    });

    let postCount = 0;
    const mockFetcher = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/house/cleanings") {
        postCount++;
        if (postCount === 1) {
          return oldPostPromise;
        }
        return newPostPromise;
      }
      if (url === "/api/auth/logout") {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) });
      }
      return Promise.reject(new Error("Unknown route"));
    });

    const controller = createController(mockFetcher);

    // 1. Sessione 1: avvia vecchia POST
    const oldOp = controller.completeCleaning("task-0", "2026-W30", 0);

    // 2. Logout e nuovo login
    await controller.logout();
    controller.invalidatePendingRequests();

    // 3. Nuova mutazione nella Sessione 2
    const newOp = controller.completeCleaning("task-1", "2026-W30", 1);
    expect(controller.getActiveMutationsCount()).toBe(1);
    expect(controller.isCleaningSubmitting("task-1")).toBe(true);

    // 4. La vecchia POST fallisce con errore di rete (catch block!)
    rejectOldPost(new Error("Network failed"));
    await oldOp;

    // Verifica fondamentale: nessun errore iniettato nella nuova sessione, e task-1 ancora inFlight!
    expect(errorHistory[errorHistory.length - 1]).toBeNull();
    expect(controller.getActiveMutationsCount()).toBe(1);
    expect(controller.isCleaningSubmitting("task-1")).toBe(true);

    // 5. Nuova mutazione termina con successo
    resolveNewPost({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        week: mockWeek,
      }),
    });
    await newOp;

    expect(controller.getActiveMutationsCount()).toBe(0);
    expect(controller.isCleaningSubmitting("task-1")).toBe(false);
  });
});
