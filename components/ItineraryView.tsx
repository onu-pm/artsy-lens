import React, { useState, useEffect, useRef } from 'react';
import { Tour } from '../types';

interface ItineraryViewProps {
  tour: Tour;
  onStartTour: (index?: number) => void;
  onViewJournal?: () => void;
  onCheckpointOpen?: (id: number) => void;
}

export const ItineraryView: React.FC<ItineraryViewProps> = ({ tour, onStartTour, onViewJournal, onCheckpointOpen }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const hasAutoOpened = useRef(false);

  // Auto-expand the first checkpoint when its summary is loaded
  useEffect(() => {
    // If the tour is completed (journal data exists), do not auto-open anything.
    if (tour.journalData) return;

    if (tour.checkpoints && tour.checkpoints.length > 0) {
      const firstCp = tour.checkpoints[0];
      
      // Check if it is enriched: 
      // 1. Not "Loading summary..."
      // 2. Not the failure message "Information currently unavailable."
      const isLoaded = firstCp.summary !== "Loading summary...";
      const isFailed = firstCp.summary === "Information currently unavailable.";
      
      if (isLoaded && !isFailed && !hasAutoOpened.current) {
        setExpandedId(firstCp.id);
        hasAutoOpened.current = true;
      }
    }
  }, [tour]);

  const toggleAccordion = (id: number) => {
      // Mark as interacted so auto-opener doesn't steal focus later if a background task finishes
      hasAutoOpened.current = true;
      
      const newExpandedId = expandedId === id ? null : id;
      setExpandedId(newExpandedId);
      
      // If opening (not closing) and we have a callback, notify parent to prioritize enrichment
      if (newExpandedId !== null && onCheckpointOpen) {
          onCheckpointOpen(id);
      }
  };

  return (
    <div className="h-full w-full relative bg-transparent overflow-hidden flex flex-col">
      {/* Unified Scrollable Container covering entire viewport */}
      <div className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth p-0 md:p-6">
        
        <div className="max-w-6xl mx-auto md:grid md:grid-cols-12 min-h-full md:border-2 md:border-[#2D2738] md:rounded-3xl overflow-hidden shadow-2xl">
          
          {/* Left Column: Header & Summary (Sticky on Desktop) */}
          <div className="md:col-span-5 bg-[#FFECB6]/95 backdrop-blur-md relative z-10 border-b-2 md:border-b-0 md:border-r-2 border-[#2D2738]/20 flex flex-col">
            <div className="md:sticky md:top-0 md:h-screen md:overflow-y-auto no-scrollbar flex flex-col justify-center p-8 md:p-10 min-h-[45vh]">
              
              {/* Content */}
              <div className="relative z-10 text-center md:text-left space-y-5">
                 <div className="inline-block">
                    <span className="px-3 py-1 bg-[#FFD1DC] text-[#2D2738] text-xs font-bold uppercase tracking-wider rounded-full border border-[#2D2738]/30 shadow-xs">
                      🎨 Cultural Itinerary
                    </span>
                 </div>
                 
                 <h2 className="text-4xl md:text-6xl font-bold text-[#2D2738] leading-tight tracking-tight break-words">
                   {tour.locationName}
                 </h2>
                 
                 <div className="flex items-center justify-center md:justify-start gap-4 text-[#2D2738]/50 my-3">
                     <div className="h-0.5 bg-[#2D2738]/30 w-12"></div>
                     <span className="text-sm font-bold text-[#2D2738]/70">Curated by ArtsyLens</span>
                     <div className="h-0.5 bg-[#2D2738]/30 w-12"></div>
                 </div>

                 <p className="text-lg md:text-xl text-[#2D2738]/85 leading-relaxed bg-white/50 p-4 rounded-2xl border border-[#2D2738]/15">
                  "{tour.description}"
                 </p>
                 
                 {/* Decorative stamps */}
                 <div className="mt-4 flex justify-center md:justify-start gap-3">
                    <span className="px-3 py-1.5 bg-[#B5EAD7] border border-[#2D2738] rounded-full text-xs font-bold text-[#2D2738] shadow-xs">
                      ✨ {tour.checkpoints.length} Checkpoints
                    </span>
                    <span className="px-3 py-1.5 bg-[#C7CEEA] border border-[#2D2738] rounded-full text-xs font-bold text-[#2D2738] shadow-xs">
                      🚶 Self-Paced Tour
                    </span>
                 </div>
                 
                 {tour.journalData && (
                     <div className="mt-6 bg-[#B5EAD7]/70 p-4 border border-[#2D2738] rounded-2xl text-left shadow-xs">
                        <div className="flex items-center gap-2 text-[#2D2738] font-bold uppercase text-xs tracking-wider mb-1">
                            <svg className="w-4 h-4 text-[#2D2738]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Tour Completed
                        </div>
                        <p className="text-sm text-[#2D2738]/80">
                            Your journal for this location has been saved!
                        </p>
                     </div>
                 )}
              </div>

            </div>
          </div>

          {/* Right Column: Timeline */}
          <div className="md:col-span-7 bg-white/90 backdrop-blur-md p-6 md:p-10 pb-32">
             <div className="relative space-y-0 max-w-3xl mx-auto">
                {/* Dashed Path Line */}
                <div className="absolute left-[15px] top-4 bottom-4 w-0.5 border-l-2 border-dashed border-[#2D2738]/25"></div>

                {tour.checkpoints.map((cp, idx) => {
                  const isLoading = cp.summary === "Loading summary...";
                  
                  return (
                    <div key={cp.id} className="relative pl-12 pb-8 last:pb-0">
                      {/* Map Marker */}
                      <div 
                        className={`absolute left-0 top-1 h-8 w-8 rounded-full border-2 border-[#2D2738] z-10 flex items-center justify-center transition-all duration-300 shadow-sm ${
                          expandedId === cp.id ? 'bg-[#FFD1DC] text-[#2D2738] scale-110 font-bold' : 'bg-[#FFECB6] text-[#2D2738]'
                        }`}
                      >
                         <span className="text-sm font-bold">{idx + 1}</span>
                      </div>
                      
                      <div className="flex flex-col">
                        <button 
                          onClick={() => toggleAccordion(cp.id)}
                          className="text-left group focus:outline-none"
                        >
                          <div className="flex items-center justify-between border-b-2 border-[#2D2738]/10 pb-4 pt-1 pr-2 hover:bg-[#FFECB6]/30 transition-colors rounded-xl pl-2 -ml-2">
                            <h3 className={`text-xl md:text-2xl font-bold transition-colors ${expandedId === cp.id ? 'text-[#2D2738]' : 'text-[#2D2738] group-hover:text-[#2D2738]/70'}`}>
                              {cp.title}
                            </h3>
                            {/* Chevron Icon */}
                            <svg 
                              className={`w-6 h-6 text-[#2D2738] transform transition-transform duration-300 ${expandedId === cp.id ? 'rotate-180' : ''}`} 
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {/* Expanded Content */}
                        <div 
                          className={`grid transition-all duration-500 ease-in-out ${
                            expandedId === cp.id ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div className="bg-[#FFECB6]/40 p-6 md:p-7 border-2 border-[#2D2738] shadow-md relative rounded-2xl">
                              {/* Pastel Tape Visual */}
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 bg-[#C7CEEA] border border-[#2D2738] text-[10px] font-bold rounded-full shadow-xs">
                                Stop #{idx + 1}
                              </div>

                              {isLoading ? (
                                  <div className="space-y-3 animate-pulse">
                                      <div className="h-4 bg-[#2D2738]/15 rounded-full w-full"></div>
                                      <div className="h-4 bg-[#2D2738]/15 rounded-full w-5/6"></div>
                                      <div className="h-4 bg-[#2D2738]/15 rounded-full w-4/6"></div>
                                  </div>
                              ) : (
                                  <p className="text-[#2D2738] text-base md:text-lg leading-relaxed mb-6">
                                    {cp.summary}
                                  </p>
                              )}
                              
                              <div className="mb-6 p-4 bg-[#B5EAD7]/50 border border-[#2D2738]/20 rounded-xl min-h-[90px]">
                                 <h4 className="text-base font-bold text-[#2D2738] mb-2 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-[#2D2738]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    Things to spot:
                                 </h4>
                                 {cp.lookFor && cp.lookFor.length > 0 ? (
                                     <ul className="space-y-1.5 text-sm md:text-base text-[#2D2738]/90">
                                       {cp.lookFor.map((item, i) => (
                                         <li key={i} className="flex items-start gap-2">
                                           <span className="mt-1 w-2 h-2 rounded-full bg-[#2D2738] shrink-0"></span>
                                           <span>{item}</span>
                                         </li>
                                       ))}
                                     </ul>
                                 ) : (
                                     <div className="space-y-2 animate-pulse">
                                         <div className="h-3 bg-[#2D2738]/20 rounded-full w-3/4"></div>
                                         <div className="h-3 bg-[#2D2738]/20 rounded-full w-2/3"></div>
                                     </div>
                                 )}
                              </div>

                              <button 
                                 disabled={isLoading}
                                 onClick={(e) => {
                                     e.stopPropagation();
                                     if(onStartTour) onStartTour(idx);
                                 }}
                                 className="w-full py-3 px-6 rounded-full border-2 border-[#2D2738] bg-[#FFD1DC] hover:bg-[#B5EAD7] text-[#2D2738] font-bold text-sm flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0px_0px_#2D2738] hover:shadow-[1px_1px_0px_0px_#2D2738] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
                              >
                                 <span>{isLoading ? "Preparing Guide..." : "Open Interactive Guide"}</span>
                                 {!isLoading && <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
          
        </div>
      </div>

      {/* Fixed Footer CTA */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none p-4 pb-6 bg-gradient-to-t from-[#FFECB6] via-[#FFECB6]/90 to-transparent z-30 flex justify-center">
        {tour.journalData && onViewJournal ? (
            <button 
              onClick={onViewJournal}
              className="pointer-events-auto bg-[#FFD1DC] text-[#2D2738] font-bold text-base py-3.5 px-8 rounded-full shadow-[3px_3px_0px_0px_#2D2738] hover:shadow-[1px_1px_0px_0px_#2D2738] hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-[#B5EAD7] transition-all flex items-center gap-3 border-2 border-[#2D2738]"
            >
              <span>📖 Open Travel Journal</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                 <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
            </button>
        ) : (
            <button 
              onClick={() => onStartTour(0)}
              className="pointer-events-auto bg-[#B5EAD7] text-[#2D2738] font-bold text-base py-3.5 px-8 rounded-full shadow-[3px_3px_0px_0px_#2D2738] hover:shadow-[1px_1px_0px_0px_#2D2738] hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-[#FFD1DC] transition-all flex items-center gap-3 border-2 border-[#2D2738] cursor-pointer"
            >
              <span>Start Walking Tour 🚀</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
        )}
      </div>
    </div>
  );
};