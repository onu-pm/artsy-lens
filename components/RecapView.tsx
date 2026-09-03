import React, { useEffect, useState } from 'react';
import { Tour, Checkpoint, JournalData } from '../types';
import { generateTourRecap } from '../services/gemini';

interface RecapViewProps {
  tour: Tour;
  onClose: () => void;
  onSaveJournal: (data: JournalData) => void;
}

// Gear SVG for loading
const SmallGearLoader = () => (
  <div className="relative w-16 h-16 mx-auto mb-2">
     <div className="absolute inset-0">
        <svg viewBox="0 0 24 24" className="w-full h-full text-[#C7CEEA] animate-spin" style={{ animationDuration: '4s' }}>
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path fill="currentColor" d="M21.9 10.2c-.2-1.2-.7-2.3-1.4-3.3l-2.3.8c-.5-.7-1.2-1.3-1.9-1.8l.8-2.3c-1-1-2.4-1.6-3.8-1.7V4.5c-.9.1-1.8.4-2.6.9l-1.5-2c-1.3.6-2.4 1.5-3.2 2.7l1.9 1.6c-.4.8-.6 1.7-.7 2.6H4.5c.1 1.4.7 2.7 1.6 3.8l2.3-.8c.7.5 1.4 1 2.2 1.3l-.8 2.3c1 1 2.3 1.7 3.7 2v-2.5c.9-.1 1.8-.4 2.6-.9l1.5 2c1.3-.6 2.4-1.5 3.2-2.7l-1.9-1.6c.4-.8.6-1.7.7-2.6h2.8zM12 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" opacity="0.9"/>
        </svg>
     </div>
     <div className="absolute -bottom-2 -right-2 w-10 h-10">
        <svg viewBox="0 0 24 24" className="w-full h-full text-[#FFD1DC] animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}>
           <path fill="currentColor" d="M21.9 10.2c-.2-1.2-.7-2.3-1.4-3.3l-2.3.8c-.5-.7-1.2-1.3-1.9-1.8l.8-2.3c-1-1-2.4-1.6-3.8-1.7V4.5c-.9.1-1.8.4-2.6.9l-1.5-2c-1.3.6-2.4 1.5-3.2 2.7l1.9 1.6c-.4.8-.6 1.7-.7 2.6H4.5c.1 1.4.7 2.7 1.6 3.8l2.3-.8c.7.5 1.4 1 2.2 1.3l-.8 2.3c1 1 2.3 1.7 3.7 2v-2.5c.9-.1 1.8-.4 2.6-.9l1.5 2c1.3-.6 2.4-1.5 3.2-2.7l-1.9-1.6c.4-.8.6-1.7.7-2.6h2.8zM12 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/>
        </svg>
     </div>
  </div>
);

const PastelConfetti: React.FC = () => {
  const [particles, setParticles] = useState<Array<{id: number, left: number, delay: number, color: string}>>([]);
  useEffect(() => {
    const colors = ['#FFD1DC', '#FFECB6', '#B5EAD7', '#C7CEEA'];
    const newParticles = Array.from({ length: 35 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0 w-3 h-5 opacity-0 animate-fall rounded-sm border border-[#2D2738]/20"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: '3s',
            transform: `rotate(${Math.random() * 360}deg)`
          }}
        />
      ))}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        .animate-fall { animation-name: fall; animation-timing-function: ease-in; animation-fill-mode: forwards; }
        @keyframes stamp-bounce {
           0% { transform: scale(2); opacity: 0; }
           60% { transform: scale(0.9); opacity: 1; }
           100% { transform: scale(1); opacity: 1; }
        }
        .animate-stamp { animation: stamp-bounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}</style>
    </div>
  );
};

export const RecapView: React.FC<RecapViewProps> = ({ tour, onClose, onSaveJournal }) => {
  const [data, setData] = useState<JournalData | null>(null);
  const [viewMode, setViewMode] = useState<'gratification' | 'journal'>('gratification');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (tour.journalData) {
        setData(tour.journalData);
    } else {
        generateTourRecap(tour.locationName, tour.checkpoints).then(newData => {
            setData(newData);
            onSaveJournal(newData);
        });
    }
  }, [tour, onSaveJournal]);

  // Screen 1: Gratification
  if (viewMode === 'gratification') {
      return (
          <div className="h-full w-full bg-transparent relative overflow-y-auto custom-scrollbar">
               <PastelConfetti />

               {/* Container */}
               <div className="min-h-full w-full flex flex-col items-center justify-center p-6 md:p-12 relative z-10">
                   <div className="relative max-w-2xl w-full bg-[#FFECB6]/95 backdrop-blur-md p-8 md:p-12 shadow-2xl border-2 border-[#2D2738] rounded-3xl text-center transform transition-all duration-700 animate-fade-in my-8">

                       <div className="mb-6 relative inline-block">
                           <div className="w-20 h-20 mx-auto bg-[#B5EAD7] text-[#2D2738] rounded-full flex items-center justify-center shadow-lg border-2 border-[#2D2738] animate-stamp relative z-10">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-[#2D2738]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                               </svg>
                           </div>
                           <div className="absolute inset-0 bg-[#FFD1DC] rounded-full opacity-60 animate-ping" style={{ animationDuration: '2s' }}></div>
                       </div>

                       <h1 className="text-3xl md:text-5xl font-bold text-[#2D2738] mb-2 tracking-tight">Journey Complete! 🎉</h1>
                       <p className="text-lg md:text-xl text-[#2D2738]/80 mb-6">Exploration of {tour.locationName}</p>
                       <div className="h-0.5 w-24 bg-[#2D2738]/20 mx-auto mb-6"></div>

                       <div className="grid grid-cols-2 gap-4 mb-6 text-[#2D2738] max-w-sm mx-auto">
                            <div className="p-4 bg-white/70 border-2 border-[#2D2738] rounded-2xl flex flex-col items-center shadow-xs">
                                <span className="text-[11px] font-bold tracking-wider uppercase text-[#2D2738]/60 mb-1">Checkpoints</span>
                                <span className="text-3xl font-bold text-[#2D2738]">{tour.checkpoints.length}</span>
                            </div>
                            <div className="p-4 bg-white/70 border-2 border-[#2D2738] rounded-2xl flex flex-col items-center shadow-xs">
                                <span className="text-[11px] font-bold tracking-wider uppercase text-[#2D2738]/60 mb-1">Status</span>
                                <span className="text-xl font-bold text-[#2D2738] mt-1">Logged ✨</span>
                            </div>
                       </div>

                       <div className="min-h-[80px] mb-6 flex items-center justify-center">
                           {data ? (
                               <div className="animate-fade-in space-y-2 bg-white/60 p-4 rounded-2xl border border-[#2D2738]/15">
                                   <p className="text-base md:text-lg text-[#2D2738] leading-relaxed max-w-md mx-auto">"{data.summary}"</p>
                               </div>
                           ) : (
                               <div className="flex flex-col items-center gap-2 opacity-80">
                                  <SmallGearLoader />
                                  <span className="text-[#2D2738] text-sm font-bold animate-pulse">Binding your ArtsyLens journal pages...</span>
                               </div>
                           )}
                       </div>

                       <p className="text-[#2D2738]/80 text-base mb-8">Your travel log has been updated with sketches, observations, and memories.</p>

                       <button 
                           onClick={() => setViewMode('journal')}
                           className="w-full md:w-auto px-8 py-3.5 bg-[#FFD1DC] hover:bg-[#B5EAD7] text-[#2D2738] font-bold rounded-full border-2 border-[#2D2738] text-base flex items-center justify-center gap-3 mx-auto shadow-[3px_3px_0px_0px_#2D2738] hover:shadow-[1px_1px_0px_0px_#2D2738] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
                       >
                           <span>📖 Open Artsy Travel Journal</span>
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                           </svg>
                       </button>

                   </div>
               </div>
          </div>
      );
  }

  // Screen 2: Travel Journal
  const checkpoints = tour.checkpoints;

  return (
    <div className="h-full w-full bg-transparent text-[#2D2738] flex flex-col overflow-hidden relative md:p-6">
      <div className="flex-1 max-w-5xl mx-auto w-full md:border-2 md:border-[#2D2738] md:rounded-3xl overflow-hidden shadow-2xl bg-white/95 backdrop-blur-md flex flex-col">
        <div className="p-6 bg-[#FFECB6] border-b-2 border-[#2D2738]/20 shadow-xs flex flex-col items-center text-center relative">
            <span className="text-[11px] font-bold tracking-wider text-[#2D2738] uppercase px-3 py-0.5 bg-[#FFD1DC] rounded-full border border-[#2D2738] mb-2">🎨 Artsy Travel Journal</span>
            <h1 className="text-3xl md:text-5xl font-bold text-[#2D2738] mb-2">{tour.locationName}</h1>
            <p className="max-w-2xl text-sm md:text-base text-[#2D2738]/85 leading-relaxed">
            {data ? data.journalStory : "Ink is drying..."}
            </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
            <div className="max-w-4xl mx-auto pb-16 space-y-10">
            {checkpoints.map((cp, idx) => {
                const hasImage = cp.annotatedImages && cp.annotatedImages.length > 0;
                const displayImage = hasImage ? cp.annotatedImages![cp.annotatedImages!.length - 1] : null;
                const isEven = idx % 2 === 0;

                return (
                <div key={cp.id} className={`flex flex-col md:flex-row gap-6 md:gap-8 relative items-center ${isEven ? 'md:flex-row-reverse' : ''}`}>
                    <div className="flex-1 w-full">
                        <div className="relative p-6 bg-[#FFECB6]/30 rounded-2xl shadow-sm border-2 border-[#2D2738]">
                            <div className="flex justify-between items-baseline mb-3 border-b-2 border-[#2D2738]/10 pb-2">
                                <h3 className="text-xl md:text-2xl font-bold text-[#2D2738]">{cp.title}</h3>
                                <span className="font-bold text-[#2D2738] px-2.5 py-0.5 bg-[#C7CEEA] border border-[#2D2738] rounded-full text-xs">Stop #{idx + 1}</span>
                            </div>
                            {data && data.entries[cp.id] ? (
                                <p className="text-base text-[#2D2738]/90 leading-relaxed animate-fade-in">{data.entries[cp.id]}</p>
                            ) : (
                                <p className="text-base text-[#2D2738]/50 italic animate-pulse">Scribbling notes...</p>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 flex justify-center items-center w-full">
                        {displayImage ? (
                            <div className="bg-white p-3 rounded-2xl shadow-lg border-2 border-[#2D2738] max-w-sm w-full relative cursor-zoom-in group" onClick={() => setSelectedImage(displayImage)}>
                                <div className="aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden">
                                    <img src={displayImage} alt="Sketch" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                </div>
                                <div className="mt-2 text-center text-[#2D2738] font-bold text-xs">Figure {idx + 1}: Landmark Sketch</div>
                            </div>
                        ) : (
                            <div className="w-44 h-28 border-2 border-dashed border-[#2D2738]/30 rounded-2xl flex flex-col items-center justify-center bg-white/40">
                                <span className="text-2xl mb-1">🖼️</span>
                                <span className="text-[#2D2738]/50 font-bold text-xs">No Visual Added</span>
                            </div>
                        )}
                    </div>
                </div>
                );
            })}
            </div>
        </div>

        <div className="p-4 bg-[#FFECB6] border-t-2 border-[#2D2738]/20 flex justify-center z-20 shrink-0">
          <button onClick={onClose} className="py-2.5 px-8 rounded-full border-2 border-[#2D2738] bg-[#B5EAD7] hover:bg-[#FFD1DC] text-[#2D2738] font-bold text-sm shadow-[2px_2px_0px_0px_#2D2738] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer">
            Close Journal
          </button>
        </div>
      </div>

      {selectedImage && (
            <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedImage(null)}>
                <button onClick={() => setSelectedImage(null)} className="absolute top-6 right-6 text-white/80 hover:text-white transition-colors z-[110] p-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                <div className="relative p-2 bg-white rounded-2xl shadow-2xl max-w-full max-h-[80vh] border-2 border-[#2D2738]" onClick={(e) => e.stopPropagation()}>
                    <img src={selectedImage} alt="Full screen" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
                </div>
                <button onClick={(e) => {
                        e.stopPropagation();
                        const link = document.createElement('a');
                        link.href = selectedImage!;
                        link.download = `artsylens-sketch-${Date.now()}.png`;
                        link.click();
                    }} className="mt-6 bg-[#B5EAD7] text-[#2D2738] border-2 border-[#2D2738] px-6 py-2.5 rounded-full text-sm font-bold shadow-lg hover:bg-[#FFD1DC] transition-colors flex items-center gap-2 z-[110] cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4 4m4 4V4" /></svg>
                    Download Sketch
                </button>
            </div>
      )}
    </div>
  );
};
