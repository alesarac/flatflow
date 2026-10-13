import { CleaningTask, Roommate, TrashTask } from "./types";

// Anchor originario: preserva l'indice delle settimane precedenti al riavvio.
const ANCHOR_MONDAY_UTC = Date.UTC(2026, 0, 5, 0, 0, 0);
// Nuovo inizio del ciclo: lunedì 12 ottobre 2026, assegnazione aree 0 -> 0, 1 -> 1, 2 -> 2.
const ROTATION_RESTART_MONDAY_UTC = Date.UTC(2026, 9, 12, 0, 0, 0);

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
 * Formatta l'intervallo completo della settimana in lingua italiana con mese esteso (es. "5 – 11 ottobre 2026").
 */
export function formatFullWeekLabel(weekKey: string): string {
  const { monday, sunday } = parseWeekKey(weekKey);

  const monthsItFull = [
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"
  ];

  const mMonth = monthsItFull[monday.month - 1];
  const sMonth = monthsItFull[sunday.month - 1];

  if (monday.month === sunday.month) {
    return `${monday.day} – ${sunday.day} ${sMonth} ${sunday.year}`;
  }
  if (monday.year !== sunday.year) {
    return `${monday.day} ${mMonth} ${monday.year} – ${sunday.day} ${sMonth} ${sunday.year}`;
  }
  return `${monday.day} ${mMonth} – ${sunday.day} ${sMonth} ${sunday.year}`;
}

/**
 * Formatta l'etichetta settimanale per lo Storico all'interno del mese di appartenenza (es. "5–11 ottobre").
 */
export function formatHistoryWeekLabel(weekKey: string): string {
  const { monday, sunday } = parseWeekKey(weekKey);
  const monthsItFull = [
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"
  ];
  const mMonth = monthsItFull[monday.month - 1];
  const sMonth = monthsItFull[sunday.month - 1];

  if (monday.year !== sunday.year) {
    return `${monday.day} ${mMonth} ${monday.year} – ${sunday.day} ${sMonth} ${sunday.year}`;
  }
  if (monday.month === sunday.month) {
    return `${monday.day}–${sunday.day} ${mMonth}`;
  }
  return `${monday.day} ${mMonth} – ${sunday.day} ${sMonth}`;
}

/**
 * Calcola l'indice della rotazione su 3 settimane.
 * Dal 12 ottobre 2026 il ciclo riparte da 0; le settimane precedenti
 * conservano l'indice storico, senza modificare altri comportamenti.
 */
export function getRotationWeekIndex(weekKey: string): number {
  const { monday } = parseWeekKey(weekKey);
  const mondayUtc = Date.UTC(monday.year, monday.month - 1, monday.day, 0, 0, 0);
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const anchorUtc =
    mondayUtc >= ROTATION_RESTART_MONDAY_UTC
      ? ROTATION_RESTART_MONDAY_UTC
      : ANCHOR_MONDAY_UTC;
  const elapsedWeeks = Math.floor((mondayUtc - anchorUtc) / oneWeekMs);
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
 * saltando chi ha già rifiutato la specifica attività.
 */
export function findSubstitute(
  currentAssignee: number,
  declinedBy: number[]
): number | null {
  for (let step = 1; step <= 2; step++) {
    const candidate = (currentAssignee + step) % 3;
    if (!declinedBy.includes(candidate)) {
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
  roommates: readonly Roommate[] = []
): CleaningTask[] {
  const weekIndex = getRotationWeekIndex(weekKey);
  const cleanings: CleaningTask[] = [];

  for (let areaId = 0; areaId < 3; areaId++) {
    const baseRoommate = getBaseAssignment(areaId, weekIndex);
    const assignedRoommate = roommates.find((r) => r.id === baseRoommate);
    const assignedToName = assignedRoommate ? assignedRoommate.name : null;

    cleanings.push({
      id: `${weekKey}-area-${areaId}`,
      weekKey,
      areaId,
      assignedTo: baseRoommate,
      assignedToName,
      declinedBy: [],
      undoableDeclines: [],
      isCompleted: false,
      completedAt: null,
      completedByName: null,
      completedBy: null,
    });
  }

  return cleanings;
}

/**
 * Gestisce la rinuncia a una pulizia («Non posso»).
 * Verifica che chi rinuncia sia l'effettivo assegnatario.
 */
export function declineCleaningTask(
  task: CleaningTask,
  decliningRoommateId: number,
  roommates: readonly Roommate[] = []
): CleaningTask {
  if (task.isCompleted) {
    throw new Error("L'attività è già stata completata.");
  }

  if (task.assignedTo !== decliningRoommateId) {
    throw new Error("Solo l'incaricato assegnato può rinunciare a questa attività.");
  }

  const updatedDeclined = Array.from(new Set([...task.declinedBy, decliningRoommateId]));
  const nextAssignee = findSubstitute(decliningRoommateId, updatedDeclined);
  const nextAssigneeObj = nextAssignee !== null ? roommates.find((r) => r.id === nextAssignee) : null;

  const currentUndoable = task.undoableDeclines || [];
  const updatedUndoable = [...currentUndoable, decliningRoommateId];

  return {
    ...task,
    declinedBy: updatedDeclined,
    undoableDeclines: updatedUndoable,
    assignedTo: nextAssignee,
    assignedToName: nextAssigneeObj ? nextAssigneeObj.name : null,
  };
}

/**
 * Gestisce la presa in carico di una pulizia senza incaricato («Me ne occupo io»).
 * Assegna il compito al coinquilino che si offre volontario, rimuove la sua eventuale
 * rinuncia precedente da declinedBy, e mantiene il compito NON completato.
 * La presa in carico sigilla la catena precedente: nessuna rinuncia anteriore al claim può più essere annullata.
 */
export function claimCleaningTask(
  task: CleaningTask,
  claimingRoommateId: number,
  roommates: readonly Roommate[] = []
): CleaningTask {
  if (task.isCompleted) {
    throw new Error("L'attività risulta già completata.");
  }

  if (task.assignedTo !== null) {
    throw new Error("L'attività ha già un incaricato assegnato.");
  }

  const claimingObj = roommates.find((r) => r.id === claimingRoommateId);
  const updatedDeclined = task.declinedBy.filter((id) => id !== claimingRoommateId);

  return {
    ...task,
    assignedTo: claimingRoommateId,
    assignedToName: claimingObj ? claimingObj.name : null,
    declinedBy: updatedDeclined,
    undoableDeclines: [],
    isCompleted: false,
  };
}

/**
 * Determina l'assegnatario appropriato per una pulizia in base alla rotazione settimanale
 * e alle rinunce registrate.
 * Restituisce null se tutti i coinquilini hanno rinunciato.
 */
export function determineCleaningAssignee(
  areaId: number,
  weekKey: string,
  declinedBy: number[],
  roommates: readonly Roommate[] = []
): { assignedTo: number | null; assignedToName: string | null } {
  const weekIndex = getRotationWeekIndex(weekKey);
  const baseRoommate = getBaseAssignment(areaId, weekIndex);
  let assignedTo: number | null = baseRoommate;

  if (declinedBy.includes(baseRoommate)) {
    assignedTo = findSubstitute(baseRoommate, declinedBy);
  }

  const assignedRoommate = assignedTo !== null ? roommates.find((r) => r.id === assignedTo) : null;
  return {
    assignedTo,
    assignedToName: assignedRoommate ? assignedRoommate.name : null,
  };
}

/**
 * Annulla il completamento di una pulizia settimanale.
 * Cancella i dati del completamento (isCompleted: false, completedAt: null, completedByName: null, completedBy: null)
 * e conserva l'assegnazione precedente al completamento (senza ricalcolarla automaticamente dalla rotazione originale),
 * preservando le riassegnazioni già avvenute a causa di rinunce e gestendo le modifiche successive.
 */
export function uncompleteCleaningTask(
  task: CleaningTask,
  roommates: readonly Roommate[] = []
): CleaningTask {
  if (!task.isCompleted) {
    throw new Error("L'attività non risulta completata.");
  }

  const assignedTo = task.assignedTo;
  const assignedRoommate = assignedTo !== null ? roommates.find((r) => r.id === assignedTo) : null;

  return {
    ...task,
    isCompleted: false,
    completedAt: null,
    completedByName: null,
    completedBy: null,
    undoableDeclines: [],
    assignedTo,
    assignedToName: assignedRoommate ? assignedRoommate.name : null,
  };
}

/**
 * Verifica se un coinquilino può annullare la propria rinuncia a una pulizia («Non posso»).
 * L'annullamento è consentito solo se:
 * 1. L'attività non è completata.
 * 2. Il coinquilino è l'autore dell'ultima rinuncia annullabile del ciclo corrente (undoableDeclines).
 * 3. Nessun altro coinquilino ha effettuato un'azione successiva (l'assegnatario attuale
 *    è ancora esattamente il sostituto designato dalla rinuncia o null se tutti avevano rinunciato).
 */
export function canUndoCleaningDecline(
  task: CleaningTask,
  roommateId: number
): boolean {
  if (task.isCompleted) {
    return false;
  }

  const undoable = task.undoableDeclines !== undefined ? task.undoableDeclines : (task.declinedBy || []);
  if (undoable.length === 0) {
    return false;
  }

  const lastDecliner = undoable[undoable.length - 1];
  if (lastDecliner !== roommateId) {
    return false;
  }

  // L'assegnatario attuale della scheda deve coincidere con il sostituto designato da questa rinuncia.
  // Se qualcuno ha preso in carico ("Me ne occupo io") o ha riassegnato, il controllo fallisce.
  const expectedAssignee = findSubstitute(roommateId, task.declinedBy);
  if (task.assignedTo !== expectedAssignee) {
    return false;
  }

  return true;
}

/**
 * Annulla la rinuncia a una pulizia settimanale («Non posso»).
 * Rimuove il coinquilino dall'elenco delle rinunce annullabili e dei rinunciatari,
 * e gli riassegna il compito ripristinando lo stato precedente.
 */
export function undoDeclineCleaningTask(
  task: CleaningTask,
  roommateId: number,
  roommates: readonly Roommate[] = []
): CleaningTask {
  if (!canUndoCleaningDecline(task, roommateId)) {
    throw new Error("Impossibile annullare la rinuncia per questa attività.");
  }

  const currentUndoable = task.undoableDeclines !== undefined ? task.undoableDeclines : (task.declinedBy || []);
  const updatedUndoable = currentUndoable.slice(0, -1);

  // Rimuove l'ultima occorrenza del coinquilino da declinedBy
  const lastIndex = task.declinedBy.lastIndexOf(roommateId);
  const updatedDeclined = lastIndex !== -1
    ? [...task.declinedBy.slice(0, lastIndex), ...task.declinedBy.slice(lastIndex + 1)]
    : task.declinedBy;

  const roommateObj = roommates.find((r) => r.id === roommateId);

  return {
    ...task,
    declinedBy: updatedDeclined,
    undoableDeclines: updatedUndoable,
    assignedTo: roommateId,
    assignedToName: roommateObj ? roommateObj.name : null,
  };
}


/**
 * TRASH MANAGEMENT
 */

/**
 * Assegna il primo coinquilino disponibile nella coda.
 */
export function findNextTrashAssignee(
  trashQueue: number[],
  declinedBy: number[] = []
): number | null {
  for (const candidate of trashQueue) {
    if (!declinedBy.includes(candidate)) {
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
  existingOpenTask: TrashTask | null
): TrashTask {
  if (existingOpenTask && existingOpenTask.status === "open") {
    throw new Error("C'è già una segnalazione di spazzatura aperta.");
  }

  const assignedTo = findNextTrashAssignee(trashQueue, []);

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
  decliningRoommateId: number
): TrashTask {
  if (task.status !== "open") {
    throw new Error("L'incarico non è aperto.");
  }

  if (task.assignedTo !== decliningRoommateId) {
    throw new Error("Solo l'incaricato attuale della spazzatura può rinunciare.");
  }

  const updatedDeclined = Array.from(new Set([...task.declinedBy, decliningRoommateId]));
  const nextAssignee = findNextTrashAssignee(trashQueue, updatedDeclined);

  return {
    ...task,
    declinedBy: updatedDeclined,
    assignedTo: nextAssignee,
  };
}

/**
 * Gestisce la presa in carico della spazzatura senza incaricato («Me ne occupo io»).
 * Assegna il compito al coinquilino che si offre volontario e rimuove la sua eventuale
 * rinuncia precedente da declinedBy. Non tocca la coda equa e lascia il task aperto (status: "open").
 */
export function claimTrashTask(
  task: TrashTask,
  claimingRoommateId: number
): TrashTask {
  if (task.status !== "open") {
    throw new Error("L'incarico di spazzatura non è aperto.");
  }

  if (task.assignedTo !== null) {
    throw new Error("L'incarico di spazzatura ha già un assegnatario.");
  }

  const updatedDeclined = task.declinedBy.filter((id) => id !== claimingRoommateId);

  return {
    ...task,
    assignedTo: claimingRoommateId,
    declinedBy: updatedDeclined,
  };
}

/**
 * Completa la spazzatura («Ho buttato»).
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
 * Calcola lo stato dei 3 segmenti della barra di avanzamento settimanale.
 * La barra si riempie rigorosamente da sinistra verso destra in base a QUANTE pulizie
 * sono state completate (0, 1, 2, 3), indipendentemente da quale stanza (areaId) sia completata.
 */
export function getWeeklyProgressBarSegments(
  cleanings: { isCompleted: boolean }[]
): [boolean, boolean, boolean] {
  const completedCount = cleanings.filter((c) => c.isCompleted).length;
  return [
    completedCount >= 1,
    completedCount >= 2,
    completedCount >= 3,
  ];
}

/**
 * Formatta un timestamp ISO in formato compatto "tempo fa" (es. "2h fa", "5h fa", "1g fa", "adesso").
 */
export function formatTimeAgo(isoString: string, now: Date = new Date()): string {
  if (!isoString) return "";
  try {
    const timestamp = new Date(isoString).getTime();
    if (isNaN(timestamp)) return "";
    const diffMs = now.getTime() - timestamp;
    if (diffMs < 0) return "adesso";

    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return "adesso";

    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m fa`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h fa`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}g fa`;

    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}m fa`;
  } catch {
    return "";
  }
}


