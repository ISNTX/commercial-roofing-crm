import pLimit from "p-limit";
import { env } from "./lib/env.js";
import { getSupabase } from "./lib/supabaseClient.js";
import { sendToOutreachEngine } from "./lib/outreach.js";
import { getCityScraper } from "./cities/registry.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCities(supabase) {
  const { data, error } = await supabase.from("cities").select("id, name, county_id");
  if (error) throw error;
  return data;
}

async function scrapeCity(supabase, city) {
  const { data: run, error: runError } = await supabase
    .from("scrape_runs")
    .insert({ city_id: city.id, county_id: city.county_id, status: "running" })
    .select()
    .single();
  if (runError) throw runError;

  try {
    const scraper = getCityScraper(city.name);
    const rawLeads = await scraper();

    let leadsFound = 0;
    for (const raw of rawLeads) {
      const { error: leadError } = await supabase.from("leads").insert({
        city_id: city.id,
        county_id: city.county_id,
        source: `scraper:${city.name}`,
        ...raw,
      });
      if (leadError) {
        console.error(`failed to insert lead for ${city.name}:`, leadError);
        continue;
      }
      leadsFound += 1;
      await sendToOutreachEngine({ ...raw, city: city.name });
    }

    await supabase
      .from("scrape_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        leads_found: leadsFound,
      })
      .eq("id", run.id);

    return { city: city.name, leadsFound };
  } catch (err) {
    await supabase
      .from("scrape_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: String(err?.message || err),
      })
      .eq("id", run.id);
    return { city: city.name, error: String(err?.message || err) };
  }
}

export async function runDailyScrape() {
  const supabase = getSupabase();
  const cities = await getCities(supabase);
  const limit = pLimit(env.scrapeConcurrency);

  const results = cities.map((city) =>
    limit(async () => {
      const result = await scrapeCity(supabase, city);
      await sleep(env.scrapeDelayMs);
      return result;
    })
  );

  const settled = await Promise.all(results);
  const totalLeads = settled.reduce((sum, r) => sum + (r.leadsFound || 0), 0);
  const failures = settled.filter((r) => r.error);

  console.log(
    `scrape complete: ${settled.length} cities, ${totalLeads} leads, ${failures.length} failures`
  );
  return { cities: settled.length, totalLeads, failures };
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
