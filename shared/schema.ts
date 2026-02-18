import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const statsEvents = pgTable("stats_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(),
  facesDetected: integer("faces_detected"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStatsEventSchema = createInsertSchema(statsEvents).pick({
  eventType: true,
  facesDetected: true,
});

export type InsertStatsEvent = z.infer<typeof insertStatsEventSchema>;
export type StatsEvent = typeof statsEvents.$inferSelect;
