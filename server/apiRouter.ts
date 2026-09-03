import express, { Router } from "express";
import {
  getActiveProviders,
  dispatchSkeleton,
  dispatchEnrich,
  dispatchChat,
  dispatchAnalyzeImage,
  dispatchAnnotateImage,
  dispatchRecap,
} from "./aiDispatcher";

export function createApiRouter(): Router {
  const router = express.Router();

  router.get("/health", (req, res) => {
    const providers = getActiveProviders();
    res.json({
      status: "ok",
      ...providers,
    });
  });

  router.post("/gemini/skeleton", async (req, res) => {
    try {
      const { location } = req.body || {};
      if (!location || typeof location !== "string") {
        return res.status(400).json({ error: "Location is required" });
      }
      const data = await dispatchSkeleton(location);
      res.json(data);
    } catch (error: any) {
      console.error("Skeleton generation error:", error);
      res.status(500).json({
        error: error?.message || "Failed to generate tour itinerary skeleton",
      });
    }
  });

  router.post("/gemini/enrich", async (req, res) => {
    try {
      const { locationName, checkpoint } = req.body || {};
      if (!checkpoint || !checkpoint.id || !checkpoint.title) {
        return res.status(400).json({ error: "Valid checkpoint is required" });
      }
      const data = await dispatchEnrich(locationName || "the location", checkpoint);
      res.json(data);
    } catch (error: any) {
      console.error("Checkpoint enrichment error:", error);
      res.status(500).json({
        error: error?.message || "Failed to enrich checkpoint",
      });
    }
  });

  router.post("/gemini/chat", async (req, res) => {
    try {
      const { checkpoint, messages, message } = req.body || {};
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }
      const reply = await dispatchChat(
        checkpoint || { title: "Location" },
        messages || [],
        message
      );
      res.json(reply);
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({
        error: error?.message || "Failed to communicate with tour guide",
      });
    }
  });

  router.post("/gemini/analyze-image", async (req, res) => {
    try {
      const { image, context, promptOverride } = req.body || {};
      if (!image) {
        return res.status(400).json({ error: "Image data is required" });
      }
      const result = await dispatchAnalyzeImage(image, context || "monument", promptOverride);
      res.json(result);
    } catch (error: any) {
      console.error("Image analysis error:", error);
      res.status(500).json({
        error: error?.message || "Failed to analyze image",
      });
    }
  });

  router.post("/gemini/annotate-image", async (req, res) => {
    try {
      const { image, context } = req.body || {};
      if (!image) {
        return res.status(400).json({ error: "Image data is required" });
      }
      const result = await dispatchAnnotateImage(image, context);
      res.json(result);
    } catch (error: any) {
      console.error("Annotate image error:", error);
      res.status(500).json({
        error: error?.message || "Failed to annotate image",
      });
    }
  });

  router.post("/gemini/recap", async (req, res) => {
    try {
      const { location, checkpoints } = req.body || {};
      if (!checkpoints || !Array.isArray(checkpoints)) {
        return res.status(400).json({ error: "Checkpoints array is required" });
      }
      const data = await dispatchRecap(location || "Journey", checkpoints);
      res.json(data);
    } catch (error: any) {
      console.error("Recap error:", error);
      res.status(500).json({
        error: error?.message || "Failed to generate recap",
      });
    }
  });

  return router;
}
