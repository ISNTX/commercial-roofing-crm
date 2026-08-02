export const env = {
  port: process.env.PORT || 8787,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  scrapeConcurrency: Number(process.env.SCRAPE_CONCURRENCY || 4),
  scrapeDelayMs: Number(process.env.SCRAPE_DELAY_MS || 5000),
  outreachEngineUrl: process.env.OUTREACH_ENGINE_URL,
  outreachEngineApiKey: process.env.OUTREACH_ENGINE_API_KEY,
  appName: process.env.APP_NAME || "commercial-roofing-crm",
  scraperTriggerSecret: process.env.SCRAPER_TRIGGER_SECRET,
};

export function assertSupabaseEnv() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for the scraper"
    );
  }
}
