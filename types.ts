export interface Checkpoint {
  id: number;
  title: string;
  order?: number;
  summary: string;
  lookFor: string[];
  detailedDescription: string; // Hidden context for the AI chatter
  suggestedQuestions: string[];
  annotatedImages?: string[]; // Array of base64 strings
}

export interface JournalData {
  summary: string;
  journalStory: string;
  entries: Record<number, string>;
}

export interface Tour {
  locationName: string;
  description: string;
  imageUrl?: string; // Base64 or URL
  checkpoints: Checkpoint[];
  journalData?: JournalData;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  imageUrl?: string;
}

export enum AppState {
  HOME = 'HOME',
  GENERATING = 'GENERATING',
  ITINERARY = 'ITINERARY',
  ACTIVE_TOUR = 'ACTIVE_TOUR',
  RECAP = 'RECAP',
}