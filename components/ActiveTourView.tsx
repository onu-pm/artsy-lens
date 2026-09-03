import React, { useState, useEffect, useRef } from 'react';
import { Tour, ChatMessage, Checkpoint } from '../types';
import { sendChatMessage, analyzeCheckpointImage, generateAnnotatedImage } from '../services/gemini';

// --- Helper Components ---

const FormattedText: React.FC<{ text: string; isUser: boolean }> = ({ text, isUser }) => {
  if (!text) return null;
  const fontClass = isUser ? "text-base md:text-lg text-[#2D2738]" : "text-base md:text-lg text-[#2D2738]";

  return (
    <div className={`p-4 leading-relaxed flex flex-col gap-2 ${fontClass}`}>
      {text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />; 
        const parseLine = (content: string) => content.split(/(\*\*.*?\*\*)/g).map((part, j) => 
              part.startsWith('**') && part.endsWith('**') 
              ? <span key={j} className="font-bold text-[#2D2738] bg-[#FFD1DC]/60 px-1 rounded">{part.slice(2, -2)}</span> 
              : part
           );
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
           return <div key={i} className="flex gap-2 pl-2"><span className="text-[#2D2738] font-bold">•</span><span>{parseLine(trimmed.substring(2))}</span></div>;
        }
        return <div key={i}>{parseLine(trimmed)}</div>;
      })}
    </div>
  );
};

const ChatGearLoader = () => (
  <div className="flex items-center gap-3 pl-1 py-2 opacity-90">
     <div className="relative w-6 h-6">
        <svg viewBox="0 0 24 24" className="w-full h-full text-[#C7CEEA] animate-spin" style={{ animationDuration: '2s' }}><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path fill="currentColor" d="M21.9 10.2c-.2-1.2-.7-2.3-1.4-3.3l-2.3.8c-.5-.7-1.2-1.3-1.9-1.8l.8-2.3c-1-1-2.4-1.6-3.8-1.7V4.5c-.9.1-1.8.4-2.6.9l-1.5-2c-1.3.6-2.4 1.5-3.2 2.7l1.9 1.6c-.4.8-.6 1.7-.7 2.6H4.5c.1 1.4.7 2.7 1.6 3.8l2.3-.8c.7.5 1.4 1 2.2 1.3l-.8 2.3c1 1 2.3 1.7 3.7 2v-2.5c.9-.1 1.8-.4 2.6-.9l1.5 2c1.3-.6 2.4-1.5 3.2-2.7l-1.9-1.6c.4-.8.6-1.7.7-2.6h2.8zM12 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/></svg>
     </div>
     <span className="text-xs italic text-[#2D2738]/70">ArtsyLens is thinking...</span>
  </div>
);

interface CheckpointSession {
  messages: ChatMessage[];
  hasVisited: boolean;
  suggestions: string[];
  lastUploadedImage: string | null;
  annotationPromise?: Promise<string | undefined> | null;
}

interface ActiveTourViewProps {
  tour: Tour;
  onEndTour: () => void;
  onCheckpointUpdate?: (id: number, data: Partial<Checkpoint>) => void;
  currentIndex: number;
  setIndex: (index: number) => void;
}

export const ActiveTourView: React.FC<ActiveTourViewProps> = ({ 
  tour, 
  onEndTour, 
  onCheckpointUpdate, 
  currentIndex, 
  setIndex 
}) => {
  const [showOverlay, setShowOverlay] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastUploadedImageRef = useRef<string | null>(null);
  const preloadedAnnotationRef = useRef<Promise<string | undefined> | null>(null);
  const sessionCache = useRef<Map<number, CheckpointSession>>(new Map());
  
  const currentCheckpoint = tour.checkpoints[currentIndex];

  // Initialize or Restore Session
  useEffect(() => {
    const checkpointId = currentCheckpoint.id;
    let session = sessionCache.current.get(checkpointId);

    if (!session) {
        // Construct detailed welcome message based on itinerary data
        let welcomeText = `Welcome to **${currentCheckpoint.title}**.`;
        
        if (currentCheckpoint.lookFor && currentCheckpoint.lookFor.length > 0 && currentCheckpoint.lookFor[0] !== "Details unavailable") {
            welcomeText += `\n\nHere are a few things to observe:\n${currentCheckpoint.lookFor.map(item => `* ${item}`).join('\n')}`;
        }
        
        welcomeText += `\n\nFeel free to snap a photo 📸 for me to analyze, or ask me any questions about what you see!`;

        const initialMessages: ChatMessage[] = [{
            id: 'init',
            role: 'model',
            text: welcomeText
        }];
        
        session = {
            messages: initialMessages,
            hasVisited: false,
            suggestions: currentCheckpoint.suggestedQuestions || [],
            lastUploadedImage: null,
            annotationPromise: null
        };
        sessionCache.current.set(checkpointId, session);
    }

    setMessages(session.messages);
    setShowOverlay(!session.hasVisited);
    setSuggestions(session.suggestions);
    lastUploadedImageRef.current = session.lastUploadedImage;
    preloadedAnnotationRef.current = session.annotationPromise || null;
  }, [currentCheckpoint.id]);

  // Sync Cache
  useEffect(() => {
    const session = sessionCache.current.get(currentCheckpoint.id);
    if (session) {
        session.messages = messages;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentCheckpoint.id]);

  const handleStartExploring = () => {
      setShowOverlay(false);
      const session = sessionCache.current.get(currentCheckpoint.id);
      if (session) {
          session.hasVisited = true;
      }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() && !lastUploadedImageRef.current) return;
    setSuggestions([]);
    
    if (text === "Annotate" && lastUploadedImageRef.current) {
        handleAnnotateRequest(lastUploadedImageRef.current);
        return;
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const responseText = await sendChatMessage(currentCheckpoint, messages, text);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: responseText }]);

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: "Connection lost. Please try again." }]);
    } finally {
      setIsTyping(false);
      const nextSuggestions = currentCheckpoint.suggestedQuestions && currentCheckpoint.suggestedQuestions.length > 0 
        ? currentCheckpoint.suggestedQuestions 
        : ["Tell me more", "What is the history?", "Architectural details"];
      setSuggestions(nextSuggestions);
    }
  };

  const handleAnnotateRequest = async (imageData: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: "Annotate this view" };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
        let annotatedImageUrl: string | undefined;
        if (preloadedAnnotationRef.current) {
            try { annotatedImageUrl = await preloadedAnnotationRef.current; } 
            catch (e) { annotatedImageUrl = await generateAnnotatedImage(imageData, currentCheckpoint.detailedDescription); }
        } else {
            annotatedImageUrl = await generateAnnotatedImage(imageData, currentCheckpoint.detailedDescription);
        }

        if (annotatedImageUrl) {
            const respText = "I've sketched out the key details for you.";
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: respText,
                imageUrl: annotatedImageUrl
            }]);
            
            if (onCheckpointUpdate) {
                const currentImages = currentCheckpoint.annotatedImages || [];
                onCheckpointUpdate(currentCheckpoint.id, {
                    annotatedImages: [...currentImages, annotatedImageUrl]
                });
            }
        } else {
            const respText = "I couldn't sketch that right now.";
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: respText }]);
        }
    } catch (e) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Something went wrong."}]);
    } finally {
        setIsTyping(false);
        setSuggestions(["Tell me more", "History"]);
        preloadedAnnotationRef.current = null;
        const session = sessionCache.current.get(currentCheckpoint.id);
        if (session) session.annotationPromise = null;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      lastUploadedImageRef.current = base64String;
      const session = sessionCache.current.get(currentCheckpoint.id);
      if (session) session.lastUploadedImage = base64String;

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: '', imageUrl: base64String }]);
      setIsTyping(true);
      setSuggestions([]);

      const context = currentCheckpoint.detailedDescription || currentCheckpoint.title;
      const promise = generateAnnotatedImage(base64String, context);
      preloadedAnnotationRef.current = promise;
      if (session) session.annotationPromise = promise;

      try {
        const analysis = await analyzeCheckpointImage(base64String, currentCheckpoint.detailedDescription);
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: analysis }]);
        setSuggestions(["Annotate", "History", "Architecture"]);
      } catch (err) {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: "I couldn't analyze the image." }]);
        setSuggestions(["Tell me more"]);
      } finally {
        setIsTyping(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
    setInputText('');
  };

  const nextCheckpoint = () => { if (currentIndex < tour.checkpoints.length - 1) setIndex(currentIndex + 1); };
  const prevCheckpoint = () => { if (currentIndex > 0) setIndex(currentIndex - 1); };
  const isLast = currentIndex === tour.checkpoints.length - 1;

  return (
    <div className="h-full relative flex flex-col bg-transparent md:p-6 overflow-hidden">
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full md:border-2 md:border-[#2D2738] md:rounded-3xl overflow-hidden shadow-2xl bg-white/95 backdrop-blur-md relative">
        {/* Header with increased left padding to avoid hamburger menu overlap */}
        <div className="bg-[#FFECB6] border-b-2 border-[#2D2738]/20 p-4 pl-16 z-50 flex items-center justify-between shadow-xs h-16">
          <div className="flex flex-col flex-1 min-w-0 mr-4">
               <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D2738]/60">Checkpoint {currentIndex + 1} of {tour.checkpoints.length}</span>
               <h3 className="font-bold text-lg md:text-xl text-[#2D2738] truncate">{currentCheckpoint.title}</h3>
          </div>
          
          <div className="flex items-center gap-2">
             <button onClick={prevCheckpoint} disabled={currentIndex === 0} className="w-8 h-8 flex items-center justify-center border-2 border-[#2D2738] rounded-full bg-[#FFD1DC] text-[#2D2738] font-bold hover:bg-[#B5EAD7] disabled:opacity-30 transition">←</button>
             <span className="text-[#2D2738] font-bold text-sm px-2">{currentIndex + 1} / {tour.checkpoints.length}</span>
             {isLast && !showOverlay ? (
                 <button onClick={onEndTour} className="px-3.5 py-1.5 bg-[#B5EAD7] text-[#2D2738] border-2 border-[#2D2738] font-bold uppercase text-xs rounded-full hover:bg-[#FFD1DC] shadow-xs transition">Finish 🏁</button>
             ) : (
                 <button onClick={nextCheckpoint} disabled={currentIndex === tour.checkpoints.length - 1} className="w-8 h-8 flex items-center justify-center border-2 border-[#2D2738] rounded-full bg-[#FFD1DC] text-[#2D2738] font-bold hover:bg-[#B5EAD7] disabled:opacity-30 transition">→</button>
             )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 relative overflow-hidden flex flex-col bg-[#FFECB6]/20">
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="max-w-3xl mx-auto w-full space-y-6">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] relative ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <span className={`inline-block text-[11px] font-bold uppercase tracking-wider mb-1 px-2 py-0.5 rounded-full ${msg.role === 'user' ? 'bg-[#C7CEEA] text-[#2D2738]' : 'bg-[#B5EAD7] text-[#2D2738]'}`}>
                          {msg.role === 'user' ? 'You' : 'ArtsyLens Guide'}
                      </span>
                      <div className={`relative p-4 rounded-2xl shadow-sm border-2 border-[#2D2738] ${msg.role === 'user' ? 'bg-[#FFD1DC] text-[#2D2738] rounded-tr-none' : 'bg-white text-[#2D2738] rounded-tl-none'}`}>
                          {msg.imageUrl && (
                              <div className="w-full mb-3 cursor-pointer hover:opacity-90 transition-opacity p-2 bg-white shadow-md border border-[#2D2738]/20 rounded-xl" onClick={() => setSelectedImage(msg.imageUrl!)}>
                                  <img src={msg.imageUrl} alt="Visual" className="w-full h-auto object-cover max-h-60 rounded-lg" />
                              </div>
                          )}
                          {msg.text && <FormattedText text={msg.text} isUser={msg.role === 'user'} />}
                      </div>
                    </div>
                  </div>
                ))}
                {isTyping && <ChatGearLoader />}
                <div ref={messagesEndRef} />
              </div>
          </div>
             
          {/* Input Area */}
          <div className="bg-[#FFECB6]/90 border-t-2 border-[#2D2738]/20 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
               {suggestions.length > 0 && (
                 <div className="w-full max-w-3xl mx-auto px-4 pt-3 pb-1">
                     <div className="flex gap-2.5 overflow-x-auto no-scrollbar items-center pb-2">
                       {suggestions.map((question, i) => {
                           const isAnnotate = question === "Annotate";
                           return (
                               <button
                                 key={i}
                                 onClick={() => sendMessage(question)}
                                 className={`shrink-0 px-4 py-1.5 rounded-full shadow-xs transition-all duration-200 text-sm border-2 border-[#2D2738] font-bold 
                                  ${isAnnotate 
                                    ? 'bg-[#FFD1DC] text-[#2D2738] hover:bg-[#B5EAD7]' 
                                    : 'bg-white text-[#2D2738] hover:bg-[#C7CEEA]'
                                  }`}
                               >
                                  {isAnnotate ? <span>🎨 Annotate Visual</span> : <span>{question}</span>}
                               </button>
                           );
                       })}
                     </div>
                 </div>
               )}

               <div className="p-4 w-full max-w-3xl mx-auto">
                 <form onSubmit={handleSubmit} className="flex gap-2 items-center bg-white p-2 rounded-2xl border-2 border-[#2D2738] shadow-sm">
                   <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-[#2D2738] hover:bg-[#FFD1DC] rounded-xl transition-colors" title="Upload Photo to Analyze">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                   </button>
                   <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />

                   <input 
                     className="flex-1 bg-transparent px-2 py-1 focus:outline-none text-base md:text-lg text-[#2D2738] placeholder-[#2D2738]/40"
                     placeholder="Ask ArtsyLens about this spot..."
                     value={inputText}
                     onChange={e => setInputText(e.target.value)}
                   />

                   <button type="submit" disabled={!inputText.trim()} className="p-2.5 bg-[#B5EAD7] text-[#2D2738] border border-[#2D2738] rounded-xl hover:bg-[#FFD1DC] transition-colors disabled:opacity-40 cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                   </button>
                 </form>
               </div>
          </div>

          {showOverlay && (
            <div className="absolute inset-0 z-50 bg-[#2D2738]/70 backdrop-blur-sm flex flex-col justify-center items-center p-6 text-center animate-fade-in">
               <div className="max-w-md w-full bg-[#FFECB6] p-8 rounded-3xl shadow-2xl relative border-2 border-[#2D2738]">
                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-[#FFD1DC] rounded-full flex items-center justify-center shadow-lg border-2 border-[#2D2738] text-[#2D2738] font-bold text-lg">
                   {currentIndex + 1}
                 </div>
                 <h2 className="mt-4 text-2xl md:text-3xl font-bold text-[#2D2738] mb-3">{currentCheckpoint.title}</h2>
                 <div className="h-0.5 w-16 bg-[#2D2738]/20 mx-auto mb-4"></div>
                 <p className="text-[#2D2738]/85 text-base leading-relaxed mb-6">{currentCheckpoint.summary}</p>
                 <button onClick={handleStartExploring} className="w-full py-3.5 px-6 rounded-full border-2 border-[#2D2738] bg-[#B5EAD7] hover:bg-[#FFD1DC] text-[#2D2738] font-bold shadow-[3px_3px_0px_0px_#2D2738] hover:shadow-[1px_1px_0px_0px_#2D2738] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer">
                   Start Exploring This Landmark ✨
                 </button>
               </div>
            </div>
          )}

          {selectedImage && (
              <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedImage(null)}>
                  <button onClick={() => setSelectedImage(null)} className="absolute top-6 right-6 text-white/80 hover:text-white transition-colors z-[110] p-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  <div className="relative p-2 bg-white rounded-2xl shadow-2xl max-w-full max-h-[80vh] border-2 border-[#2D2738]" onClick={(e) => e.stopPropagation()}>
                      <img src={selectedImage} alt="Full screen" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
                  </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};