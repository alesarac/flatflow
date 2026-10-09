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
  getWeekKey,
  parseWeekKey,
  reconcileOpenTrash,
  revokeRoommateAbsence,
} from "../domain/logic";
import { HistoryResult, IHouseRepository } from "./types";

export class SupabaseHouseRepository implements IHouseRepository {
  private client: SupabaseClient;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SupabaseHouseRepository richiede supabaseUrl e serviceRoleKey validi.");
    }
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  async getRoommates(): Promise<Roommate[]> {
    const { data, error } = await this.client
      .from("roommates")
      .select("id, name")
      .order("id", { ascending: true });

    if (error) {
      throw new Error(`Errore caricamento coinquilini da Supabase: ${error.message}`);
    }

    if (!data || data.length === 0) {
      // Inizializza coinquilini di default se la tabella è vuota
      const defaultRows = DEFAULT_ROOMMATES.map((r) => ({ id: r.id, name: r.name }));
      const { error: insertError } = await this.client.from("roommates").upsert(defaultRows);
      if (insertError) {
        throw new Error(`Errore inizializzazione coinquilini: ${insertError.message}`);
      }
      return [...DEFAULT_ROOMMATES];
    }

    return data as Roommate[];
  }

  async updateRoommate(id: number, name: string): Promise<void> {
    const { error } = await this.client
      .from("roommates")
      .upsert({ id, name: name.trim(), updated_at: new Date().toISOString() });

    if (error) {
      throw new Error(`Errore aggiornamento coinquilino: ${error.message}`);
    }
  }

  async getTrashQueue(): Promise<number[]> {
    const { data, error } = await this.client
      .from("house_config")
      .select("trash_queue")
      .eq("id", "default")
      .single();

    if (error) {
      // Se non esiste la riga di configurazione, la creiamo
      const { data: created, error: createError } = await this.client
        .from("house_config")
        .upsert({ id: "default", trash_queue: [0, 1, 2] })
        .select("trash_queue")
        .single();

      if (createError || !created) {
        throw new Error(`Errore lettura configurazione coda spazzatura: ${error.message}`);
      }
      return created.trash_queue as number[];
    }

    return data.trash_queue as number[];
  }

  async updateTrashQueue(queue: number[]): Promise<void> {
    const { error } = await this.client
      .from("house_config")
      .upsert({ id: "default", trash_queue: queue, updated_at: new Date().toISOString() });

    if (error) {
      throw new Error(`Errore aggiornamento coda spazzatura: ${error.message}`);
    }
  }

  async getWeekState(weekKey: string): Promise<WeekState> {
    const { monday, sunday } = parseWeekKey(weekKey);
    const roommates = await this.getRoommates();

    // 1. Lettura assenze
    const { data: absenceData, error: absenceError } = await this.client
      .from("weekly_absences")
      .select("roommate_id")
      .eq("week_key", weekKey);

    if (absenceError) {
      throw new Error(`Errore lettura assenze: ${absenceError.message}`);
    }

    const absentRoommates = absenceData ? absenceData.map((a) => a.roommate_id) : [];

    // 2. Lettura compiti di pulizia
    const { data: existingTasks, error: fetchError } = await this.client
      .from("cleaning_tasks")
      .select("*")
      .eq("week_key", weekKey)
      .order("area_id", { ascending: true });

    if (fetchError) {
      throw new Error(`Errore lettura compiti pulizia: ${fetchError.message}`);
    }

    let cleanings: CleaningTask[] = [];

    // Se mancano i compiti (o sono meno di 3), inizializza con ON CONFLICT DO NOTHING
    if (!existingTasks || existingTasks.length < 3) {
      const initialTasks = createWeekCleanings(weekKey, absentRoommates, roommates);
      const rows = initialTasks.map((c) => ({
        id: c.id,
        week_key: c.weekKey,
        area_id: c.areaId,
        assigned_to: c.assignedTo,
        assigned_to_name: c.assignedToName,
        declined_by: c.declinedBy,
        is_completed: c.isCompleted,
        completed_at: c.completedAt,
        completed_by_name: c.completedByName,
      }));

      const { error: insertError } = await this.client
        .from("cleaning_tasks")
        .upsert(rows, { onConflict: "week_key, area_id", ignoreDuplicates: true });

      if (insertError) {
        throw new Error(`Errore inserimento compiti pulizia: ${insertError.message}`);
      }

      // Rileggi SEMPRE dal database per garantire che i dati restituiti siano quelli persistiti
      const { data: reloadedTasks, error: reloadError } = await this.client
        .from("cleaning_tasks")
        .select("*")
        .eq("week_key", weekKey)
        .order("area_id", { ascending: true });

      if (reloadError || !reloadedTasks) {
        throw new Error(`Errore ricaricamento compiti: ${reloadError?.message}`);
      }

      cleanings = reloadedTasks.map((t) => ({
        id: t.id,
        weekKey: t.week_key,
        areaId: t.area_id,
        assignedTo: t.assigned_to,
        assignedToName: t.assigned_to_name || (t.assigned_to !== null ? roommates.find((r) => r.id === t.assigned_to)?.name || null : null),
        declinedBy: t.declined_by || [],
        isCompleted: t.is_completed,
        completedAt: t.completed_at,
        completedByName: t.completed_by_name,
      }));
    } else {
      cleanings = existingTasks.map((t) => ({
        id: t.id,
        weekKey: t.week_key,
        areaId: t.area_id,
        assignedTo: t.assigned_to,
        assignedToName: t.assigned_to_name || (t.assigned_to !== null ? roommates.find((r) => r.id === t.assigned_to)?.name || null : null),
        declinedBy: t.declined_by || [],
        isCompleted: t.is_completed,
        completedAt: t.completed_at,
        completedByName: t.completed_by_name,
      }));
    }

    const startIso = new Date(Date.UTC(monday.year, monday.month - 1, monday.day)).toISOString();
    const endIso = new Date(Date.UTC(sunday.year, sunday.month - 1, sunday.day, 23, 59, 59, 999)).toISOString();

    return {
      weekKey,
      startDate: startIso,
      endDate: endIso,
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
    const roommates = await this.getRoommates();
    const wasAbsent = weekState.absentRoommates.includes(roommateId);
    const queue = await this.getTrashQueue();

    if (isAbsent && !wasAbsent) {
      const { error: insErr } = await this.client
        .from("weekly_absences")
        .insert({ week_key: weekKey, roommate_id: roommateId });

      if (insErr) {
        throw new Error(`Errore salvataggio assenza: ${insErr.message}`);
      }

      const newAbsences = [...weekState.absentRoommates, roommateId];
      const updatedCleanings = applyRoommateAbsence(
        weekState.cleanings,
        roommateId,
        newAbsences,
        roommates
      );

      for (const task of updatedCleanings) {
        await this.updateCleaningTask(task);
      }

      // P1-04: Riconciliazione immediata della spazzatura aperta se assegnata all'assente
      const openTrash = await this.getOpenTrashTask();
      if (openTrash && openTrash.assignedTo === roommateId) {
        const reconciled = reconcileOpenTrash(openTrash, queue, newAbsences);
        if (reconciled) {
          await this.updateTrashTask(reconciled);
        }
      }
    } else if (!isAbsent && wasAbsent) {
      const { error: delErr } = await this.client
        .from("weekly_absences")
        .delete()
        .eq("week_key", weekKey)
        .eq("roommate_id", roommateId);

      if (delErr) {
        throw new Error(`Errore revoca assenza: ${delErr.message}`);
      }

      const remainingAbsences = weekState.absentRoommates.filter((id) => id !== roommateId);
      const updatedCleanings = revokeRoommateAbsence(
        weekState.cleanings,
        roommateId,
        remainingAbsences,
        roommates
      );

      for (const task of updatedCleanings) {
        await this.updateCleaningTask(task);
      }

      // P1-04: Riconciliazione spazzatura aperta se era rimasta senza incaricato
      const openTrash = await this.getOpenTrashTask();
      if (openTrash && openTrash.assignedTo === null) {
        const reconciled = reconcileOpenTrash(openTrash, queue, remainingAbsences);
        if (reconciled) {
          await this.updateTrashTask(reconciled);
        }
      }
    }

    return this.getWeekState(weekKey);
  }

  async updateCleaningTask(task: CleaningTask): Promise<void> {
    const { error } = await this.client
      .from("cleaning_tasks")
      .update({
        assigned_to: task.assignedTo,
        assigned_to_name: task.assignedToName,
        declined_by: task.declinedBy,
        is_completed: task.isCompleted,
        completed_at: task.completedAt,
        completed_by_name: task.completedByName,
      })
      .eq("id", task.id);

    if (error) {
      throw new Error(`Errore aggiornamento compito pulizia: ${error.message}`);
    }
  }

  async getOpenTrashTask(): Promise<TrashTask | null> {
    const { data, error } = await this.client
      .from("trash_tasks")
      .select("*")
      .eq("status", "open")
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Errore lettura spazzatura aperta: ${error.message}`);
    }

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
    // Il vincolo di unicità parziale idx_trash_tasks_single_open garantisce l'impossibilità di duplicati
    const { error } = await this.client.from("trash_tasks").insert({
      id: task.id,
      status: task.status,
      assigned_to: task.assignedTo,
      declined_by: task.declinedBy,
      reported_at: task.reportedAt,
      completed_at: task.completedAt,
      completed_by_name: task.completedByName,
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error("C'è già una segnalazione di spazzatura aperta.");
      }
      throw new Error(`Errore creazione compito spazzatura: ${error.message}`);
    }
  }

  async updateTrashTask(task: TrashTask): Promise<void> {
    const { error } = await this.client
      .from("trash_tasks")
      .update({
        status: task.status,
        assigned_to: task.assignedTo,
        declined_by: task.declinedBy,
        completed_at: task.completedAt,
        completed_by_name: task.completedByName,
      })
      .eq("id", task.id);

    if (error) {
      throw new Error(`Errore aggiornamento spazzatura: ${error.message}`);
    }
  }

  async completeTrashAtomic(
    taskId: string,
    roommateId: number,
    roommateName: string
  ): Promise<{ task: TrashTask; queue: number[] }> {
    // Prova prima la funzione atomica PostgreSQL RPC se definita
    const { data: rpcData, error: rpcError } = await this.client.rpc("rpc_complete_trash", {
      p_task_id: taskId,
      p_roommate_id: roommateId,
      p_completed_by_name: roommateName,
    });

    if (!rpcError && rpcData?.success) {
      const queue = rpcData.new_queue as number[];
      const completedTask: TrashTask = {
        id: taskId,
        status: "completed",
        assignedTo: roommateId,
        declinedBy: [],
        reportedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        completedByName: roommateName,
      };
      return { task: completedTask, queue };
    }

    // Fallback controllato se la funzione RPC non è ancora registrata nel DB
    const currentQueue = await this.getTrashQueue();
    const { error: taskErr } = await this.client
      .from("trash_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by_name: roommateName,
      })
      .eq("id", taskId)
      .eq("status", "open");

    if (taskErr) {
      throw new Error(`Errore completamento spazzatura: ${taskErr.message}`);
    }

    const remaining = currentQueue.filter((id) => id !== roommateId);
    const updatedQueue = [...remaining, roommateId];
    await this.updateTrashQueue(updatedQueue);

    const completedTask: TrashTask = {
      id: taskId,
      status: "completed",
      assignedTo: roommateId,
      declinedBy: [],
      reportedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      completedByName: roommateName,
    };

    return { task: completedTask, queue: updatedQueue };
  }

  async getHistory(limit: number = 30, offset: number = 0): Promise<HistoryResult> {
    const currentWeekKey = getWeekKey(new Date());
    const items: HistoryItem[] = [];

    // 1. Pulizie completate
    const { data: completedCleanings, error: cErr } = await this.client
      .from("cleaning_tasks")
      .select("*")
      .eq("is_completed", true)
      .order("completed_at", { ascending: false });

    if (cErr) {
      throw new Error(`Errore lettura storico pulizie: ${cErr.message}`);
    }

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
    const { data: pastIncompleteCleanings, error: incErr } = await this.client
      .from("cleaning_tasks")
      .select("*")
      .lt("week_key", currentWeekKey)
      .eq("is_completed", false)
      .order("week_key", { ascending: false });

    if (incErr) {
      throw new Error(`Errore lettura pulizie incomplete: ${incErr.message}`);
    }

    if (pastIncompleteCleanings && pastIncompleteCleanings.length > 0) {
      const roommates = await this.getRoommates();
      for (const t of pastIncompleteCleanings) {
        const area = AREAS.find((a) => a.id === t.area_id);
        const areaName = area ? area.name : `Area ${t.area_id}`;
        // P1-07: Usa lo snapshot assigned_to_name se registrato, altrimenti cerca nei profili
        const personName =
          t.assigned_to_name ||
          (t.assigned_to !== null ? roommates.find((r) => r.id === t.assigned_to)?.name || "Coinquilino" : "Nessun incaricato");

        const { sunday } = parseWeekKey(t.week_key);
        const sundayIso = new Date(Date.UTC(sunday.year, sunday.month - 1, sunday.day, 23, 59, 59)).toISOString();

        items.push({
          id: `clean-${t.id}`,
          type: "cleaning",
          title: `Pulizia ${areaName}`,
          areaId: t.area_id,
          status: "incomplete",
          personName,
          date: sundayIso,
          weekKey: t.week_key,
        });
      }
    }

    // 3. Spazzatura completata
    const { data: completedTrash, error: trErr } = await this.client
      .from("trash_tasks")
      .select("*")
      .eq("status", "completed")
      .order("completed_at", { ascending: false });

    if (trErr) {
      throw new Error(`Errore lettura storico spazzatura: ${trErr.message}`);
    }

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

    // Ordinamento cronologico decrescente globale
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

  async recordFailedLogin(ip: string): Promise<void> {
    const { error } = await this.client.from("login_attempts").insert({ ip });
    if (error) {
      throw new Error(`Errore registrazione tentativo login: ${error.message}`);
    }
  }

  async isRateLimited(ip: string): Promise<boolean> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count, error } = await this.client
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("attempt_time", fifteenMinutesAgo);

    if (error) {
      throw new Error(`Errore verifica rate limit: ${error.message}`);
    }

    return (count || 0) >= 5;
  }

  async resetRateLimit(ip: string): Promise<void> {
    const { error } = await this.client.from("login_attempts").delete().eq("ip", ip);
    if (error) {
      throw new Error(`Errore reset rate limit: ${error.message}`);
    }
  }
}
