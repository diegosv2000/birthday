import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { getRateLimitsCollection } from "./mongodb";

const WINDOWS = [
  { duration: 60_000, limit: 5 },
  { duration: 3_600_000, limit: 30 },
];
const MAX_BLOCKED_KEYS = 1024;
const blockedUntil = new Map<string, number>();

function result(retryAt: number) {
  return {
    allowed: retryAt === 0,
    retryAfter: retryAt ? Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)) : 0,
  };
}

function clientKey(request: Request): string {
  // Solo confiar en una cabecera que el hosting/proxy sobrescriba siempre.
  const header = process.env.RSVP_TRUSTED_IP_HEADER?.trim()
    || (process.env.VERCEL === "1" ? "x-vercel-forwarded-for" : "");
  const raw = header ? request.headers.get(header)?.trim() : undefined;
  let ip = "shared";
  if (raw && !raw.includes("%") && isIP(raw)) {
    // Canonicalizar IPv6 impide eludir el límite cambiando su representación.
    const normalized = raw.includes(":")
      ? new URL(`http://[${raw}]/`).hostname.slice(1, -1)
      : raw;
    ip = normalized.startsWith("::ffff:") && isIP(raw) === 6
      ? normalizeMappedIPv4(normalized)
      : normalized;
  }
  return createHash("sha256").update(ip).digest("hex");
}

function normalizeMappedIPv4(ip: string): string {
  const parts = ip.slice("::ffff:".length).split(":");
  if (parts.length !== 2) return ip;
  const value = (parseInt(parts[0], 16) * 65_536) + parseInt(parts[1], 16);
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
}

export async function consumeRsvpRateLimit(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  const cachedReset = blockedUntil.get(key);
  if (cachedReset && cachedReset > now) return result(cachedReset);
  blockedUntil.delete(key);

  const collection = await getRateLimitsCollection();
  const results = await Promise.all(WINDOWS.map(async ({ duration, limit }) => {
    const start = Math.floor(now / duration) * duration;
    const resetAt = start + duration;
    const filter = { _id: `rsvp:${key}:${duration}:${start}` };
    const update = {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(resetAt) },
    };
    let counter;
    try {
      counter = await collection.findOneAndUpdate(filter, update, {
        upsert: true,
        returnDocument: "after",
        includeResultMetadata: false,
      });
    } catch (error) {
      // Dos instancias pueden intentar crear el mismo contador a la vez.
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) {
        throw error;
      }
      counter = await collection.findOneAndUpdate(filter, update, {
        returnDocument: "after",
        includeResultMetadata: false,
      });
    }
    if (!counter) throw new Error("Rate limit counter unavailable");
    return counter.count > limit ? resetAt : 0;
  }));
  const retryAt = Math.max(...results);
  if (retryAt) {
    // Rechazar reincidentes sin seguir cargando MongoDB; el contador compartido
    // sigue siendo la autoridad en instancias nuevas o si se desaloja la caché.
    if (blockedUntil.size >= MAX_BLOCKED_KEYS) {
      const oldestKey = blockedUntil.keys().next().value;
      if (oldestKey !== undefined) blockedUntil.delete(oldestKey);
    }
    blockedUntil.set(key, retryAt);
  }
  return result(retryAt);
}
