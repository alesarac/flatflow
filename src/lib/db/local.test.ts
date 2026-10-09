import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { LocalHouseRepository } from "./local";
import { reportTrash, declineTrash, completeTrash } from "../domain/logic";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-db.json");

describe("LocalHouseRepository", () => {
  let repo: LocalHouseRepository;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    repo = new LocalHouseRepository(TEST_DB_PATH);
  });

  it("initializes with default roommates and allows updating names", async () => {
    const roommates = await repo.getRoommates();
    expect(roommates).toHaveLength(3);
    expect(roommates[0].name).toBe("Coinquilino 1");

    await repo.updateRoommate(0, "Marco");
    const updated = await repo.getRoommates();
    expect(updated[0].name).toBe("Marco");
  });

  it("handles week cleanings and preserves historical snapshot of names across renames (P1-07)", async () => {
    const pastWeekKey = "2026-09-28";
    const pastWeek = await repo.getWeekState(pastWeekKey);
    // In week 2026-09-28 (w = 38 % 3 = 2):
    // Area 0 (Cucina) -> 2 ("Coinquilino 3")
    // Area 1 (Bagno) -> 0 ("Coinquilino 1")
    // Area 2 (Ingresso) -> 1 ("Coinquilino 2")
    expect(pastWeek.cleanings[0].assignedToName).toBe("Coinquilino 3");
    expect(pastWeek.cleanings[1].assignedToName).toBe("Coinquilino 1");
    expect(pastWeek.cleanings[2].assignedToName).toBe("Coinquilino 2");

    // Roommate 2 completes area 0
    pastWeek.cleanings[0].isCompleted = true;
    pastWeek.cleanings[0].completedAt = "2026-09-30T10:00:00.000Z";
    pastWeek.cleanings[0].completedByName = "Coinquilino 3";
    await repo.updateCleaningTask(pastWeek.cleanings[0]);

    // Area 2 was assigned to Coinquilino 2 (id: 1) and remained incomplete
    expect(pastWeek.cleanings[2].assignedToName).toBe("Coinquilino 2");

    // Later on, Coinquilino 2 (id: 1) is replaced by "Giacomo" in settings
    await repo.updateRoommate(1, "Giacomo");

    // Historical records must preserve "Coinquilino 2" as assigned at that time!
    const history = await repo.getHistory();
    const incompleteArea2 = history.items.find((h) => h.status === "incomplete" && h.areaId === 2);
    expect(incompleteArea2).toBeDefined();
    expect(incompleteArea2?.personName).toBe("Coinquilino 2");
  });

  it("reconciles open trash task immediately when assignee declares absence (P1-04)", async () => {
    const queue = await repo.getTrashQueue(); // [0, 1, 2]
    const task = reportTrash(queue, [], null); // assignedTo: 0
    await repo.createTrashTask(task);

    const openBefore = await repo.getOpenTrashTask();
    expect(openBefore?.assignedTo).toBe(0);

    // Roommate 0 declares absence for week 2026-10-05
    await repo.setRoommateAbsence("2026-10-05", 0, true);

    // Open trash must be immediately reassigned to Roommate 1
    const openAfter = await repo.getOpenTrashTask();
    expect(openAfter?.assignedTo).toBe(1);
    // Queue order remains untouched
    expect(await repo.getTrashQueue()).toEqual([0, 1, 2]);
  });

  it("performs atomic completion of trash and rotates queue (P1-01)", async () => {
    const queue = await repo.getTrashQueue(); // [0, 1, 2]
    const task = reportTrash(queue, [], null); // assignedTo: 0
    await repo.createTrashTask(task);

    // Atomic completion
    const { task: completed, queue: newQueue } = await repo.completeTrashAtomic(
      task.id,
      0,
      "Coinquilino 1"
    );

    expect(completed.status).toBe("completed");
    expect(completed.completedByName).toBe("Coinquilino 1");
    expect(newQueue).toEqual([1, 2, 0]);

    expect(await repo.getOpenTrashTask()).toBeNull();
    expect(await repo.getTrashQueue()).toEqual([1, 2, 0]);
  });

  it("supports pagination in history (P1-07)", async () => {
    // Generate and complete 3 separate trash tasks
    for (let i = 0; i < 3; i++) {
      const queue = await repo.getTrashQueue();
      const t = reportTrash(queue, [], null);
      await repo.createTrashTask(t);
      await repo.completeTrashAtomic(t.id, t.assignedTo!, `Coinquilino ${(t.assignedTo! + 1)}`);
    }

    const page1 = await repo.getHistory(2, 0);
    expect(page1.items).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.totalCount).toBeGreaterThanOrEqual(3);

    const page2 = await repo.getHistory(2, 2);
    expect(page2.items.length).toBeGreaterThanOrEqual(1);
    expect(page2.hasMore).toBe(false);
  });

  it("enforces rate limiting after 5 failed login attempts", async () => {
    const ip = "192.168.1.50";
    expect(await repo.isRateLimited(ip)).toBe(false);

    for (let i = 0; i < 4; i++) {
      await repo.recordFailedLogin(ip);
      expect(await repo.isRateLimited(ip)).toBe(false);
    }

    // 5th attempt triggers rate limit
    await repo.recordFailedLogin(ip);
    expect(await repo.isRateLimited(ip)).toBe(true);

    // Resetting clears rate limit
    await repo.resetRateLimit(ip);
    expect(await repo.isRateLimited(ip)).toBe(false);
  });
});
