import pLimit from "p-limit";
import { env } from "./lib/env.js";
import { getSupabase } from "./lib/supabaseClient.js";
import { sendToOutreachEngine } from "./lib/outreach.js";
import { getCityScraper } from "./cities/registry.js";

// Columns a scraper may set on a lead. Anything else a scraper returns is
// kept in raw_data.extra instead of being sent to PostgREST, which rejects
// unknown columns and would otherwise drop the whole insert.
const LEAD_COLUMNS = [
  "project_type",
  "project_value_estimate",
  "address",
  "city",
  "zip",
  "contact_name",
  "contact_phone",
  "contact_email",
  "permit_url",
  "contractor_id",
];

// A run still marked "running" after this long was interrupted (deploy,
// crash, OOM) and will never finish on its own.
const STALE_RUN_MS = 2 * 60 * 60 * 1000;
const DEDUPE_WINDOW_DAYS = 90;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeAddress(address) {
  return String(address || "")
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeLead(raw) {
  const lead = {};
  const extra = {};
  for (const [key, value] of Object.entries(raw || {})) {
    if (LEAD_COLUMNS.includes(key)) lead[key] = value;
    else if (key !== "raw_data") extra[key] = value;
  }
  const rawData = raw?.raw_data && typeof raw.raw_data === "object" ? raw.raw_data : {};
  lead.raw_data = Object.keys(extra).length ? { ...rawData, extra } : rawData;
  return lead;
}

export async function withRetry(fn, { attempts = env.scrapeRetries, baseDelayMs = 2000, timeoutMs = env.scrapeTimeoutMs } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let timer;
    try {
      return await Promise.race([
        fn(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
    } catch (err) {
      lastError = err;
      if (attempt < attempts) await sleep(baseDelayMs * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

export async function recoverStaleRuns(supabase, now = Date.now()) {
  const cutoff = new Date(now - STALE_RUN_MS).toISOString();
  const { data, error } = await supabase
    .from("scrape_runs")
    .update({
      status: "failed",
      finished_at: new Date(now).toISOString(),
      error: "interrupted: run never finished (service restarted or crashed)",
    })
    .eq("status", "running")
    .lt("started_at", cutoff)
    .select("id");
  if (error) {
    console.error("could not recover stale runs:", error);
    return 0;
  }
  return data?.length || 0;
}

async function getCities(supabase) {
  const { data, error } = await supabase.from("cities").select("id, name, county_id, counties(name)");
  if (error) throw error;
  return data;
}

async function existingAddresses(supabase, cityId) {
  const since = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 86400000).toISOString();
  const { data, error } = await supabase
    .from("leads")
    .select("address, project_type")
    .eq("city_id", cityId)
    .gte("scraped_at", since);
  if (error) throw error;
  return new Set((data || []).map((l) => `${normalizeAddress(l.address)}|${l.project_type || ""}`));
}

async function forwardToOutreach(lead) {
  // Outreach is best-effort: a failure here must not mark a run as failed
  // after its leads were already saved.
  try {
    await sendToOutreachEngine(lead);
  } catch (err) {
    console.error("outreach engine unreachable:", err?.message || err);
  }
}

async function saveCityLeads(supabase, city, rawLeads) {
  const seen = await existingAddresses(supabase, city.id);
  let saved = 0;
  let duplicates = 0;
  for (const raw of rawLeads) {
    const lead = sanitizeLead(raw);
    const key = `${normalizeAddress(lead.address)}|${lead.project_type || ""}`;
    if (!lead.address || seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    const { error } = await supabase.from("leads").insert({
      ...lead,
      city_id: city.id,
      county_id: city.county_id,
      source: `scraper:${city.name}`,
    });
    if (error) {
      console.error(`failed to insert lead for ${city.name}:`, error);
      continue;
    }
    saved += 1;
    await forwardToOutreach({ ...lead, city: city.name, county: city.counties?.name });
  }
  return { saved, duplicates };
}

// A scraper shared by several cities (e.g. one Permian Basin scraper for
// Odessa and Midland) runs once per daily run; each city gets the leads
// whose `city` matches it, and leads matching none go to the first city.
function splitByCity(leads, cities) {
  const byName = new Map(cities.map((c) => [c.name.toLowerCase(), []]));
  for (const lead of leads) {
    const bucket = byName.get(String(lead.city || "").toLowerCase()) || byName.get(cities[0].name.toLowerCase());
    bucket.push(lead);
  }
  return byName;
}

async function startRun(supabase, city) {
  const { data, error } = await supabase
    .from("scrape_runs")
    .insert({ city_id: city.id, county_id: city.county_id, status: "running" })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

async function finishRun(supabase, runId, fields) {
  const { error } = await supabase
    .from("scrape_runs")
    .update({ finished_at: new Date().toISOString(), ...fields })
    .eq("id", runId);
  if (error) console.error("could not record run result:", error);
}

async function scrapeGroup(supabase, scraper, cities) {
  const runIds = new Map();
  for (const city of cities) runIds.set(city.id, await startRun(supabase, city));

  let leads;
  try {
    leads = await withRetry(() => scraper());
    if (!Array.isArray(leads)) throw new Error("scraper did not return an array");
  } catch (err) {
    const message = String(err?.message || err);
    for (const city of cities) await finishRun(supabase, runIds.get(city.id), { status: "failed", error: message });
    return cities.map((city) => ({ city: city.name, error: message }));
  }

  const buckets = splitByCity(leads, cities);
  const results = [];
  for (const city of cities) {
    try {
      const { saved, duplicates } = await saveCityLeads(supabase, city, buckets.get(city.name.toLowerCase()));
      await finishRun(supabase, runIds.get(city.id), { status: "success", leads_found: saved });
      results.push({ city: city.name, leadsFound: saved, duplicates });
    } catch (err) {
      const message = String(err?.message || err);
      await finishRun(supabase, runIds.get(city.id), { status: "failed", error: message });
      results.push({ city: city.name, error: message });
    }
  }
  return results;
}

export async function runDailyScrape({ supabase = getSupabase(), getScraper = getCityScraper } = {}) {
  const recovered = await recoverStaleRuns(supabase);
  if (recovered) console.warn(`marked ${recovered} interrupted run(s) as failed`);

  const cities = await getCities(supabase);
  const groups = new Map();
  for (const city of cities) {
    const scraper = getScraper(city.name);
    if (!groups.has(scraper)) groups.set(scraper, []);
    groups.get(scraper).push(city);
  }

  const limit = pLimit(env.scrapeConcurrency);
  const settled = (
    await Promise.all(
      [...groups].map(([scraper, groupCities]) =>
        limit(async () => {
          const results = await scrapeGroup(supabase, scraper, groupCities);
          await sleep(env.scrapeDelayMs);
          return results;
        })
      )
    )
  ).flat();

  const totalLeads = settled.reduce((sum, r) => sum + (r.leadsFound || 0), 0);
  const failures = settled.filter((r) => r.error);

  console.log(
    `scrape complete: ${settled.length} cities, ${totalLeads} new leads, ${failures.length} failures`
  );
  return { cities: settled.length, totalLeads, failures, recovered };
}

// Allow `npm run scrape` to run this directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  runDailyScrape()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
