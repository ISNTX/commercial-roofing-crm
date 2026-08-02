import pLimit from "p-limit";
import { env } from "./lib/env.js";
import { getSupabase } from "./lib/supabaseClient.js";
import { sendToOutreachEngine } from "./lib/outreach.js";
import { getAllCounties, getCountyScraper } from "./counties/registry.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCountyIdMap(supabase) {
  const { data, error } = await supabase.from("counties").select("id, name");
  if (error) throw error;
  return new Map(data.map((c) => [c.name, c.id]));
}

async function scrapeCounty(supabase, countyName, countyId) {
  const { data: run, error: runError } = await supabase
    .from("scrape_runs")
    .insert({ county_id: countyId, status: "running" })
    .select()
    .single();
  if (runError) throw runError;

  try {
    const scraper = getCountyScraper(countyName);
    const rawLeads = await scraper();

    let leadsFound = 0;
    for (const raw of rawLeads) {
      const { error: leadError } = await supabase.from("leads").insert({
        county_id: countyId,
        source: `scraper:${countyName}`,
        ...raw,
      });
      if (leadError) {
        console.error(`failed to insert lead for ${countyName}:`, leadError);
        continue;
      }
      leadsFound += 1;
      await sendToOutreachEngine({ ...raw, county: countyName });
    }

    await supabase
      .from("scrape_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        leads_found: leadsFound,
      })
      .eq("id", run.id);

    return { county: countyName, leadsFound };
  } catch (err) {
    await supabase
      .from("scrape_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: String(err?.message || err),
      })
      .eq("id", run.id);
    return { county: countyName, error: String(err?.message || err) };
  }
}

export async function runDailyScrape() {
  const supabase = getSupabase();
  const counties = getAllCounties();
  const countyIds = await getCountyIdMap(supabase);
  const limit = pLimit(env.scrapeConcurrency);

  const results = [];
  for (const countyName of counties) {
    const countyId = countyIds.get(countyName);
    if (!countyId) {
      console.warn(`no counties row for "${countyName}" — skipping`);
      continue;
    }
    results.push(
      limit(async () => {
        const result = await scrapeCounty(supabase, countyName, countyId);
        await sleep(env.scrapeDelayMs);
        return result;
      })
    );
  }

  const settled = await Promise.all(results);
  const totalLeads = settled.reduce((sum, r) => sum + (r.leadsFound || 0), 0);
  const failures = settled.filter((r) => r.error);

  console.log(
    `scrape complete: ${settled.length} counties, ${totalLeads} leads, ${failures.length} failures`
  );
  return { counties: settled.length, totalLeads, failures };
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
