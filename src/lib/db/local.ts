import fs from "fs";
import path from "path";
import {
  AREAS,
  CleaningTask,
  DEFAULT_ROOMMATES,
  HistoryItem,
  Roommate,
  TrashTask,
  WeekState,
} from "../domain/types";
import {
  applyRoommateAbsence,
  createWeekCleanings,
  formatWeekLabel,
  getSundayOf,
  getWeekKey,
  parseWeekKey,
  revokeRoommateAbsence,
} from "../domain/logic";
import { IHouseRepository } from "./types";

interface StoredData {
  roommates: Roommate[];
  trashQueue: number[];
  absences: Record<string, number[]>; // weekKey -> roommateId[]
  cleanings: Record<string, CleaningTask[]>; // weekKey -> CleaningTask[]
  trashTasks: TrashTask[];
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
        return JSON.parse(raw);
      }
    } catch {
      // ignore read error and fallback to default
    }

    return {
      roommates: [...DEFAULT_ROOMMATES],
      trashQueue: [0, 1, 2],
      absences: {},
      cleanings: {},
      trashTasks: [],
      loginAttempts: [],
    };
  }

  private saveData(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
    } catch {
      // In read-only or restricted environments, data remains in memory
    }
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
    const monday = parseWeekKey(weekKey);
    const sunday = getSundayOf(monday);
    const absences = this.data.absences[weekKey] || [];

    if (!this.data.cleanings[weekKey]) {
      this.data.cleanings[weekKey] = createWeekCleanings(weekKey, absences);
      this.saveData();
    }

    return {
      weekKey,
      startDate: monday.toISOString(),
      endDate: sunday.toISOString(),
      label: formatWeekLabel(weekKey),
      absentRoommates: absences,
      cleanings: this.data.cleanings[weekKey],
    };
  }

  async setRoommateAbsence(
    weekKey: string,
    roommateId: number,
    isAbsent: boolean
  ): Promise<WeekState> {
    const weekState = await this.getWeekState(weekKey);
    let currentAbsences = this.data.absences[weekKey] || [];

    if (isAbsent) {
      if (!currentAbsences.includes(roommateId)) {
        currentAbsences = [...currentAbsences, roommateId];
        this.data.absences[weekKey] = currentAbsences;
        // Reassign tasks
        this.data.cleanings[weekKey] = applyRoommateAbsence(
          weekState.cleanings,
          roommateId,
          currentAbsences
        );
      }
    } else {
      if (currentAbsences.includes(roommateId)) {
        currentAbsences = currentAbsences.filter((id) => id !== roommateId);
        this.data.absences[weekKey] = currentAbsences;
        // Revoke absence without touching already reassigned tasks
        this.data.cleanings[weekKey] = revokeRoommateAbsence(
          weekState.cleanings,
          roommateId,
          currentAbsences
        );
      }
    }

    this.saveData();
    return this.getWeekState(weekKey);
  }

  async updateCleaningTask(task: CleaningTask): Promise<void> {
    const weekCleanings = this.data.cleanings[task.weekKey];
    if (weekCleanings) {
      const idx = weekCleanings.findIndex((t) => t.id === task.id);
      if (idx !== -1) {
        weekCleanings[idx] = task;
        this.saveData();
      }
    }
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

  async updateTrashTask(task: TrashTask): Promise<void> {
    const idx = this.data.trashTasks.findIndex((t) => t.id === task.id);
    if (idx !== -1) {
      this.data.trashTasks[idx] = task;
      this.saveData();
    }
  }

  async getHistory(limit: number = 50): Promise<HistoryItem[]> {
    const currentWeekKey = getWeekKey(new Date());
    const items: HistoryItem[] = [];

    // 1. Pulizie completate da tutte le settimane
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
          // Settimana passata non completata
          const assignedRoommate = this.data.roommates.find((r) => r.id === task.assignedTo);
          const personName = assignedRoommate ? assignedRoommate.name : "Nessun incaricato";
          const sunday = getSundayOf(parseWeekKey(weekKey));

          items.push({
            id: `clean-${task.id}`,
            type: "cleaning",
            title: `Pulizia ${areaName}`,
            areaId: task.areaId,
            status: "incomplete",
            personName,
            date: sunday.toISOString(),
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

    return items.slice(0, limit);
  }

  async recordFailedLogin(ip: string): Promise<void> {
    this.data.loginAttempts.push({ ip, timestamp: Date.now() });
    // Keep only last 100 attempts
    if (this.data.loginAttempts.length > 100) {
      this.data.loginAttempts = this.data.loginAttempts.slice(-100);
    }
    this.saveData();
  }

  async isRateLimited(ip: string): Promise<boolean> {
    const windowMs = 15 * 60 * 1000; // 15 minutes
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
