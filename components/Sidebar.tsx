import React from 'react';
import { Tour, AppState } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewJourney: () => void;
  appState: AppState;
  currentTour: Tour | null;
  tourHistory: Tour[];
  onSelectHistory: (tour: Tour) => void;
  currentCheckpointIndex: number;
  onCheckpointSelect: (index: number) => void;
  onViewItinerary: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  onNewJourney,
  appState,
  currentTour,
  tourHistory,
  onSelectHistory,
  currentCheckpointIndex,
  onCheckpointSelect,
  onViewItinerary
}) => {
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar Panel */}
      <div className={`fixed inset-y-0 left-0 w-80 bg-[#2D2738] text-[#FFECB6] z-50 transform transition-transform duration-300 ease-out shadow-2xl flex flex-col border-r-2 border-[#C7CEEA]/40 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header */}
        <div className="p-6 border-b border-[#C7CEEA]/20 flex items-center justify-between bg-[#241F2D]">
          <div>
            <span className="font-bold text-xs tracking-[0.2em] text-[#FFD1DC] uppercase">ArtsyLens</span>
            <h2 className="text-2xl font-bold mt-1 text-[#FFECB6]">Travel Journals</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-[#FFECB6]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          
          {/* Section: Current Journey (Only if active) */}
          {currentTour && (appState === AppState.ACTIVE_TOUR || appState === AppState.ITINERARY) && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-2 mb-4 text-[#B5EAD7]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <h3 className="text-sm uppercase tracking-widest font-bold">Current Expedition</h3>
              </div>
              
              <div className="bg-[#C7CEEA]/10 rounded-2xl p-4 border border-[#C7CEEA]/30">
                <h4 className="text-xl font-bold mb-4 text-[#FFD1DC]">{currentTour.locationName}</h4>
                
                <button 
                  onClick={() => { onViewItinerary(); onClose(); }}
                  className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl transition-all mb-2 font-bold ${appState === AppState.ITINERARY ? 'bg-[#FFD1DC] text-[#2D2738] shadow-sm' : 'hover:bg-white/10 text-[#FFECB6]'}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  <span className="text-sm">Full Itinerary Plan</span>
                </button>

                <div className="h-px bg-[#C7CEEA]/20 my-3"></div>

                <div className="space-y-1">
                  {currentTour.checkpoints.map((cp, idx) => (
                    <button
                      key={cp.id}
                      onClick={() => { onCheckpointSelect(idx); onClose(); }}
                      className={`w-full text-left flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                         appState === AppState.ACTIVE_TOUR && currentCheckpointIndex === idx 
                         ? 'bg-[#B5EAD7] text-[#2D2738] font-bold shadow-sm' 
                         : 'hover:bg-white/10 text-[#FFECB6]/80'
                      }`}
                    >
                      <span className="text-xs mt-0.5 opacity-70">#{idx + 1}</span>
                      <span className="text-sm truncate">{cp.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section: History */}
          {tourHistory.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4 text-[#C7CEEA]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <h3 className="text-sm uppercase tracking-widest font-bold">Past Journeys</h3>
              </div>
              
              <div className="space-y-2">
                {tourHistory.map((historyTour, i) => (
                   <button
                     key={i}
                     onClick={() => { onSelectHistory(historyTour); onClose(); }}
                     className="w-full text-left group"
                   >
                     <div className="p-3 rounded-xl border border-[#C7CEEA]/20 hover:border-[#FFD1DC] hover:bg-white/5 transition-all">
                        <div className="flex justify-between items-center mb-1">
                           <span className="font-bold text-[#FFECB6] group-hover:text-[#FFD1DC] transition-colors">{historyTour.locationName}</span>
                        </div>
                        <p className="text-xs text-[#FFECB6]/60 truncate">
                          {historyTour.checkpoints.length} stops • {historyTour.description.substring(0, 30)}...
                        </p>
                     </div>
                   </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#C7CEEA]/20 bg-[#241F2D]">
          <button 
            onClick={() => { onNewJourney(); onClose(); }}
            className="w-full py-3 rounded-full border-2 border-[#B5EAD7] bg-[#B5EAD7] text-[#2D2738] font-bold uppercase tracking-wider text-xs hover:bg-[#FFD1DC] hover:border-[#FFD1DC] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Start New Journey
          </button>
        </div>
      </div>
    </>
  );
};