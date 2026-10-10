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

