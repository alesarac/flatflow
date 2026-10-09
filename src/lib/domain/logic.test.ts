import { describe, it, expect } from "vitest";
import {
  getMondayOf,
  getSundayOf,
  getWeekKey,
  parseWeekKey,
  formatWeekLabel,
  getRotationWeekIndex,
  getBaseAssignment,
  findSubstitute,
  createWeekCleanings,
  declineCleaningTask,
  applyRoommateAbsence,
  revokeRoommateAbsence,
  findNextTrashAssignee,
  reportTrash,
  declineTrash,
  completeTrash,
} from "./logic";

describe("Date and Week Helpers", () => {
  it("correctly identifies Monday and Sunday of a week", () => {
    // 2026-10-10 is a Saturday
    const sat = new Date(Date.UTC(2026, 9, 10, 15, 30, 0));
    const monday = getMondayOf(sat);
    const sunday = getSundayOf(monday);

    expect(monday.getUTCFullYear()).toBe(2026);
    expect(monday.getUTCMonth()).toBe(9); // October
    expect(monday.getUTCDate()).toBe(5); // Monday Oct 5
    expect(monday.getUTCDay()).toBe(1); // Monday

    expect(sunday.getUTCDate()).toBe(11); // Sunday Oct 11
    expect(sunday.getUTCDay()).toBe(0); // Sunday
  });

  it("handles weekKey generation and parsing", () => {
    const sat = new Date(Date.UTC(2026, 9, 10));
    const key = getWeekKey(sat);
    expect(key).toBe("2026-10-05");

    const parsed = parseWeekKey(key);
    expect(parsed.getUTCDate()).toBe(5);
    expect(parsed.getUTCMonth()).toBe(9);
  });

  it("formats Italian week labels properly", () => {
    expect(formatWeekLabel("2026-10-05")).toBe("5 - 11 ott 2026");
    expect(formatWeekLabel("2026-09-28")).toBe("28 set - 4 ott 2026");
  });
});

describe("Weekly Cleaning 3-Week Rotation", () => {
  it("follows the exact 3-week cyclical rotation where everyone cleans every area", () => {
    const monday0 = parseWeekKey("2026-01-05"); // Week 0
    const monday1 = parseWeekKey("2026-01-12"); // Week 1
    const monday2 = parseWeekKey("2026-01-19"); // Week 2
    const monday3 = parseWeekKey("2026-01-26"); // Week 3 (cycles back)

    const w0 = getRotationWeekIndex(monday0);
    const w1 = getRotationWeekIndex(monday1);
    const w2 = getRotationWeekIndex(monday2);
    const w3 = getRotationWeekIndex(monday3);

    expect(w0).toBe(0);
    expect(w1).toBe(1);
    expect(w2).toBe(2);
    expect(w3).toBe(0);

    // Week 0 assignments
    expect(getBaseAssignment(0, w0)).toBe(0); // Cucina -> 0
    expect(getBaseAssignment(1, w0)).toBe(1); // Bagno -> 1
    expect(getBaseAssignment(2, w0)).toBe(2); // Ingresso -> 2

    // Week 1 assignments
    expect(getBaseAssignment(0, w1)).toBe(1); // Cucina -> 1
    expect(getBaseAssignment(1, w1)).toBe(2); // Bagno -> 2
    expect(getBaseAssignment(2, w1)).toBe(0); // Ingresso -> 0

    // Week 2 assignments
    expect(getBaseAssignment(0, w2)).toBe(2); // Cucina -> 2
    expect(getBaseAssignment(1, w2)).toBe(0); // Bagno -> 0
    expect(getBaseAssignment(2, w2)).toBe(1); // Ingresso -> 1

    // Verify Roommate 0 rotates through Cucina (W0), Ingresso (W1), Bagno (W2)
    // Verify Roommate 1 rotates through Bagno (W0), Cucina (W1), Ingresso (W2)
    // Verify Roommate 2 rotates through Ingresso (W0), Bagno (W1), Cucina (W2)
  });

  it("creates standard week cleanings when nobody is absent", () => {
    const tasks = createWeekCleanings("2026-01-05", []);
    expect(tasks).toHaveLength(3);
    expect(tasks.map((t) => t.assignedTo)).toEqual([0, 1, 2]);
    expect(tasks.every((t) => !t.isCompleted)).toBe(true);
  });
});

describe("Cleaning Substitutions and Declines", () => {
  it("finds substitute in fixed circular order (0 -> 1 -> 2 -> 0)", () => {
    expect(findSubstitute(0, [], [])).toBe(1);
    expect(findSubstitute(1, [], [])).toBe(2);
    expect(findSubstitute(2, [], [])).toBe(0);
  });

  it("skips absent roommates and declined roommates", () => {
    // Roommate 0 declines, roommate 1 is absent -> goes to roommate 2
    expect(findSubstitute(0, [1], [0])).toBe(2);

    // Roommate 0 declines, 1 and 2 already declined -> null
    expect(findSubstitute(0, [], [0, 1, 2])).toBe(null);

    // Roommate 0 declines, 1 is absent, 2 declined -> null
    expect(findSubstitute(0, [1], [0, 2])).toBe(null);
  });

  it("correctly reassigns when a roommate clicks 'Non posso pulire'", () => {
    const tasks = createWeekCleanings("2026-01-05", []);
    const cucina = tasks[0]; // assignedTo: 0

    // Roommate 0 declines
    const declinedOnce = declineCleaningTask(cucina, [], 0);
    expect(declinedOnce.assignedTo).toBe(1);
    expect(declinedOnce.declinedBy).toEqual([0]);

    // Roommate 1 also declines
    const declinedTwice = declineCleaningTask(declinedOnce, [], 1);
    expect(declinedTwice.assignedTo).toBe(2);
    expect(declinedTwice.declinedBy).toEqual([0, 1]);

    // Roommate 2 also declines -> unassigned
    const declinedAll = declineCleaningTask(declinedTwice, [], 2);
    expect(declinedAll.assignedTo).toBe(null);
    expect(declinedAll.declinedBy).toEqual([0, 1, 2]);
  });
});

describe("Absences during Weekly Cleanings", () => {
  it("assigns to substitute initially if roommate is already absent at week start", () => {
    // In week 2026-01-05, base Cucina is 0. If 0 is absent, it should go to 1.
    const tasks = createWeekCleanings("2026-01-05", [0]);
    const cucina = tasks.find((t) => t.areaId === 0)!;
    expect(cucina.assignedTo).toBe(1);
  });

  it("allows one person to receive 2 or 3 areas if others are absent", () => {
    // Both 0 and 1 are absent -> roommate 2 receives all 3 areas!
    const tasks = createWeekCleanings("2026-01-05", [0, 1]);
    expect(tasks.map((t) => t.assignedTo)).toEqual([2, 2, 2]);
  });

  it("leaves tasks unassigned if all 3 roommates are absent", () => {
    const tasks = createWeekCleanings("2026-01-05", [0, 1, 2]);
    expect(tasks.map((t) => t.assignedTo)).toEqual([null, null, null]);
  });

  it("reassigns tasks when roommate declares absence mid-week, leaving completed tasks untouched", () => {
    const tasks = createWeekCleanings("2026-01-05", []);
    // Roommate 0 completes Bagno? No, base is: Cucina: 0, Bagno: 1, Ingresso: 2
    tasks[0].isCompleted = true; // Cucina completed by 0

    // Now roommate 0 declares absence
    const updated = applyRoommateAbsence(tasks, 0, []);
    // Cucina was completed, stays completed and assigned to 0
    expect(updated[0].isCompleted).toBe(true);
    expect(updated[0].assignedTo).toBe(0);

    // If roommate 1 declares absence, Bagno (1) transfers to 2
    const updated2 = applyRoommateAbsence(tasks, 1, []);
    expect(updated2[1].assignedTo).toBe(2);
  });

  it("preserves already transferred tasks when absence is revoked before week end", () => {
    const tasks = createWeekCleanings("2026-01-05", []);
    // Roommate 0 was absent, Cucina transferred to 1
    const tasksWithAbsence = applyRoommateAbsence(tasks, 0, []);
    expect(tasksWithAbsence[0].assignedTo).toBe(1);

    // Roommate 0 revokes absence
    const revoked = revokeRoommateAbsence(tasksWithAbsence, 0, []);
    // "le assegnazioni già trasferite non cambiano" -> Cucina remains with 1!
    expect(revoked[0].assignedTo).toBe(1);
  });
});

describe("Trash Management & Fair Queue", () => {
  it("assigns trash to head of queue and prevents multiple open tasks", () => {
    const queue = [0, 1, 2];
    const task = reportTrash(queue, [], null);

    expect(task.status).toBe("open");
    expect(task.assignedTo).toBe(0);

    // Rule 6: Only one open report at a time
    expect(() => reportTrash(queue, [], task)).toThrow();
  });

  it("skips absent roommates without changing their queue priority", () => {
    const queue = [0, 1, 2];
    // Roommate 0 is absent
    const task = reportTrash(queue, [0], null);
    // Roommate 1 gets it
    expect(task.assignedTo).toBe(1);

    // The queue order remains [0, 1, 2]
    expect(queue).toEqual([0, 1, 2]);
  });

  it("when roommate declines trash, they maintain queue priority and it reassigns to next in queue", () => {
    const initialQueue = [0, 1, 2];
    const task = reportTrash(initialQueue, [], null); // assignedTo: 0

    // Roommate 0 declines ("Non posso")
    const declined = declineTrash(task, initialQueue, [], 0);
    expect(declined.assignedTo).toBe(1);
    expect(declined.declinedBy).toEqual([0]);

    // Initial queue has NOT changed! Roommate 0 is still first in queue!
    expect(initialQueue).toEqual([0, 1, 2]);

    // Roommate 1 completes the trash ("Ho buttato")
    const { updatedTask, updatedQueue } = completeTrash(declined, initialQueue, 1, "Coinquilino 2");
    expect(updatedTask.status).toBe("completed");
    expect(updatedTask.completedByName).toBe("Coinquilino 2");

    // Roommate 1 moves to the back of the queue!
    // Queue becomes [0, 2, 1]! Roommate 0 maintains their top priority for next time!
    expect(updatedQueue).toEqual([0, 2, 1]);

    // Next trash report goes to roommate 0!
    const nextTask = reportTrash(updatedQueue, [], null);
    expect(nextTask.assignedTo).toBe(0);
  });

  it("sets assignedTo to null if everyone declines or is absent", () => {
    const queue = [0, 1, 2];
    const task = reportTrash(queue, [2], null); // assignedTo: 0 (2 is absent)
    const dec0 = declineTrash(task, queue, [2], 0); // goes to 1
    expect(dec0.assignedTo).toBe(1);
    const dec1 = declineTrash(dec0, queue, [2], 1); // 2 is absent, nobody left
    expect(dec1.assignedTo).toBe(null);
  });

  it("anyone can complete an open trash task even if reassigning was exhausted", () => {
    const queue = [0, 1, 2];
    const task = reportTrash(queue, [0, 1, 2], null); // all absent -> unassigned
    expect(task.assignedTo).toBe(null);

    // Roommate 2 manages to throw it
    const { updatedTask, updatedQueue } = completeTrash(task, queue, 2, "Coinquilino 3");
    expect(updatedTask.status).toBe("completed");
    expect(updatedTask.completedByName).toBe("Coinquilino 3");
    expect(updatedQueue).toEqual([0, 1, 2]); // 2 was last anyway
  });
});
