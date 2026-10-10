import { CleaningTask, HistoryItem, Roommate, TrashTask, WeekState } from "../domain/types";

export interface HistoryResult {
  items: HistoryItem[];
  totalCount: number;
  hasMore: boolean;
}

export interface IHouseRepository {
  getRoommates(): Promise<Roommate[]>;
  updateRoommate(id: number, name: string): Promise<void>;
  
  getTrashQueue(): Promise<number[]>;
  updateTrashQueue(queue: number[]): Promise<void>;

  getWeekState(weekKey: string): Promise<WeekState>;
  updateCleaningTask(
    task: CleaningTask,
    condition?: { isCompleted?: boolean; assignedTo?: number | null }
  ): Promise<boolean>;

  getOpenTrashTask(): Promise<TrashTask | null>;
  createTrashTask(task: TrashTask): Promise<void>;
  updateTrashTask(
    task: TrashTask,
    condition?: { status?: "open" | "completed"; assignedTo?: number | null }
  ): Promise<boolean>;
  completeTrashAtomic(taskId: string, roommateId: number, roommateName: string): Promise<{ task: TrashTask; queue: number[] }>;

  getHistory(limit?: number, offset?: number): Promise<HistoryResult>;

  recordFailedLogin(ip: string): Promise<void>;
  isRateLimited(ip: string): Promise<boolean>;
  resetRateLimit(ip: string): Promise<void>;
}
