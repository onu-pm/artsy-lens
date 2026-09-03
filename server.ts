import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  generateSkeleton,
  enrichCheckpointData,
  chatWithGuide,
  analyzeImage,
  annotateImageStudy,
  recapTour,
  getOpenRouterApiKey,
} from "./server/openrouterService";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    const hasOpenRouterKey = Boolean(getOpenRouterApiKey());
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY);
    res.json({
      status: "ok",
      provider: "openrouter",
      hasKey: hasOpenRouterKey || hasGeminiKey,
      hasOpenRouterKey,
    });
  });

  app.post("/api/gemini/skeleton", async (req, res) => {
    try {
      const { location } = req.body;
      if (!location || typeof location !== "string") {
        return res.status(400).json({ error: "Location is required" });
      }
      const data = await generateSkeleton(location);
      res.json(data);
    } catch (error: any) {
      console.error("Skeleton generation error:", error);
      res.status(500).json({
        error: error?.message || "Failed to generate tour itinerary skeleton",
      });
    }
  });

  app.post("/api/gemini/enrich", async (req, res) => {
    try {
      const { locationName, checkpoint } = req.body;
      if (!checkpoint || !checkpoint.id || !checkpoint.title) {
        return res.status(400).json({ error: "Valid checkpoint is required" });
      }
      const data = await enrichCheckpointData(locationName || "the location", checkpoint);
      res.json(data);
    } catch (error: any) {
      console.error("Checkpoint enrichment error:", error);
      res.status(500).json({
        error: error?.message || "Failed to enrich checkpoint",
      });
    }
  });

  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { checkpoint, messages, message } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }
      const reply = await chatWithGuide(
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

  app.post("/api/gemini/analyze-image", async (req, res) => {
    try {
      const { image, context, promptOverride } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Image data is required" });
      }
      const result = await analyzeImage(image, context || "monument", promptOverride);
      res.json(result);
    } catch (error: any) {
      console.error("Image analysis error:", error);
      res.status(500).json({
        error: error?.message || "Failed to analyze image",
      });
    }
  });

  app.post("/api/gemini/annotate-image", async (req, res) => {
    try {
      const { image, context } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Image data is required" });
      }
      const result = await annotateImageStudy(image, context);
      res.json(result);
    } catch (error: any) {
      console.error("Annotate image error:", error);
      res.status(500).json({
        error: error?.message || "Failed to annotate image",
      });
    }
  });

  app.post("/api/gemini/recap", async (req, res) => {
    try {
      const { location, checkpoints } = req.body;
      if (!checkpoints || !Array.isArray(checkpoints)) {
        return res.status(400).json({ error: "Checkpoints array is required" });
      }
      const data = await recapTour(location || "Journey", checkpoints);
      res.json(data);
    } catch (error: any) {
      console.error("Recap error:", error);
      res.status(500).json({
        error: error?.message || "Failed to generate recap",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // In Express v5, wildcard routing uses '*all'
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
