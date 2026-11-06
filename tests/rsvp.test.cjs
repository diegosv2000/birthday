const assert = require("node:assert/strict");
const { test } = require("node:test");
const loadTs = require("./helpers/load-ts.cjs");
const setEnv = require("./helpers/set-env.cjs");

function setup(t) {
  setEnv(t, { RSVP_TRUSTED_IP_HEADER: "x-real-ip", VERCEL: "0" });
  t.mock.method(Date, "now", () => Date.UTC(2026, 10, 6, 12, 0, 10));
  const counters = new Map();
  const guests = new Map();
  let guestQueries = 0;
  let offline = false;
  const db = {
    getRateLimitsCollection: async () => {
      if (offline) throw new Error("offline");
      return {
        async findOneAndUpdate(filter, update) {
          const counter = counters.get(filter._id) || { ...update.$setOnInsert, count: 0 };
          counter.count += update.$inc.count;
          counters.set(filter._id, counter);
          return { ...counter };
        },
      };
    },
    getGuestsCollection: async () => {
      guestQueries++;
      return {
        findOne: async ({ dni }) => guests.get(dni),
        insertOne: async (guest) => { guests.set(guest.dni, guest); },
      };
    },
  };
  const body = loadTs("src/lib/rsvp-body.ts");
  const limiter = loadTs("src/lib/rsvp-rate-limit.ts", { "./mongodb": db });
  const { POST } = loadTs("src/app/api/rsvp/route.ts", {
    "@/lib/mongodb": db,
    "@/lib/rsvp-body": body,
    "@/lib/rsvp-rate-limit": limiter,
  });
  const request = (data = { dni: "12345678", fullName: "Diego Salazar" }, headers = {}) => new Request("https://invite.test/api/rsvp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": "192.0.2.1", ...headers },
    body: typeof data === "string" ? data : JSON.stringify(data),
  });
  return {
    POST, request, guests,
    get guestQueries() { return guestQueries; },
    goOffline: () => { offline = true; },
  };
}

test("conserva registro, idempotencia y rechazo de invitados bloqueados", async (t) => {
  const s = setup(t);
  const response = await s.POST(s.request());
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { registered: true });
  assert.equal(s.guests.get("12345678").fullName, "Diego Salazar");
  assert.equal((await s.POST(s.request())).status, 200);
  s.guests.get("12345678").state = "Banned";
  const banned = await s.POST(s.request());
  assert.equal(banned.status, 403);
  assert.deepEqual(await banned.json(), { banned: true });
});

test("los intentos con JSON inválido cuentan y el bloqueo no consulta invitados", async (t) => {
  const s = setup(t);
  for (let i = 0; i < 5; i++) assert.equal((await s.POST(s.request("{"))).status, 400);
  const response = await s.POST(s.request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "50");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "rate-limited" });
  assert.equal(s.guestQueries, 0);
  assert.equal(s.guests.size, 0);
});

test("si MongoDB no puede contar, responde 503 sin consultar ni insertar invitados", async (t) => {
  const s = setup(t);
  s.goOffline();
  t.mock.method(console, "error", () => {});
  const response = await s.POST(s.request());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(s.guestQueries, 0);
  assert.equal(s.guests.size, 0);
});

test("rechaza nombres largos, tipos incorrectos y cuerpos que no sean objetos", async (t) => {
  const s = setup(t);
  const values = [
    { dni: "12345678", fullName: "a".repeat(121) },
    { dni: { $ne: "" }, fullName: "Diego" },
    { dni: "12345678", fullName: ["Diego"] },
    [],
    null,
  ];
  for (const value of values) assert.equal((await s.POST(s.request(value))).status, 400);
  assert.equal(s.guestQueries, 0);
});

test("acepta nombres de 120 caracteres y JSON con charset", async (t) => {
  const s = setup(t);
  const response = await s.POST(s.request({ dni: "12345678", fullName: "a".repeat(120) }, {
    "Content-Type": "application/json; charset=utf-8",
  }));
  assert.equal(response.status, 201);
});

test("rechaza tipos de contenido distintos de JSON y cuerpos de más de 1 KiB", async (t) => {
  const s = setup(t);
  assert.equal((await s.POST(s.request("{}", { "Content-Type": "text/plain" }))).status, 415);
  assert.equal((await s.POST(s.request("{}", { "Content-Length": "1025" }))).status, 413);
  assert.equal((await s.POST(s.request(" ".repeat(1025)))).status, 413);
  assert.equal((await s.POST(s.request(" ".repeat(1025), { "Content-Length": "2" }))).status, 413);
  assert.equal(s.guestQueries, 0);
});

test("limita bytes reales en cuerpos fragmentados y cancela la lectura al excederlos", async (t) => {
  const s = setup(t);
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(600));
      controller.enqueue(new Uint8Array(600));
    },
    cancel() { canceled = true; },
  });
  const response = await s.POST(new Request("https://invite.test/api/rsvp", {
    method: "POST", body: stream, duplex: "half",
    headers: { "Content-Type": "application/json", "x-real-ip": "192.0.2.1" },
  }));
  assert.equal(response.status, 413);
  assert.equal(canceled, true);
  assert.equal(s.guestQueries, 0);
});

test("decodifica correctamente UTF-8 cuando un carácter llega en fragmentos distintos", async (t) => {
  const s = setup(t);
  const bytes = new TextEncoder().encode(JSON.stringify({ dni: "12345678", fullName: "José Salazar" }));
  const split = bytes.indexOf(0xc3) + 1;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.slice(0, split));
      controller.enqueue(bytes.slice(split));
      controller.close();
    },
  });
  const response = await s.POST(new Request("https://invite.test/api/rsvp", {
    method: "POST", body: stream, duplex: "half",
    headers: { "Content-Type": "application/json", "x-real-ip": "192.0.2.1" },
  }));
  assert.equal(response.status, 201);
  assert.equal(s.guests.get("12345678").fullName, "José Salazar");
});
