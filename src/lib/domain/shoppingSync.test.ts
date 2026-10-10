import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShoppingSyncController } from "./shoppingSync";
import { ShoppingItem } from "./types";

describe("ShoppingSyncController Concurrency & Reconciliation", () => {
  const itemA: ShoppingItem = {
    id: "item-a",
    name: "Latte",
    isBought: false,
    addedBy: 0,
    addedByName: "Coinquilino 1",
    createdAt: "2026-10-10T10:00:00.000Z",
    boughtBy: null,
    boughtByName: null,
    boughtAt: null,
  };

  const itemB: ShoppingItem = {
    id: "item-b",
    name: "Caffè",
    isBought: false,
    addedBy: 1,
    addedByName: "Coinquilino 2",
    createdAt: "2026-10-10T10:05:00.000Z",
    boughtBy: null,
    boughtByName: null,
    boughtAt: null,
  };

  let itemsHistory: ShoppingItem[][];
  let errorHistory: (string | null)[];
  let pendingHistory: Set<string>[];

  beforeEach(() => {
    itemsHistory = [];
    errorHistory = [];
    pendingHistory = [];
  });

  function createController(fetcherMock: any, initialItems: ShoppingItem[] = [itemA, itemB]) {
    return new ShoppingSyncController({
      initialItems,
      onItemsChange: (items) => itemsHistory.push(items),
      onError: (err) => errorHistory.push(err),
      onPendingItemIdsChange: (ids) => pendingHistory.push(new Set(ids)),
      fetcher: fetcherMock,
    });
  }

  it("drops out-of-order stale fetch responses if a newer state was already committed", async () => {
    let resolveFirstFetch!: (val: any) => void;
    const firstFetchPromise = new Promise((res) => {
      resolveFirstFetch = res;
    });

    const mockFetcher = vi.fn().mockImplementation((url: string, init?: any) => {
      if (url === "/api/house/shopping" && (!init || !init.method)) {
        // Primo fetch lento
        return firstFetchPromise;
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          item: { ...itemA, isBought: true },
          items: [{ ...itemA, isBought: true }, itemB],
        }),
      });
    });

    const controller = createController(mockFetcher, [itemA, itemB]);

    // 1. Avvia primo fetch lento
    const fetch1 = controller.fetchItems();

    // 2. Nel frattempo l'utente esegue una mutazione (toggle itemA)
    controller.toggleItem(itemA.id, true, 0, "Coinquilino 1");

    // Aspetta che la mutazione completi
    await new Promise((r) => setTimeout(r, 10));

    // L'elemento itemA deve essere comprato nello stato
    expect(controller.getItems().find((i) => i.id === "item-a")?.isBought).toBe(true);

    // 3. Ora finalmente risponde il primo fetch lento con lo stato vecchio (itemA non comprato)
    resolveFirstFetch({
      ok: true,
      json: async () => ({ items: [itemA, itemB] }),
    });
    await fetch1;

    // Verifica fondamentale: la risposta obsoleta fuori ordine NON deve sovrascrivere lo stato più recente
    expect(controller.getItems().find((i) => i.id === "item-a")?.isBought).toBe(true);
  });

  it("preserves optimistic updates when multiple rapid mutations occur and avoids redundant refetches", async () => {
    let fetchCalls = 0;
    const mockFetcher = vi.fn().mockImplementation((url: string, init?: any) => {
      if (url === "/api/house/shopping" && (!init || !init.method)) {
        fetchCalls++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [itemA, itemB] }),
        });
      }

      const body = JSON.parse(init.body);
      if (body.action === "toggle" && body.id === "item-a") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            item: { ...itemA, isBought: true },
            items: [{ ...itemA, isBought: true }, itemB],
          }),
        });
      }

      if (body.action === "toggle" && body.id === "item-b") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            item: { ...itemB, isBought: true },
            items: [
              { ...itemA, isBought: true },
              { ...itemB, isBought: true },
            ],
          }),
        });
      }

      return Promise.reject(new Error("Unknown route"));
    });

    const controller = createController(mockFetcher, [itemA, itemB]);

    // L'utente clicca rapidamente toggle sia su itemA che su itemB
    controller.toggleItem(itemA.id, true, 0, "Coinquilino 1");
    controller.toggleItem(itemB.id, true, 1, "Coinquilino 2");

    // Immediatamente entrambi risultano optimisticamente completati
    expect(controller.getItems().find((i) => i.id === "item-a")?.isBought).toBe(true);
    expect(controller.getItems().find((i) => i.id === "item-b")?.isBought).toBe(true);

    // Attendiamo lo svuotamento della coda
    await new Promise((r) => setTimeout(r, 20));

    // Entrambi sono completati sul server
    expect(controller.getItems().find((i) => i.id === "item-a")?.isBought).toBe(true);
    expect(controller.getItems().find((i) => i.id === "item-b")?.isBought).toBe(true);

    // Evita refetch inutili: fetchCalls deve essere 0 perché la risposta dell'ultima mutazione conteneva già la lista autorevole
    expect(fetchCalls).toBe(0);
    expect(controller.getActiveMutationsCount()).toBe(0);
  });

  it("reconciles state with server when a single mutation fails due to network error", async () => {
    let getItemsCalled = false;
    const mockFetcher = vi.fn().mockImplementation((url: string, init?: any) => {
      if (url === "/api/house/shopping" && (!init || !init.method)) {
        getItemsCalled = true;
        // Restituisce lo stato reale del server: itemA NON è comprato
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [itemA, itemB] }),
        });
      }

      // La mutazione POST fallisce con errore di rete
      return Promise.reject(new Error("Network connection lost"));
    });

    const controller = createController(mockFetcher, [itemA, itemB]);

    // Mutazione ottimistica
    controller.toggleItem(itemA.id, true, 0, "Coinquilino 1");
    expect(controller.getItems().find((i) => i.id === "item-a")?.isBought).toBe(true);

    // Aspetta lo svuotamento della coda e la riconciliazione automatica
    await new Promise((r) => setTimeout(r, 20));

    // La riconciliazione automatica con il server è stata eseguita
    expect(getItemsCalled).toBe(true);
    // Lo stato è stato riconciliato tornando non comprato
    expect(controller.getItems().find((i) => i.id === "item-a")?.isBought).toBe(false);
    expect(errorHistory).toContain("Network connection lost");
  });

  it("handles first mutation failing while second mutation is queued: does not lose second optimistic update and reconciles", async () => {
    const mockFetcher = vi.fn().mockImplementation((url: string, init?: any) => {
      const body = JSON.parse(init.body);
      if (body.action === "toggle" && body.id === "item-a") {
        // La prima mutazione fallisce sul server (500)
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "Errore interno server su item-a" }),
        });
      }

      if (body.action === "toggle" && body.id === "item-b") {
        // La seconda mutazione ha successo: sul server itemA è non comprato, itemB è comprato
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            item: { ...itemB, isBought: true },
            items: [
              { ...itemA, isBought: false },
              { ...itemB, isBought: true },
            ],
          }),
        });
      }

      return Promise.reject(new Error("Unknown route"));
    });

    const controller = createController(mockFetcher, [itemA, itemB]);

    // Mutazioni rapide in coda
    controller.toggleItem(itemA.id, true, 0, "Coinquilino 1");
    controller.toggleItem(itemB.id, true, 1, "Coinquilino 2");

    // Entrambe ottimisticamente attive
    expect(controller.getItems().find((i) => i.id === "item-a")?.isBought).toBe(true);
    expect(controller.getItems().find((i) => i.id === "item-b")?.isBought).toBe(true);

    // Aspetta elaborazione
    await new Promise((r) => setTimeout(r, 20));

    // itemA è tornato non comprato (perché la prima mutazione è fallita), itemB è rimasto comprato
    expect(controller.getItems().find((i) => i.id === "item-a")?.isBought).toBe(false);
    expect(controller.getItems().find((i) => i.id === "item-b")?.isBought).toBe(true);
    expect(errorHistory).toContain("Errore interno server su item-a");
  });

  it("handles 404 on deleted item: removes item, reports notice, and reconciles when queue drains", async () => {
    let getItemsCalled = false;
    const mockFetcher = vi.fn().mockImplementation((url: string, init?: any) => {
      if (url === "/api/house/shopping" && (!init || !init.method)) {
        getItemsCalled = true;
        // Sul server itemA non esiste più
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [itemB] }),
        });
      }

      const body = JSON.parse(init.body);
      if (body.action === "toggle" && body.id === "item-a") {
        return Promise.resolve({
          status: 404,
          ok: false,
          json: async () => ({ error: "Prodotto non trovato." }),
        });
      }

      return Promise.reject(new Error("Unknown route"));
    });

    const controller = createController(mockFetcher, [itemA, itemB]);

    controller.toggleItem(itemA.id, true, 0, "Coinquilino 1");

    await new Promise((r) => setTimeout(r, 20));

    expect(getItemsCalled).toBe(true);
    expect(controller.getItems().find((i) => i.id === "item-a")).toBeUndefined();
    expect(controller.getItems().find((i) => i.id === "item-b")).toBeDefined();
    expect(errorHistory).toContain("Questo prodotto non è più presente nella lista.");
  });

  it("defers fetchItems arriving while mutations are active, and reconciles after queue drains if mutations fail", async () => {
    let getCalls = 0;
    const mockFetcher = vi.fn().mockImplementation((url: string, init?: any) => {
      if (url === "/api/house/shopping" && (!init || !init.method)) {
        getCalls++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [itemA, itemB] }),
        });
      }

      // La mutazione fallisce
      return Promise.resolve({
        ok: false,
        json: async () => ({ error: "Errore DB" }),
      });
    });

    const controller = createController(mockFetcher, [itemA, itemB]);

    // 1. Avvia mutazione
    controller.toggleItem(itemA.id, true, 0, "Coinquilino 1");

    // 2. Durante la mutazione arriva un fetchItems (ad es. da focus / visibilitychange)
    controller.fetchItems(false);

    // Aspetta che la coda si svuoti
    await new Promise((r) => setTimeout(r, 20));

    // Il fetch posticipato ha riconciliato lo stato
    expect(getCalls).toBeGreaterThanOrEqual(1);
    expect(controller.getItems().find((i) => i.id === "item-a")?.isBought).toBe(false);
  });
});
