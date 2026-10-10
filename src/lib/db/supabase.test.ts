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

