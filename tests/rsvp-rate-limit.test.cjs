const assert = require("node:assert/strict");
const { test } = require("node:test");
const loadTs = require("./helpers/load-ts.cjs");
const setEnv = require("./helpers/set-env.cjs");

function setup(t, { trustedHeader = "x-real-ip", vercel = "0" } = {}) {
  setEnv(t, { RSVP_TRUSTED_IP_HEADER: trustedHeader, VERCEL: vercel });
  let now = Date.UTC(2026, 10, 6, 12, 0, 10);
  t.mock.method(Date, "now", () => now);
  const counters = new Map();
  const calls = [];
  const collection = {
    async findOneAndUpdate(filter, update, options) {
      calls.push({ filter, update, options });
      const old = counters.get(filter._id);
      if (!old && !options.upsert) return null;
      const counter = old || { ...update.$setOnInsert, count: 0 };
      counter.count += update.$inc.count;
      counters.set(filter._id, counter);
      return { ...counter };
    },
  };
  const limiter = loadTs("src/lib/rsvp-rate-limit.ts", {
    "./mongodb": { getRateLimitsCollection: async () => collection },
  });
  const request = (ip = "192.0.2.1", header = "x-real-ip") => new Request("https://invite.test/api/rsvp", {
    headers: { [header]: ip },
  });
  return {
    ...limiter, counters, calls, collection, request,
    advance: (ms) => { now += ms; },
  };
}

test("permite cinco intentos y bloquea el sexto hasta la siguiente ventana", async (t) => {
  const s = setup(t);
  for (let i = 0; i < 5; i++) assert.equal((await s.consumeRsvpRateLimit(s.request())).allowed, true);
  assert.deepEqual(await s.consumeRsvpRateLimit(s.request()), { allowed: false, retryAfter: 50 });
  s.advance(50_000);
  assert.equal((await s.consumeRsvpRateLimit(s.request())).allowed, true);
});

test("el límite horario persiste entre minutos y se reinicia sin esperar al TTL", async (t) => {
  const s = setup(t);
  for (let minute = 0; minute < 6; minute++) {
    for (let i = 0; i < 5; i++) assert.equal((await s.consumeRsvpRateLimit(s.request())).allowed, true);
    s.advance(60_000);
  }
  assert.deepEqual(await s.consumeRsvpRateLimit(s.request()), { allowed: false, retryAfter: 3230 });
  s.advance(3_230_000);
  assert.equal((await s.consumeRsvpRateLimit(s.request())).allowed, true);
});

test("veinte solicitudes concurrentes comparten el mismo contador", async (t) => {
  const s = setup(t);
  const results = await Promise.all(Array.from({ length: 20 }, () => s.consumeRsvpRateLimit(s.request())));
  assert.equal(results.filter((result) => result.allowed).length, 5);
  assert.equal(s.counters.size, 2);
  for (const call of s.calls) {
    assert.equal(call.options.returnDocument, "after");
    assert.equal(call.options.includeResultMetadata, false);
    assert.equal(call.filter._id.includes("192.0.2.1"), false);
    assert.ok(call.update.$setOnInsert.expiresAt instanceof Date);
  }
});

test("las IP bloqueadas se rechazan sin seguir consultando MongoDB", async (t) => {
  const s = setup(t);
  for (let i = 0; i < 6; i++) await s.consumeRsvpRateLimit(s.request());
  const previousCalls = s.calls.length;
  for (let i = 0; i < 50; i++) {
    assert.equal((await s.consumeRsvpRateLimit(s.request())).allowed, false);
  }
  assert.equal(s.calls.length, previousCalls);
  s.advance(50_000);
  assert.equal((await s.consumeRsvpRateLimit(s.request())).allowed, true);
  assert.equal(s.calls.length, previousCalls + 2);
});

test("instancias independientes comparten MongoDB, con límites separados por IP", async (t) => {
  const s = setup(t);
  const other = loadTs("src/lib/rsvp-rate-limit.ts", {
    "./mongodb": { getRateLimitsCollection: async () => s.collection },
  });
  for (let i = 0; i < 5; i++) await s.consumeRsvpRateLimit(s.request());
  assert.equal((await other.consumeRsvpRateLimit(s.request())).allowed, false);
  assert.equal((await other.consumeRsvpRateLimit(s.request("192.0.2.2"))).allowed, true);
});

test("sin proxy confiable no permite evadir el límite cambiando cabeceras", async (t) => {
  const s = setup(t, { trustedHeader: "" });
  for (let i = 0; i < 5; i++) await s.consumeRsvpRateLimit(s.request(`192.0.2.${i + 1}`, "x-forwarded-for"));
  assert.equal((await s.consumeRsvpRateLimit(s.request("192.0.2.99", "x-forwarded-for"))).allowed, false);
});

test("Vercel usa su cabecera de IP y no x-forwarded-for arbitrario", async (t) => {
  const s = setup(t, { trustedHeader: "", vercel: "1" });
  for (let i = 0; i < 5; i++) await s.consumeRsvpRateLimit(s.request("192.0.2.1", "x-vercel-forwarded-for"));
  assert.equal((await s.consumeRsvpRateLimit(s.request("192.0.2.1", "x-vercel-forwarded-for"))).allowed, false);
  assert.equal((await s.consumeRsvpRateLimit(s.request("192.0.2.2", "x-vercel-forwarded-for"))).allowed, true);
});

test("normaliza IPv6 y direcciones IPv4 mapeadas", async (t) => {
  const s = setup(t);
  for (let i = 0; i < 5; i++) await s.consumeRsvpRateLimit(s.request("2001:db8::1"));
  assert.equal((await s.consumeRsvpRateLimit(s.request("2001:0db8:0:0:0:0:0:1"))).allowed, false);
  for (let i = 0; i < 5; i++) await s.consumeRsvpRateLimit(s.request("192.0.2.1"));
  assert.equal((await s.consumeRsvpRateLimit(s.request("::ffff:192.0.2.1"))).allowed, false);
});

test("IP ausente, inválida o lista de IP comparten el mismo límite", async (t) => {
  const s = setup(t);
  for (let i = 0; i < 5; i++) await s.consumeRsvpRateLimit(s.request("inventada"));
  assert.equal((await s.consumeRsvpRateLimit(s.request("192.0.2.1, 192.0.2.2"))).allowed, false);
  assert.equal((await s.consumeRsvpRateLimit(new Request("https://invite.test"))).allowed, false);
});

test("reintenta una colisión al crear contadores y propaga los fallos de MongoDB", async (t) => {
  const s = setup(t);
  const original = s.collection.findOneAndUpdate.bind(s.collection);
  let raced = false;
  s.collection.findOneAndUpdate = async (filter, update, options) => {
    if (!raced) {
      raced = true;
      await original(filter, update, options);
      throw Object.assign(new Error("duplicate"), { code: 11000 });
    }
    return original(filter, update, options);
  };
  assert.equal((await s.consumeRsvpRateLimit(s.request())).allowed, true);
  assert.ok(s.calls.some((call) => !call.options.upsert));
  s.collection.findOneAndUpdate = async () => { throw new Error("offline"); };
  await assert.rejects(() => s.consumeRsvpRateLimit(s.request()), /offline/);
});
