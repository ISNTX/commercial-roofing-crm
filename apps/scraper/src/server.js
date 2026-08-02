import express from "express";
import { env } from "./lib/env.js";
import { runDailyScrape } from "./run.js";

const app = express();
let scrapeInFlight = null;

app.get("/health", (_req, res) => {
  res.json({ status: "ok", app: env.appName });
});

// Triggered daily by Supabase pg_cron + pg_net (see supabase/migrations).
// Requires a shared-secret header so the endpoint can't be triggered by
// anyone who finds the Railway URL.
app.post("/run", async (req, res) => {
  if (
    env.scraperTriggerSecret &&
    req.get("x-trigger-secret") !== env.scraperTriggerSecret
  ) {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (scrapeInFlight) {
    return res.status(409).json({ error: "scrape already running" });
  }

  scrapeInFlight = runDailyScrape().finally(() => {
    scrapeInFlight = null;
  });

  // Fire-and-forget: county scrapes can take longer than an HTTP timeout,
  // so acknowledge the trigger immediately and let it run in the background.
  res.status(202).json({ status: "started" });
});

app.listen(env.port, () => {
  console.log(`scraper service listening on :${env.port}`);
});
