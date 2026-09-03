import React, { useState } from 'react';

interface HomeViewProps {
  onSearch: (location: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onSearch }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) onSearch(input);
  };

  const quickPicks = [
    { name: 'The Louvre', color: 'bg-[#FFD1DC] hover:bg-[#FFD1DC]/80' },
    { name: 'Rome', color: 'bg-[#B5EAD7] hover:bg-[#B5EAD7]/80' },
    { name: 'Kyoto', color: 'bg-[#C7CEEA] hover:bg-[#C7CEEA]/80' },
    { name: 'Taj Mahal', color: 'bg-[#FFECB6] hover:bg-[#FFECB6]/80' },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-4 md:p-8 relative overflow-hidden">
      {/* Vincent van Gogh Mosaic Artwork Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <picture>
          <source media="(min-width: 768px)" srcSet="/van_gogh_mosaic.jpg" />
          <img 
            src="/van_gogh_mosaic_portrait.jpg" 
            alt="Vincent van Gogh Masterpiece Mosaic Background" 
            className="w-full h-full object-cover object-center transform scale-[1.01]"
            referrerPolicy="no-referrer"
          />
        </picture>
        {/* Soft Contrast Tint Overlay for pristine text readability */}
        <div className="absolute inset-0 bg-[#2D2738]/25 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2D2738]/50 via-transparent to-[#2D2738]/35" />
      </div>

      {/* Decorative Frame */}
      <div className="absolute inset-3 md:inset-5 border-2 border-white/35 pointer-events-none rounded-3xl z-10 hidden sm:block"></div>
      
      {/* Compass Detail */}
      <div className="absolute -bottom-20 -right-20 opacity-20 pointer-events-none animate-compass text-[#FFECB6] z-0">
        <svg width="400" height="400" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
           <circle cx="50" cy="50" r="45" />
           <circle cx="50" cy="50" r="30" />
           <path d="M50 5 L50 95 M5 50 L95 50" />
           <path d="M50 5 L60 40 L95 50 L60 60 L50 95 L40 60 L5 50 L40 40 Z" fill="currentColor" opacity="0.3"/>
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center text-center space-y-6 my-auto">
        
        <div className="space-y-2">
           <span className="inline-block px-4 py-1 bg-[#FFD1DC] text-[#2D2738] text-xs font-bold uppercase tracking-wider rounded-full border-2 border-[#2D2738] shadow-[2px_2px_0px_0px_#2D2738]">
             ✨ Your AI Tour Companion
           </span>
           <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]">
             ArtsyLens
           </h1>
           <p className="text-xl md:text-2xl font-bold text-[#FFECB6] drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
             The Virtual Cultural & Art Guide
           </p>
        </div>

        <div className="w-full max-w-md bg-[#FFECB6]/95 backdrop-blur-md p-7 md:p-8 border-2 border-[#2D2738] rounded-3xl shadow-[6px_6px_0px_0px_rgba(45,39,56,0.6)] relative">
          {/* Pastel badge tape */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#C7CEEA] border-2 border-[#2D2738] text-[11px] font-bold text-[#2D2738] rounded-full shadow-[2px_2px_0px_0px_#2D2738]">
            ✨ Plan Any Destination
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 mt-2">
            <div className="relative text-left">
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#2D2738]">
                Where would you like to explore?
              </label>
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. The Louvre, Florence, Kyoto, Barcelona..."
                className="w-full bg-white/80 border-2 border-[#2D2738] rounded-xl px-4 py-3 text-lg text-[#2D2738] placeholder-[#2D2738]/50 focus:outline-none focus:ring-2 focus:ring-[#C7CEEA] focus:border-[#2D2738] transition-all"
              />
              
              <div className="flex flex-wrap gap-2 pt-3">
                {quickPicks.map((dest) => (
                  <button
                    key={dest.name}
                    type="button"
                    onClick={() => {
                      setInput(dest.name);
                      onSearch(dest.name);
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border-2 border-[#2D2738] text-[#2D2738] font-bold shadow-[1px_1px_0px_0px_#2D2738] transition-transform active:scale-95 ${dest.color}`}
                  >
                    + {dest.name}
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              type="submit"
              disabled={!input.trim()}
              className="w-full py-4 text-lg font-bold rounded-full border-2 border-[#2D2738] bg-[#B5EAD7] hover:bg-[#FFD1DC] text-[#2D2738] shadow-[3px_3px_0px_0px_#2D2738] hover:shadow-[1px_1px_0px_0px_#2D2738] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              Start Exploring 🧭
            </button>
          </form>
        </div>
        
        <p className="text-sm font-bold text-[#2D2738] bg-[#FFD1DC] px-5 py-2 rounded-full border-2 border-[#2D2738] shadow-[2px_2px_0px_0px_#2D2738]">
          🎨 "Every work of art is a world waiting to be discovered."
        </p>
      </div>
    </div>
  );
};
