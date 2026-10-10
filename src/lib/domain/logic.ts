import { CleaningTask, Roommate, TrashTask } from "./types";

// Anchor date: Lunedì 5 gennaio 2026 (Europe/Rome)
const ANCHOR_MONDAY_UTC = Date.UTC(2026, 0, 5, 0, 0, 0);

interface RomeCivilDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  weekday: number; // 1 = Lunedì, ..., 7 = Domenica
}

/**
 * Estrae i componenti civili (anno, mese, giorno, giorno della settimana)
 * nel fuso orario italiano "Europe/Rome".
 */
export function getRomeCivilDate(date: Date = new Date()): RomeCivilDate {
  // Usiamo Intl.DateTimeFormat con timeZone Europe/Rome
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  let day = date.getUTCDate();
  let weekdayStr = "Mon";

  for (const part of parts) {
    if (part.type === "year") year = parseInt(part.value, 10);
    if (part.type === "month") month = parseInt(part.value, 10);
    if (part.type === "day") day = parseInt(part.value, 10);
    if (part.type === "weekday") weekdayStr = part.value;
  }

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  const weekday = weekdayMap[weekdayStr] || 1;

  return { year, month, day, weekday };
}

/**
 * Calcola il lunedì civile corrispondente alla data fornita secondo il fuso Europe/Rome.
 * Restituisce una data con componenti YYYY-MM-DD.
 */
export function getMondayCivilParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const rome = getRomeCivilDate(date);
  // Sottraiamo i giorni trascorsi dal lunedì (0 per lunedì, 6 per domenica)
  const daysSinceMonday = rome.weekday - 1;

  const d = new Date(Date.UTC(rome.year, rome.month - 1, rome.day));
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);

  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/**
 * Restituisce la chiave univoca della settimana in formato "YYYY-MM-DD"
 * calcolata rigorosamente in Europe/Rome (es. "2026-10-12").
 */
export function getWeekKey(date: Date = new Date()): string {
  const { year, month, day } = getMondayCivilParts(date);
  const mStr = String(month).padStart(2, "0");
  const dStr = String(day).padStart(2, "0");
  return `${year}-${mStr}-${dStr}`;
}

/**
 * Converte una chiave "YYYY-MM-DD" nei componenti civili del lunedì e della domenica.
 */
export function parseWeekKey(weekKey: string): {
  monday: { year: number; month: number; day: number };
  sunday: { year: number; month: number; day: number };
} {
  const [yearStr, monthStr, dayStr] = weekKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const sunDate = new Date(Date.UTC(year, month - 1, day + 6));
  const sunday = {
    year: sunDate.getUTCFullYear(),
    month: sunDate.getUTCMonth() + 1,
    day: sunDate.getUTCDate(),
  };

  return {
    monday: { year, month, day },
    sunday,
  };
}

/**
 * Calcola l'ISO string corrispondente alla fine della domenica (23:59:59) nel fuso orario Europe/Rome.
 * Garantisce che nelle conversioni orarie italiane la data ricada rigorosamente di domenica sera e non di lunedì mattina.
 */
export function getRomeSundayEndIso(weekKey: string): string {
  const { sunday } = parseWeekKey(weekKey);
  const civilUtc = Date.UTC(sunday.year, sunday.month - 1, sunday.day, 23, 59, 59);

  const probe = new Date(civilUtc - 2 * 3600 * 1000);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(probe);
  const partMap: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      partMap[p.type] = parseInt(p.value, 10);
    }
  }

  const hour = partMap.hour === 24 ? 0 : (partMap.hour ?? 0);
  const probeInRomeUtc = Date.UTC(
    partMap.year ?? sunday.year,
    (partMap.month ?? sunday.month) - 1,
    partMap.day ?? sunday.day,
    hour,
    partMap.minute ?? 0,
    partMap.second ?? 0
  );

  const offsetMs = probeInRomeUtc - probe.getTime();
  const exactUtcMs = civilUtc - offsetMs;

  return new Date(exactUtcMs).toISOString();
}


/**
 * Formatta l'etichetta della settimana in lingua italiana (es. "5 - 11 ott 2026" o "28 set - 4 ott 2026").
 */
export function formatWeekLabel(weekKey: string): string {
  const { monday, sunday } = parseWeekKey(weekKey);

  const monthsIt = [
    "gen", "feb", "mar", "apr", "mag", "giu",
    "lug", "ago", "set", "ott", "nov", "dic"
  ];

  const mMonth = monthsIt[monday.month - 1];
  const sMonth = monthsIt[sunday.month - 1];

  if (monday.month === sunday.month) {
    return `${monday.day} - ${sunday.day} ${mMonth} ${sunday.year}`;
  }
  if (monday.year !== sunday.year) {
    return `${monday.day} ${mMonth} ${monday.year} - ${sunday.day} ${sMonth} ${sunday.year}`;
  }
  return `${monday.day} ${mMonth} - ${sunday.day} ${sMonth} ${sunday.year}`;
}

/**
 * Calcola l'indice di rotazione da 0 a 2 per il ciclo fisso di 3 settimane.
 */
export function getRotationWeekIndex(weekKey: string): number {
  const { monday } = parseWeekKey(weekKey);
  const mondayUtc = Date.UTC(monday.year, monday.month - 1, monday.day, 0, 0, 0);
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const elapsedWeeks = Math.floor((mondayUtc - ANCHOR_MONDAY_UTC) / oneWeekMs);
  return ((elapsedWeeks % 3) + 3) % 3;
}

/**
 * Determina il coinquilino base per un'area e un indice settimanale.
 */
export function getBaseAssignment(areaId: number, weekIndex: number): number {
  return (areaId + weekIndex) % 3;
}

/**
 * Trova il sostituto secondo l'ordine fisso dei coinquilini 0 -> 1 -> 2 -> 0,
 * saltando chi è assente o ha già rifiutato la specifica attività.
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
 * Inizializza i compiti di pulizia per una settimana.
 * Registra anche lo snapshot del nome dell'assegnatario (assignedToName).
 */
export function createWeekCleanings(
  weekKey: string,
  absentRoommates: number[] = [],
  roommates: Roommate[] = []
): CleaningTask[] {
  const weekIndex = getRotationWeekIndex(weekKey);
  const cleanings: CleaningTask[] = [];

  for (let areaId = 0; areaId < 3; areaId++) {
    const baseRoommate = getBaseAssignment(areaId, weekIndex);
    let assignedTo: number | null = baseRoommate;

    if (absentRoommates.includes(baseRoommate)) {
      assignedTo = findSubstitute(baseRoommate, absentRoommates, []);
    }

    const assignedRoommate = assignedTo !== null ? roommates.find((r) => r.id === assignedTo) : null;
    const assignedToName = assignedRoommate ? assignedRoommate.name : null;

    cleanings.push({
      id: `${weekKey}-area-${areaId}`,
      weekKey,
      areaId,
      assignedTo,
      assignedToName,
      declinedBy: [],
      isCompleted: false,
      completedAt: null,
      completedByName: null,
    });
  }

  return cleanings;
}

/**
 * Gestisce la rinuncia a una pulizia («Non posso pulire»).
 * Verifica che chi rinuncia sia l'effettivo assegnatario.
 */
export function declineCleaningTask(
  task: CleaningTask,
  absentRoommates: number[],
  decliningRoommateId: number,
  roommates: Roommate[] = []
): CleaningTask {
  if (task.isCompleted) {
    throw new Error("L'attività è già stata completata.");
  }

  if (task.assignedTo !== decliningRoommateId) {
    throw new Error("Solo l'incaricato assegnato può rinunciare a questa attività.");
  }

  const updatedDeclined = Array.from(new Set([...task.declinedBy, decliningRoommateId]));
  const nextAssignee = findSubstitute(decliningRoommateId, absentRoommates, updatedDeclined);
  const nextAssigneeObj = nextAssignee !== null ? roommates.find((r) => r.id === nextAssignee) : null;

  return {
    ...task,
    declinedBy: updatedDeclined,
    assignedTo: nextAssignee,
    assignedToName: nextAssigneeObj ? nextAssigneeObj.name : null,
  };
}

/**
 * Applica l'assenza settimanale di un coinquilino («Sono assente questa settimana»).
 * Riassegna le attività non completate attualmente assegnate al coinquilino assente.
 */
export function applyRoommateAbsence(
  cleanings: CleaningTask[],
  absentRoommateId: number,
  allAbsentRoommates: number[],
  roommates: Roommate[] = []
): CleaningTask[] {
  const absentSet = Array.from(new Set([...allAbsentRoommates, absentRoommateId]));

  return cleanings.map((task) => {
    if (task.isCompleted) return task;
    if (task.assignedTo === absentRoommateId) {
      const nextAssignee = findSubstitute(absentRoommateId, absentSet, task.declinedBy);
      const nextAssigneeObj = nextAssignee !== null ? roommates.find((r) => r.id === nextAssignee) : null;
      return {
        ...task,
        assignedTo: nextAssignee,
        assignedToName: nextAssigneeObj ? nextAssigneeObj.name : null,
      };
    }
    return task;
  });
}

/**
 * Revoca dell'assenza settimanale.
 * Per specifica: le attività già trasferite non cambiano.
 * Se un'attività era senza incaricato (assignedTo === null), il coinquilino che torna può riceverla.
 */
export function revokeRoommateAbsence(
  cleanings: CleaningTask[],
  returningRoommateId: number,
  remainingAbsentRoommates: number[],
  roommates: Roommate[] = []
): CleaningTask[] {
  const returningObj = roommates.find((r) => r.id === returningRoommateId);

  return cleanings.map((task) => {
    if (task.isCompleted) return task;
    if (task.assignedTo === null && !task.declinedBy.includes(returningRoommateId)) {
      return {
        ...task,
        assignedTo: returningRoommateId,
        assignedToName: returningObj ? returningObj.name : null,
      };
    }
    return task;
  });
}

/**
 * TRASH MANAGEMENT
 */

/**
 * Assegna il primo coinquilino disponibile nella coda.
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
 * Segnala spazzatura piena.
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
 * Rinuncia alla spazzatura («Non posso»).
 * Chi rinuncia mantiene la posizione in coda per la prossima volta.
 * L'incarico passa al successivo in coda.
 */
export function declineTrash(
  task: TrashTask,
  trashQueue: number[],
  absentRoommates: number[],
  decliningRoommateId: number
): TrashTask {
  if (task.status !== "open") {
    throw new Error("L'incarico non è aperto.");
  }

  if (task.assignedTo !== decliningRoommateId) {
    throw new Error("Solo l'incaricato attuale della spazzatura può rinunciare.");
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
 * Completa la spazzatura («Ho buttato la spazzatura»).
 * Chi completa passa in fondo alla coda.
 */
export function completeTrash(
  task: TrashTask,
  trashQueue: number[],
  completingRoommateId: number,
  completingRoommateName: string
): { updatedTask: TrashTask; updatedQueue: number[] } {
  if (task.status !== "open") {
    throw new Error("L'incarico di spazzatura è già stato completato.");
  }

  // Se c'era un assegnatario, deve coincidere con chi completa
  if (task.assignedTo !== null && task.assignedTo !== completingRoommateId) {
    throw new Error("Solo l'incaricato assegnato può completare questo compito.");
  }

  const updatedTask: TrashTask = {
    ...task,
    status: "completed",
    completedAt: new Date().toISOString(),
    completedByName: completingRoommateName,
  };

  // Chi completa passa in fondo alla coda
  const remaining = trashQueue.filter((id) => id !== completingRoommateId);
  const updatedQueue = [...remaining, completingRoommateId];

  return { updatedTask, updatedQueue };
}

/**
 * Riconcilia la spazzatura aperta in caso di variazione di assenze (P1-04).
 * Se l'incaricato attuale è diventato assente, riassegna al prossimo disponibile senza toccare la coda.
 * Se l'incarico era senza incaricato e torna un coinquilino non assente (e che non ha rifiutato), lo assegna.
 */
export function reconcileOpenTrash(
  task: TrashTask | null,
  trashQueue: number[],
  currentAbsentRoommates: number[]
): TrashTask | null {
  if (!task || task.status !== "open") {
    return task;
  }

  // Caso 1: l'assegnatario attuale è diventato assente
  if (task.assignedTo !== null && currentAbsentRoommates.includes(task.assignedTo)) {
    const next = findNextTrashAssignee(trashQueue, currentAbsentRoommates, task.declinedBy);
    return {
      ...task,
      assignedTo: next,
    };
  }

  // Caso 2: l'incarico era senza assegnatario e qualcuno è tornato disponibile
  if (task.assignedTo === null) {
    const next = findNextTrashAssignee(trashQueue, currentAbsentRoommates, task.declinedBy);
    if (next !== null) {
      return {
        ...task,
        assignedTo: next,
      };
    }
  }

  return task;
}
