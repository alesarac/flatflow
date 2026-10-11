import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { SupabaseHouseRepository } from "./supabase";

describe("Supabase Schema Security (P0-01)", () => {
  it("enforces search_path and revokes public/anon execution on rpc_complete_trash in schema.sql", () => {
    const schemaSql = fs.readFileSync(
      path.join(process.cwd(), "supabase", "schema.sql"),
      "utf-8"
    );

    // Deve avere SET search_path = public, pg_temp
    expect(schemaSql).toMatch(/SET\s+search_path\s*=\s*public,\s*pg_temp/i);

    // Deve revocare esplicitamente i permessi da PUBLIC, anon e authenticated
    expect(schemaSql).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+rpc_complete_trash.*FROM\s+PUBLIC/i);
    expect(schemaSql).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+rpc_complete_trash.*FROM\s+anon/i);
    expect(schemaSql).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+rpc_complete_trash.*FROM\s+authenticated/i);

    // Deve concedere execute solo a service_role
    expect(schemaSql).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+rpc_complete_trash.*TO\s+service_role/i);
  });
});

describe("SupabaseHouseRepository Atomic Trash Completion (P1-01)", () => {
  it("strictly throws an error and performs NO fallback updates if RPC fails", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    // Mock client.rpc to simulate an error (e.g. database error or function unavailable)
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Funzione non disponibile o errore transazione" },
    });

    const mockFrom = vi.fn();

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      rpc: mockRpc,
      from: mockFrom,
    };

    await expect(
      repo.completeTrashAtomic("task-123", 0, "Coinquilino 1")
    ).rejects.toThrow("Errore completamento atomico spazzatura");

    // Verifica fondamentale: client.from() NON deve essere stato chiamato (nessun fallback non atomico!)
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("successfully returns completed task and rotated queue when RPC succeeds", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    const mockRpc = vi.fn().mockResolvedValue({
      data: { success: true, new_queue: [1, 2, 0] },
      error: null,
    });

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      rpc: mockRpc,
    };

    const result = await repo.completeTrashAtomic("task-123", 0, "Coinquilino 1");
    expect(result.task.status).toBe("completed");
    expect(result.task.completedByName).toBe("Coinquilino 1");
    expect(result.queue).toEqual([1, 2, 0]);
  });
});

describe("SupabaseHouseRepository Conditional Trash Updates (P1-01)", () => {
  it("only updates assigned_to and declined_by, enforces status 'open', and rejects completed tasks", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    let updatedPayload: any = null;
    const eqCalls: [string, any][] = [];

    const mockQuery: any = {
      update: vi.fn((payload) => {
        updatedPayload = payload;
        return mockQuery;
      }),
      eq: vi.fn((col, val) => {
        eqCalls.push([col, val]);
        return mockQuery;
      }),
      select: vi.fn().mockResolvedValue({
        data: [], // 0 righe aggiornate (task già completato concorrentemente)
        error: null,
      }),
    };

    const mockFrom = vi.fn().mockReturnValue(mockQuery);

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      from: mockFrom,
    };

    const result = await repo.updateTrashTask(
      {
        id: "trash-1",
        status: "open",
        assignedTo: 1,
        declinedBy: [0],
        reportedAt: "2026-10-10T00:00:00Z",
        completedAt: null,
        completedByName: null,
      },
      { status: "open", assignedTo: 0 }
    );

    // 1. Risultato deve essere false perché nessuna riga è stata aggiornata
    expect(result).toBe(false);

    // 2. Il payload di update NON deve contenere status, completed_at o completed_by_name!
    expect(updatedPayload).toEqual({
      assigned_to: 1,
      declined_by: [0],
    });
    expect(updatedPayload.status).toBeUndefined();
    expect(updatedPayload.completed_at).toBeUndefined();

    // 3. La query deve filtrare rigorosamente su status = 'open' e assigned_to = 0
    expect(eqCalls).toContainEqual(["id", "trash-1"]);
    expect(eqCalls).toContainEqual(["status", "open"]);
    expect(eqCalls).toContainEqual(["assigned_to", 0]);
  });
});

describe("SupabaseHouseRepository Conditional Cleaning Updates & Undo", () => {
  it("enforces is_completed: true filter on uncomplete, saving null completed_by/completed_by_name and preserving assigned_to", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    let updatedPayload: any = null;
    const eqCalls: [string, any][] = [];

    const mockQuery: any = {
      update: vi.fn((payload) => {
        updatedPayload = payload;
        return mockQuery;
      }),
      eq: vi.fn((col, val) => {
        eqCalls.push([col, val]);
        return mockQuery;
      }),
      select: vi.fn().mockResolvedValue({
        data: [{ id: "2026-10-05-area-0" }], // 1 riga aggiornata con successo
        error: null,
      }),
    };

    const mockFrom = vi.fn().mockReturnValue(mockQuery);

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      from: mockFrom,
    };

    const taskToUncomplete = {
      id: "2026-10-05-area-0",
      weekKey: "2026-10-05",
      areaId: 0,
      assignedTo: 1, // Precedente assegnazione preservata
      assignedToName: "Coinquilino 2",
      declinedBy: [0],
      isCompleted: false,
      completedAt: null,
      completedByName: null,
      completedBy: null,
    };

    const success = await repo.updateCleaningTask(taskToUncomplete, {
      isCompleted: true,
    });

    expect(success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("cleaning_tasks");
    expect(eqCalls).toContainEqual(["id", "2026-10-05-area-0"]);
    expect(eqCalls).toContainEqual(["is_completed", true]);

    // Verifica payload per Supabase: reset completamento e conservazione assegnazione
    expect(updatedPayload).toEqual({
      assigned_to: 1,
      assigned_to_name: "Coinquilino 2",
      declined_by: [0],
      undoable_declines: [],
      is_completed: false,
      completed_at: null,
      completed_by_name: null,
      completed_by: null,
    });
  });

  it("returns false when a concurrent operation has already uncompleted or modified the task", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    const mockQuery: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [], // 0 righe aggiornate (conflitto di concorrenza)
        error: null,
      }),
    };

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      from: vi.fn().mockReturnValue(mockQuery),
    };

    const task = {
      id: "2026-10-05-area-0",
      weekKey: "2026-10-05",
      areaId: 0,
      assignedTo: 0,
      assignedToName: "Coinquilino 1",
      declinedBy: [],
      isCompleted: false,
      completedAt: null,
      completedByName: null,
      completedBy: null,
    };

    const success = await repo.updateCleaningTask(task, {
      isCompleted: true,
    });

    expect(success).toBe(false);
  });
});

describe("SupabaseHouseRepository Shopping Items Non-Existent and Concurrent Deletions", () => {
  it("toggleShoppingItem returns null when item does not exist or has already been deleted", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    const mockQuery: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [], // 0 rows updated
        error: null,
      }),
    };

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      from: vi.fn().mockReturnValue(mockQuery),
    };

    const result = await repo.toggleShoppingItem("non-existent-id", true, 0, "Coinquilino 1");
    expect(result).toBeNull();
    expect(mockQuery.update).toHaveBeenCalled();
    expect(mockQuery.eq).toHaveBeenCalledWith("id", "non-existent-id");
    expect(mockQuery.select).toHaveBeenCalled();
  });

  it("toggleShoppingItem returns updated item when row exists", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    const mockRow = {
      id: "shop-123",
      name: "Pane",
      is_bought: true,
      added_by: 0,
      added_by_name: "Coinquilino 1",
      created_at: "2026-10-10T10:00:00.000Z",
      bought_by: 1,
      bought_by_name: "Coinquilino 2",
      bought_at: "2026-10-10T12:00:00.000Z",
    };

    const mockQuery: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [mockRow],
        error: null,
      }),
    };

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      from: vi.fn().mockReturnValue(mockQuery),
    };

    const result = await repo.toggleShoppingItem("shop-123", true, 1, "Coinquilino 2");
    expect(result).toEqual({
      id: "shop-123",
      name: "Pane",
      isBought: true,
      addedBy: 0,
      addedByName: "Coinquilino 1",
      createdAt: "2026-10-10T10:00:00.000Z",
      boughtBy: 1,
      boughtByName: "Coinquilino 2",
      boughtAt: "2026-10-10T12:00:00.000Z",
    });
  });

  it("deleteShoppingItem returns false when item does not exist or has already been deleted", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    const mockQuery: any = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [], // 0 rows deleted
        error: null,
      }),
    };

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      from: vi.fn().mockReturnValue(mockQuery),
    };

    const deleted = await repo.deleteShoppingItem("non-existent-id");
    expect(deleted).toBe(false);
    expect(mockQuery.delete).toHaveBeenCalled();
    expect(mockQuery.eq).toHaveBeenCalledWith("id", "non-existent-id");
    expect(mockQuery.select).toHaveBeenCalledWith("id");
  });

  it("deleteShoppingItem returns true when row is deleted", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    const mockQuery: any = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: "shop-123" }],
        error: null,
      }),
    };

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      from: vi.fn().mockReturnValue(mockQuery),
    };

    const deleted = await repo.deleteShoppingItem("shop-123");
    expect(deleted).toBe(true);
    expect(mockQuery.delete).toHaveBeenCalled();
    expect(mockQuery.eq).toHaveBeenCalledWith("id", "shop-123");
  });
});

describe("SupabaseHouseRepository History Pagination with > 30 items in single category", () => {
  it("paginates accurately across multiple pages and reports hasMore: true when total category items exceed page limit", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    // Genera 70 compiti completati per una sola categoria (cleaning_tasks)
    const mockTasks = Array.from({ length: 70 }, (_, i) => ({
      id: `task-${i}`,
      area_id: 0,
      week_key: "2026-W30",
      is_completed: true,
      completed_at: new Date(Date.now() - i * 60000).toISOString(),
      completed_by_name: "Coinquilino 1",
      created_at: new Date(Date.now() - i * 60000).toISOString(),
    }));

    const createQueryMock = (dataToReturn: any[], countVal: number) => {
      const q: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn((limitVal: number) => {
          return Promise.resolve({
            data: dataToReturn.slice(0, limitVal),
            count: countVal,
            error: null,
          });
        }),
      };
      return q;
    };

    let cleaningCallCount = 0;
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "cleaning_tasks") {
        cleaningCallCount++;
        if (cleaningCallCount % 2 === 1) {
          // Query 1: is_completed = true -> 70 compiti completati
          return createQueryMock(mockTasks, 70);
        } else {
          // Query 2: is_completed = false -> 0 compiti incompleti
          return createQueryMock([], 0);
        }
      }
      if (table === "roommates") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: 0, name: "Coinquilino 1" }],
            error: null,
          }),
        };
      }
      // trash_tasks ha 0 elementi
      return createQueryMock([], 0);
    });

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      from: mockFrom,
    };

    // 1. Pagina 1: limit 30, offset 0 -> deve restituire 30 elementi, totalCount 70, hasMore = true
    const page1 = await repo.getHistory(30, 0);
    expect(page1.items).toHaveLength(30);
    expect(page1.totalCount).toBe(70);
    expect(page1.hasMore).toBe(true);
    expect(page1.items[0].id).toBe("clean-task-0");

    // 2. Pagina 2: limit 30, offset 30 -> deve restituire 30 elementi successivi (30-59), totalCount 70, hasMore = true
    const page2 = await repo.getHistory(30, 30);
    expect(page2.items).toHaveLength(30);
    expect(page2.totalCount).toBe(70);
    expect(page2.hasMore).toBe(true);
    expect(page2.items[0].id).toBe("clean-task-30");

    // 3. Pagina 3: limit 30, offset 60 -> deve restituire gli ultimi 10 elementi (60-69), totalCount 70, hasMore = false
    const page3 = await repo.getHistory(30, 60);
    expect(page3.items).toHaveLength(10);
    expect(page3.totalCount).toBe(70);
    expect(page3.hasMore).toBe(false);
    expect(page3.items[0].id).toBe("clean-task-60");
  });
});

describe("SupabaseHouseRepository Trash Queue Protection (Issue 4)", () => {
  it("throws immediately on read error without upserting initial queue [0, 1, 2]", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    const mockUpsert = vi.fn();
    const mockQuery: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection timeout" },
      }),
      upsert: mockUpsert,
    };

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      from: vi.fn().mockReturnValue(mockQuery),
    };

    await expect(repo.getTrashQueue()).rejects.toThrow("Errore lettura configurazione coda spazzatura");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("returns existing trash queue without upserting", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    const mockUpsert = vi.fn();
    const mockQuery: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { trash_queue: [2, 0, 1] },
        error: null,
      }),
      upsert: mockUpsert,
    };

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      from: vi.fn().mockReturnValue(mockQuery),
    };

    const queue = await repo.getTrashQueue();
    expect(queue).toEqual([2, 0, 1]);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("initializes queue with [0, 1, 2] only when configuration row is genuinely absent (data === null, error === null)", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    const mockUpsertQuery: any = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { trash_queue: [0, 1, 2] },
        error: null,
      }),
    };
    const mockUpsert = vi.fn().mockReturnValue(mockUpsertQuery);

    const mockSelectQuery: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
      upsert: mockUpsert,
    };

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      from: vi.fn().mockReturnValue(mockSelectQuery),
    };

    const queue = await repo.getTrashQueue();
    expect(queue).toEqual([0, 1, 2]);
    expect(mockUpsert).toHaveBeenCalledWith({ id: "default", trash_queue: [0, 1, 2] });
  });
});

describe("SupabaseHouseRepository Atomic Cleaning Verification of declinedBy (Issue 3)", () => {
  it("enforces exact declined_by array condition in query and saves undoable_declines", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    let updatedPayload: any = null;
    const eqCalls: [string, any][] = [];

    const mockQuery: any = {
      update: vi.fn((payload) => {
        updatedPayload = payload;
        return mockQuery;
      }),
      eq: vi.fn((col, val) => {
        eqCalls.push([col, val]);
        return mockQuery;
      }),
      is: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: "2026-10-05-area-0" }],
        error: null,
      }),
    };

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      from: vi.fn().mockReturnValue(mockQuery),
    };

    const task = {
      id: "2026-10-05-area-0",
      weekKey: "2026-10-05",
      areaId: 0,
      assignedTo: 1,
      assignedToName: "Coinquilino 2",
      declinedBy: [0],
      undoableDeclines: [0],
      isCompleted: false,
      completedAt: null,
      completedByName: null,
      completedBy: null,
    };

    const success = await repo.updateCleaningTask(task, {
      isCompleted: false,
      assignedTo: 0,
      declinedBy: [],
    });

    expect(success).toBe(true);
    expect(eqCalls).toContainEqual(["id", "2026-10-05-area-0"]);
    expect(eqCalls).toContainEqual(["is_completed", false]);
    expect(eqCalls).toContainEqual(["assigned_to", 0]);
    expect(eqCalls).toContainEqual(["declined_by", "{}"]);

    expect(updatedPayload.declined_by).toEqual([0]);
    expect(updatedPayload.undoable_declines).toEqual([0]);
  });

  it("returns false if concurrent operation altered declined_by (query returns 0 updated rows)", async () => {
    const repo = new SupabaseHouseRepository("https://dummy.supabase.co", "dummy-service-key");

    const mockQuery: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [], // 0 righe aggiornate per mismatch condizionale
        error: null,
      }),
    };

    // @ts-expect-error accessing private client for unit test mocking
    repo.client = {
      from: vi.fn().mockReturnValue(mockQuery),
    };

    const task = {
      id: "2026-10-05-area-0",
      weekKey: "2026-10-05",
      areaId: 0,
      assignedTo: 2,
      assignedToName: "Coinquilino 3",
      declinedBy: [0, 1],
      undoableDeclines: [0, 1],
      isCompleted: false,
      completedAt: null,
      completedByName: null,
      completedBy: null,
    };

    const success = await repo.updateCleaningTask(task, {
      isCompleted: false,
      assignedTo: 1,
      declinedBy: [0], // stato stale: nel DB era già cambiato
    });

    expect(success).toBe(false);
  });
});


