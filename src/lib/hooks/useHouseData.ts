"use client";

import { useEffect, useState, useCallback } from "react";
import { HouseData, Roommate } from "../domain/types";

const LOCAL_STORAGE_KEY = "flatflow_my_roommate_id";

export function useHouseData() {
  const [data, setData] = useState<HouseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [myRoommateId, setMyRoommateIdState] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load saved roommate ID from localStorage
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
      // ignore localStorage errors
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
        throw new Error("Errore nel caricamento dei dati");
      }
      const json: HouseData = await res.json();
      setData(json);
      setAuthenticated(true);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore sconosciuto";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check auth and initial fetch
  useEffect(() => {
    fetchData();

    // Re-fetch on focus and visibilitychange
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

  // Cleanings actions
  const completeCleaning = async (taskId: string, weekKey: string, roommateName: string) => {
    try {
      const res = await fetch("/api/house/cleanings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          taskId,
          weekKey,
          roommateName,
        }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      //
    }
  };

  const declineCleaning = async (taskId: string, weekKey: string, roommateId: number) => {
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
      if (res.ok) {
        await fetchData();
      }
    } catch {
      //
    }
  };

  const toggleAbsence = async (weekKey: string, roommateId: number, isAbsent: boolean) => {
    try {
      const res = await fetch("/api/house/cleanings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_absence",
          weekKey,
          roommateId,
          isAbsent,
        }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      //
    }
  };

  // Trash actions
  const reportTrashAction = async () => {
    try {
      const res = await fetch("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report" }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Errore nella segnalazione");
      }
    } catch {
      //
    }
  };

  const declineTrashAction = async (roommateId: number) => {
    try {
      const res = await fetch("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", roommateId }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      //
    }
  };

  const completeTrashAction = async (roommateId: number, roommateName: string) => {
    try {
      const res = await fetch("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", roommateId, roommateName }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      //
    }
  };

  const claimTrashAction = async (roommateId: number) => {
    try {
      const res = await fetch("/api/house/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", roommateId }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      //
    }
  };

  // Update roommate name
  const updateRoommateName = async (id: number, name: string) => {
    try {
      const res = await fetch("/api/house/roommates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });
      if (res.ok) {
        await fetchData();
        return true;
      }
      return false;
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
    authenticated,
    myRoommateId,
    setMyRoommateId,
    refresh: fetchData,
    completeCleaning,
    declineCleaning,
    toggleAbsence,
    reportTrash: reportTrashAction,
    declineTrash: declineTrashAction,
    completeTrash: completeTrashAction,
    claimTrash: claimTrashAction,
    updateRoommateName,
    logout,
  };
}
