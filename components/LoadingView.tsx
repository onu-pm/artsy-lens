import React, { useState, useEffect } from 'react';

const PROCESS_STEPS = [
  "Consulting the Archives (Gathering History)...",
  "Charting the Optimal Path...",
  "Curating Visible Landmarks...",
  "Binding Your Travel Journal..."
];

export const LoadingView: React.FC = () => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev < PROCESS_STEPS.length - 1 ? prev + 1 : prev));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full w-full relative bg-transparent overflow-hidden flex flex-col items-center justify-center p-6">
      
      {/* Foreground Loading Card */}
      <div className="relative z-10 max-w-lg w-full bg-[#FFECB6]/95 backdrop-blur-md p-8 md:p-10 border-2 border-[#2D2738] rounded-3xl shadow-2xl flex flex-col items-center text-center">
          
          <div className="px-3.5 py-1 bg-[#C7CEEA] border border-[#2D2738] text-[11px] font-bold text-[#2D2738] uppercase tracking-wider rounded-full shadow-xs mb-6">
            ✨ ArtsyLens AI Guide
          </div>

          {/* Gears Animation */}
          <div className="relative w-28 h-28 mb-6">
             {/* Big Gear */}
             <div className="absolute inset-0">
                <svg viewBox="0 0 24 24" className="w-full h-full text-[#C7CEEA] animate-spin" style={{ animationDuration: '8s' }}>
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                  <path fill="currentColor" d="M21.9 10.2c-.2-1.2-.7-2.3-1.4-3.3l-2.3.8c-.5-.7-1.2-1.3-1.9-1.8l.8-2.3c-1-1-2.4-1.6-3.8-1.7V4.5c-.9.1-1.8.4-2.6.9l-1.5-2c-1.3.6-2.4 1.5-3.2 2.7l1.9 1.6c-.4.8-.6 1.7-.7 2.6H4.5c.1 1.4.7 2.7 1.6 3.8l2.3-.8c.7.5 1.4 1 2.2 1.3l-.8 2.3c1 1 2.3 1.7 3.7 2v-2.5c.9-.1 1.8-.4 2.6-.9l1.5 2c1.3-.6 2.4-1.5 3.2-2.7l-1.9-1.6c.4-.8.6-1.7.7-2.6h2.8zM12 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" opacity="0.9"/>
                </svg>
             </div>
             {/* Small Gear */}
             <div className="absolute -bottom-3 -right-3 w-16 h-16">
                <svg viewBox="0 0 24 24" className="w-full h-full text-[#FFD1DC] animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}>
                   <path fill="currentColor" d="M21.9 10.2c-.2-1.2-.7-2.3-1.4-3.3l-2.3.8c-.5-.7-1.2-1.3-1.9-1.8l.8-2.3c-1-1-2.4-1.6-3.8-1.7V4.5c-.9.1-1.8.4-2.6.9l-1.5-2c-1.3.6-2.4 1.5-3.2 2.7l1.9 1.6c-.4.8-.6 1.7-.7 2.6H4.5c.1 1.4.7 2.7 1.6 3.8l2.3-.8c.7.5 1.4 1 2.2 1.3l-.8 2.3c1 1 2.3 1.7 3.7 2v-2.5c.9-.1 1.8-.4 2.6-.9l1.5 2c1.3-.6 2.4-1.5 3.2-2.7l-1.9-1.6c.4-.8.6-1.7.7-2.6h2.8zM12 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/>
                </svg>
             </div>
          </div>

          <div className="max-w-sm text-center">
             <h2 className="text-xl md:text-2xl font-bold text-[#2D2738] mb-2 tracking-wide animate-fade-in">
               {PROCESS_STEPS[stepIndex]}
             </h2>
             <div className="w-36 h-2 bg-white/70 border border-[#2D2738]/20 mx-auto rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-[#B5EAD7] border-r border-[#2D2738] animate-progress"></div>
             </div>
          </div>

      </div>
      
      <style>{`
        @keyframes progress-slide {
            0% { width: 0%; transform: translateX(-100%); }
            50% { width: 50%; }
            100% { width: 100%; transform: translateX(100%); }
        }
        .animate-progress {
            animation: progress-slide 2s infinite linear;
        }
      `}</style>
    </div>
  );
};
