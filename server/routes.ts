import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertStatsEventSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/stats/event", async (req, res) => {
    try {
      const parsed = insertStatsEventSchema.parse(req.body);
      const event = await storage.trackEvent(parsed);
      res.json(event);
    } catch (error) {
      res.status(400).json({ error: "Invalid event data" });
    }
  });

  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  return httpServer;
}
