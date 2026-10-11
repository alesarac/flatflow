import { createClient, SupabaseClient } from "@supabase/supabase-js";
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
  createWeekCleanings,
  formatWeekLabel,
  getRomeSundayEndIso,
  getWeekKey,
  parseWeekKey,
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

    // Lettura compiti di pulizia
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
      const roommates = await this.getRoommates();
      const initialTasks = createWeekCleanings(weekKey, roommates);
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
        completed_by: c.completedBy,
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

      const needsRoommates = reloadedTasks.some((t) => !t.assigned_to_name && t.assigned_to !== null);
      const fallbackRoommates = needsRoommates ? await this.getRoommates() : [];

      cleanings = reloadedTasks.map((t) => ({
        id: t.id,
        weekKey: t.week_key,
        areaId: t.area_id,
        assignedTo: t.assigned_to,
        assignedToName: t.assigned_to_name || (t.assigned_to !== null ? fallbackRoommates.find((r) => r.id === t.assigned_to)?.name || null : null),
        declinedBy: t.declined_by || [],
        isCompleted: t.is_completed,
        completedAt: t.completed_at,
        completedByName: t.completed_by_name,
        completedBy: t.completed_by !== undefined ? t.completed_by : null,
      }));
    } else {
      const needsRoommates = existingTasks.some((t) => !t.assigned_to_name && t.assigned_to !== null);
      const fallbackRoommates = needsRoommates ? await this.getRoommates() : [];

      cleanings = existingTasks.map((t) => ({
        id: t.id,
        weekKey: t.week_key,
        areaId: t.area_id,
        assignedTo: t.assigned_to,
        assignedToName: t.assigned_to_name || (t.assigned_to !== null ? fallbackRoommates.find((r) => r.id === t.assigned_to)?.name || null : null),
        declinedBy: t.declined_by || [],
        isCompleted: t.is_completed,
        completedAt: t.completed_at,
        completedByName: t.completed_by_name,
        completedBy: t.completed_by !== undefined ? t.completed_by : null,
      }));
    }

    const startIso = new Date(Date.UTC(monday.year, monday.month - 1, monday.day)).toISOString();
    const endIso = new Date(Date.UTC(sunday.year, sunday.month - 1, sunday.day, 23, 59, 59, 999)).toISOString();

    return {
      weekKey,
      startDate: startIso,
      endDate: endIso,
      label: formatWeekLabel(weekKey),
      cleanings,
    };
  }


  async updateCleaningTask(
    task: CleaningTask,
    condition?: { isCompleted?: boolean; assignedTo?: number | null }
  ): Promise<boolean> {
    let query = this.client
      .from("cleaning_tasks")
      .update({
        assigned_to: task.assignedTo,
        assigned_to_name: task.assignedToName,
        declined_by: task.declinedBy,
        is_completed: task.isCompleted,
        completed_at: task.completedAt,
        completed_by_name: task.completedByName,
        completed_by: task.completedBy,
      })
      .eq("id", task.id);

    if (condition) {
      if (condition.isCompleted !== undefined) {
        query = query.eq("is_completed", condition.isCompleted);
      }
      if (condition.assignedTo !== undefined) {
        if (condition.assignedTo === null) {
          query = query.is("assigned_to", null);
        } else {
          query = query.eq("assigned_to", condition.assignedTo);
        }
      }
    }

    const { data, error } = await query.select();

    if (error) {
      throw new Error(`Errore aggiornamento compito pulizia: ${error.message}`);
    }

    return (data && data.length > 0) ? true : false;
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

  async updateTrashTask(
    task: TrashTask,
    condition?: { status?: "open" | "completed"; assignedTo?: number | null }
  ): Promise<boolean> {
    // P1-01: Per rinunce e riassegnazioni aggiorna SOLO i campi necessari (assigned_to, declined_by).
    // Non tocca MAI status, completed_at o completed_by_name (il completamento avviene solo via RPC atomica).
    let query = this.client
      .from("trash_tasks")
      .update({
        assigned_to: task.assignedTo,
        declined_by: task.declinedBy,
      })
      .eq("id", task.id);

    // Condizione: per impostazione predefinita il task DEVE essere ancora 'open' per poter essere modificato
    const targetStatus = condition?.status ?? "open";
    query = query.eq("status", targetStatus);

    if (condition && condition.assignedTo !== undefined) {
      if (condition.assignedTo === null) {
        query = query.is("assigned_to", null);
      } else {
        query = query.eq("assigned_to", condition.assignedTo);
      }
    }

    const { data, error } = await query.select();

    if (error) {
      throw new Error(`Errore aggiornamento spazzatura: ${error.message}`);
    }

    return (data && data.length > 0) ? true : false;
  }


  async completeTrashAtomic(
    taskId: string,
    roommateId: number,
    roommateName: string
  ): Promise<{ task: TrashTask; queue: number[] }> {
    // Esecuzione atomica esclusiva tramite funzione PostgreSQL RPC
    const { data: rpcData, error: rpcError } = await this.client.rpc("rpc_complete_trash", {
      p_task_id: taskId,
      p_roommate_id: roommateId,
      p_completed_by_name: roommateName,
    });

    if (rpcError) {
      throw new Error(`Errore completamento atomico spazzatura: ${rpcError.message}`);
    }

    if (!rpcData || !rpcData.success) {
      throw new Error("Transazione atomica completamento spazzatura fallita.");
    }

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


  async getHistory(limit: number = 30, offset: number = 0): Promise<HistoryResult> {
    const currentWeekKey = getWeekKey(new Date());
    const items: HistoryItem[] = [];

    // Esecuzione concorrente in parallelo delle 3 query indipendenti
    const [
      { data: completedCleanings, error: cErr },
      { data: pastIncompleteCleanings, error: incErr },
      { data: completedTrash, error: trErr },
    ] = await Promise.all([
      this.client
        .from("cleaning_tasks")
        .select("*")
        .eq("is_completed", true)
        .order("completed_at", { ascending: false }),
      this.client
        .from("cleaning_tasks")
        .select("*")
        .lt("week_key", currentWeekKey)
        .eq("is_completed", false)
        .order("week_key", { ascending: false }),
      this.client
        .from("trash_tasks")
        .select("*")
        .eq("status", "completed")
        .order("completed_at", { ascending: false }),
    ]);

    if (cErr) {
      throw new Error(`Errore lettura storico pulizie: ${cErr.message}`);
    }
    if (incErr) {
      throw new Error(`Errore lettura pulizie incomplete: ${incErr.message}`);
    }
    if (trErr) {
      throw new Error(`Errore lettura storico spazzatura: ${trErr.message}`);
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

    if (pastIncompleteCleanings && pastIncompleteCleanings.length > 0) {
      const needsRoommates = pastIncompleteCleanings.some(
        (t) => !t.assigned_to_name && t.assigned_to !== null
      );
      const roommates = needsRoommates ? await this.getRoommates() : [];
      for (const t of pastIncompleteCleanings) {
        const area = AREAS.find((a) => a.id === t.area_id);
        const areaName = area ? area.name : `Area ${t.area_id}`;
        // P1-07: Usa lo snapshot assigned_to_name se registrato, altrimenti cerca nei profili
        const personName =
          t.assigned_to_name ||
          (t.assigned_to !== null ? roommates.find((r) => r.id === t.assigned_to)?.name || "Coinquilino" : "Nessun incaricato");

        // P2-02: Calcola la data di incompletezza rigorosamente secondo Europe/Rome (domenica sera)
        const sundayIso = getRomeSundayEndIso(t.week_key);

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

  async getShoppingItems(): Promise<ShoppingItem[]> {
    const { data, error } = await this.client
      .from("shopping_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("Tabella shopping_items non ancora presente su Supabase.");
        return [];
      }
      throw new Error(`Errore caricamento lista della spesa da Supabase: ${error.message}`);
    }

    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      isBought: Boolean(row.is_bought),
      addedBy: row.added_by,
      addedByName: row.added_by_name,
      createdAt: row.created_at,
      boughtBy: row.bought_by !== null && row.bought_by !== undefined ? row.bought_by : null,
      boughtByName: row.bought_by_name || null,
      boughtAt: row.bought_at || null,
    }));
  }

  async addShoppingItem(name: string, addedBy: number, addedByName: string): Promise<ShoppingItem> {
    const id = `shop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const row = {
      id,
      name: name.trim(),
      is_bought: false,
      added_by: addedBy,
      added_by_name: addedByName,
      created_at: nowIso,
      bought_by: null,
      bought_by_name: null,
      bought_at: null,
    };

    const { error } = await this.client.from("shopping_items").insert(row);
    if (error) {
      throw new Error(`Errore inserimento prodotto lista della spesa: ${error.message}`);
    }

    return {
      id,
      name: name.trim(),
      isBought: false,
      addedBy,
      addedByName,
      createdAt: nowIso,
      boughtBy: null,
      boughtByName: null,
      boughtAt: null,
    };
  }

  async toggleShoppingItem(
    id: string,
    isBought: boolean,
    boughtBy: number | null,
    boughtByName: string | null
  ): Promise<ShoppingItem | null> {
    const updateData: any = {
      is_bought: isBought,
      bought_by: isBought ? boughtBy : null,
      bought_by_name: isBought ? boughtByName : null,
      bought_at: isBought ? new Date().toISOString() : null,
    };

    const { data, error } = await this.client
      .from("shopping_items")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) {
      throw new Error(`Errore aggiornamento prodotto lista della spesa: ${error.message}`);
    }

    if (!data || data.length === 0) return null;

    const row = data[0];
    return {
      id: row.id,
      name: row.name,
      isBought: Boolean(row.is_bought),
      addedBy: row.added_by,
      addedByName: row.added_by_name,
      createdAt: row.created_at,
      boughtBy: row.bought_by !== null && row.bought_by !== undefined ? row.bought_by : null,
      boughtByName: row.bought_by_name || null,
      boughtAt: row.bought_at || null,
    };
  }

  async deleteShoppingItem(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("shopping_items")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      throw new Error(`Errore eliminazione prodotto lista della spesa: ${error.message}`);
    }

    return Boolean(data && data.length > 0);
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
