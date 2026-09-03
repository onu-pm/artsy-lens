import express from "express";
import { createApiRouter } from "./apiRouter";

const app = express();

// Enable CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// JSON parser with fallback if body is already a string
app.use(express.json({ limit: "25mb" }));
app.use((req: any, _res: any, next: any) => {
  if (typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body);
    } catch (_) {}
  }
  next();
});

const apiRouter = createApiRouter();
// Support both /api/* and root /* in case Vercel rewrite strips prefix
app.use("/api", apiRouter);
app.use("/", apiRouter);

// Global error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("Vercel Serverless API Error:", err);
  res.status(500).json({
    error: err?.message || "Internal server error",
  });
});

export default app;
