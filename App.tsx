import React, { useState, useEffect, useRef } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { HomeView } from './components/HomeView';
import { LoadingView } from './components/LoadingView';
import { ItineraryView } from './components/ItineraryView';
import { ActiveTourView } from './components/ActiveTourView';
import { RecapView } from './components/RecapView';
import { Sidebar } from './components/Sidebar';
import { AppState, Tour, Checkpoint, JournalData } from './types';
import { generateItinerarySkeleton, enrichCheckpoint } from './services/gemini';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [tour, setTour] = useState<Tour | null>(null);
  const [currentCheckpointIndex, setCurrentCheckpointIndex] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [tourHistory, setTourHistory] = useState<Tour[]>([]);

  // Queue Management State
  const [priorityId, setPriorityId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isEnrichingRef = useRef(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleSearch = async (location: string) => {
    isEnrichingRef.current = false; // Reset lock to prevent deadlocks from previous sessions
    setAppState(AppState.GENERATING);
    setPriorityId(null); 
    try {
      // 1. Generate Skeleton (Fast, only titles/IDs)
      const tourData = await generateItinerarySkeleton(location);
      
      if (!tourData || !tourData.checkpoints || tourData.checkpoints.length === 0) {
          throw new Error("No checkpoints generated");
      }

      setTour(tourData);
      setAppState(AppState.ITINERARY);
      
      // Update history immediately
      setTourHistory(prev => {
        if (prev.some(t => t.locationName === tourData.locationName)) return prev;
        return [tourData, ...prev];
      });
      
    } catch (e: any) {
      console.error("Failed to generate tour", e);
      setAppState(AppState.HOME);
      setErrorMessage(e?.message || "Could not craft a tour for that location. Please verify your connection or try another destination.");
    }
  };

  // --- Priority Queue Enrichment System ---
  useEffect(() => {
    if (!tour || !tour.checkpoints) return;

    const processNextEnrichment = async () => {
      // If already working, wait for it to finish (triggered by next state update)
      if (isEnrichingRef.current) return;

      // Filter for checkpoints that still need data
      const pendingCheckpoints = tour.checkpoints.filter(cp => cp.summary === "Loading summary...");
      
      if (pendingCheckpoints.length === 0) return; // All done

      let nextCp: Checkpoint | undefined;

      // RULE 1: User Priority (User expanded this accordion)
      if (priorityId) {
        nextCp = pendingCheckpoints.find(cp => cp.id === priorityId);
      }

      // RULE 2: Prefetched Checkpoint 1 (Order 1/Index 0)
      if (!nextCp) {
        // Find the actual first checkpoint from the original list
        const firstCp = tour.checkpoints[0]; 
        if (firstCp && firstCp.summary === "Loading summary...") {
            nextCp = firstCp;
        }
      }

      // RULE 3: Ascending Order (Next available)
      if (!nextCp) {
        nextCp = pendingCheckpoints[0];
      }

      if (nextCp) {
        isEnrichingRef.current = true;
        try {
           const details = await enrichCheckpoint(tour.locationName, nextCp);
           
           setTour(prev => {
              if (!prev) return null;
              return {
                  ...prev,
                  checkpoints: prev.checkpoints.map(c => 
                      c.id === nextCp!.id ? { ...c, ...details } : c
                  )
              };
           });
           
           // If we just finished the priority ID, clear it so we fall back to standard order
           if (priorityId === nextCp.id) {
               setPriorityId(null);
           }

        } catch (err) {
           console.error(`Error enriching checkpoint ${nextCp.id}`, err);
        } finally {
           isEnrichingRef.current = false;
        }
      }
    };

    processNextEnrichment();
  }, [tour, priorityId]); // Re-run when tour updates (one finished) or priority changes (user clicked)


  const startTour = (index: number = 0) => {
    setCurrentCheckpointIndex(index);
    setAppState(AppState.ACTIVE_TOUR);
  };

  const handleCheckpointUpdate = (checkpointId: number, data: Partial<Checkpoint>) => {
    setTour(prev => {
      if (!prev) return null;
      return {
        ...prev,
        checkpoints: prev.checkpoints.map(cp => {
          if (cp.id === checkpointId) {
            return { ...cp, ...data };
          }
          return cp;
        })
      };
    });
  };

  const endTour = () => {
    setAppState(AppState.RECAP);
  };

  const handleJournalSave = (data: JournalData) => {
    if (!tour) return;
    
    const updatedTour = { ...tour, journalData: data };
    setTour(updatedTour);
    
    // Update history
    setTourHistory(prev => prev.map(t => 
        t.locationName === updatedTour.locationName ? updatedTour : t
    ));
  };

  const goHome = () => {
    isEnrichingRef.current = false; // Reset lock
    setAppState(AppState.HOME);
    setTour(null);
    setPriorityId(null);
  };
  
  const handleHistorySelect = (historyTour: Tour) => {
    isEnrichingRef.current = false;
    setTour(historyTour);
    setAppState(AppState.ITINERARY);
  };
  
  const goToItinerary = () => {
     setAppState(AppState.ITINERARY);
  };

  const viewJournal = () => {
      setAppState(AppState.RECAP);
  };

  // Called when user expands an accordion in ItineraryView
  const handleCheckpointOpen = (id: number) => {
     setPriorityId(id);
  };

  // Common Menu Button Component
  const MenuButton = ({ colorClass = "text-[#2D2738]" }) => (
    <button 
      onClick={toggleSidebar} 
      className={`absolute top-4 left-4 z-[60] p-2.5 rounded-full bg-[#FFECB6] border-2 border-[#2D2738] shadow-[2px_2px_0px_0px_#2D2738] hover:bg-[#FFD1DC] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer ${colorClass}`}
      title="Open Menu"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );

  return (
    <div className="w-full h-screen overflow-hidden text-[#2c2420] relative">
      <SpeedInsights />
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        onNewJourney={goHome}
        appState={appState}
        currentTour={tour}
        tourHistory={tourHistory}
        onSelectHistory={handleHistorySelect}
        currentCheckpointIndex={currentCheckpointIndex}
        onCheckpointSelect={(idx) => {
          setCurrentCheckpointIndex(idx);
          setAppState(AppState.ACTIVE_TOUR);
        }}
        onViewItinerary={goToItinerary}
      />
      
      {appState === AppState.HOME && (
        <>
          <MenuButton />
          <HomeView onSearch={handleSearch} />
        </>
      )}
      
      {appState === AppState.GENERATING && <LoadingView />}
      
      {appState === AppState.ITINERARY && tour && (
        <>
          <MenuButton colorClass="text-[#2D2738]" />
          <ItineraryView 
            tour={tour} 
            onStartTour={startTour} 
            onViewJournal={viewJournal}
            onCheckpointOpen={handleCheckpointOpen}
          />
        </>
      )}
      
      {appState === AppState.ACTIVE_TOUR && tour && (
        <>
          <MenuButton />
          <ActiveTourView 
            tour={tour} 
            currentIndex={currentCheckpointIndex}
            setIndex={setCurrentCheckpointIndex}
            onEndTour={endTour} 
            onCheckpointUpdate={handleCheckpointUpdate}
          />
        </>
      )}
      
      {appState === AppState.RECAP && tour && (
        <>
          <MenuButton />
          <RecapView 
            tour={tour} 
            onClose={goToItinerary} 
            onSaveJournal={handleJournalSave}
          />
        </>
      )}

      {errorMessage && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[70] max-w-md w-11/12 bg-[#8c2f1b] text-[#f0ebe0] p-4 rounded shadow-2xl border border-[#2c2420] flex items-center justify-between gap-3">
          <span className="font-serif text-base">{errorMessage}</span>
          <button 
            onClick={() => setErrorMessage(null)} 
            className="text-xs uppercase font-display px-2 py-1 bg-black/20 hover:bg-black/40 rounded transition"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

export default App;