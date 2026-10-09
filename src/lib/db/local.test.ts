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

  it("handles week cleanings and absence toggles", async () => {
    const weekKey = "2026-10-05";
    const initialWeek = await repo.getWeekState(weekKey);
    expect(initialWeek.cleanings).toHaveLength(3);
    expect(initialWeek.absentRoommates).toEqual([]);

    // Set roommate 0 absent
    const withAbsence = await repo.setRoommateAbsence(weekKey, 0, true);
    expect(withAbsence.absentRoommates).toEqual([0]);
    // The task assigned to 0 should now be assigned to someone else
    const taskForBase0 = withAbsence.cleanings.find((t) => t.assignedTo === 0);
    expect(taskForBase0).toBeUndefined();

    // Revoke absence
    const revoked = await repo.setRoommateAbsence(weekKey, 0, false);
    expect(revoked.absentRoommates).toEqual([]);
  });

  it("manages trash reporting, decline and queue rotation", async () => {
    const queue = await repo.getTrashQueue();
    expect(queue).toEqual([0, 1, 2]);

    const initialOpen = await repo.getOpenTrashTask();
    expect(initialOpen).toBeNull();

    // Report trash
    const task = reportTrash(queue, [], null);
    await repo.createTrashTask(task);

    const openTask = await repo.getOpenTrashTask();
    expect(openTask).not.toBeNull();
    expect(openTask?.assignedTo).toBe(0);

    // Decline trash
    const declined = declineTrash(openTask!, queue, [], 0);
    await repo.updateTrashTask(declined);

    const declinedOpen = await repo.getOpenTrashTask();
    expect(declinedOpen?.assignedTo).toBe(1);
    expect(declinedOpen?.declinedBy).toEqual([0]);

    // Complete trash by roommate 1
    const { updatedTask, updatedQueue } = completeTrash(
      declinedOpen!,
      queue,
      1,
      "Coinquilino 2"
    );
    await repo.updateTrashTask(updatedTask);
    await repo.updateTrashQueue(updatedQueue);

    expect(await repo.getOpenTrashTask()).toBeNull();
    expect(await repo.getTrashQueue()).toEqual([0, 2, 1]);
  });

  it("generates correct history for completed and past incomplete tasks", async () => {
    const pastWeekKey = "2026-09-28";
    const pastWeek = await repo.getWeekState(pastWeekKey);

    // Complete area 0
    pastWeek.cleanings[0].isCompleted = true;
    pastWeek.cleanings[0].completedAt = "2026-09-30T10:00:00.000Z";
    pastWeek.cleanings[0].completedByName = "Marco";
    await repo.updateCleaningTask(pastWeek.cleanings[0]);

    // Area 1 and 2 remain incomplete for past week

    const history = await repo.getHistory();
    // Area 0 was completed
    const completedItem = history.find((h) => h.status === "completed" && h.areaId === 0);
    expect(completedItem).toBeDefined();
    expect(completedItem?.personName).toBe("Marco");

    // Area 1 was incomplete
    const incompleteItem = history.find((h) => h.status === "incomplete" && h.areaId === 1);
    expect(incompleteItem).toBeDefined();
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
