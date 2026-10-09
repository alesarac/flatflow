"use client";

import { useState } from "react";
import { useHouseData } from "../lib/hooks/useHouseData";
import { AuthGate } from "../components/AuthGate";
import { Header } from "../components/Header";
import { Navigation, TabType } from "../components/Navigation";
import { RoommatePickerModal } from "../components/RoommatePickerModal";
import { AbsenceBanner } from "../components/AbsenceBanner";
import { CleaningCard } from "../components/CleaningCard";
import { TrashCard } from "../components/TrashCard";
import { HistoryView } from "../components/HistoryView";
import { SettingsView } from "../components/SettingsView";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const {
    data,
    loading,
    authenticated,
    myRoommateId,
    setMyRoommateId,
    refresh,
    completeCleaning,
    declineCleaning,
    toggleAbsence,
    reportTrash,
    declineTrash,
    completeTrash,
    claimTrash,
    updateRoommateName,
    logout,
  } = useHouseData();

  const [currentTab, setCurrentTab] = useState<TabType>("home");
  const [showPickerModal, setShowPickerModal] = useState(false);

  // Loading screen
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="text-xs text-slate-400 font-medium">Caricamento Flatflow...</span>
      </div>
    );
  }

  // Auth gate if not authenticated
  if (!authenticated) {
    return <AuthGate onSuccess={refresh} />;
  }

  // When data is loaded
  const roommates = data?.roommates || [];
  const currentWeek = data?.currentWeek;
  const openTrashTask = data?.openTrashTask || null;
  const trashQueue = data?.trashQueue || [0, 1, 2];

  const activeRoommate =
    myRoommateId !== null ? roommates.find((r) => r.id === myRoommateId) : undefined;

  // Calculate pending duties assigned to the current user
  let pendingDutiesCount = 0;
  if (myRoommateId !== null && currentWeek) {
    // Uncompleted cleanings assigned to me
    pendingDutiesCount += currentWeek.cleanings.filter(
      (c) => c.assignedTo === myRoommateId && !c.isCompleted
    ).length;
    // Open trash assigned to me
    if (openTrashTask && openTrashTask.assignedTo === myRoommateId) {
      pendingDutiesCount += 1;
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        weekLabel={currentWeek?.label}
        activeRoommate={activeRoommate}
        onOpenPicker={() => setShowPickerModal(true)}
      />

      <div className="flex-1">
        {currentTab === "home" && currentWeek && (
          <div className="p-4 space-y-5">
            {/* 1. Presenze settimana */}
            <AbsenceBanner
              roommates={roommates}
              absentRoommates={currentWeek.absentRoommates}
              myRoommateId={myRoommateId}
              onToggleAbsence={(rId, isAbsent) =>
                toggleAbsence(currentWeek.weekKey, rId, isAbsent)
              }
              onOpenPicker={() => setShowPickerModal(true)}
            />

            {/* 2. Spazzatura */}
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Gestione Spazzatura
                </h2>
              </div>
              <TrashCard
                openTask={openTrashTask}
                trashQueue={trashQueue}
                roommates={roommates}
                myRoommateId={myRoommateId}
                onReport={reportTrash}
                onDecline={declineTrash}
                onComplete={(rId) => {
                  const name =
                    roommates.find((r) => r.id === rId)?.name ||
                    activeRoommate?.name ||
                    "Coinquilino";
                  completeTrash(rId, name);
                }}
                onClaim={claimTrash}
              />
            </section>

            {/* 3. Pulizie della settimana */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Pulizie della Settimana
                </h2>
                <span className="text-[11px] text-slate-500">
                  {currentWeek.cleanings.filter((c) => c.isCompleted).length} su 3 fatte
                </span>
              </div>

              <div className="space-y-3">
                {currentWeek.cleanings.map((task) => (
                  <CleaningCard
                    key={task.id}
                    task={task}
                    roommates={roommates}
                    myRoommateId={myRoommateId}
                    onComplete={(taskId) => {
                      const name = activeRoommate?.name || "Coinquilino";
                      completeCleaning(taskId, currentWeek.weekKey, name);
                    }}
                    onDecline={(taskId, rId) =>
                      declineCleaning(taskId, currentWeek.weekKey, rId)
                    }
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
      </div>

      {/* Identity Picker Modal */}
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

      {/* Navigation */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingCount={pendingDutiesCount}
      />
    </div>
  );
}
