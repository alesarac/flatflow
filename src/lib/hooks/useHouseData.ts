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
  const [submittingCleaningIds, setSubmittingCleaningIds] = useState<Set<string>>(new Set());
  const [isTrashSubmitting, setIsTrashSubmitting] = useState(false);
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
        onSubmittingCleaningIdsChange: setSubmittingCleaningIds,
        onIsTrashSubmittingChange: setIsTrashSubmitting,
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
      onSubmittingCleaningIdsChange: setSubmittingCleaningIds,
      onIsTrashSubmittingChange: setIsTrashSubmitting,
      onIsSubmittingChange: setIsSubmitting,
    });
  });

  const fetchData = useCallback((isManual = false) => {
    controllerRef.current?.fetchData(isManual);
  }, []);

  const invalidatePendingRequests = useCallback(() => {
    controllerRef.current?.invalidatePendingRequests();
  }, []);

  // Aggiornamento all'apertura, al ritorno sull'app e al focus
  useEffect(() => {
    fetchData(false);

    const onFocus = () => fetchData(false);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchData(false);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchData]);

  const isCleaningSubmitting = useCallback(
    (taskId: string) => submittingCleaningIds.has(taskId),
    [submittingCleaningIds]
  );

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

  const undoDeclineCleaning = async (taskId: string, weekKey: string, roommateId?: number) => {
    const targetId = roommateId ?? myRoommateId;
    if (targetId === null) return false;
    return (await controllerRef.current?.undoDeclineCleaning(taskId, weekKey, targetId)) ?? false;
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
    submittingCleaningIds,
    isCleaningSubmitting,
    isTrashSubmitting,
    isSubmitting,
    authenticated,
    myRoommateId,
    refresh: () => fetchData(true),
    invalidatePendingRequests,
    resetSession: invalidatePendingRequests,
    completeCleaning,
    declineCleaning,
    undoDeclineCleaning,
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
