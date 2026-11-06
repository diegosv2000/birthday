import { getGuestsCollection } from "@/lib/mongodb";
import { consumeRsvpRateLimit } from "@/lib/rsvp-rate-limit";
import { NAME_MAX, readRsvpBody, RsvpBodyError } from "@/lib/rsvp-body";

const DNI_PATTERN = /^\d{8}$/;
const NAME_MIN = 3;

export async function POST(request: Request) {
  try {
    const rateLimit = await consumeRsvpRateLimit(request);
    if (!rateLimit.allowed) {
      return Response.json({ error: "rate-limited" }, {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfter), "Cache-Control": "no-store" },
      });
    }
  } catch {
    // Si el contador falla, no permitir registros sin protección.
    console.error("[rsvp] rate limit unavailable");
    return Response.json({ error: "temporarily-unavailable" }, {
      status: 503,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }

  let body: unknown;
  try {
    body = await readRsvpBody(request);
  } catch (error) {
    if (error instanceof RsvpBodyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "invalid-fields" }, { status: 400 });
  }
  const { dni, fullName } = body as { dni?: unknown; fullName?: unknown };
  const cleanDni = typeof dni === "string" ? dni.trim() : "";
  const cleanName = typeof fullName === "string" ? fullName.trim() : "";

  if (!DNI_PATTERN.test(cleanDni) || cleanName.length < NAME_MIN || cleanName.length > NAME_MAX) {
    return Response.json({ error: "invalid-fields" }, { status: 400 });
  }

  try {
    const guests = await getGuestsCollection();
    const existing = await guests.findOne({ dni: cleanDni });
    if (existing) {
      if (existing.state === "Banned") {
        return Response.json({ banned: true }, { status: 403 });
      }
      return Response.json({ alreadyRegistered: true }, { status: 200 });
    }

    await guests.insertOne({
      dni: cleanDni,
      fullName: cleanName,
      state: "Ready",
      createdAt: new Date(),
    });
    return Response.json({ registered: true }, { status: 201 });
  } catch (error) {
    // Carrera: otro insert ganó la unique key entre el findOne y el insertOne.
    if (isDuplicateKey(error)) {
      const guests = await getGuestsCollection();
      const racer = await guests.findOne({ dni: cleanDni });
      if (racer?.state === "Banned") {
        return Response.json({ banned: true }, { status: 403 });
      }
      return Response.json({ alreadyRegistered: true }, { status: 200 });
    }
    console.error("[rsvp] db error:", error);
    return Response.json({ error: "db-error" }, { status: 500 });
  }
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000;
}
