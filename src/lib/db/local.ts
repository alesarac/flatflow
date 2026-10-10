import fs from "fs";
import path from "path";
import {
  AREAS,
  CleaningTask,
  DEFAULT_ROOMMATES,
  HistoryItem,
  Roommate,
  ShoppingItem,
  TrashTask,
  WeekState,
} from "../domain/types";
import {
  completeTrash,
  createWeekCleanings,
  formatWeekLabel,
  getRomeSundayEndIso,
  getWeekKey,
  parseWeekKey,
} from "../domain/logic";
import { HistoryResult, IHouseRepository } from "./types";

interface StoredData {
  roommates: Roommate[];
  trashQueue: number[];
  cleanings: Record<string, CleaningTask[]>; // weekKey -> CleaningTask[]
  trashTasks: TrashTask[];
  shoppingItems?: ShoppingItem[];
  loginAttempts: { ip: string; timestamp: number }[];
}

export class LocalHouseRepository implements IHouseRepository {
  private filePath: string;
  private data: StoredData;

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), "data", "local-db.json");
    this.data = this.loadData();
  }

  private loadData(): StoredData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (!parsed.shoppingItems) {
          parsed.shoppingItems = [];
        }
        return parsed;
      }
    } catch {
      // ignore read error e usa default
    }

    return {
      roommates: DEFAULT_ROOMMATES.map((r) => ({ ...r })),
      trashQueue: [0, 1, 2],
      cleanings: {},
      trashTasks: [],
      shoppingItems: [],
      loginAttempts: [],
    };
  }

  private saveData(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  async getRoommates(): Promise<Roommate[]> {
    return [...this.data.roommates];
  }

  async updateRoommate(id: number, name: string): Promise<void> {
    const roommate = this.data.roommates.find((r) => r.id === id);
    if (roommate) {
      roommate.name = name.trim();
      this.saveData();
    }
  }

  async getTrashQueue(): Promise<number[]> {
    return [...this.data.trashQueue];
  }

  async updateTrashQueue(queue: number[]): Promise<void> {
    this.data.trashQueue = [...queue];
    this.saveData();
  }

  async getWeekState(weekKey: string): Promise<WeekState> {
    const { monday, sunday } = parseWeekKey(weekKey);

    if (!this.data.cleanings[weekKey]) {
      this.data.cleanings[weekKey] = createWeekCleanings(
        weekKey,
        this.data.roommates
      );
      this.saveData();
    }

    const startIso = new Date(Date.UTC(monday.year, monday.month - 1, monday.day)).toISOString();
    const endIso = new Date(Date.UTC(sunday.year, sunday.month - 1, sunday.day, 23, 59, 59, 999)).toISOString();

    return {
      weekKey,
      startDate: startIso,
      endDate: endIso,
      label: formatWeekLabel(weekKey),
      cleanings: this.data.cleanings[weekKey],
    };
  }

  async updateCleaningTask(
    task: CleaningTask,
    condition?: { isCompleted?: boolean; assignedTo?: number | null }
  ): Promise<boolean> {
    const weekCleanings = this.data.cleanings[task.weekKey];
    if (!weekCleanings) return false;
    const idx = weekCleanings.findIndex((t) => t.id === task.id);
    if (idx === -1) return false;

    const current = weekCleanings[idx];
    if (condition) {
      if (condition.isCompleted !== undefined && current.isCompleted !== condition.isCompleted) {
        return false;
      }
      if (condition.assignedTo !== undefined && current.assignedTo !== condition.assignedTo) {
        return false;
      }
    }

    weekCleanings[idx] = { ...task };
    this.saveData();
    return true;
  }


  async getOpenTrashTask(): Promise<TrashTask | null> {
    const openTask = this.data.trashTasks.find((t) => t.status === "open");
    return openTask || null;
  }

  async createTrashTask(task: TrashTask): Promise<void> {
    const existing = await this.getOpenTrashTask();
    if (existing) {
      throw new Error("C'è già una segnalazione di spazzatura aperta.");
    }
    this.data.trashTasks.unshift(task);
    this.saveData();
  }

  async updateTrashTask(
    task: TrashTask,
    condition?: { status?: "open" | "completed"; assignedTo?: number | null }
  ): Promise<boolean> {
    const idx = this.data.trashTasks.findIndex((t) => t.id === task.id);
    if (idx === -1) return false;

    const current = this.data.trashTasks[idx];
    const targetStatus = condition?.status ?? "open";
    if (current.status !== targetStatus) {
      return false;
    }

    if (condition && condition.assignedTo !== undefined) {
      if (current.assignedTo !== condition.assignedTo) {
        return false;
      }
    }

    // P1-01: Aggiorna solo i campi necessari (assignedTo, declinedBy), senza sovrascrivere lo stato di completamento
    this.data.trashTasks[idx] = {
      ...current,
      assignedTo: task.assignedTo,
      declinedBy: task.declinedBy,
    };
    this.saveData();
    return true;
  }


  async completeTrashAtomic(
    taskId: string,
    roommateId: number,
    roommateName: string
  ): Promise<{ task: TrashTask; queue: number[] }> {
    const task = this.data.trashTasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error("Task non trovato");
    }

    const { updatedTask, updatedQueue } = completeTrash(
      task,
      this.data.trashQueue,
      roommateId,
      roommateName
    );

    const idx = this.data.trashTasks.findIndex((t) => t.id === taskId);
    this.data.trashTasks[idx] = updatedTask;
    this.data.trashQueue = updatedQueue;
    this.saveData();

    return { task: updatedTask, queue: updatedQueue };
  }

  async getHistory(limit: number = 30, offset: number = 0): Promise<HistoryResult> {
    const currentWeekKey = getWeekKey(new Date());
    const items: HistoryItem[] = [];

    // 1. Pulizie completate
    for (const [weekKey, tasks] of Object.entries(this.data.cleanings)) {
      for (const task of tasks) {
        const area = AREAS.find((a) => a.id === task.areaId);
        const areaName = area ? area.name : `Area ${task.areaId}`;

        if (task.isCompleted && task.completedAt) {
          items.push({
            id: `clean-${task.id}`,
            type: "cleaning",
            title: `Pulizia ${areaName}`,
            areaId: task.areaId,
            status: "completed",
            personName: task.completedByName || "Coinquilino",
            date: task.completedAt,
            weekKey,
          });
        } else if (weekKey < currentWeekKey && !task.isCompleted) {
          // Pulizia incompleta di una settimana passata
          // P1-07: Usiamo lo snapshot assignedToName se presente, altrimenti fallback sul profilo
          const personName =
            task.assignedToName ||
            (task.assignedTo !== null
              ? this.data.roommates.find((r) => r.id === task.assignedTo)?.name || "Coinquilino"
              : "Nessun incaricato");

          // P2-02: Calcola la data di incompletezza rigorosamente secondo Europe/Rome (domenica sera)
          const sundayIso = getRomeSundayEndIso(weekKey);

          items.push({
            id: `clean-${task.id}`,
            type: "cleaning",
            title: `Pulizia ${areaName}`,
            areaId: task.areaId,
            status: "incomplete",
            personName,
            date: sundayIso,
            weekKey,
          });
        }
      }
    }

    // 2. Conferimenti spazzatura completati
    for (const trash of this.data.trashTasks) {
      if (trash.status === "completed" && trash.completedAt) {
        items.push({
          id: `trash-${trash.id}`,
          type: "trash",
          title: "Spazzatura",
          status: "completed",
          personName: trash.completedByName || "Coinquilino",
          date: trash.completedAt,
        });
      }
    }

    // Ordina per data decrescente (più recenti prima)
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalCount = items.length;
    const paginated = items.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    return {
      items: paginated,
      totalCount,
      hasMore,
    };
  }

  async getShoppingItems(): Promise<ShoppingItem[]> {
    if (!this.data.shoppingItems) {
      this.data.shoppingItems = [];
    }
    return [...this.data.shoppingItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async addShoppingItem(name: string, addedBy: number, addedByName: string): Promise<ShoppingItem> {
    if (!this.data.shoppingItems) {
      this.data.shoppingItems = [];
    }
    const newItem: ShoppingItem = {
      id: `shop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      isBought: false,
      addedBy,
      addedByName,
      createdAt: new Date().toISOString(),
      boughtBy: null,
      boughtByName: null,
      boughtAt: null,
    };
    this.data.shoppingItems.unshift(newItem);
    this.saveData();
    return newItem;
  }

  async toggleShoppingItem(
    id: string,
    isBought: boolean,
    boughtBy: number | null,
    boughtByName: string | null
  ): Promise<ShoppingItem | null> {
    if (!this.data.shoppingItems) {
      this.data.shoppingItems = [];
    }
    const item = this.data.shoppingItems.find((i) => i.id === id);
    if (!item) return null;

    item.isBought = isBought;
    item.boughtBy = isBought ? boughtBy : null;
    item.boughtByName = isBought ? boughtByName : null;
    item.boughtAt = isBought ? new Date().toISOString() : null;

    this.saveData();
    return { ...item };
  }

  async deleteShoppingItem(id: string): Promise<boolean> {
    if (!this.data.shoppingItems) {
      this.data.shoppingItems = [];
    }
    const initialLen = this.data.shoppingItems.length;
    this.data.shoppingItems = this.data.shoppingItems.filter((i) => i.id !== id);
    if (this.data.shoppingItems.length !== initialLen) {
      this.saveData();
      return true;
    }
    return false;
  }

  async recordFailedLogin(ip: string): Promise<void> {
    this.data.loginAttempts.push({ ip, timestamp: Date.now() });
    if (this.data.loginAttempts.length > 100) {
      this.data.loginAttempts = this.data.loginAttempts.slice(-100);
    }
    this.saveData();
  }

  async isRateLimited(ip: string): Promise<boolean> {
    const windowMs = 15 * 60 * 1000; // 15 minuti
    const now = Date.now();
    const recentAttempts = this.data.loginAttempts.filter(
      (a) => a.ip === ip && now - a.timestamp < windowMs
    );
    return recentAttempts.length >= 5;
  }

  async resetRateLimit(ip: string): Promise<void> {
    this.data.loginAttempts = this.data.loginAttempts.filter((a) => a.ip !== ip);
    this.saveData();
  }
}
