import { MongoClient } from "mongodb";
import type { Collection } from "mongodb";
import type { GuestDBO } from "./types";

let client: MongoClient | null = null;
let indexReady = false;

function getClient(): MongoClient {
  const uri = process.env.DB_URL;
  if (!uri) throw new Error("DB_URL is not configured");
  if (!client) client = new MongoClient(uri);
  return client;
}

async function ensureConnected(): Promise<MongoClient> {
  const client = getClient();
  await client.connect();
  await client.db("admin").command({ ping: 1 });
  return client;
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
