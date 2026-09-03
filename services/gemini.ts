import { Tour, Checkpoint, ChatMessage } from '../types';

export const generateItinerarySkeleton = async (locationInput: string): Promise<Tour> => {
  try {
    const res = await fetch('/api/gemini/skeleton', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: locationInput }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server responded with status ${res.status}`);
    }

    const partialResponse = await res.json();
    const safeCheckpoints = (partialResponse.checkpoints || []).map((cp: any, index: number) => ({
      ...cp,
      order: cp.order ?? (index + 1),
      summary: "Loading summary...",
      lookFor: [],
      detailedDescription: "Loading details...",
      suggestedQuestions: ["What is this place?", "Why is it famous?", "Tell me a fun fact"]
    }));

    if (safeCheckpoints.length === 0) {
      throw new Error("No checkpoints returned");
    }

    return {
      locationName: locationInput,
      description: partialResponse.location_intro || "Your custom itinerary is ready.",
      checkpoints: safeCheckpoints
    } as Tour;
  } catch (error: any) {
    console.error("Skeleton generation failed:", error);
    throw new Error(error?.message || "Could not generate tour checkpoints for that location. Please try again.");
  }
};

export const enrichCheckpoint = async (
  locationName: string,
  checkpoint: Checkpoint
): Promise<Partial<Checkpoint>> => {
  try {
    const res = await fetch('/api/gemini/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationName, checkpoint }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return {
      summary: data.summary,
      lookFor: data.things_to_notice || [],
      detailedDescription: `${checkpoint.title} in ${locationName}. A significant location worthy of exploration.`,
      suggestedQuestions: data.questions || ["What is the history here?", "What are the key features?", "Why is this significant?"]
    };
  } catch (e) {
    console.warn(`Failed to enrich checkpoint ${checkpoint.title}`, e);
    return {
      summary: "Information currently unavailable.",
      lookFor: ["Details unavailable"],
      detailedDescription: "Could not load detailed history.",
      suggestedQuestions: ["What happened here?", "Who built this?", "Is it old?"]
    };
  }
};

export const sendChatMessage = async (
  checkpoint: Checkpoint,
  history: ChatMessage[],
  message: string
): Promise<string> => {
  try {
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpoint, messages: history, message }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return data.text || "I see what you mean. What aspect would you like to explore further?";
  } catch (err) {
    console.error("Chat message failed:", err);
    throw err;
  }
};

export const analyzeCheckpointImage = async (
  base64Image: string,
  context: string,
  promptOverride?: string
): Promise<string> => {
  try {
    const res = await fetch('/api/gemini/analyze-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image, context, promptOverride }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return data.text || "I see the image, but I'm having trouble analyzing the specific details right now.";
  } catch (e) {
    console.error("Analysis failed", e);
    return "I couldn't analyze that image clearly right now.";
  }
};

export const generateAnnotatedImage = async (
  base64Image: string,
  context?: string
): Promise<string | undefined> => {
  try {
    const res = await fetch('/api/gemini/annotate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image, context }),
    });

    if (!res.ok) {
      return undefined;
    }

    const data = await res.json();
    return data.imageUrl || undefined;
  } catch (e) {
    console.warn("Annotated image request failed", e);
    return undefined;
  }
};

export const generateTourRecap = async (
  location: string,
  checkpoints: Checkpoint[]
): Promise<{ summary: string; journalStory: string; entries: Record<number, string> }> => {
  try {
    const res = await fetch('/api/gemini/recap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, checkpoints }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (e) {
    console.error("Recap generation failed", e);
    return {
      summary: `Journey through ${location} complete.`,
      journalStory: `A walk through ${location}.`,
      entries: {}
    };
  }
};
