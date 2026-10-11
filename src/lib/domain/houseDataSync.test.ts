import { describe, it, expect, vi, beforeEach } from "vitest";
import { HouseDataSyncController } from "./houseDataSync";
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

  beforeEach(() => {
    dataHistory = [];
    errorHistory = [];
  });

  function createController(fetcherMock: any, initial: HouseData | null = initialHouseData) {
    return new HouseDataSyncController({
      initialData: initial,
      callbacks: {
        onDataChange: (d) => dataHistory.push(d),
        onLoadingChange: () => {},
        onError: (e) => errorHistory.push(e),
        onAuthenticatedChange: () => {},
        onSubmittingTaskIdChange: () => {},
        onIsSubmittingChange: () => {},
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
});
