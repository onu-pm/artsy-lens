// Unified AI Dispatcher
// Automatically cascades between NVIDIA NIM, OpenRouter, and Gemini based on provided environment keys

import {
  getNvidiaApiKey,
  nvidiaGenerateSkeleton,
  nvidiaEnrichCheckpoint,
  nvidiaChatWithGuide,
  nvidiaAnalyzeImage,
  nvidiaRecapTour,
} from "./nvidiaService";

import {
  getOpenRouterApiKey,
  generateSkeleton as openRouterSkeleton,
  enrichCheckpointData as openRouterEnrich,
  chatWithGuide as openRouterChat,
  analyzeImage as openRouterAnalyze,
  annotateImageStudy as openRouterAnnotate,
  recapTour as openRouterRecap,
} from "./openrouterService";

import {
  generateSkeleton as geminiSkeleton,
  enrichCheckpointData as geminiEnrich,
  chatWithGuide as geminiChat,
  analyzeImage as geminiAnalyze,
  annotateImageStudy as geminiAnnotate,
  recapTour as geminiRecap,
} from "./geminiService";

export function getActiveProviders() {
  const hasNvidia = Boolean(getNvidiaApiKey());
  const hasOpenRouter = Boolean(getOpenRouterApiKey());
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY);

  const primary = hasNvidia
    ? "nvidia"
    : hasOpenRouter
    ? "openrouter"
    : hasGemini
    ? "gemini"
    : "fallback";

  return {
    provider: primary,
    hasKey: hasNvidia || hasOpenRouter || hasGemini,
    hasNvidiaKey: hasNvidia,
    hasOpenRouterKey: hasOpenRouter,
    hasGeminiKey: hasGemini,
  };
}

export async function dispatchSkeleton(location: string) {
  if (getNvidiaApiKey()) {
    try {
      return await nvidiaGenerateSkeleton(location);
    } catch (err) {
      console.warn("[Dispatcher] NVIDIA skeleton failed, falling back to OpenRouter/Gemini:", err);
    }
  }

  if (getOpenRouterApiKey()) {
    try {
      return await openRouterSkeleton(location);
    } catch (err) {
      console.warn("[Dispatcher] OpenRouter skeleton failed, falling back to Gemini:", err);
    }
  }

  return await geminiSkeleton(location);
}

export async function dispatchEnrich(locationName: string, checkpoint: any) {
  if (getNvidiaApiKey()) {
    try {
      return await nvidiaEnrichCheckpoint(locationName, checkpoint);
    } catch (err) {
      console.warn("[Dispatcher] NVIDIA enrich failed, falling back to OpenRouter/Gemini:", err);
    }
  }

  if (getOpenRouterApiKey()) {
    try {
      return await openRouterEnrich(locationName, checkpoint);
    } catch (err) {
      console.warn("[Dispatcher] OpenRouter enrich failed, falling back to Gemini:", err);
    }
  }

  return await geminiEnrich(locationName, checkpoint);
}

export async function dispatchChat(
  checkpoint: any,
  messages: Array<{ role: "user" | "model"; text: string }>,
  message: string
) {
  if (getNvidiaApiKey()) {
    try {
      return await nvidiaChatWithGuide(checkpoint, messages, message);
    } catch (err) {
      console.warn("[Dispatcher] NVIDIA chat failed, falling back to OpenRouter/Gemini:", err);
    }
  }

  if (getOpenRouterApiKey()) {
    try {
      return await openRouterChat(checkpoint, messages, message);
    } catch (err) {
      console.warn("[Dispatcher] OpenRouter chat failed, falling back to Gemini:", err);
    }
  }

  return await geminiChat(checkpoint, messages, message);
}

export async function dispatchAnalyzeImage(
  image: string,
  context: string,
  promptOverride?: string
) {
  if (getNvidiaApiKey()) {
    try {
      return await nvidiaAnalyzeImage(image, context, promptOverride);
    } catch (err) {
      console.warn("[Dispatcher] NVIDIA vision failed, falling back to OpenRouter/Gemini:", err);
    }
  }

  if (getOpenRouterApiKey()) {
    try {
      return await openRouterAnalyze(image, context, promptOverride);
    } catch (err) {
      console.warn("[Dispatcher] OpenRouter vision failed, falling back to Gemini:", err);
    }
  }

  return await geminiAnalyze(image, context, promptOverride);
}

export async function dispatchAnnotateImage(image: string, context?: string) {
  if (getOpenRouterApiKey()) {
    try {
      return await openRouterAnnotate(image, context);
    } catch (err) {
      console.warn("[Dispatcher] OpenRouter annotate failed:", err);
    }
  }
  return await geminiAnnotate(image, context);
}

export async function dispatchRecap(
  location: string,
  checkpoints: Array<{ id: number; title: string; summary?: string }>
) {
  if (getNvidiaApiKey()) {
    try {
      return await nvidiaRecapTour(location, checkpoints);
    } catch (err) {
      console.warn("[Dispatcher] NVIDIA recap failed, falling back to OpenRouter/Gemini:", err);
    }
  }

  if (getOpenRouterApiKey()) {
    try {
      return await openRouterRecap(location, checkpoints);
    } catch (err) {
      console.warn("[Dispatcher] OpenRouter recap failed, falling back to Gemini:", err);
    }
  }

  return await geminiRecap(location, checkpoints);
}
