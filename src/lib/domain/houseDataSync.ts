import { HouseData, CleaningTask, TrashTask, Roommate } from "./types";
import { declineCleaningTask, declineTrash, claimTrashTask, reportTrash } from "./logic";

export interface HouseDataSyncCallbacks {
  onDataChange: (data: HouseData | null) => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (error: string | null) => void;
  onAuthenticatedChange: (auth: boolean | null) => void;
  onSubmittingTaskIdChange: (id: string | null) => void;
  onIsSubmittingChange: (submitting: boolean) => void;
}

export interface HouseDataSyncOptions {
  initialData?: HouseData | null;
  callbacks: HouseDataSyncCallbacks;
  fetcher?: typeof fetch;
}

/**
 * Controller per la sincronizzazione dei dati della casa (Home/Pulizie/Spazzatura).
 * Protegge da:
 * 1. Risposte GET obsolete o fuori ordine.
 * 2. Risposte GET che arrivano mentre mutazioni ottimistiche sono in volo.
 * 3. Risposte POST concorrenti che rischiano di sovrascrivere mutazioni parallele.
 * 4. Rollback corretto dello stato al server in caso di errori o 409.
 */
export class HouseDataSyncController {
  private data: HouseData | null = null;
  private version = 0;
  private lastCommittedVersion = 0;
  private latestFetchVersion = 0;
  private activeMutationsCount = 0;
  private inFlightCleaningIds = new Set<string>();
  private inFlightTrash = false;
  private needsReconciliation = false;
  private callbacks: HouseDataSyncCallbacks;
  private fetcher: typeof fetch;

  constructor(options: HouseDataSyncOptions) {
    this.data = options.initialData || null;
    this.callbacks = options.callbacks;
    this.fetcher =
      options.fetcher ||
      (typeof fetch !== "undefined" ? fetch.bind(globalThis) : (undefined as any));
  }

  setCallbacks(callbacks: HouseDataSyncCallbacks) {
    this.callbacks = callbacks;
  }

  getData(): HouseData | null {
    return this.data;
  }

  getActiveMutationsCount(): number {
    return this.activeMutationsCount;
  }

  private updateData(newData: HouseData | null) {
    this.data = newData;
    this.callbacks.onDataChange(newData);
  }

  async fetchData(): Promise<void> {
    const reqVersion = ++this.version;
    this.latestFetchVersion = reqVersion;

    try {
      const res = await this.fetcher("/api/house/data", { cache: "no-store" });
      if (res.status === 401) {
        if (reqVersion >= this.lastCommittedVersion) {
          this.lastCommittedVersion = reqVersion;
          this.callbacks.onAuthenticatedChange(false);
          this.updateData(null);
          this.callbacks.onLoadingChange(false);
        }
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Errore nel caricamento dei dati");
      }

      const json: HouseData = await res.json();

      // Scarta la risposta se obsoleta rispetto a versioni già applicate
      if (reqVersion < this.lastCommittedVersion) {
        return;
      }

      // Se ci sono mutazioni locali attive, NON sovrascrivere lo stato ottimistico:
      // segnala necessità di riconciliazione quando le mutazioni termineranno
      if (this.activeMutationsCount > 0) {
        this.needsReconciliation = true;
        return;
      }

      this.lastCommittedVersion = reqVersion;
      this.needsReconciliation = false;
      this.updateData(json);
      this.callbacks.onAuthenticatedChange(true);
      this.callbacks.onError(null);
    } catch (err: any) {
      if (reqVersion >= this.lastCommittedVersion) {
        this.callbacks.onError(err.message || "Errore di connessione");
      }
    } finally {
      if (reqVersion === this.latestFetchVersion) {
        this.callbacks.onLoadingChange(false);
      }
    }
  }

  private checkReconciliation() {
    if (this.activeMutationsCount === 0 && this.needsReconciliation) {
      this.needsReconciliation = false;
      this.fetchData();
    }
  }

  async completeCleaning(taskId: string, weekKey: string, roommateId: number): Promise<boolean> {
    const targetRoommate = this.data?.roommates.find((r) => r.id === roommateId);

    // Aggiornamento ottimistico immediato
    if (this.data && this.data.currentWeek) {
      const updatedCleanings = this.data.currentWeek.cleanings.map((c) =>
        c.id === taskId
          ? {
              ...c,
              isCompleted: true,
              completedAt: new Date().toISOString(),
              completedByName: targetRoommate?.name || "Coinquilino",
              completedBy: roommateId,
            }
          : c
      );
      this.updateData({
        ...this.data,
        currentWeek: { ...this.data.currentWeek, cleanings: updatedCleanings },
      });
    }

    this.activeMutationsCount++;
    this.inFlightCleaningIds.add(taskId);
    this.callbacks.onSubmittingTaskIdChange(taskId);
    this.callbacks.onIsSubmittingChange(true);
    const mutVersion = ++this.version;

    try {
      const res = await this.fetcher("/api/house/cleanings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          taskId,
          weekKey,
          roommateId,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile completare l'attività";
        this.callbacks.onError(msg);
        this.needsReconciliation = true;
        return false;
      }

      if (resJson.week && this.data) {
        if (mutVersion >= this.lastCommittedVersion) {
          this.lastCommittedVersion = mutVersion;
          // Preserva lo stato ottimistico di altre attività in volo
          const mergedCleanings = resJson.week.cleanings.map((serverTask: CleaningTask) => {
            if (serverTask.id !== taskId && this.inFlightCleaningIds.has(serverTask.id)) {
              const currentLocal = this.data?.currentWeek?.cleanings.find(
                (c) => c.id === serverTask.id
              );
              return currentLocal || serverTask;
            }
            return serverTask;
          });

          this.updateData({
            ...this.data,
            currentWeek: {
              ...resJson.week,
              cleanings: mergedCleanings,
            },
          });
        }
      }
      return true;
    } catch {
      this.callbacks.onError("Errore di rete durante il salvataggio.");
      this.needsReconciliation = true;
      return false;
    } finally {
      this.inFlightCleaningIds.delete(taskId);
      this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
      this.callbacks.onSubmittingTaskIdChange(null);
      this.callbacks.onIsSubmittingChange(this.activeMutationsCount > 0);
      this.checkReconciliation();
    }
  }

  async declineCleaning(taskId: string, weekKey: string, roommateId: number): Promise<boolean> {
    // Aggiornamento ottimistico immediato
    if (this.data && this.data.currentWeek) {
      const task = this.data.currentWeek.cleanings.find((c) => c.id === taskId);
      if (task) {
        const updatedTask = declineCleaningTask(task, roommateId, this.data.roommates);
        const updatedCleanings = this.data.currentWeek.cleanings.map((c) =>
          c.id === taskId ? updatedTask : c
        );
        this.updateData({
          ...this.data,
          currentWeek: { ...this.data.currentWeek, cleanings: updatedCleanings },
        });
      }
    }

    this.activeMutationsCount++;
    this.inFlightCleaningIds.add(taskId);
    this.callbacks.onSubmittingTaskIdChange(taskId);
    this.callbacks.onIsSubmittingChange(true);
    const mutVersion = ++this.version;

    try {
      const res = await this.fetcher("/api/house/cleanings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "decline",
          taskId,
          weekKey,
          roommateId,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile rinunciare all'attività";
        this.callbacks.onError(msg);
        this.needsReconciliation = true;
        return false;
      }

      if (resJson.week && this.data && mutVersion >= this.lastCommittedVersion) {
        this.lastCommittedVersion = mutVersion;
        const mergedCleanings = resJson.week.cleanings.map((serverTask: CleaningTask) => {
          if (serverTask.id !== taskId && this.inFlightCleaningIds.has(serverTask.id)) {
            const currentLocal = this.data?.currentWeek?.cleanings.find(
              (c) => c.id === serverTask.id
            );
            return currentLocal || serverTask;
          }
          return serverTask;
        });

        this.updateData({
          ...this.data,
          currentWeek: { ...resJson.week, cleanings: mergedCleanings },
        });
      }
      return true;
    } catch {
      this.callbacks.onError("Errore di rete durante la rinuncia.");
      this.needsReconciliation = true;
      return false;
    } finally {
      this.inFlightCleaningIds.delete(taskId);
      this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
      this.callbacks.onSubmittingTaskIdChange(null);
      this.callbacks.onIsSubmittingChange(this.activeMutationsCount > 0);
      this.checkReconciliation();
    }
  }

  async uncompleteCleaning(taskId: string, weekKey: string, roommateId: number): Promise<boolean> {
    if (this.data && this.data.currentWeek) {
      const updatedCleanings = this.data.currentWeek.cleanings.map((c) =>
        c.id === taskId
          ? {
              ...c,
              isCompleted: false,
              completedAt: null,
              completedByName: null,
              completedBy: null,
            }
          : c
      );
      this.updateData({
        ...this.data,
        currentWeek: { ...this.data.currentWeek, cleanings: updatedCleanings },
      });
    }

    this.activeMutationsCount++;
    this.inFlightCleaningIds.add(taskId);
    this.callbacks.onSubmittingTaskIdChange(taskId);
    this.callbacks.onIsSubmittingChange(true);
    const mutVersion = ++this.version;

    try {
      const res = await this.fetcher("/api/house/cleanings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "uncomplete",
          taskId,
          weekKey,
          roommateId,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile annullare il completamento dell'attività";
        this.callbacks.onError(msg);
        this.needsReconciliation = true;
        return false;
      }

      if (resJson.week && this.data && mutVersion >= this.lastCommittedVersion) {
        this.lastCommittedVersion = mutVersion;
        const mergedCleanings = resJson.week.cleanings.map((serverTask: CleaningTask) => {
          if (serverTask.id !== taskId && this.inFlightCleaningIds.has(serverTask.id)) {
            const currentLocal = this.data?.currentWeek?.cleanings.find(
              (c) => c.id === serverTask.id
            );
            return currentLocal || serverTask;
          }
          return serverTask;
        });

        this.updateData({
          ...this.data,
          currentWeek: { ...resJson.week, cleanings: mergedCleanings },
        });
      }
      return true;
    } catch {
      this.callbacks.onError("Errore di rete durante l'annullamento.");
      this.needsReconciliation = true;
      return false;
    } finally {
      this.inFlightCleaningIds.delete(taskId);
      this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
      this.callbacks.onSubmittingTaskIdChange(null);
      this.callbacks.onIsSubmittingChange(this.activeMutationsCount > 0);
      this.checkReconciliation();
    }
  }

  async claimCleaning(taskId: string, weekKey: string, roommateId: number): Promise<boolean> {
    const targetRoommate = this.data?.roommates.find((r) => r.id === roommateId);
    if (this.data && this.data.currentWeek) {
      const updatedCleanings = this.data.currentWeek.cleanings.map((c) =>
        c.id === taskId
          ? {
              ...c,
              assignedTo: roommateId,
              assignedToName: targetRoommate?.name || null,
              declinedBy: c.declinedBy.filter((id) => id !== roommateId),
            }
          : c
      );
      this.updateData({
        ...this.data,
        currentWeek: { ...this.data.currentWeek, cleanings: updatedCleanings },
      });
    }

    this.activeMutationsCount++;
    this.inFlightCleaningIds.add(taskId);
    this.callbacks.onSubmittingTaskIdChange(taskId);
    this.callbacks.onIsSubmittingChange(true);
    const mutVersion = ++this.version;

    try {
      const res = await this.fetcher("/api/house/cleanings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim",
          taskId,
          weekKey,
          roommateId,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile prendere in carico l'attività";
        this.callbacks.onError(msg);
        this.needsReconciliation = true;
        return false;
      }

      if (resJson.week && this.data && mutVersion >= this.lastCommittedVersion) {
        this.lastCommittedVersion = mutVersion;
        const mergedCleanings = resJson.week.cleanings.map((serverTask: CleaningTask) => {
          if (serverTask.id !== taskId && this.inFlightCleaningIds.has(serverTask.id)) {
            const currentLocal = this.data?.currentWeek?.cleanings.find(
              (c) => c.id === serverTask.id
            );
            return currentLocal || serverTask;
          }
          return serverTask;
        });

        this.updateData({
          ...this.data,
          currentWeek: { ...resJson.week, cleanings: mergedCleanings },
        });
      }
      return true;
    } catch {
      this.callbacks.onError("Errore di rete durante la presa in carico.");
      this.needsReconciliation = true;
      return false;
    } finally {
      this.inFlightCleaningIds.delete(taskId);
      this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
      this.callbacks.onSubmittingTaskIdChange(null);
      this.callbacks.onIsSubmittingChange(this.activeMutationsCount > 0);
      this.checkReconciliation();
    }
  }

  async reportTrash(): Promise<boolean> {
    if (this.data) {
      const nextAssigned =
        this.data.trashQueue && this.data.trashQueue.length > 0 ? this.data.trashQueue[0] : 0;
      this.updateData({
        ...this.data,
        openTrashTask: {
          id: "temp_trash",
          status: "open",
          assignedTo: nextAssigned,
          declinedBy: [],
          reportedAt: new Date().toISOString(),
          completedAt: null,
          completedByName: null,
        },
      });
    }

    this.activeMutationsCount++;
    this.inFlightTrash = true;
    this.callbacks.onIsSubmittingChange(true);
    const mutVersion = ++this.version;

    try {
      const res = await this.fetcher("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report" }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Errore nella segnalazione della spazzatura";
        this.callbacks.onError(msg);
        this.needsReconciliation = true;
        return false;
      }

      if (resJson.openTrashTask !== undefined && resJson.trashQueue && this.data) {
        if (mutVersion >= this.lastCommittedVersion) {
          this.lastCommittedVersion = mutVersion;
          this.updateData({
            ...this.data,
            openTrashTask: resJson.openTrashTask,
            trashQueue: resJson.trashQueue,
          });
        }
      }
      return true;
    } catch {
      this.callbacks.onError("Errore di rete durante la segnalazione.");
      this.needsReconciliation = true;
      return false;
    } finally {
      this.inFlightTrash = false;
      this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
      this.callbacks.onIsSubmittingChange(this.activeMutationsCount > 0);
      this.checkReconciliation();
    }
  }

  async declineTrash(roommateId: number): Promise<boolean> {
    if (this.data && this.data.openTrashTask) {
      const currentTask = this.data.openTrashTask;
      const updatedDeclined = currentTask.declinedBy.includes(roommateId)
        ? currentTask.declinedBy
        : [...currentTask.declinedBy, roommateId];
      const nextCandidate = this.data.trashQueue.find((id) => !updatedDeclined.includes(id)) ?? null;
      this.updateData({
        ...this.data,
        openTrashTask: {
          ...currentTask,
          assignedTo: nextCandidate,
          declinedBy: updatedDeclined,
        },
      });
    }

    this.activeMutationsCount++;
    this.inFlightTrash = true;
    this.callbacks.onIsSubmittingChange(true);
    const mutVersion = ++this.version;

    try {
      const res = await this.fetcher("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", roommateId }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile rinunciare al turno di spazzatura";
        this.callbacks.onError(msg);
        this.needsReconciliation = true;
        return false;
      }

      if (resJson.openTrashTask !== undefined && resJson.trashQueue && this.data) {
        if (mutVersion >= this.lastCommittedVersion) {
          this.lastCommittedVersion = mutVersion;
          this.updateData({
            ...this.data,
            openTrashTask: resJson.openTrashTask,
            trashQueue: resJson.trashQueue,
          });
        }
      }
      return true;
    } catch {
      this.callbacks.onError("Errore di rete durante la rinuncia.");
      this.needsReconciliation = true;
      return false;
    } finally {
      this.inFlightTrash = false;
      this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
      this.callbacks.onIsSubmittingChange(this.activeMutationsCount > 0);
      this.checkReconciliation();
    }
  }

  async completeTrash(roommateId: number): Promise<boolean> {
    if (this.data) {
      this.updateData({ ...this.data, openTrashTask: null });
    }

    this.activeMutationsCount++;
    this.inFlightTrash = true;
    this.callbacks.onIsSubmittingChange(true);
    const mutVersion = ++this.version;

    try {
      const res = await this.fetcher("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", roommateId }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile completare la spazzatura";
        this.callbacks.onError(msg);
        this.needsReconciliation = true;
        return false;
      }

      if (resJson.trashQueue && this.data) {
        if (mutVersion >= this.lastCommittedVersion) {
          this.lastCommittedVersion = mutVersion;
          this.updateData({
            ...this.data,
            openTrashTask: null,
            trashQueue: resJson.trashQueue,
          });
        }
      }
      return true;
    } catch {
      this.callbacks.onError("Errore di rete durante il salvataggio.");
      this.needsReconciliation = true;
      return false;
    } finally {
      this.inFlightTrash = false;
      this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
      this.callbacks.onIsSubmittingChange(this.activeMutationsCount > 0);
      this.checkReconciliation();
    }
  }

  async claimTrash(roommateId: number): Promise<boolean> {
    if (this.data && this.data.openTrashTask) {
      this.updateData({
        ...this.data,
        openTrashTask: {
          ...this.data.openTrashTask,
          assignedTo: roommateId,
          declinedBy: this.data.openTrashTask.declinedBy.filter((id) => id !== roommateId),
        },
      });
    }

    this.activeMutationsCount++;
    this.inFlightTrash = true;
    this.callbacks.onIsSubmittingChange(true);
    const mutVersion = ++this.version;

    try {
      const res = await this.fetcher("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", roommateId }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile prendere in carico la spazzatura";
        this.callbacks.onError(msg);
        this.needsReconciliation = true;
        return false;
      }

      if (resJson.openTrashTask !== undefined && resJson.trashQueue && this.data) {
        if (mutVersion >= this.lastCommittedVersion) {
          this.lastCommittedVersion = mutVersion;
          this.updateData({
            ...this.data,
            openTrashTask: resJson.openTrashTask,
            trashQueue: resJson.trashQueue,
          });
        }
      }
      return true;
    } catch {
      this.callbacks.onError("Errore di rete durante la presa in carico.");
      this.needsReconciliation = true;
      return false;
    } finally {
      this.inFlightTrash = false;
      this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
      this.callbacks.onIsSubmittingChange(this.activeMutationsCount > 0);
      this.checkReconciliation();
    }
  }

  async updateRoommateName(id: number, name: string): Promise<boolean> {
    const trimmed = name.trim();
    if (this.data) {
      this.updateData({
        ...this.data,
        roommates: this.data.roommates.map((r) =>
          r.id === id ? { ...r, name: trimmed } : r
        ),
      });
    }

    this.activeMutationsCount++;
    this.callbacks.onIsSubmittingChange(true);
    const mutVersion = ++this.version;

    try {
      const res = await this.fetcher("/api/house/roommates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: trimmed }),
      });

      if (!res.ok) {
        this.needsReconciliation = true;
        return false;
      }

      if (mutVersion >= this.lastCommittedVersion) {
        this.lastCommittedVersion = mutVersion;
      }
      return true;
    } catch {
      this.needsReconciliation = true;
      return false;
    } finally {
      this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
      this.callbacks.onIsSubmittingChange(this.activeMutationsCount > 0);
      this.checkReconciliation();
    }
  }

  async logout(): Promise<void> {
    try {
      await this.fetcher("/api/auth/logout", { method: "POST" });
    } catch {
      //
    } finally {
      this.callbacks.onAuthenticatedChange(false);
      this.updateData(null);
    }
  }
}
