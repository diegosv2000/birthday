import { MongoClient } from "mongodb";
import type { Collection } from "mongodb";
import type { GuestDBO, RateLimitDBO } from "./types";

let client: MongoClient | null = null;
let indexReady = false;
let rateLimitsReady: Promise<Collection<RateLimitDBO>> | null = null;

function getClient(): MongoClient {
  const uri = process.env.DB_URL;
  if (!uri) throw new Error("DB_URL is not configured");
  if (!client) client = new MongoClient(uri);
  return client;
}

async function ensureConnected(): Promise<MongoClient> {
  const client = getClient();
  await client.connect();
  return client;
}

export function getRateLimitsCollection(): Promise<Collection<RateLimitDBO>> {
  if (!rateLimitsReady) {
    rateLimitsReady = (async () => {
      const client = await ensureConnected();
      const collection = client.db(process.env.DB_NAME).collection<RateLimitDBO>(
        process.env.DB_COL_RSVP_LIMITS || "rsvp_rate_limits",
      );
      await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      return collection;
    })().catch((error) => {
      rateLimitsReady = null;
      throw error;
    });
  }
  return rateLimitsReady;
}

export async function getGuestsCollection(): Promise<Collection<GuestDBO>> {
  const client = await ensureConnected();
  const db = client.db(process.env.DB_NAME);
  const guests = db.collection<GuestDBO>(process.env.DB_COL_GUESTS || "guests");
  if (!indexReady) {
    await guests.createIndex({ dni: 1 }, { unique: true });
    indexReady = true;
  }
  return guests;
}
