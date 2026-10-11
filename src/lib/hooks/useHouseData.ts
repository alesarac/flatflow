"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { HouseData } from "../domain/types";
import { HouseDataSyncController } from "../domain/houseDataSync";

export function useHouseData() {
  const [data, setData] = useState<HouseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const myRoommateId =
    data && typeof data.myRoommateId === "number" ? data.myRoommateId : null;

  const controllerRef = useRef<HouseDataSyncController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new HouseDataSyncController({
      callbacks: {
        onDataChange: setData,
        onLoadingChange: setLoading,
        onError: setError,
        onAuthenticatedChange: setAuthenticated,
        onSubmittingTaskIdChange: setSubmittingTaskId,
        onIsSubmittingChange: setIsSubmitting,
      },
    });
  }

  // Mantieni aggiornati i callback React nel controller
  useEffect(() => {
    controllerRef.current?.setCallbacks({
      onDataChange: setData,
      onLoadingChange: setLoading,
      onError: setError,
      onAuthenticatedChange: setAuthenticated,
      onSubmittingTaskIdChange: setSubmittingTaskId,
      onIsSubmittingChange: setIsSubmitting,
    });
  });

  const fetchData = useCallback(() => {
    controllerRef.current?.fetchData();
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
    const targetId = roommateId ?? myRoommateId;
    if (targetId === null) return false;
    return (await controllerRef.current?.completeCleaning(taskId, weekKey, targetId)) ?? false;
  };

  const declineCleaning = async (taskId: string, weekKey: string, roommateId?: number) => {
    const targetId = roommateId ?? myRoommateId;
    if (targetId === null) return false;
    return (await controllerRef.current?.declineCleaning(taskId, weekKey, targetId)) ?? false;
  };

  const uncompleteCleaning = async (taskId: string, weekKey: string, roommateId?: number) => {
    const targetId = roommateId ?? myRoommateId;
    if (targetId === null) return false;
    return (await controllerRef.current?.uncompleteCleaning(taskId, weekKey, targetId)) ?? false;
  };

  const claimCleaning = async (taskId: string, weekKey: string, roommateId?: number) => {
    const targetId = roommateId ?? myRoommateId;
    if (targetId === null) return false;
    return (await controllerRef.current?.claimCleaning(taskId, weekKey, targetId)) ?? false;
  };

  // Azioni spazzatura
  const reportTrashAction = async () => {
    return (await controllerRef.current?.reportTrash()) ?? false;
  };

  const declineTrashAction = async (roommateId?: number) => {
    const targetId = roommateId ?? myRoommateId;
    if (targetId === null) return false;
    return (await controllerRef.current?.declineTrash(targetId)) ?? false;
  };

  const completeTrashAction = async (roommateId?: number) => {
    const targetId = roommateId ?? myRoommateId;
    if (targetId === null) return false;
    return (await controllerRef.current?.completeTrash(targetId)) ?? false;
  };

  const claimTrashAction = async (roommateId?: number) => {
    const targetId = roommateId ?? myRoommateId;
    if (targetId === null) return false;
    return (await controllerRef.current?.claimTrash(targetId)) ?? false;
  };

  // Aggiornamento nome coinquilino (solo il proprio)
  const updateRoommateName = async (id: number, name: string): Promise<boolean> => {
    return (await controllerRef.current?.updateRoommateName(id, name)) ?? false;
  };

  const logout = async () => {
    await controllerRef.current?.logout();
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
