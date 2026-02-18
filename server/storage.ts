import { type User, type InsertUser, type InsertStatsEvent, type StatsEvent, statsEvents } from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  trackEvent(event: InsertStatsEvent): Promise<StatsEvent>;
  getStats(): Promise<{
    photosTaken: number;
    photosUploaded: number;
    respins: number;
    totalGames: number;
    avgFaces: number;
    recentActivity: { date: string; count: number }[];
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    return undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    throw new Error("Not implemented");
  }

  async trackEvent(event: InsertStatsEvent): Promise<StatsEvent> {
    const [result] = await db.insert(statsEvents).values(event).returning();
    return result;
  }

  async getStats() {
    const photosTakenResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(statsEvents)
      .where(sql`event_type = 'photo_taken'`);

    const photosUploadedResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(statsEvents)
      .where(sql`event_type = 'photo_uploaded'`);

    const respinsResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(statsEvents)
      .where(sql`event_type = 'respin'`);

    const totalGamesResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(statsEvents)
      .where(sql`event_type IN ('photo_taken', 'photo_uploaded')`);

    const avgFacesResult = await db.select({ avg: sql<number>`coalesce(avg(faces_detected), 0)::float` })
      .from(statsEvents)
      .where(sql`faces_detected is not null`);

    const recentActivityResult = await db.select({
      date: sql<string>`to_char(created_at, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
      .from(statsEvents)
      .where(sql`created_at >= now() - interval '30 days'`)
      .groupBy(sql`to_char(created_at, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(created_at, 'YYYY-MM-DD')`);

    return {
      photosTaken: photosTakenResult[0]?.count ?? 0,
      photosUploaded: photosUploadedResult[0]?.count ?? 0,
      respins: respinsResult[0]?.count ?? 0,
      totalGames: totalGamesResult[0]?.count ?? 0,
      avgFaces: Math.round((avgFacesResult[0]?.avg ?? 0) * 10) / 10,
      recentActivity: recentActivityResult,
    };
  }
}

export const storage = new DatabaseStorage();
