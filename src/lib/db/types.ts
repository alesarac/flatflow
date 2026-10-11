import { CleaningTask, HistoryItem, Roommate, ShoppingItem, TrashTask, WeekState } from "../domain/types";

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
    condition?: { isCompleted?: boolean; assignedTo?: number | null; declinedBy?: number[] }
  ): Promise<boolean>;

  getOpenTrashTask(): Promise<TrashTask | null>;
  createTrashTask(task: TrashTask): Promise<void>;
  updateTrashTask(
    task: TrashTask,
    condition?: { status?: "open" | "completed"; assignedTo?: number | null }
  ): Promise<boolean>;
  completeTrashAtomic(taskId: string, roommateId: number, roommateName: string): Promise<{ task: TrashTask; queue: number[] }>;

  getHistory(limit?: number, offset?: number): Promise<HistoryResult>;

  getShoppingItems(): Promise<ShoppingItem[]>;
  addShoppingItem(name: string, addedBy: number, addedByName: string): Promise<ShoppingItem>;
  toggleShoppingItem(
    id: string,
    isBought: boolean,
    boughtBy: number | null,
    boughtByName: string | null
  ): Promise<ShoppingItem | null>;
  deleteShoppingItem(id: string): Promise<boolean>;

  recordFailedLogin(ip: string): Promise<void>;
  isRateLimited(ip: string): Promise<boolean>;
  resetRateLimit(ip: string): Promise<void>;
}
