import { createClient, SupabaseClient } from "@supabase/supabase-js";
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

export class SupabaseHouseRepository implements IHouseRepository {
  private client: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  async getRoommates(): Promise<Roommate[]> {
    const { data, error } = await this.client
      .from("roommates")
      .select("id, name")
      .order("id", { ascending: true });

    if (error || !data || data.length === 0) {
      return [...DEFAULT_ROOMMATES];
    }
    return data as Roommate[];
  }

  async updateRoommate(id: number, name: string): Promise<void> {
    await this.client
      .from("roommates")
      .upsert({ id, name: name.trim(), updated_at: new Date().toISOString() });
  }

  async getTrashQueue(): Promise<number[]> {
    const { data, error } = await this.client
      .from("house_config")
      .select("trash_queue")
      .eq("id", "default")
      .single();

    if (error || !data) {
      return [0, 1, 2];
    }
    return data.trash_queue as number[];
  }

  async updateTrashQueue(queue: number[]): Promise<void> {
    await this.client
      .from("house_config")
      .upsert({ id: "default", trash_queue: queue, updated_at: new Date().toISOString() });
  }

  async getWeekState(weekKey: string): Promise<WeekState> {
    const monday = parseWeekKey(weekKey);
    const sunday = getSundayOf(monday);

    // Fetch absences
    const { data: absenceData } = await this.client
      .from("weekly_absences")
      .select("roommate_id")
      .eq("week_key", weekKey);

    const absentRoommates = absenceData ? absenceData.map((a) => a.roommate_id) : [];

    // Fetch cleaning tasks
    const { data: existingTasks } = await this.client
      .from("cleaning_tasks")
      .select("*")
      .eq("week_key", weekKey)
      .order("area_id", { ascending: true });

    let cleanings: CleaningTask[] = [];

    if (!existingTasks || existingTasks.length === 0) {
      // Create new week cleanings
      cleanings = createWeekCleanings(weekKey, absentRoommates);
      const rows = cleanings.map((c) => ({
        id: c.id,
        week_key: c.weekKey,
        area_id: c.areaId,
        assigned_to: c.assignedTo,
        declined_by: c.declinedBy,
        is_completed: c.isCompleted,
        completed_at: c.completedAt,
        completed_by_name: c.completedByName,
      }));
      await this.client.from("cleaning_tasks").insert(rows);
    } else {
      cleanings = existingTasks.map((t) => ({
        id: t.id,
        weekKey: t.week_key,
        areaId: t.area_id,
        assignedTo: t.assigned_to,
        declinedBy: t.declined_by || [],
        isCompleted: t.is_completed,
        completedAt: t.completed_at,
        completedByName: t.completed_by_name,
      }));
    }

    return {
      weekKey,
      startDate: monday.toISOString(),
      endDate: sunday.toISOString(),
      label: formatWeekLabel(weekKey),
      absentRoommates,
      cleanings,
    };
  }

  async setRoommateAbsence(
    weekKey: string,
    roommateId: number,
    isAbsent: boolean
  ): Promise<WeekState> {
    const weekState = await this.getWeekState(weekKey);
    const wasAbsent = weekState.absentRoommates.includes(roommateId);

    if (isAbsent && !wasAbsent) {
      await this.client
        .from("weekly_absences")
        .insert({ week_key: weekKey, roommate_id: roommateId });

      const newAbsences = [...weekState.absentRoommates, roommateId];
      const updatedCleanings = applyRoommateAbsence(
        weekState.cleanings,
        roommateId,
        newAbsences
      );

      for (const task of updatedCleanings) {
        await this.updateCleaningTask(task);
      }
    } else if (!isAbsent && wasAbsent) {
      await this.client
        .from("weekly_absences")
        .delete()
        .eq("week_key", weekKey)
        .eq("roommate_id", roommateId);

      const remainingAbsences = weekState.absentRoommates.filter((id) => id !== roommateId);
      const updatedCleanings = revokeRoommateAbsence(
        weekState.cleanings,
        roommateId,
        remainingAbsences
      );

      for (const task of updatedCleanings) {
        await this.updateCleaningTask(task);
      }
    }

    return this.getWeekState(weekKey);
  }

  async updateCleaningTask(task: CleaningTask): Promise<void> {
    await this.client
      .from("cleaning_tasks")
      .update({
        assigned_to: task.assignedTo,
        declined_by: task.declinedBy,
        is_completed: task.isCompleted,
        completed_at: task.completedAt,
        completed_by_name: task.completedByName,
      })
      .eq("id", task.id);
  }

  async getOpenTrashTask(): Promise<TrashTask | null> {
    const { data } = await this.client
      .from("trash_tasks")
      .select("*")
      .eq("status", "open")
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    return {
      id: data.id,
      status: data.status as "open" | "completed",
      assignedTo: data.assigned_to,
      declinedBy: data.declined_by || [],
      reportedAt: data.reported_at,
      completedAt: data.completed_at,
      completedByName: data.completed_by_name,
    };
  }

  async createTrashTask(task: TrashTask): Promise<void> {
    const existing = await this.getOpenTrashTask();
    if (existing) {
      throw new Error("C'è già una segnalazione di spazzatura aperta.");
    }

    await this.client.from("trash_tasks").insert({
      id: task.id,
      status: task.status,
      assigned_to: task.assignedTo,
      declined_by: task.declinedBy,
      reported_at: task.reportedAt,
      completed_at: task.completedAt,
      completed_by_name: task.completedByName,
    });
  }

  async updateTrashTask(task: TrashTask): Promise<void> {
    await this.client
      .from("trash_tasks")
      .update({
        status: task.status,
        assigned_to: task.assignedTo,
        declined_by: task.declinedBy,
        completed_at: task.completedAt,
        completed_by_name: task.completedByName,
      })
      .eq("id", task.id);
  }

  async getHistory(limit: number = 50): Promise<HistoryItem[]> {
    const currentWeekKey = getWeekKey(new Date());
    const items: HistoryItem[] = [];

    // 1. Pulizie completate
    const { data: completedCleanings } = await this.client
      .from("cleaning_tasks")
      .select("*")
      .eq("is_completed", true)
      .order("completed_at", { ascending: false })
      .limit(limit);

    if (completedCleanings) {
      for (const t of completedCleanings) {
        const area = AREAS.find((a) => a.id === t.area_id);
        const areaName = area ? area.name : `Area ${t.area_id}`;
        items.push({
          id: `clean-${t.id}`,
          type: "cleaning",
          title: `Pulizia ${areaName}`,
          areaId: t.area_id,
          status: "completed",
          personName: t.completed_by_name || "Coinquilino",
          date: t.completed_at || t.created_at,
          weekKey: t.week_key,
        });
      }
    }

    // 2. Pulizie incomplete di settimane passate
    const { data: pastIncompleteCleanings } = await this.client
      .from("cleaning_tasks")
      .select("*")
      .lt("week_key", currentWeekKey)
      .eq("is_completed", false)
      .limit(limit);

    if (pastIncompleteCleanings && pastIncompleteCleanings.length > 0) {
      const roommates = await this.getRoommates();
      for (const t of pastIncompleteCleanings) {
        const area = AREAS.find((a) => a.id === t.area_id);
        const areaName = area ? area.name : `Area ${t.area_id}`;
        const assigned = roommates.find((r) => r.id === t.assigned_to);
        const personName = assigned ? assigned.name : "Nessun incaricato";
        const sunday = getSundayOf(parseWeekKey(t.week_key));

        items.push({
          id: `clean-${t.id}`,
          type: "cleaning",
          title: `Pulizia ${areaName}`,
          areaId: t.area_id,
          status: "incomplete",
          personName,
          date: sunday.toISOString(),
          weekKey: t.week_key,
        });
      }
    }

    // 3. Spazzatura completata
    const { data: completedTrash } = await this.client
      .from("trash_tasks")
      .select("*")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(limit);

    if (completedTrash) {
      for (const tr of completedTrash) {
        items.push({
          id: `trash-${tr.id}`,
          type: "trash",
          title: "Spazzatura",
          status: "completed",
          personName: tr.completed_by_name || "Coinquilino",
          date: tr.completed_at || tr.reported_at,
        });
      }
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items.slice(0, limit);
  }

  async recordFailedLogin(ip: string): Promise<void> {
    await this.client.from("login_attempts").insert({ ip });
  }

  async isRateLimited(ip: string): Promise<boolean> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await this.client
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("attempt_time", fifteenMinutesAgo);

    return (count || 0) >= 5;
  }

  async resetRateLimit(ip: string): Promise<void> {
    await this.client.from("login_attempts").delete().eq("ip", ip);
  }
}
