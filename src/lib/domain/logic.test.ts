import { describe, it, expect } from "vitest";
import {
  getMondayCivilParts,
  getWeekKey,
  parseWeekKey,
  formatWeekLabel,
  formatHistoryWeekLabel,
  getRomeSundayEndIso,
  getRotationWeekIndex,
  getBaseAssignment,
  findSubstitute,
  createWeekCleanings,
  declineCleaningTask,
  findNextTrashAssignee,
  reportTrash,
  declineTrash,
  completeTrash,
  determineCleaningAssignee,
  uncompleteCleaningTask,
  canUndoCleaningDecline,
  undoDeclineCleaningTask,
  claimCleaningTask,
  claimTrashTask,
  getWeeklyProgressBarSegments,
  formatTimeAgo,
} from "./logic";
import { DEFAULT_ROOMMATES, CleaningTask } from "./types";

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

    // Formattazione settimanale storico: «5–11 ottobre», «28 settembre – 4 ottobre»
    expect(formatHistoryWeekLabel("2026-10-05")).toBe("5–11 ottobre");
    expect(formatHistoryWeekLabel("2026-09-28")).toBe("28 settembre – 4 ottobre");
    expect(formatHistoryWeekLabel("2026-12-28")).toBe("28 dicembre 2026 – 3 gennaio 2027");
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

    const tasks = createWeekCleanings("2026-01-05", DEFAULT_ROOMMATES);
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
    const tasks = createWeekCleanings("2026-01-05", DEFAULT_ROOMMATES);
    const cucina = tasks[0]; // assignedTo: 0

    // Roommate 1 tries to decline Roommate 0's task -> must throw!
    expect(() => declineCleaningTask(cucina, 1, DEFAULT_ROOMMATES)).toThrow(
      "Solo l'incaricato assegnato può rinunciare a questa attività."
    );
  });

  it("reassigns correctly and updates assignedToName when assignee declines", () => {
    const tasks = createWeekCleanings("2026-01-05", DEFAULT_ROOMMATES);
    const cucina = tasks[0]; // assignedTo: 0, "Coinquilino 1"

    const declinedOnce = declineCleaningTask(cucina, 0, DEFAULT_ROOMMATES);
    expect(declinedOnce.assignedTo).toBe(1);
    expect(declinedOnce.assignedToName).toBe("Coinquilino 2");
    expect(declinedOnce.declinedBy).toEqual([0]);

    const declinedTwice = declineCleaningTask(declinedOnce, 1, DEFAULT_ROOMMATES);
    expect(declinedTwice.assignedTo).toBe(2);
    expect(declinedTwice.assignedToName).toBe("Coinquilino 3");

    const declinedAll = declineCleaningTask(declinedTwice, 2, DEFAULT_ROOMMATES);
    expect(declinedAll.assignedTo).toBe(null);
    expect(declinedAll.assignedToName).toBe(null);
  });
});

describe("Trash Management & Declining (P1-01, P1-02)", () => {
  it("strictly validates that only assigned roommate can decline or complete trash", () => {
    const queue = [0, 1, 2];
    const task = reportTrash(queue, null); // assignedTo: 0

    // Roommate 1 tries to decline -> must throw!
    expect(() => declineTrash(task, queue, 1)).toThrow(
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

  it("advances to next in queue on decline and sets null when all decline", () => {
    const queue = [0, 1, 2];
    const task = reportTrash(queue, null); // assignedTo: 0
    expect(task.assignedTo).toBe(0);

    const declined0 = declineTrash(task, queue, 0);
    expect(declined0.assignedTo).toBe(1);
    expect(declined0.declinedBy).toEqual([0]);

    const declined1 = declineTrash(declined0, queue, 1);
    expect(declined1.assignedTo).toBe(2);
    expect(declined1.declinedBy).toEqual([0, 1]);

    const declined2 = declineTrash(declined1, queue, 2);
    expect(declined2.assignedTo).toBe(null);
    expect(declined2.declinedBy).toEqual([0, 1, 2]);
  });
});

describe("Cleaning Completion Undo (Uncomplete)", () => {
  const roommates = [...DEFAULT_ROOMMATES];

  it("restores standard completed cleaning task to uncompleted state with correct assignee", () => {
    // Week 2026-10-05 has rotation index 0. Area 0 is assigned to Roommate 0.
    const cleanings = createWeekCleanings("2026-10-05", roommates);
    const task = cleanings[0];
    expect(task.assignedTo).toBe(0);

    // Simulate completion
    const completedTask = {
      ...task,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      completedByName: "Coinquilino 1",
    };

    const undone = uncompleteCleaningTask(completedTask, roommates);
    expect(undone.isCompleted).toBe(false);
    expect(undone.completedAt).toBeNull();
    expect(undone.completedByName).toBeNull();
    expect(undone.assignedTo).toBe(0);
    expect(undone.assignedToName).toBe("Coinquilino 1");
  });

  it("restores assignment to correct substitute if a decline was recorded before completion", () => {
    const cleanings = createWeekCleanings("2026-10-05", roommates);
    const declined = declineCleaningTask(cleanings[0], 0, roommates);
    expect(declined.assignedTo).toBe(1);
    expect(declined.declinedBy).toEqual([0]);

    // Roommate 1 completed it
    const completed = {
      ...declined,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      completedByName: "Coinquilino 2",
    };

    const undone = uncompleteCleaningTask(completed, roommates);
    expect(undone.isCompleted).toBe(false);
    expect(undone.completedAt).toBeNull();
    expect(undone.completedByName).toBeNull();
    expect(undone.completedBy).toBeNull();
    expect(undone.assignedTo).toBe(1);
    expect(undone.assignedToName).toBe("Coinquilino 2");
    expect(undone.declinedBy).toEqual([0]);
  });

  it("restores assignedTo: null if task was originally without an assignee (all declined)", () => {
    const cleanings = createWeekCleanings("2026-10-05", roommates);
    let task = cleanings[0];
    task = declineCleaningTask(task, 0, roommates);
    task = declineCleaningTask(task, 1, roommates);
    task = declineCleaningTask(task, 2, roommates);
    expect(task.assignedTo).toBeNull();

    // A volunteer completes it
    const completed = {
      ...task,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      completedByName: "Coinquilino 1",
      completedBy: 0,
    };

    const undone = uncompleteCleaningTask(completed, roommates);
    expect(undone.isCompleted).toBe(false);
    expect(undone.completedAt).toBeNull();
    expect(undone.completedByName).toBeNull();
    expect(undone.completedBy).toBeNull();
    expect(undone.assignedTo).toBeNull();
    expect(undone.assignedToName).toBeNull();
  });

  it("throws error when attempting to uncomplete an already uncompleted task", () => {
    const cleanings = createWeekCleanings("2026-10-05", roommates);
    expect(() => uncompleteCleaningTask(cleanings[0], roommates)).toThrow(
      "L'attività non risulta completata."
    );
  });
});

describe("Undoing Cleaning Decline Domain Logic", () => {
  const roommates = [
    { id: 0, name: "Coinquilino 1" },
    { id: 1, name: "Coinquilino 2" },
    { id: 2, name: "Coinquilino 3" },
  ];

  it("allows original assignee to undo decline when no subsequent action occurred", () => {
    const cleanings = createWeekCleanings("2026-10-05", roommates);
    const task0 = cleanings[0]; // base assignment is 0
    expect(task0.assignedTo).toBe(0);

    const declined = declineCleaningTask(task0, 0, roommates);
    expect(declined.assignedTo).toBe(1);
    expect(declined.declinedBy).toEqual([0]);

    // Roommate 0 can undo
    expect(canUndoCleaningDecline(declined, 0)).toBe(true);
    // Other roommates cannot undo
    expect(canUndoCleaningDecline(declined, 1)).toBe(false);
    expect(canUndoCleaningDecline(declined, 2)).toBe(false);

    const undone = undoDeclineCleaningTask(declined, 0, roommates);
    expect(undone.assignedTo).toBe(0);
    expect(undone.assignedToName).toBe("Coinquilino 1");
    expect(undone.declinedBy).toEqual([]);
    expect(undone.isCompleted).toBe(false);
  });

  it("prevents previous decliner from undoing if the new assignee also declined", () => {
    const cleanings = createWeekCleanings("2026-10-05", roommates);
    let task = cleanings[0]; // assigned to 0
    task = declineCleaningTask(task, 0, roommates); // assigned to 1
    task = declineCleaningTask(task, 1, roommates); // assigned to 2

    // Roommate 0 cannot undo because roommate 1 already acted
    expect(canUndoCleaningDecline(task, 0)).toBe(false);
    expect(() => undoDeclineCleaningTask(task, 0, roommates)).toThrow(
      "Impossibile annullare la rinuncia per questa attività."
    );

    // Roommate 1 can undo because roommate 2 hasn't acted yet
    expect(canUndoCleaningDecline(task, 1)).toBe(true);

    const undone1 = undoDeclineCleaningTask(task, 1, roommates);
    expect(undone1.assignedTo).toBe(1);
    expect(undone1.assignedToName).toBe("Coinquilino 2");
    expect(undone1.declinedBy).toEqual([0]);

    // Now that roommate 1 undid, roommate 0 can undo again!
    expect(canUndoCleaningDecline(undone1, 0)).toBe(true);
    const undone0 = undoDeclineCleaningTask(undone1, 0, roommates);
    expect(undone0.assignedTo).toBe(0);
    expect(undone0.declinedBy).toEqual([]);
  });

  it("handles undo when all roommates had declined and task was unassigned", () => {
    const cleanings = createWeekCleanings("2026-10-05", roommates);
    let task = cleanings[0]; // 0
    task = declineCleaningTask(task, 0, roommates); // 1
    task = declineCleaningTask(task, 1, roommates); // 2
    task = declineCleaningTask(task, 2, roommates); // null

    expect(task.assignedTo).toBeNull();
    expect(task.declinedBy).toEqual([0, 1, 2]);

    // Only roommate 2 can undo
    expect(canUndoCleaningDecline(task, 0)).toBe(false);
    expect(canUndoCleaningDecline(task, 1)).toBe(false);
    expect(canUndoCleaningDecline(task, 2)).toBe(true);

    const undone2 = undoDeclineCleaningTask(task, 2, roommates);
    expect(undone2.assignedTo).toBe(2);
    expect(undone2.assignedToName).toBe("Coinquilino 3");
    expect(undone2.declinedBy).toEqual([0, 1]);
  });

  it("prevents undo if task was completed or claimed by another roommate", () => {
    const cleanings = createWeekCleanings("2026-10-05", roommates);
    let task = cleanings[0];
    task = declineCleaningTask(task, 0, roommates); // assigned to 1

    // Completed by substitute
    const completed = {
      ...task,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      completedByName: "Coinquilino 2",
      completedBy: 1,
    };
    expect(canUndoCleaningDecline(completed, 0)).toBe(false);
    expect(() => undoDeclineCleaningTask(completed, 0, roommates)).toThrow();

    // Claimed after unassigned
    let unassignedTask = declineCleaningTask(task, 1, roommates);
    unassignedTask = declineCleaningTask(unassignedTask, 2, roommates);
    // Roommate 0 claims
    const claimed = claimCleaningTask(unassignedTask, 0, roommates);
    // Roommate 2 was last before claim, but can no longer undo because 0 acted (claimed)
    expect(canUndoCleaningDecline(claimed, 2)).toBe(false);
    expect(() => undoDeclineCleaningTask(claimed, 2, roommates)).toThrow();
  });
});

describe("Claiming Unassigned Tasks Domain Logic (Section 1)", () => {
  const roommates = [
    { id: 0, name: "Coinquilino 1" },
    { id: 1, name: "Coinquilino 2" },
    { id: 2, name: "Coinquilino 3" },
  ];

  it("claims an unassigned cleaning task, removes previous decline, leaves isCompleted false", () => {
    const cleanings = createWeekCleanings("2026-10-05", roommates);
    let task = cleanings[0]; // assigned to 0

    // 0 declines -> assigned to 1
    task = declineCleaningTask(task, 0, roommates);
    // 1 declines -> assigned to 2
    task = declineCleaningTask(task, 1, roommates);
    // 2 declines -> assigned to null (unassigned)
    task = declineCleaningTask(task, 2, roommates);

    expect(task.assignedTo).toBeNull();
    expect(task.declinedBy).toEqual([0, 1, 2]);

    // Roommate 0 changes mind and claims
    const claimed = claimCleaningTask(task, 0, roommates);
    expect(claimed.assignedTo).toBe(0);
    expect(claimed.assignedToName).toBe("Coinquilino 1");
    expect(claimed.declinedBy).toEqual([1, 2]); // 0 removed from declinedBy
    expect(claimed.isCompleted).toBe(false);

    // Now roommate 0 can decline again if needed
    const declinedAgain = declineCleaningTask(claimed, 0, roommates);
    expect(declinedAgain.assignedTo).toBeNull();
    expect(declinedAgain.declinedBy).toContain(0);
  });

  it("rejects claiming a cleaning if already assigned or completed", () => {
    const cleanings = createWeekCleanings("2026-10-05", roommates);
    const task = cleanings[0]; // assigned to 0

    // Cannot claim already assigned task
    expect(() => claimCleaningTask(task, 1, roommates)).toThrow(
      "L'attività ha già un incaricato assegnato."
    );

    const unassigned = { ...task, assignedTo: null, assignedToName: null };

    // Already completed
    const completed = { ...unassigned, isCompleted: true };
    expect(() => claimCleaningTask(completed, 1, roommates)).toThrow(
      "L'attività risulta già completata."
    );
  });

  it("claims an unassigned trash task, removes previous decline, leaves open", () => {
    const trashQueue = [0, 1, 2];
    let openTrash = reportTrash(trashQueue, null); // assigned to 0
    expect(openTrash.assignedTo).toBe(0);

    // 0 declines -> assigned to 1
    openTrash = declineTrash(openTrash, trashQueue, 0);
    // 1 declines -> assigned to 2
    openTrash = declineTrash(openTrash, trashQueue, 1);
    // 2 declines -> assigned to null
    openTrash = declineTrash(openTrash, trashQueue, 2);

    expect(openTrash.assignedTo).toBeNull();
    expect(openTrash.declinedBy).toEqual([0, 1, 2]);

    // Roommate 1 changes mind and claims
    const claimed = claimTrashTask(openTrash, 1);
    expect(claimed.assignedTo).toBe(1);
    expect(claimed.declinedBy).toEqual([0, 2]); // 1 removed from declinedBy
    expect(claimed.status).toBe("open");
  });

  it("rejects claiming trash if already assigned or closed", () => {
    const openTrash = reportTrash([0, 1, 2], null); // assigned to 0

    expect(() => claimTrashTask(openTrash, 1)).toThrow(
      "L'incarico di spazzatura ha già un assegnatario."
    );

    const unassigned = { ...openTrash, assignedTo: null };

    const completed = { ...unassigned, status: "completed" as const };
    expect(() => claimTrashTask(completed, 1)).toThrow(
      "L'incarico di spazzatura non è aperto."
    );
  });
});

describe("Weekly Progress Bar Logic (Point 6)", () => {
  const roommates = [
    { id: 0, name: "Coinquilino 1" },
    { id: 1, name: "Coinquilino 2" },
    { id: 2, name: "Coinquilino 3" },
  ];

  it("0 cleanings completed: all 3 segments are gray (false)", () => {
    const cleanings = [
      { areaId: 0, isCompleted: false },
      { areaId: 1, isCompleted: false },
      { areaId: 2, isCompleted: false },
    ];
    expect(getWeeklyProgressBarSegments(cleanings)).toEqual([false, false, false]);
  });

  it("1 cleaning completed: 1st segment is green (true) regardless of which area was cleaned", () => {
    const onlyArea2Done = [
      { areaId: 0, isCompleted: false },
      { areaId: 1, isCompleted: false },
      { areaId: 2, isCompleted: true },
    ];
    expect(getWeeklyProgressBarSegments(onlyArea2Done)).toEqual([true, false, false]);

    const onlyArea1Done = [
      { areaId: 0, isCompleted: false },
      { areaId: 1, isCompleted: true },
      { areaId: 2, isCompleted: false },
    ];
    expect(getWeeklyProgressBarSegments(onlyArea1Done)).toEqual([true, false, false]);

    const onlyArea0Done = [
      { areaId: 0, isCompleted: true },
      { areaId: 1, isCompleted: false },
      { areaId: 2, isCompleted: false },
    ];
    expect(getWeeklyProgressBarSegments(onlyArea0Done)).toEqual([true, false, false]);
  });

  it("2 cleanings completed: 1st and 2nd segments are green, 3rd is gray, regardless of order", () => {
    const area2And0Done = [
      { areaId: 0, isCompleted: true },
      { areaId: 1, isCompleted: false },
      { areaId: 2, isCompleted: true },
    ];
    expect(getWeeklyProgressBarSegments(area2And0Done)).toEqual([true, true, false]);

    const area1And2Done = [
      { areaId: 0, isCompleted: false },
      { areaId: 1, isCompleted: true },
      { areaId: 2, isCompleted: true },
    ];
    expect(getWeeklyProgressBarSegments(area1And2Done)).toEqual([true, true, false]);
  });

  it("3 cleanings completed: all 3 segments are green", () => {
    const allDone = [
      { areaId: 0, isCompleted: true },
      { areaId: 1, isCompleted: true },
      { areaId: 2, isCompleted: true },
    ];
    expect(getWeeklyProgressBarSegments(allDone)).toEqual([true, true, true]);
  });

  it("correctly regresses from N to N-1 (always from right to left) upon undoing cleanings", () => {
    const baseTasks = createWeekCleanings("2026-10-05", roommates);
    const task0 = { ...baseTasks[0], isCompleted: true, completedBy: 0, completedByName: "Coinquilino 1" };
    const task1 = { ...baseTasks[1], isCompleted: true, completedBy: 1, completedByName: "Coinquilino 2" };
    const task2 = { ...baseTasks[2], isCompleted: true, completedBy: 2, completedByName: "Coinquilino 3" };

    let current: CleaningTask[] = [task0, task1, task2];
    expect(getWeeklyProgressBarSegments(current)).toEqual([true, true, true]);

    // Undo task 0 (Cucina) -> 2 remaining -> segments 0 and 1 green, 2 gray
    const undone0 = uncompleteCleaningTask(task0, roommates);
    current = [undone0, task1, task2];
    expect(getWeeklyProgressBarSegments(current)).toEqual([true, true, false]);

    // Undo task 2 (Ingresso) -> 1 remaining -> segment 0 green, 1 and 2 gray
    const undone2 = uncompleteCleaningTask(task2, roommates);
    current = [undone0, task1, undone2];
    expect(getWeeklyProgressBarSegments(current)).toEqual([true, false, false]);

    // Undo task 1 (Bagno) -> 0 remaining -> all gray
    const undone1 = uncompleteCleaningTask(task1, roommates);
    current = [undone0, undone1, undone2];
    expect(getWeeklyProgressBarSegments(current)).toEqual([false, false, false]);
  });
});

describe("Shopping List Time Ago Helper (formatTimeAgo)", () => {
  it("formats relative times cleanly in Italian according to mockups", () => {
    const now = new Date("2026-10-10T12:00:00.000Z");

    // Adesso (< 1 min)
    const justNow = new Date("2026-10-10T11:59:45.000Z").toISOString();
    expect(formatTimeAgo(justNow, now)).toBe("adesso");

    // Minuti fa (< 60 min)
    const tenMinAgo = new Date("2026-10-10T11:50:00.000Z").toISOString();
    expect(formatTimeAgo(tenMinAgo, now)).toBe("10m fa");

    // Ore fa (< 24 ore)
    const twoHoursAgo = new Date("2026-10-10T10:00:00.000Z").toISOString();
    expect(formatTimeAgo(twoHoursAgo, now)).toBe("2h fa");

    const fiveHoursAgo = new Date("2026-10-10T07:00:00.000Z").toISOString();
    expect(formatTimeAgo(fiveHoursAgo, now)).toBe("5h fa");

    // Giorni fa (< 30 giorni)
    const oneDayAgo = new Date("2026-10-09T12:00:00.000Z").toISOString();
    expect(formatTimeAgo(oneDayAgo, now)).toBe("1g fa");

    const twoDaysAgo = new Date("2026-10-08T12:00:00.000Z").toISOString();
    expect(formatTimeAgo(twoDaysAgo, now)).toBe("2g fa");
  });
});

