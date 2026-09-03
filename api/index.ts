import express from "express";
import { createApiRouter } from "../server/apiRouter";

const app = express();
app.use(express.json({ limit: "25mb" }));

const apiRouter = createApiRouter();
// Support both /api/* and root /* in case Vercel rewrite strips prefix
app.use("/api", apiRouter);
app.use("/", apiRouter);

export default app;
