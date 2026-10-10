export interface Roommate {
  id: number; // 0, 1, 2
  name: string;
}

export interface Area {
  id: number; // 0: Cucina, 1: Bagno, 2: Ingresso e corridoio
  name: string;
  iconName: string;
}

export const AREAS: Area[] = [
  { id: 0, name: "Cucina", iconName: "UtensilsCrossed" },
  { id: 1, name: "Bagno", iconName: "Sparkles" },
  { id: 2, name: "Ingresso e corridoio", iconName: "DoorOpen" },
];

export const DEFAULT_ROOMMATES: readonly Roommate[] = Object.freeze([
  Object.freeze({ id: 0, name: "Coinquilino 1" }),
  Object.freeze({ id: 1, name: "Coinquilino 2" }),
  Object.freeze({ id: 2, name: "Coinquilino 3" }),
]);

export interface CleaningTask {
  id: string;
  weekKey: string;
  areaId: number;
  assignedTo: number | null;
  assignedToName: string | null; // Snapshot storico del nome dell'assegnatario
  declinedBy: number[];
  isCompleted: boolean;
  completedAt: string | null;
  completedByName: string | null;
  completedBy: number | null; // ID stabile del coinquilino che ha completato l'attività (0, 1, 2)
}

export interface TrashTask {
  id: string;
  status: "open" | "completed";
  assignedTo: number | null;
  declinedBy: number[];
  reportedAt: string;
  completedAt: string | null;
  completedByName: string | null;
}

export interface WeekState {
  weekKey: string;
  startDate: string;
  endDate: string;
  label: string;
  cleanings: CleaningTask[];
}

export interface HouseData {
  roommates: Roommate[];
  currentWeek: WeekState;
  openTrashTask: TrashTask | null;
  trashQueue: number[]; // Ordered array of roommate IDs, e.g. [0, 1, 2]
  myRoommateId?: number;
}

export interface HistoryItem {
  id: string;
  type: "cleaning" | "trash";
  title: string;
  areaId?: number;
  status: "completed" | "incomplete";
  personName: string;
  date: string; // ISO date string or formatted date
  weekKey?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  isBought: boolean;
  addedBy: number; // 0, 1, 2
  addedByName: string;
  createdAt: string; // ISO date string
  boughtBy: number | null; // 0, 1, 2 or null
  boughtByName: string | null;
  boughtAt: string | null; // ISO date string or null
}
