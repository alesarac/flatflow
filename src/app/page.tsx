"use client";

import { useState } from "react";
import { useHouseData } from "../lib/hooks/useHouseData";
import { AuthGate } from "../components/AuthGate";
import { Header } from "../components/Header";
import { Navigation, TabType } from "../components/Navigation";
import { CleaningCard } from "../components/CleaningCard";
import { TrashCard } from "../components/TrashCard";
import { HistoryView } from "../components/HistoryView";
import { SettingsView } from "../components/SettingsView";
import { ShoppingView } from "../components/ShoppingView";
import { WeekProgressCard } from "../components/WeekProgressCard";
import { Loader2, Clock } from "lucide-react";

export default function HomePage() {
  const {
    data,
    loading,
    error,
    submittingTaskId,
    isCleaningSubmitting,
    isTrashSubmitting,
    isSubmitting,
    authenticated,
    myRoommateId,
    refresh,
    invalidatePendingRequests,
    completeCleaning,
    declineCleaning,
    claimCleaning,
    uncompleteCleaning,
    reportTrash,
    declineTrash,
    completeTrash,
    claimTrash,
    updateRoommateName,
    logout,
  } = useHouseData();

  const [currentTab, setCurrentTab] = useState<TabType>("cleanings");

  // Schermata di caricamento
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-500 animate-spin" />
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Caricamento FlatLoop...</span>
      </div>
    );
  }

  // Blocco di autenticazione se non connesso o privo di profilo
  if (!authenticated || myRoommateId === null) {
    return (
      <AuthGate
        onSuccess={() => {
          invalidatePendingRequests();
          refresh();
        }}
      />
    );
  }

  const roommates = data?.roommates || [];
  const currentWeek = data?.currentWeek;
  const openTrashTask = data?.openTrashTask || null;
  const trashQueue = data?.trashQueue || [0, 1, 2];

  const activeRoommate = roommates.find((r) => r.id === myRoommateId);

  // Calcolo delle attività pendenti assegnate all'utente attivo
  let pendingDutiesCount = 0;
  if (currentWeek) {
    pendingDutiesCount += currentWeek.cleanings.filter(
      (c) => c.assignedTo === myRoommateId && !c.isCompleted
    ).length;
    if (openTrashTask && openTrashTask.assignedTo === myRoommateId) {
      pendingDutiesCount += 1;
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header activeRoommate={activeRoommate} />

      {error && (
        <div className="mx-4 mt-3 p-3 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300 rounded-2xl text-xs border">
          {error}
        </div>
      )}

      <main className="flex-1 max-w-md mx-auto w-full pb-nav-safe">
        {currentTab === "cleanings" && currentWeek && (
          <div className="p-4 space-y-5">
            {/* 1. Settimana corrente e progresso pulizie */}
            <WeekProgressCard
              weekKey={currentWeek.weekKey}
              cleanings={currentWeek.cleanings}
            />

            {/* 2. Spazzatura */}
            <section className="space-y-2.5">
              <div className="px-0.5">
                <h2 className="text-[19px] font-bold text-slate-900 dark:text-white leading-tight">
                  Spazzatura
                </h2>
              </div>
              <TrashCard
                openTask={openTrashTask}
                trashQueue={trashQueue}
                roommates={roommates}
                myRoommateId={myRoommateId}
                isSubmitting={isTrashSubmitting}
                onReport={reportTrash}
                onDecline={declineTrash}
                onComplete={(rId) => completeTrash(rId)}
                onClaim={claimTrash}
              />
            </section>

            {/* 3. Pulizie della settimana */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-0.5">
                <h2 className="text-[19px] font-bold text-slate-900 dark:text-white leading-tight">
                  Pulizie della settimana
                </h2>
                <button
                  type="button"
                  onClick={() => setCurrentTab("history")}
                  className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold text-[#4355EC] dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 active:scale-95 transition-all inline-flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  title="Apri storico attività"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Storico</span>
                </button>
              </div>

              <div className="space-y-3">
                {currentWeek.cleanings.map((task) => (
                  <CleaningCard
                    key={task.id}
                    task={task}
                    roommates={roommates}
                    myRoommateId={myRoommateId}
                    isSubmitting={isCleaningSubmitting(task.id)}
                    onComplete={(taskId) => {
                      completeCleaning(taskId, currentWeek.weekKey, myRoommateId);
                    }}
                    onDecline={(taskId, rId) => {
                      declineCleaning(taskId, currentWeek.weekKey, rId);
                    }}
                    onClaim={(taskId, rId) => {
                      claimCleaning(taskId, currentWeek.weekKey, rId);
                    }}
                    onUncomplete={(taskId) => {
                      uncompleteCleaning(taskId, currentWeek.weekKey, myRoommateId);
                    }}
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {currentTab === "shopping" && (
          <ShoppingView roommates={roommates} myRoommateId={myRoommateId} />
        )}

        {currentTab === "history" && (
          <HistoryView onBack={() => setCurrentTab("cleanings")} />
        )}

        {currentTab === "settings" && (
          <SettingsView
            roommates={roommates}
            myRoommateId={myRoommateId}
            onUpdateRoommateName={updateRoommateName}
            onLogout={logout}
          />
        )}
      </main>

      {/* Navigazione inferiore */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingCount={pendingDutiesCount}
      />
    </div>
  );
}
