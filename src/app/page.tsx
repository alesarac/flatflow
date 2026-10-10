"use client";

import { useState } from "react";
import { useHouseData } from "../lib/hooks/useHouseData";
import { AuthGate } from "../components/AuthGate";
import { Header } from "../components/Header";
import { Navigation, TabType } from "../components/Navigation";
import { RoommatePickerModal } from "../components/RoommatePickerModal";
import { CleaningCard } from "../components/CleaningCard";
import { TrashCard } from "../components/TrashCard";
import { HistoryView } from "../components/HistoryView";
import { SettingsView } from "../components/SettingsView";
import { WeekProgressCard } from "../components/WeekProgressCard";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const {
    data,
    loading,
    error,
    submittingTaskId,
    isSubmitting,
    authenticated,
    myRoommateId,
    setMyRoommateId,
    refresh,
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

  const [currentTab, setCurrentTab] = useState<TabType>("home");
  const [showPickerModal, setShowPickerModal] = useState(false);

  // Schermata di caricamento
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-500 animate-spin" />
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Caricamento Flatflow...</span>
      </div>
    );
  }

  // Blocco di autenticazione se non connesso
  if (!authenticated) {
    return <AuthGate onSuccess={refresh} />;
  }

  const roommates = data?.roommates || [];
  const currentWeek = data?.currentWeek;
  const openTrashTask = data?.openTrashTask || null;
  const trashQueue = data?.trashQueue || [0, 1, 2];

  const activeRoommate =
    myRoommateId !== null ? roommates.find((r) => r.id === myRoommateId) : undefined;

  // Calcolo delle attività pendenti assegnate all'utente attivo
  let pendingDutiesCount = 0;
  if (myRoommateId !== null && currentWeek) {
    pendingDutiesCount += currentWeek.cleanings.filter(
      (c) => c.assignedTo === myRoommateId && !c.isCompleted
    ).length;
    if (openTrashTask && openTrashTask.assignedTo === myRoommateId) {
      pendingDutiesCount += 1;
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        activeRoommate={activeRoommate}
        onOpenPicker={() => setShowPickerModal(true)}
      />

      {error && (
        <div className="mx-4 mt-3 p-3 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300 rounded-2xl text-xs border">
          {error}
        </div>
      )}

      <main className="flex-1 max-w-md mx-auto w-full pb-nav-safe">
        {currentTab === "home" && currentWeek && (
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
                isSubmitting={isSubmitting}
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
              </div>

              <div className="space-y-3">
                {currentWeek.cleanings.map((task) => (
                  <CleaningCard
                    key={task.id}
                    task={task}
                    roommates={roommates}
                    myRoommateId={myRoommateId}
                    isSubmitting={isSubmitting || submittingTaskId === task.id}
                    onComplete={(taskId) => {
                      if (myRoommateId !== null) {
                        completeCleaning(taskId, currentWeek.weekKey, myRoommateId);
                      } else {
                        setShowPickerModal(true);
                      }
                    }}
                    onDecline={(taskId, rId) =>
                      declineCleaning(taskId, currentWeek.weekKey, rId)
                    }
                    onClaim={(taskId, rId) => {
                      if (myRoommateId !== null) {
                        claimCleaning(taskId, currentWeek.weekKey, rId);
                      } else {
                        setShowPickerModal(true);
                      }
                    }}
                    onUncomplete={(taskId) => {
                      if (myRoommateId !== null) {
                        uncompleteCleaning(taskId, currentWeek.weekKey, myRoommateId);
                      } else {
                        setShowPickerModal(true);
                      }
                    }}
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {currentTab === "history" && <HistoryView />}

        {currentTab === "settings" && (
          <SettingsView
            roommates={roommates}
            myRoommateId={myRoommateId}
            onSelectMyId={setMyRoommateId}
            onUpdateRoommateName={updateRoommateName}
            onLogout={logout}
          />
        )}
      </main>

      {/* Modale selezione identità */}
      {(showPickerModal || (myRoommateId === null && roommates.length > 0)) && (
        <RoommatePickerModal
          roommates={roommates}
          currentId={myRoommateId}
          onSelect={(id) => {
            setMyRoommateId(id);
            setShowPickerModal(false);
          }}
          onClose={myRoommateId !== null ? () => setShowPickerModal(false) : undefined}
        />
      )}

      {/* Navigazione inferiore */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingCount={pendingDutiesCount}
      />
    </div>
  );
}
