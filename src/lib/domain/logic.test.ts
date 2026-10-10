import { describe, it, expect } from "vitest";
import {
  getMondayCivilParts,
  getWeekKey,
  parseWeekKey,
  formatWeekLabel,
  getRomeSundayEndIso,
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
  reconcileOpenTrash,
  determineCleaningAssignee,
  uncompleteCleaningTask,
  claimCleaningTask,
  claimTrashTask,
} from "./logic";
import { DEFAULT_ROOMMATES } from "./types";

describe("Europe/Rome Calendar & Week Helpers (P1-05)", () => {
  it("correctly calculates Rome civil week transition at midnight, not UTC (audit reproduction)", () => {
    // Sunday 11 October 2026 at 21:30 UTC = 23:30 in Rome (CEST, UTC+2).
    // It is still Sunday in Rome, so the week is 2026-10-05.
    const sunRomeEvening = new Date("2026-10-11T21:30:00.000Z");
    expect(getWeekKey(sunRomeEvening)).toBe("2026-10-05");

    // Sunday 11 October 2026 at 22:30 UTC = 00:30 on MONDAY 12 October in Rome (CEST, UTC+2).
    // In Italy, it is already Monday! The week must be 2026-10-12!
    const monRomeMidnight = new Date("2026-10-11T22:30:00.000Z");
    expect(getWeekKey(monRomeMidnight)).toBe("2026-10-12");
  });

  it("handles year end and month boundaries in Rome civil calendar", () => {
    // Year-end boundary: Monday 28 Dec 2026 -> Sunday 3 Jan 2027
    const yearEnd = parseWeekKey("2026-12-28");
    expect(yearEnd.monday).toEqual({ year: 2026, month: 12, day: 28 });
    expect(yearEnd.sunday).toEqual({ year: 2027, month: 1, day: 3 });
    expect(formatWeekLabel("2026-12-28")).toBe("28 dic 2026 - 3 gen 2027");

    // Month boundary: 28 September - 4 October 2026
    expect(formatWeekLabel("2026-09-28")).toBe("28 set - 4 ott 2026");

    // Same month: 5 - 11 October 2026
    expect(formatWeekLabel("2026-10-05")).toBe("5 - 11 ott 2026");
  });

  it("calculates Sunday 23:59:59 in Europe/Rome ensuring it never rolls into Monday (P2-02)", () => {
    // 1. Summer daylight saving time (CEST, UTC+2)
    // Week 2026-10-05: Sunday is 11 October 2026.
    // 23:59:59 Rome = 21:59:59 UTC
    const isoSummer = getRomeSundayEndIso("2026-10-05");
    expect(isoSummer).toBe("2026-10-11T21:59:59.000Z");

    const dateSummer = new Date(isoSummer);
    const romeSummerFormatted = dateSummer.toLocaleString("it-IT", { timeZone: "Europe/Rome" });
    expect(romeSummerFormatted).toContain("11/10/2026, 23:59:59");

    const weekdaySummer = new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      weekday: "long",
    }).format(dateSummer);
    expect(weekdaySummer.toLowerCase()).toBe("domenica");

    // 2. Winter standard time (CET, UTC+1)
    // Week 2026-12-07: Sunday is 13 December 2026.
    // 23:59:59 Rome = 22:59:59 UTC
    const isoWinter = getRomeSundayEndIso("2026-12-07");
    expect(isoWinter).toBe("2026-12-13T22:59:59.000Z");

    const dateWinter = new Date(isoWinter);
    const romeWinterFormatted = dateWinter.toLocaleString("it-IT", { timeZone: "Europe/Rome" });
    expect(romeWinterFormatted).toContain("13/12/2026, 23:59:59");

    const weekdayWinter = new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      weekday: "long",
    }).format(dateWinter);
    expect(weekdayWinter.toLowerCase()).toBe("domenica");
  });
});


describe("Weekly Cleaning 3-Week Rotation & Name Snapshots", () => {
  it("follows the exact 3-week cyclical rotation and saves assignedToName snapshot", () => {
    const w0 = getRotationWeekIndex("2026-01-05");
    const w1 = getRotationWeekIndex("2026-01-12");
    const w2 = getRotationWeekIndex("2026-01-19");
    const w3 = getRotationWeekIndex("2026-01-26");

    expect(w0).toBe(0);
    expect(w1).toBe(1);
    expect(w2).toBe(2);
    expect(w3).toBe(0);

    // Week 0 assignments
    expect(getBaseAssignment(0, w0)).toBe(0); // Cucina -> 0
    expect(getBaseAssignment(1, w0)).toBe(1); // Bagno -> 1
    expect(getBaseAssignment(2, w0)).toBe(2); // Ingresso -> 2

    const tasks = createWeekCleanings("2026-01-05", [], DEFAULT_ROOMMATES);
    expect(tasks).toHaveLength(3);
    expect(tasks[0].assignedTo).toBe(0);
    expect(tasks[0].assignedToName).toBe("Coinquilino 1");
    expect(tasks[1].assignedTo).toBe(1);
    expect(tasks[1].assignedToName).toBe("Coinquilino 2");
    expect(tasks[2].assignedTo).toBe(2);
    expect(tasks[2].assignedToName).toBe("Coinquilino 3");
  });
});

describe("Cleaning Substitutions & Strict Assignee Validation (P1-02)", () => {
  it("prevents decline if declining roommate is not the current assignee", () => {
    const tasks = createWeekCleanings("2026-01-05", [], DEFAULT_ROOMMATES);
    const cucina = tasks[0]; // assignedTo: 0

    // Roommate 1 tries to decline Roommate 0's task -> must throw!
    expect(() => declineCleaningTask(cucina, [], 1, DEFAULT_ROOMMATES)).toThrow(
      "Solo l'incaricato assegnato può rinunciare a questa attività."
    );
  });

  it("reassigns correctly and updates assignedToName when assignee declines", () => {
    const tasks = createWeekCleanings("2026-01-05", [], DEFAULT_ROOMMATES);
    const cucina = tasks[0]; // assignedTo: 0, "Coinquilino 1"

    const declinedOnce = declineCleaningTask(cucina, [], 0, DEFAULT_ROOMMATES);
    expect(declinedOnce.assignedTo).toBe(1);
    expect(declinedOnce.assignedToName).toBe("Coinquilino 2");
    expect(declinedOnce.declinedBy).toEqual([0]);

    const declinedTwice = declineCleaningTask(declinedOnce, [], 1, DEFAULT_ROOMMATES);
    expect(declinedTwice.assignedTo).toBe(2);
    expect(declinedTwice.assignedToName).toBe("Coinquilino 3");

    const declinedAll = declineCleaningTask(declinedTwice, [], 2, DEFAULT_ROOMMATES);
    expect(declinedAll.assignedTo).toBe(null);
    expect(declinedAll.assignedToName).toBe(null);
  });
});

describe("Absences during Weekly Cleanings", () => {
  it("assigns to substitute initially if roommate is already absent at week start", () => {
    const tasks = createWeekCleanings("2026-01-05", [0], DEFAULT_ROOMMATES);
    const cucina = tasks.find((t) => t.areaId === 0)!;
    expect(cucina.assignedTo).toBe(1);
    expect(cucina.assignedToName).toBe("Coinquilino 2");
  });

  it("preserves already transferred tasks when absence is revoked before week end", () => {
    const tasks = createWeekCleanings("2026-01-05", [], DEFAULT_ROOMMATES);
    const tasksWithAbsence = applyRoommateAbsence(tasks, 0, [], DEFAULT_ROOMMATES);
    expect(tasksWithAbsence[0].assignedTo).toBe(1);

    // Roommate 0 revokes absence
    const revoked = revokeRoommateAbsence(tasksWithAbsence, 0, [], DEFAULT_ROOMMATES);
    expect(revoked[0].assignedTo).toBe(1); // Task remains with roommate 1!
  });
});

describe("Trash Management & Reconciliation on Absence (P1-01, P1-02, P1-04)", () => {
  it("strictly validates that only assigned roommate can decline or complete trash", () => {
    const queue = [0, 1, 2];
    const task = reportTrash(queue, [], null); // assignedTo: 0

    // Roommate 1 tries to decline -> must throw!
    expect(() => declineTrash(task, queue, [], 1)).toThrow(
      "Solo l'incaricato attuale della spazzatura può rinunciare."
    );

    // Roommate 1 tries to complete -> must throw!
    expect(() => completeTrash(task, queue, 1, "Coinquilino 2")).toThrow(
      "Solo l'incaricato assegnato può completare questo compito."
    );

    // Roommate 0 completes successfully
    const { updatedTask, updatedQueue } = completeTrash(task, queue, 0, "Coinquilino 1");
    expect(updatedTask.status).toBe("completed");
    expect(updatedQueue).toEqual([1, 2, 0]);
  });

  it("reconciles open trash immediately when current assignee becomes absent (P1-04)", () => {
    const queue = [0, 1, 2];
    const task = reportTrash(queue, [], null); // assignedTo: 0
    expect(task.assignedTo).toBe(0);

    // Roommate 0 becomes absent: reconcileOpenTrash reassigns to Roommate 1
    const reconciled = reconcileOpenTrash(task, queue, [0]);
    expect(reconciled?.assignedTo).toBe(1);
    // Queue order remains unchanged!
    expect(queue).toEqual([0, 1, 2]);

    // If both 0 and 1 are absent, reassigns to Roommate 2
    const reconciled2 = reconcileOpenTrash(task, queue, [0, 1]);
    expect(reconciled2?.assignedTo).toBe(2);

    // If all are absent, assignedTo becomes null
    const reconciledAll = reconcileOpenTrash(task, queue, [0, 1, 2]);
    expect(reconciledAll?.assignedTo).toBe(null);
  });

  it("reconciles unassigned trash when a roommate returns from absence (P1-04)", () => {
    const queue = [0, 1, 2];
    // Task was unassigned because everyone was absent
    const task = reportTrash(queue, [0, 1, 2], null);
    expect(task.assignedTo).toBe(null);

    // Roommate 1 returns from absence (0 and 2 still absent)
    const reconciled = reconcileOpenTrash(task, queue, [0, 2]);
    expect(reconciled?.assignedTo).toBe(1);
  });

  it("does not re-assign to a roommate who has already declined even if returning from absence", () => {
    const queue = [0, 1, 2];
    const task = reportTrash(queue, [], null); // assignedTo: 0
    const declined0 = declineTrash(task, queue, [], 0); // assignedTo: 1, declinedBy: [0]

    // Roommate 1 becomes absent, 0 returns
    declined0.assignedTo = null; // simulate both unavailable
    const reconciled = reconcileOpenTrash(declined0, queue, [1]); // Roommate 0 is not absent, but declinedBy includes 0
    // Roommate 2 should get it because 0 already declined!
    expect(reconciled?.assignedTo).toBe(2);
  });

  it("reconciles open trash without assignee when entering a new week with no absences (P1-03)", () => {
    const queue = [0, 1, 2];
    // In week 1: all roommates were absent, trash was reported with assignedTo = null
    const task = reportTrash(queue, [0, 1, 2], null);
    expect(task.assignedTo).toBe(null);
    expect(task.status).toBe("open");

    // On Monday morning of week 2: absences are reset to []
    // reconcileOpenTrash must assign to the first available in queue (Roommate 0)
    const reconciled = reconcileOpenTrash(task, queue, []);
    expect(reconciled?.assignedTo).toBe(0);
    expect(reconciled?.status).toBe("open");
    // Queue order must be strictly preserved
    expect(queue).toEqual([0, 1, 2]);
  });
});

describe("Cleaning Completion Undo (Uncomplete)", () => {
  const roommates = [...DEFAULT_ROOMMATES];

  it("restores standard completed cleaning task to uncompleted state with correct assignee", () => {
    // Week 2026-10-05 has rotation index 0. Area 0 is assigned to Roommate 0.
    const cleanings = createWeekCleanings("2026-10-05", [], roommates);
    const task = cleanings[0];
    expect(task.assignedTo).toBe(0);

    // Simulate completion
    const completedTask = {
      ...task,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      completedByName: "Coinquilino 1",
    };

    const undone = uncompleteCleaningTask(completedTask, [], roommates);
    expect(undone.isCompleted).toBe(false);
    expect(undone.completedAt).toBeNull();
    expect(undone.completedByName).toBeNull();
    expect(undone.assignedTo).toBe(0);
    expect(undone.assignedToName).toBe("Coinquilino 1");
  });

  it("restores assignment to correct substitute if a decline was recorded before completion", () => {
    const cleanings = createWeekCleanings("2026-10-05", [], roommates);
    const declined = declineCleaningTask(cleanings[0], [], 0, roommates);
    expect(declined.assignedTo).toBe(1);
    expect(declined.declinedBy).toEqual([0]);

    // Roommate 1 completed it
    const completed = {
      ...declined,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      completedByName: "Coinquilino 2",
    };

    const undone = uncompleteCleaningTask(completed, [], roommates);
    expect(undone.isCompleted).toBe(false);
    expect(undone.completedAt).toBeNull();
    expect(undone.completedByName).toBeNull();
    expect(undone.completedBy).toBeNull();
    expect(undone.assignedTo).toBe(1);
    expect(undone.assignedToName).toBe("Coinquilino 2");
    expect(undone.declinedBy).toEqual([0]);
  });

  it("handles subsequent absence of assignee during completed state", () => {
    // Task was assigned to 1 and completed by 1
    const cleanings = createWeekCleanings("2026-10-05", [], roommates);
    const completed = {
      ...cleanings[1], // assignedTo: 1
      isCompleted: true,
      completedAt: new Date().toISOString(),
      completedByName: "Coinquilino 2",
      completedBy: 1,
    };

    // Roommate 1 became absent afterwards
    const undone = uncompleteCleaningTask(completed, [1], roommates);
    expect(undone.isCompleted).toBe(false);
    expect(undone.completedBy).toBeNull();
    // Since 1 is absent, substitute is found (2)
    expect(undone.assignedTo).toBe(2);
    expect(undone.assignedToName).toBe("Coinquilino 3");
  });

  it("preserves assignedTo: null for originally unassigned tasks on uncomplete", () => {
    const cleanings = createWeekCleanings("2026-10-05", [0, 1, 2], roommates);
    const unassigned = cleanings[0];
    expect(unassigned.assignedTo).toBeNull();

    const completed = {
      ...unassigned,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      completedByName: "Coinquilino 1",
      completedBy: 0,
    };

    const undone = uncompleteCleaningTask(completed, [1, 2], roommates);
    expect(undone.isCompleted).toBe(false);
    expect(undone.completedBy).toBeNull();
    expect(undone.assignedTo).toBeNull();
    expect(undone.assignedToName).toBeNull();
  });

  it("restores assignedTo: null if task was originally without an assignee (all declined or absent)", () => {
    const cleanings = createWeekCleanings("2026-10-05", [1, 2], roommates);
    // Area 0 base is 0. 0 declines: 1 and 2 are absent so no substitute available
    const declined0 = declineCleaningTask(cleanings[0], [1, 2], 0, roommates);
    expect(declined0.assignedTo).toBeNull();

    // A volunteer completes it
    const completed = {
      ...declined0,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      completedByName: "Coinquilino 1",
      completedBy: 0,
    };

    const undone = uncompleteCleaningTask(completed, [1, 2], roommates);
    expect(undone.isCompleted).toBe(false);
    expect(undone.completedAt).toBeNull();
    expect(undone.completedByName).toBeNull();
    expect(undone.completedBy).toBeNull();
    expect(undone.assignedTo).toBeNull();
    expect(undone.assignedToName).toBeNull();
  });

  it("throws error when attempting to uncomplete an already uncompleted task", () => {
    const cleanings = createWeekCleanings("2026-10-05", [], roommates);
    expect(() => uncompleteCleaningTask(cleanings[0], [], roommates)).toThrow(
      "L'attività non risulta completata."
    );
  });
});

describe("Claiming Unassigned Tasks Domain Logic (Section 1)", () => {
  const roommates = [
    { id: 0, name: "Coinquilino 1" },
    { id: 1, name: "Coinquilino 2" },
    { id: 2, name: "Coinquilino 3" },
  ];

  it("claims an unassigned cleaning task, removes previous decline, leaves isCompleted false", () => {
    const cleanings = createWeekCleanings("2026-10-05", [], roommates);
    let task = cleanings[0]; // assigned to 0

    // 0 declines -> assigned to 1
    task = declineCleaningTask(task, [], 0, roommates);
    // 1 declines -> assigned to 2
    task = declineCleaningTask(task, [], 1, roommates);
    // 2 declines -> assigned to null (unassigned)
    task = declineCleaningTask(task, [], 2, roommates);

    expect(task.assignedTo).toBeNull();
    expect(task.declinedBy).toEqual([0, 1, 2]);

    // Roommate 0 changes mind and claims
    const claimed = claimCleaningTask(task, [], 0, roommates);
    expect(claimed.assignedTo).toBe(0);
    expect(claimed.assignedToName).toBe("Coinquilino 1");
    expect(claimed.declinedBy).toEqual([1, 2]); // 0 removed from declinedBy
    expect(claimed.isCompleted).toBe(false);

    // Now roommate 0 can decline again if needed
    const declinedAgain = declineCleaningTask(claimed, [], 0, roommates);
    expect(declinedAgain.assignedTo).toBeNull();
    expect(declinedAgain.declinedBy).toContain(0);
  });

  it("rejects claiming a cleaning if already assigned or completed or absent", () => {
    const cleanings = createWeekCleanings("2026-10-05", [], roommates);
    const task = cleanings[0]; // assigned to 0

    // Cannot claim already assigned task
    expect(() => claimCleaningTask(task, [], 1, roommates)).toThrow(
      "L'attività ha già un incaricato assegnato."
    );

    // Unassigned task but claimant is absent
    const unassigned = { ...task, assignedTo: null, assignedToName: null };
    expect(() => claimCleaningTask(unassigned, [1], 1, roommates)).toThrow(
      "Un coinquilino assente non può prendere in carico l'attività."
    );

    // Already completed
    const completed = { ...unassigned, isCompleted: true };
    expect(() => claimCleaningTask(completed, [], 1, roommates)).toThrow(
      "L'attività risulta già completata."
    );
  });

  it("claims an unassigned trash task, removes previous decline, leaves open", () => {
    const trashQueue = [0, 1, 2];
    let openTrash = reportTrash(trashQueue, [], null); // assigned to 0
    expect(openTrash.assignedTo).toBe(0);

    // 0 declines -> assigned to 1
    openTrash = declineTrash(openTrash, trashQueue, [], 0);
    // 1 declines -> assigned to 2
    openTrash = declineTrash(openTrash, trashQueue, [], 1);
    // 2 declines -> assigned to null
    openTrash = declineTrash(openTrash, trashQueue, [], 2);

    expect(openTrash.assignedTo).toBeNull();
    expect(openTrash.declinedBy).toEqual([0, 1, 2]);

    // Roommate 1 changes mind and claims
    const claimed = claimTrashTask(openTrash, [], 1);
    expect(claimed.assignedTo).toBe(1);
    expect(claimed.declinedBy).toEqual([0, 2]); // 1 removed from declinedBy
    expect(claimed.status).toBe("open");
  });

  it("rejects claiming trash if already assigned or closed or absent", () => {
    const openTrash = reportTrash([0, 1, 2], [], null); // assigned to 0

    expect(() => claimTrashTask(openTrash, [], 1)).toThrow(
      "L'incarico di spazzatura ha già un assegnatario."
    );

    const unassigned = { ...openTrash, assignedTo: null };
    expect(() => claimTrashTask(unassigned, [2], 2)).toThrow(
      "Un coinquilino assente non può prendere in carico la spazzatura."
    );

    const completed = { ...unassigned, status: "completed" as const };
    expect(() => claimTrashTask(completed, [], 1)).toThrow(
      "L'incarico di spazzatura non è aperto."
    );
  });
});



