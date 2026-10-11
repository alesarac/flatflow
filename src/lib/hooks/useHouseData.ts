"use client";

import { useEffect, useState, useCallback } from "react";
import { HouseData } from "../domain/types";

export function useHouseData() {
  const [data, setData] = useState<HouseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [myRoommateId, setMyRoommateId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/house/data", { cache: "no-store" });
      if (res.status === 401) {
        setAuthenticated(false);
        setData(null);
        setMyRoommateId(null);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Errore nel caricamento dei dati");
      }
      const json: HouseData = await res.json();
      setData(json);
      if (typeof json.myRoommateId === "number") {
        setMyRoommateId(json.myRoommateId);
      }
      setAuthenticated(true);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore di connessione";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Aggiornamento all'apertura, al ritorno sull'app e al focus
  useEffect(() => {
    fetchData();

    const onFocus = () => fetchData();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchData]);

  // Azioni pulizie
  const completeCleaning = async (taskId: string, weekKey: string, roommateId?: number) => {
    const targetRoommateId = roommateId ?? myRoommateId;
    if (targetRoommateId === null) return false;

    setSubmittingTaskId(taskId);
    setIsSubmitting(true);

    // Aggiornamento ottimistico immediato: la UI risponde a 0ms
    const targetRoommate = data?.roommates.find((r) => r.id === targetRoommateId);
    setData((prev) => {
      if (!prev || !prev.currentWeek) return prev;
      return {
        ...prev,
        currentWeek: {
          ...prev.currentWeek,
          cleanings: prev.currentWeek.cleanings.map((c) =>
            c.id === taskId
              ? {
                  ...c,
                  isCompleted: true,
                  completedAt: new Date().toISOString(),
                  completedByName: targetRoommate?.name || "Coinquilino",
                  completedBy: targetRoommateId,
                }
              : c
          ),
        },
      };
    });

    try {
      const res = await fetch("/api/house/cleanings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          taskId,
          weekKey,
          roommateId: targetRoommateId,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile completare l'attività";
        setError(msg);
        alert(msg);
        await fetchData(); // rollback
        return false;
      }

      // Applica direttamente lo stato autorevole restituito (evita la seconda richiesta di rete GET /api/house/data)
      if (resJson.week) {
        setData((prev) => (prev ? { ...prev, currentWeek: resJson.week } : prev));
      }
      return true;
    } catch {
      setError("Errore di rete durante il salvataggio.");
      await fetchData(); // rollback
      return false;
    } finally {
      setSubmittingTaskId(null);
      setIsSubmitting(false);
    }
  };

  const declineCleaning = async (taskId: string, weekKey: string, roommateId?: number) => {
    const targetRoommateId = roommateId ?? myRoommateId;
    if (targetRoommateId === null) return false;

    setSubmittingTaskId(taskId);
    setIsSubmitting(true);

    // Aggiornamento ottimistico immediato: l'area risulta subito non assegnata con rinuncia registrata
    setData((prev) => {
      if (!prev || !prev.currentWeek) return prev;
      return {
        ...prev,
        currentWeek: {
          ...prev.currentWeek,
          cleanings: prev.currentWeek.cleanings.map((c) =>
            c.id === taskId
              ? {
                  ...c,
                  assignedTo: null,
                  assignedToName: null,
                  declinedBy: c.declinedBy.includes(targetRoommateId)
                    ? c.declinedBy
                    : [...c.declinedBy, targetRoommateId],
                }
              : c
          ),
        },
      };
    });

    try {
      const res = await fetch("/api/house/cleanings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "decline",
          taskId,
          weekKey,
          roommateId: targetRoommateId,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile rinunciare all'attività";
        setError(msg);
        alert(msg);
        await fetchData(); // rollback
        return false;
      }

      if (resJson.week) {
        setData((prev) => (prev ? { ...prev, currentWeek: resJson.week } : prev));
      }
      return true;
    } catch {
      setError("Errore di rete durante la rinuncia.");
      await fetchData(); // rollback
      return false;
    } finally {
      setSubmittingTaskId(null);
      setIsSubmitting(false);
    }
  };

  const uncompleteCleaning = async (taskId: string, weekKey: string, roommateId?: number) => {
    const targetRoommateId = roommateId ?? myRoommateId;
    if (targetRoommateId === null) return false;

    setSubmittingTaskId(taskId);
    setIsSubmitting(true);

    // Aggiornamento ottimistico immediato
    setData((prev) => {
      if (!prev || !prev.currentWeek) return prev;
      return {
        ...prev,
        currentWeek: {
          ...prev.currentWeek,
          cleanings: prev.currentWeek.cleanings.map((c) =>
            c.id === taskId
              ? {
                  ...c,
                  isCompleted: false,
                  completedAt: null,
                  completedByName: null,
                  completedBy: null,
                }
              : c
          ),
        },
      };
    });

    try {
      const res = await fetch("/api/house/cleanings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "uncomplete",
          taskId,
          weekKey,
          roommateId: targetRoommateId,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile annullare il completamento dell'attività";
        setError(msg);
        alert(msg);
        await fetchData(); // rollback
        return false;
      }

      if (resJson.week) {
        setData((prev) => (prev ? { ...prev, currentWeek: resJson.week } : prev));
      }
      return true;
    } catch {
      setError("Errore di rete durante l'annullamento.");
      await fetchData(); // rollback
      return false;
    } finally {
      setSubmittingTaskId(null);
      setIsSubmitting(false);
    }
  };

  const claimCleaning = async (taskId: string, weekKey: string, roommateId?: number) => {
    const targetRoommateId = roommateId ?? myRoommateId;
    if (targetRoommateId === null) return false;

    setSubmittingTaskId(taskId);
    setIsSubmitting(true);

    // Aggiornamento ottimistico immediato
    const targetRoommate = data?.roommates.find((r) => r.id === targetRoommateId);
    setData((prev) => {
      if (!prev || !prev.currentWeek) return prev;
      return {
        ...prev,
        currentWeek: {
          ...prev.currentWeek,
          cleanings: prev.currentWeek.cleanings.map((c) =>
            c.id === taskId
              ? {
                  ...c,
                  assignedTo: targetRoommateId,
                  assignedToName: targetRoommate?.name || null,
                  declinedBy: c.declinedBy.filter((id) => id !== targetRoommateId),
                }
              : c
          ),
        },
      };
    });

    try {
      const res = await fetch("/api/house/cleanings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim",
          taskId,
          weekKey,
          roommateId: targetRoommateId,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile prendere in carico l'attività";
        setError(msg);
        alert(msg);
        await fetchData();
        return false;
      }

      if (resJson.week) {
        setData((prev) => (prev ? { ...prev, currentWeek: resJson.week } : prev));
      }
      return true;
    } catch {
      setError("Errore di rete durante la presa in carico.");
      await fetchData();
      return false;
    } finally {
      setSubmittingTaskId(null);
      setIsSubmitting(false);
    }
  };

  // Azioni spazzatura
  const reportTrashAction = async () => {
    setIsSubmitting(true);

    // Aggiornamento ottimistico immediato: mostra subito la spazzatura come aperta e piena
    setData((prev) => {
      if (!prev) return prev;
      const nextAssigned =
        prev.trashQueue && prev.trashQueue.length > 0 ? prev.trashQueue[0] : 0;
      return {
        ...prev,
        openTrashTask: {
          id: "temp_trash",
          status: "open",
          assignedTo: nextAssigned,
          declinedBy: [],
          reportedAt: new Date().toISOString(),
          completedAt: null,
          completedByName: null,
        },
      };
    });

    try {
      const res = await fetch("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report" }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Errore nella segnalazione della spazzatura";
        alert(msg);
        await fetchData();
        return false;
      }

      if (resJson.openTrashTask !== undefined && resJson.trashQueue) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                openTrashTask: resJson.openTrashTask,
                trashQueue: resJson.trashQueue,
              }
            : prev
        );
      }
      return true;
    } catch {
      alert("Errore di rete durante la segnalazione.");
      await fetchData();
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const declineTrashAction = async (roommateId?: number) => {
    const targetRoommateId = roommateId ?? myRoommateId;
    if (targetRoommateId === null) return false;

    setIsSubmitting(true);

    // Aggiornamento ottimistico immediato
    setData((prev) => {
      if (!prev || !prev.openTrashTask) return prev;
      const currentTask = prev.openTrashTask;
      const updatedDeclined = currentTask.declinedBy.includes(targetRoommateId)
        ? currentTask.declinedBy
        : [...currentTask.declinedBy, targetRoommateId];
      // Se tutti e 3 hanno rifiutato, l'assegnatario diventa null; altrimenti passa al prossimo in coda
      const nextCandidate = prev.trashQueue.find((id) => !updatedDeclined.includes(id)) ?? null;
      return {
        ...prev,
        openTrashTask: {
          ...currentTask,
          assignedTo: nextCandidate,
          declinedBy: updatedDeclined,
        },
      };
    });

    try {
      const res = await fetch("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", roommateId: targetRoommateId }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile rinunciare al turno di spazzatura";
        alert(msg);
        await fetchData();
        return false;
      }

      if (resJson.openTrashTask !== undefined && resJson.trashQueue) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                openTrashTask: resJson.openTrashTask,
                trashQueue: resJson.trashQueue,
              }
            : prev
        );
      }
      return true;
    } catch {
      alert("Errore di rete durante la rinuncia.");
      await fetchData();
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeTrashAction = async (roommateId?: number) => {
    const targetRoommateId = roommateId ?? myRoommateId;
    if (targetRoommateId === null) return false;

    setIsSubmitting(true);

    // Aggiornamento ottimistico: la spazzatura passa subito allo stato chiuso/in ordine
    setData((prev) => (prev ? { ...prev, openTrashTask: null } : prev));

    try {
      const res = await fetch("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", roommateId: targetRoommateId }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile completare la spazzatura";
        alert(msg);
        await fetchData(); // rollback
        return false;
      }

      if (resJson.trashQueue) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                openTrashTask: null,
                trashQueue: resJson.trashQueue,
              }
            : prev
        );
      }
      return true;
    } catch {
      alert("Errore di rete durante il salvataggio.");
      await fetchData(); // rollback
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const claimTrashAction = async (roommateId?: number) => {
    const targetRoommateId = roommateId ?? myRoommateId;
    if (targetRoommateId === null) return false;

    setIsSubmitting(true);

    // Aggiornamento ottimistico immediato
    setData((prev) => {
      if (!prev || !prev.openTrashTask) return prev;
      return {
        ...prev,
        openTrashTask: {
          ...prev.openTrashTask,
          assignedTo: targetRoommateId,
          declinedBy: prev.openTrashTask.declinedBy.filter((id) => id !== targetRoommateId),
        },
      };
    });

    try {
      const res = await fetch("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", roommateId: targetRoommateId }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile prendere in carico la spazzatura";
        alert(msg);
        await fetchData();
        return false;
      }

      if (resJson.openTrashTask !== undefined && resJson.trashQueue) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                openTrashTask: resJson.openTrashTask,
                trashQueue: resJson.trashQueue,
              }
            : prev
        );
      }
      return true;
    } catch {
      alert("Errore di rete durante la presa in carico.");
      await fetchData();
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Aggiornamento nome coinquilino (solo il proprio)
  const updateRoommateName = async (id: number, name: string): Promise<boolean> => {
    const trimmed = name.trim();
    // Aggiornamento ottimistico immediato
    setData((prev) =>
      prev
        ? {
            ...prev,
            roommates: prev.roommates.map((r) =>
              r.id === id ? { ...r, name: trimmed } : r
            ),
          }
        : prev
    );

    try {
      const res = await fetch("/api/house/roommates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: trimmed }),
      });

      if (!res.ok) {
        await fetchData(); // rollback
        return false;
      }
      return true;
    } catch {
      await fetchData(); // rollback
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setAuthenticated(false);
      setData(null);
      setMyRoommateId(null);
    } catch {
      //
    }
  };

  return {
    data,
    loading,
    error,
    submittingTaskId,
    isSubmitting,
    authenticated,
    myRoommateId,
    refresh: fetchData,
    completeCleaning,
    declineCleaning,
    claimCleaning,
    uncompleteCleaning,
    reportTrash: reportTrashAction,
    declineTrash: declineTrashAction,
    completeTrash: completeTrashAction,
    claimTrash: claimTrashAction,
    updateRoommateName,
    logout,
  };
}
