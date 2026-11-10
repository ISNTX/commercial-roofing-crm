import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SCRAPE_DELAY_MS = "0";
process.env.SCRAPE_RETRIES = "2";
const { runDailyScrape, sanitizeLead, withRetry, normalizeAddress } = await import("../src/run.js");

// Minimal in-memory stand-in for the supabase-js query builder, covering
// only the calls run.js makes.
function fakeSupabase(seed = {}) {
  const tables = { cities: [], leads: [], scrape_runs: [], ...structuredClone(seed) };
  let nextId = 1;
  const failInsertsWith = new Set();

  function query(table) {
    const filters = [];
    let op = "select";
    let payload;
    let single = false;
    const rows = () => tables[table].filter((r) => filters.every((f) => f(r)));
    const builder = {
      select() { return builder; },
      insert(p) { op = "insert"; payload = p; return builder; },
      update(p) { op = "update"; payload = p; return builder; },
      eq(col, v) { filters.push((r) => r[col] === v); return builder; },
      lt(col, v) { filters.push((r) => r[col] < v); return builder; },
      gte(col, v) { filters.push((r) => r[col] >= v); return builder; },
      order() { return builder; },
      limit() { return builder; },
      single() { single = true; return builder; },
      then(resolve) {
        if (op === "insert") {
          const unknown = Object.keys(payload).find((k) => failInsertsWith.has(k));
          if (unknown) return resolve({ data: null, error: { message: `unknown column ${unknown}` } });
          const row = { id: String(nextId++), started_at: new Date().toISOString(), scraped_at: new Date().toISOString(), ...payload };
          tables[table].push(row);
          return resolve({ data: single ? row : [row], error: null });
        }
        if (op === "update") {
          const hit = rows();
          hit.forEach((r) => Object.assign(r, payload));
          return resolve({ data: hit, error: null });
        }
        const hit = rows().map((r) => (table === "cities" ? { ...r, counties: { name: `${r.name} County` } } : r));
        return resolve({ data: hit, error: null });
      },
    };
    return builder;
  }
  return { from: query, tables, failInsertsWith };
}

const CITIES = [
  { id: "c1", name: "Odessa", county_id: "k1" },
  { id: "c2", name: "Midland", county_id: "k2" },
];

test("sanitizeLead keeps known columns and moves the rest into raw_data.extra", () => {
  const lead = sanitizeLead({ address: "1 Main St", _meta: { score: 9 }, raw_data: { source: "x" } });
  assert.deepEqual(lead, { address: "1 Main St", raw_data: { source: "x", extra: { _meta: { score: 9 } } } });
});

test("normalizeAddress ignores case, punctuation and spacing", () => {
  assert.equal(normalizeAddress(" 12  Main St., Odessa "), normalizeAddress("12 main st odessa"));
});

test("withRetry retries a transient failure, then succeeds", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls += 1;
    if (calls === 1) throw new Error("ECONNRESET");
    return "ok";
  }, { baseDelayMs: 1 });
  assert.equal(result, "ok");
  assert.equal(calls, 2);
});

test("withRetry gives up on a scraper that hangs", async () => {
  await assert.rejects(withRetry(() => new Promise(() => {}), { attempts: 1, timeoutMs: 20 }), /timed out/);
});

test("a shared scraper runs once and its leads are split by city", async () => {
  const db = fakeSupabase({ cities: CITIES });
  let calls = 0;
  const shared = async () => {
    calls += 1;
    return [
      { address: "1 A St", city: "Odessa", project_type: "reroof" },
      { address: "2 B St", city: "Midland", project_type: "reroof" },
    ];
  };
  const summary = await runDailyScrape({ supabase: db, getScraper: () => shared });
  assert.equal(calls, 1);
  assert.equal(summary.totalLeads, 2);
  assert.deepEqual(db.tables.leads.map((l) => l.city_id).sort(), ["c1", "c2"]);
  assert.ok(db.tables.scrape_runs.every((r) => r.status === "success"));
});

test("leads already saved are not inserted again on the next run", async () => {
  const db = fakeSupabase({ cities: [CITIES[0]] });
  const scraper = async () => [{ address: "1 A St", city: "Odessa", project_type: "reroof" }];
  await runDailyScrape({ supabase: db, getScraper: () => scraper });
  const second = await runDailyScrape({ supabase: db, getScraper: () => scraper });
  assert.equal(db.tables.leads.length, 1);
  assert.equal(second.totalLeads, 0);
});

test("unknown fields from a scraper no longer drop the lead", async () => {
  const db = fakeSupabase({ cities: [CITIES[0]] });
  db.failInsertsWith.add("_meta");
  const scraper = async () => [{ address: "1 A St", city: "Odessa", _meta: { score: 80 } }];
  const summary = await runDailyScrape({ supabase: db, getScraper: () => scraper });
  assert.equal(summary.totalLeads, 1);
  assert.deepEqual(db.tables.leads[0].raw_data.extra, { _meta: { score: 80 } });
});

test("a failing scraper marks its runs failed without stopping other cities", async () => {
  const db = fakeSupabase({ cities: CITIES });
  const broken = async () => { throw new Error("site down"); };
  const working = async () => [{ address: "2 B St", city: "Midland" }];
  const summary = await runDailyScrape({ supabase: db, getScraper: (name) => (name === "Odessa" ? broken : working) });
  assert.equal(summary.failures.length, 1);
  assert.equal(summary.totalLeads, 1);
  const failed = db.tables.scrape_runs.find((r) => r.city_id === "c1");
  assert.equal(failed.status, "failed");
  assert.match(failed.error, /site down/);
});

test("runs left 'running' by a crash are recovered as failed", async () => {
  const old = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  const db = fakeSupabase({ cities: [], scrape_runs: [{ id: "old", status: "running", started_at: old }] });
  const summary = await runDailyScrape({ supabase: db, getScraper: () => async () => [] });
  assert.equal(summary.recovered, 1);
  assert.equal(db.tables.scrape_runs[0].status, "failed");
});
