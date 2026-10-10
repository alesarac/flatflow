import { ShoppingItem } from "./types";

export interface ShoppingSyncCallbacks {
  onItemsChange: (items: ShoppingItem[]) => void;
  onError: (error: string | null) => void;
  onPendingItemIdsChange: (ids: Set<string>) => void;
  onLoadingChange?: (loading: boolean) => void;
  onRefreshingChange?: (refreshing: boolean) => void;
}

export interface ShoppingSyncOptions extends ShoppingSyncCallbacks {
  initialItems?: ShoppingItem[];
  fetcher?: typeof fetch;
}

/**
 * Controller per la sincronizzazione della lista della spesa.
 * Gestisce:
 * 1. Risposte asincrone fuori ordine (sequence tracking).
 * 2. Serializzazione delle mutazioni in coda (mutationQueue).
 * 3. Aggiornamenti ottimistici immediati senza bloccare elementi distinti.
 * 4. Riconciliazione finale con il server quando la coda si svuota dopo errori o HTTP 404.
 * 5. Prevenzione di refetch inutili quando le mutazioni restituiscono già lo stato autorevole del server.
 */
export class ShoppingSyncController {
  private items: ShoppingItem[] = [];
  private pendingItemIds = new Set<string>();
  private version = 0;
  private lastCommittedVersion = 0;
  private activeMutationsCount = 0;
  private needsReconciliation = false;
  private mutationQueue: Promise<void> = Promise.resolve();
  private fetcher: typeof fetch;

  private callbacks: ShoppingSyncCallbacks;

  constructor(options: ShoppingSyncOptions) {
    this.items = options.initialItems ? [...options.initialItems] : [];
    this.callbacks = {
      onItemsChange: options.onItemsChange,
      onError: options.onError,
      onPendingItemIdsChange: options.onPendingItemIdsChange,
      onLoadingChange: options.onLoadingChange,
      onRefreshingChange: options.onRefreshingChange,
    };
    this.fetcher =
      options.fetcher ||
      (typeof fetch !== "undefined" ? fetch.bind(globalThis) : (undefined as any));
  }

  setCallbacks(callbacks: ShoppingSyncCallbacks) {
    this.callbacks = callbacks;
  }

  getItems(): ShoppingItem[] {
    return this.items;
  }

  getPendingItemIds(): Set<string> {
    return new Set(this.pendingItemIds);
  }

  getActiveMutationsCount(): number {
    return this.activeMutationsCount;
  }

  getNeedsReconciliation(): boolean {
    return this.needsReconciliation;
  }

  private updateItems(newItems: ShoppingItem[]) {
    this.items = newItems;
    this.callbacks.onItemsChange(newItems);
  }

  private addPendingId(id: string) {
    this.pendingItemIds.add(id);
    this.callbacks.onPendingItemIdsChange(new Set(this.pendingItemIds));
  }

  private removePendingId(id: string) {
    this.pendingItemIds.delete(id);
    this.callbacks.onPendingItemIdsChange(new Set(this.pendingItemIds));
  }

  /**
   * Esegue la riconciliazione finale con il server quando la coda delle mutazioni torna vuota
   * e vi è una sincronizzazione pendente (dovuta a errori, 404 o fetch posticipati).
   */
  private checkReconciliation() {
    if (this.activeMutationsCount === 0 && this.needsReconciliation) {
      this.needsReconciliation = false;
      this.fetchItems(false);
    }
  }

  async fetchItems(isManual = false): Promise<void> {
    if (isManual) this.callbacks.onRefreshingChange?.(true);
    const reqVersion = ++this.version;

    try {
      const res = await this.fetcher("/api/house/shopping", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Impossibile caricare la lista della spesa.");
      }
      const data = await res.json();

      // Scarta la risposta se nel frattempo è stata applicata o è in arrivo una versione più recente
      if (reqVersion < this.lastCommittedVersion) {
        return;
      }

      // Se ci sono mutazioni locali ancora attive nella coda, non possiamo sovrascrivere lo stato ottimistico:
      // segnaliamo la necessità di riconciliazione quando la coda si svuoterà
      if (this.activeMutationsCount > 0) {
        this.needsReconciliation = true;
        return;
      }

      this.lastCommittedVersion = reqVersion;
      this.needsReconciliation = false;
      this.updateItems(data.items || []);
      this.callbacks.onError(null);
    } catch (err: any) {
      if (reqVersion >= this.lastCommittedVersion) {
        this.callbacks.onError(err.message || "Errore di connessione.");
      }
    } finally {
      if (reqVersion >= this.lastCommittedVersion) {
        this.callbacks.onLoadingChange?.(false);
        this.callbacks.onRefreshingChange?.(false);
      }
    }
  }

  async addItem(name: string): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed) return false;

    this.activeMutationsCount++;
    const addVersion = ++this.version;
    this.callbacks.onError(null);

    return new Promise<boolean>((resolve) => {
      this.mutationQueue = this.mutationQueue.then(async () => {
        let success = false;
        try {
          const res = await this.fetcher("/api/house/shopping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "add", name: trimmed }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Errore durante l'aggiunta.");
          }

          success = true;
          if (addVersion >= this.lastCommittedVersion && this.activeMutationsCount === 1) {
            this.lastCommittedVersion = addVersion;
            this.updateItems(data.items || []);
            this.needsReconciliation = false;
          } else if (data.item) {
            this.updateItems([
              data.item,
              ...this.items.filter((i) => i.id !== data.item.id),
            ]);
          }
        } catch (err: any) {
          this.callbacks.onError(err.message || "Errore durante l'aggiunta.");
          this.needsReconciliation = true;
        } finally {
          this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
          this.checkReconciliation();
          resolve(success);
        }
      });
    });
  }

  toggleItem(
    id: string,
    isBought: boolean,
    roommateId?: number | null,
    roommateName?: string | null
  ): void {
    if (this.pendingItemIds.has(id)) return;

    this.addPendingId(id);
    this.callbacks.onError(null);

    // Aggiornamento ottimistico immediato
    this.updateItems(
      this.items.map((item) =>
        item.id === id
          ? {
              ...item,
              isBought,
              boughtAt: isBought ? new Date().toISOString() : null,
              boughtBy: isBought ? roommateId ?? item.boughtBy : null,
              boughtByName: isBought ? roommateName ?? item.boughtByName : null,
            }
          : item
      )
    );

    this.activeMutationsCount++;
    const toggleVersion = ++this.version;

    this.mutationQueue = this.mutationQueue.then(async () => {
      try {
        const res = await this.fetcher("/api/house/shopping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggle", id, isBought }),
        });

        const data = await res.json();
        if (res.status === 404) {
          // Prodotto eliminato concorrentemente da un altro coinquilino
          this.updateItems(this.items.filter((item) => item.id !== id));
          this.callbacks.onError("Questo prodotto non è più presente nella lista.");
          this.needsReconciliation = true;
          return;
        }

        if (!res.ok) {
          throw new Error(data.error || "Errore durante l'aggiornamento.");
        }

        if (toggleVersion >= this.lastCommittedVersion && this.activeMutationsCount === 1) {
          this.lastCommittedVersion = toggleVersion;
          this.updateItems(data.items || []);
          this.needsReconciliation = false;
        } else if (data.item) {
          this.updateItems(
            this.items.map((item) => (item.id === data.item.id ? data.item : item))
          );
        }
      } catch (err: any) {
        this.callbacks.onError(err.message || "Errore durante l'aggiornamento.");
        this.needsReconciliation = true;
      } finally {
        this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
        this.removePendingId(id);
        this.checkReconciliation();
      }
    });
  }

  deleteItem(id: string): void {
    if (this.pendingItemIds.has(id)) return;

    this.addPendingId(id);
    this.callbacks.onError(null);

    // Aggiornamento ottimistico immediato
    this.updateItems(this.items.filter((item) => item.id !== id));

    this.activeMutationsCount++;
    const deleteVersion = ++this.version;

    this.mutationQueue = this.mutationQueue.then(async () => {
      try {
        const res = await this.fetcher("/api/house/shopping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", id }),
        });

        const data = await res.json();
        if (res.status === 404) {
          // Già rimosso altrove da un altro coinquilino
          this.needsReconciliation = true;
          return;
        }

        if (!res.ok) {
          throw new Error(data.error || "Errore durante l'eliminazione.");
        }

        if (deleteVersion >= this.lastCommittedVersion && this.activeMutationsCount === 1) {
          this.lastCommittedVersion = deleteVersion;
          this.updateItems(data.items || []);
          this.needsReconciliation = false;
        }
      } catch (err: any) {
        this.callbacks.onError(err.message || "Errore durante l'eliminazione.");
        this.needsReconciliation = true;
      } finally {
        this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
        this.removePendingId(id);
        this.checkReconciliation();
      }
    });
  }
}
