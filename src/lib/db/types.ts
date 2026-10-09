import { CleaningTask, HistoryItem, Roommate, TrashTask, WeekState } from "../domain/types";

export interface IHouseRepository {
  getRoommates(): Promise<Roommate[]>;
  updateRoommate(id: number, name: string): Promise<void>;
  
  getTrashQueue(): Promise<number[]>;
  updateTrashQueue(queue: number[]): Promise<void>;

  getWeekState(weekKey: string): Promise<WeekState>;
  setRoommateAbsence(weekKey: string, roommateId: number, isAbsent: boolean): Promise<WeekState>;
  updateCleaningTask(task: CleaningTask): Promise<void>;

  getOpenTrashTask(): Promise<TrashTask | null>;
  createTrashTask(task: TrashTask): Promise<void>;
  updateTrashTask(task: TrashTask): Promise<void>;

  getHistory(limit?: number): Promise<HistoryItem[]>;

  recordFailedLogin(ip: string): Promise<void>;
  isRateLimited(ip: string): Promise<boolean>;
  resetRateLimit(ip: string): Promise<void>;
}
