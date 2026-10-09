import { CleaningTask, TrashTask } from "./types";

// Anchor date: Monday 5 January 2026
const ANCHOR_MONDAY = new Date(Date.UTC(2026, 0, 5, 0, 0, 0));

/**
 * Returns the Monday at 00:00:00 UTC for the given date.
 */
export function getMondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the Sunday at 23:59:59 UTC for the week of the given Monday.
 */
export function getSundayOf(monday: Date): Date {
  const d = new Date(monday.getTime());
  d.setUTCDate(d.getUTCDate() + 6);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Returns a unique week key string in format "YYYY-MM-DD" representing the Monday of that week.
 */
export function getWeekKey(date: Date = new Date()): string {
  const monday = getMondayOf(date);
  const year = monday.getUTCFullYear();
  const month = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const day = String(monday.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a week key "YYYY-MM-DD" into its Monday Date.
 */
export function parseWeekKey(weekKey: string): Date {
  const [year, month, day] = weekKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

/**
 * Formats a week range in Italian, e.g. "5 ott - 11 ott 2026".
 */
export function formatWeekLabel(weekKey: string): string {
  const monday = parseWeekKey(weekKey);
  const sunday = getSundayOf(monday);

  const monthsIt = [
    "gen", "feb", "mar", "apr", "mag", "giu",
    "lug", "ago", "set", "ott", "nov", "dic"
  ];

  const mDay = monday.getUTCDate();
  const mMonth = monthsIt[monday.getUTCMonth()];
  const sDay = sunday.getUTCDate();
  const sMonth = monthsIt[sunday.getUTCMonth()];
  const year = sunday.getUTCFullYear();

  if (monday.getUTCMonth() === sunday.getUTCMonth()) {
    return `${mDay} - ${sDay} ${mMonth} ${year}`;
  }
  return `${mDay} ${mMonth} - ${sDay} ${sMonth} ${year}`;
}

/**
 * Calculates the number of weeks elapsed from anchor to determine the 3-week rotation cycle.
 */
export function getRotationWeekIndex(monday: Date): number {
  const diffMs = monday.getTime() - ANCHOR_MONDAY.getTime();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const weeks = Math.floor(diffMs / oneWeekMs);
  return ((weeks % 3) + 3) % 3;
}

/**
 * Determines the base roommate assignment for a specific area in a given week.
 * Areas: 0: Cucina, 1: Bagno, 2: Ingresso e corridoio
 * Roommates: 0, 1, 2
 */
export function getBaseAssignment(areaId: number, weekIndex: number): number {
  return (areaId + weekIndex) % 3;
}

/**
 * Finds the next substitute roommate following the fixed order 0 -> 1 -> 2 -> 0,
 * skipping absent roommates and those who have declined this task.
 */
export function findSubstitute(
  currentAssignee: number,
  absentRoommates: number[],
  declinedBy: number[]
): number | null {
  for (let step = 1; step <= 2; step++) {
    const candidate = (currentAssignee + step) % 3;
    if (!absentRoommates.includes(candidate) && !declinedBy.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Generates initial cleaning tasks for a given week.
 * Automatically accounts for roommates who are already absent this week.
 */
export function createWeekCleanings(
  weekKey: string,
  absentRoommates: number[] = []
): CleaningTask[] {
  const monday = parseWeekKey(weekKey);
  const weekIndex = getRotationWeekIndex(monday);

  const cleanings: CleaningTask[] = [];

  for (let areaId = 0; areaId < 3; areaId++) {
    const baseRoommate = getBaseAssignment(areaId, weekIndex);
    let assignedTo: number | null = baseRoommate;

    if (absentRoommates.includes(baseRoommate)) {
      assignedTo = findSubstitute(baseRoommate, absentRoommates, []);
    }

    cleanings.push({
      id: `${weekKey}-area-${areaId}`,
      weekKey,
      areaId,
      assignedTo,
      declinedBy: [],
      isCompleted: false,
      completedAt: null,
      completedByName: null,
    });
  }

  return cleanings;
}

/**
 * Handles a roommate declining a cleaning task ("Non posso pulire").
 * Adds the roommate to declinedBy and reassigns to the next available roommate in fixed order.
 */
export function declineCleaningTask(
  task: CleaningTask,
  absentRoommates: number[],
  decliningRoommateId: number
): CleaningTask {
  if (task.isCompleted) {
    return task;
  }

  const updatedDeclined = Array.from(new Set([...task.declinedBy, decliningRoommateId]));
  const nextAssignee = findSubstitute(decliningRoommateId, absentRoommates, updatedDeclined);

  return {
    ...task,
    declinedBy: updatedDeclined,
    assignedTo: nextAssignee,
  };
}

/**
 * Reassigns tasks when a roommate declares absence ("Sono assente questa settimana").
 * Only uncompleted tasks assigned to the newly absent roommate are reassigned.
 */
export function applyRoommateAbsence(
  cleanings: CleaningTask[],
  absentRoommateId: number,
  allAbsentRoommates: number[]
): CleaningTask[] {
  const absentSet = Array.from(new Set([...allAbsentRoommates, absentRoommateId]));

  return cleanings.map((task) => {
    if (task.isCompleted) return task;
    if (task.assignedTo === absentRoommateId) {
      const nextAssignee = findSubstitute(absentRoommateId, absentSet, task.declinedBy);
      return {
        ...task,
        assignedTo: nextAssignee,
      };
    }
    return task;
  });
}

/**
 * Handles revocation of absence.
 * Per requirements: "Se viene revocata prima, le assegnazioni già trasferite non cambiano."
 * Already transferred tasks are kept. If a task was unassigned (assignedTo === null)
 * because no one was available, the returning roommate can be assigned if they haven't declined it.
 */
export function revokeRoommateAbsence(
  cleanings: CleaningTask[],
  returningRoommateId: number,
  remainingAbsentRoommates: number[]
): CleaningTask[] {
  return cleanings.map((task) => {
    if (task.isCompleted) return task;
    if (task.assignedTo === null && !task.declinedBy.includes(returningRoommateId)) {
      return {
        ...task,
        assignedTo: returningRoommateId,
      };
    }
    return task;
  });
}

/**
 * TRASH MANAGEMENT
 */

/**
 * Assigns the first available roommate from the queue.
 * Queue is an ordered array of roommate IDs [first, second, third].
 * Absent roommates and declined roommates are skipped.
 */
export function findNextTrashAssignee(
  trashQueue: number[],
  absentRoommates: number[],
  declinedBy: number[] = []
): number | null {
  for (const candidate of trashQueue) {
    if (!absentRoommates.includes(candidate) && !declinedBy.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Reports full trash.
 * Returns a new TrashTask. Throws if there is already an open task.
 */
export function reportTrash(
  trashQueue: number[],
  absentRoommates: number[],
  existingOpenTask: TrashTask | null
): TrashTask {
  if (existingOpenTask && existingOpenTask.status === "open") {
    throw new Error("C'è già una segnalazione di spazzatura aperta.");
  }

  const assignedTo = findNextTrashAssignee(trashQueue, absentRoommates, []);

  return {
    id: `trash-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    status: "open",
    assignedTo,
    declinedBy: [],
    reportedAt: new Date().toISOString(),
    completedAt: null,
    completedByName: null,
  };
}

/**
 * Roommate declines trash task ("Non posso").
 * Roommate maintains queue priority for next time (queue order does NOT change).
 * The task is reassigned to the next available roommate in the queue.
 */
export function declineTrash(
  task: TrashTask,
  trashQueue: number[],
  absentRoommates: number[],
  decliningRoommateId: number
): TrashTask {
  if (task.status !== "open") {
    return task;
  }

  const updatedDeclined = Array.from(new Set([...task.declinedBy, decliningRoommateId]));
  const nextAssignee = findNextTrashAssignee(trashQueue, absentRoommates, updatedDeclined);

  return {
    ...task,
    declinedBy: updatedDeclined,
    assignedTo: nextAssignee,
  };
}

/**
 * Completing trash task ("Ho buttato la spazzatura").
 * Rule 3: The person who completed the task moves to the back of the queue!
 * Returns the completed task and the updated queue.
 */
export function completeTrash(
  task: TrashTask,
  trashQueue: number[],
  completingRoommateId: number,
  completingRoommateName: string
): { updatedTask: TrashTask; updatedQueue: number[] } {
  const updatedTask: TrashTask = {
    ...task,
    status: "completed",
    completedAt: new Date().toISOString(),
    completedByName: completingRoommateName,
  };

  // Move completing roommate to back of queue
  const remaining = trashQueue.filter((id) => id !== completingRoommateId);
  const updatedQueue = [...remaining, completingRoommateId];

  return { updatedTask, updatedQueue };
}
