"use client";

import { useEffect, useState, useCallback } from "react";
import { HouseData } from "../domain/types";

const LOCAL_STORAGE_KEY = "flatflow_my_roommate_id";

export function useHouseData() {
  const [data, setData] = useState<HouseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [myRoommateId, setMyRoommateIdState] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carica il profilo salvato da localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved !== null && saved !== "") {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 2) {
          setMyRoommateIdState(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const setMyRoommateId = useCallback((id: number | null) => {
    setMyRoommateIdState(id);
    try {
      if (id === null) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } else {
        localStorage.setItem(LOCAL_STORAGE_KEY, id.toString());
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/house/data", { cache: "no-store" });
      if (res.status === 401) {
        setAuthenticated(false);
        setData(null);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Errore nel caricamento dei dati");
      }
      const json: HouseData = await res.json();
      setData(json);
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
  const completeCleaning = async (taskId: string, weekKey: string, roommateId: number) => {
    setSubmittingTaskId(taskId);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/house/cleanings", {
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
        setError(msg);
        alert(msg);
        await fetchData();
        return false;
      }

      await fetchData();
      return true;
    } catch {
      setError("Errore di rete durante il salvataggio.");
      return false;
    } finally {
      setSubmittingTaskId(null);
      setIsSubmitting(false);
    }
  };

  const declineCleaning = async (taskId: string, weekKey: string, roommateId: number) => {
    setSubmittingTaskId(taskId);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/house/cleanings", {
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
        setError(msg);
        alert(msg);
        await fetchData();
        return false;
      }

      await fetchData();
      return true;
    } catch {
      setError("Errore di rete durante la rinuncia.");
      return false;
    } finally {
      setSubmittingTaskId(null);
      setIsSubmitting(false);
    }
  };

  const uncompleteCleaning = async (taskId: string, weekKey: string, roommateId: number) => {
    setSubmittingTaskId(taskId);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/house/cleanings", {
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
        setError(msg);
        alert(msg);
        await fetchData();
        return false;
      }

      await fetchData();
      return true;
    } catch {
      setError("Errore di rete durante l'annullamento.");
      return false;
    } finally {
      setSubmittingTaskId(null);
      setIsSubmitting(false);
    }
  };

  const claimCleaning = async (taskId: string, weekKey: string, roommateId: number) => {
    setSubmittingTaskId(taskId);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/house/cleanings", {
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
        setError(msg);
        alert(msg);
        await fetchData();
        return false;
      }

      await fetchData();
      return true;
    } catch {
      setError("Errore di rete durante la presa in carico.");
      return false;
    } finally {
      setSubmittingTaskId(null);
      setIsSubmitting(false);
    }
  };

  // Azioni spazzatura
  const reportTrashAction = async () => {
    setIsSubmitting(true);
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
        return false;
      }

      await fetchData();
      return true;
    } catch {
      alert("Errore di rete durante la segnalazione.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const declineTrashAction = async (roommateId: number) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", roommateId }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile rinunciare al turno di spazzatura";
        alert(msg);
        return false;
      }

      await fetchData();
      return true;
    } catch {
      alert("Errore di rete durante la rinuncia.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeTrashAction = async (roommateId: number) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", roommateId }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile completare la spazzatura";
        alert(msg);
        return false;
      }

      await fetchData();
      return true;
    } catch {
      alert("Errore di rete durante il salvataggio.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const claimTrashAction = async (roommateId: number) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", roommateId }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        const msg = resJson.error || "Impossibile prendere in carico la spazzatura";
        alert(msg);
        return false;
      }

      await fetchData();
      return true;
    } catch {
      alert("Errore di rete durante la presa in carico.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Aggiornamento nome coinquilino
  const updateRoommateName = async (id: number, name: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/house/roommates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });

      if (!res.ok) {
        return false;
      }
      await fetchData();
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setAuthenticated(false);
      setData(null);
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
    setMyRoommateId,
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
