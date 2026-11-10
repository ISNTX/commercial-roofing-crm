import express from "express";
import { env } from "./lib/env.js";
import { getSupabase } from "./lib/supabaseClient.js";
import { runDailyScrape } from "./run.js";

const app = express();
let scrapeInFlight = null;

function startScrape(reason) {
  if (scrapeInFlight) return false;
  console.log(`starting scrape (${reason})`);
  scrapeInFlight = runDailyScrape()
    .catch((err) => console.error("scrape crashed:", err))
    .finally(() => {
      scrapeInFlight = null;
    });
  return true;
}

async function lastRunStartedAt() {
  const { data, error } = await getSupabase()
    .from("scrape_runs")
    .select("started_at")
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.started_at ? new Date(data[0].started_at) : null;
}

app.get("/health", async (_req, res) => {
  const body = { status: "ok", app: env.appName, scrape_in_flight: Boolean(scrapeInFlight) };
  try {
    const { data, error } = await getSupabase()
      .from("scrape_runs")
      .select("status, started_at, finished_at, leads_found")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const last = data?.[0];
    const lastSuccess = data?.find((r) => r.status === "success");
    body.last_run_started_at = last?.started_at ?? null;
    body.last_success_at = lastSuccess?.finished_at ?? null;
    body.recent_failures = data?.filter((r) => r.status === "failed").length ?? 0;
    const staleMs = env.watchdogHours * 3600 * 1000;
    if (staleMs && (!last || Date.now() - new Date(last.started_at) > staleMs)) {
      body.status = "degraded";
      body.problem = "no scrape has started recently; check the daily trigger";
    }
  } catch (err) {
    body.status = "degraded";
    body.problem = `cannot read run history: ${err?.message || err}`;
  }
  // Always 200 so the platform healthcheck keeps the service up; the body
  // says whether the scraping itself is healthy.
  res.json(body);
});

// Triggered daily by Supabase pg_cron + pg_net (see supabase/migrations).
// Fails closed: without SCRAPER_TRIGGER_SECRET configured, nobody can
// trigger a run over HTTP (use `npm run scrape` locally instead).
app.post("/run", (req, res) => {
  if (!env.scraperTriggerSecret) {
    return res.status(503).json({ error: "SCRAPER_TRIGGER_SECRET is not configured" });
  }
  if (req.get("x-trigger-secret") !== env.scraperTriggerSecret) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!startScrape("trigger")) {
    return res.status(409).json({ error: "scrape already running" });
  }
  // Fire-and-forget: scrapes can take longer than an HTTP timeout, so
  // acknowledge the trigger immediately and let it run in the background.
  res.status(202).json({ status: "started" });
});

// Self-healing backstop: if the pg_cron trigger is misconfigured or a run
// was missed, start one once no run has begun for `watchdogHours`.
async function watchdog() {
  try {
    const last = await lastRunStartedAt();
    if (!last || Date.now() - last > env.watchdogHours * 3600 * 1000) {
      startScrape(last ? `watchdog: last run started ${last.toISOString()}` : "watchdog: no runs recorded");
    }
  } catch (err) {
    console.error("watchdog check failed:", err?.message || err);
  }
}

process.on("unhandledRejection", (err) => console.error("unhandled rejection:", err));

app.listen(env.port, () => {
  console.log(`scraper service listening on :${env.port}`);
  if (env.watchdogHours > 0) {
    setTimeout(watchdog, 60 * 1000);
    setInterval(watchdog, 60 * 60 * 1000);
  }
});
