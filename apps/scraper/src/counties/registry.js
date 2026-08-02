import { scrapeTravisCounty } from "./travisExample.js";
import { TEXAS_COUNTIES } from "./list.js";

// Stub used by every county that doesn't have a real scraper wired up yet.
// Returns no leads rather than fabricating data.
async function notYetImplemented() {
  return [];
}

const COUNTY_SCRAPERS = {
  "Travis County": scrapeTravisCounty,
};

export function getCountyScraper(countyName) {
  return COUNTY_SCRAPERS[countyName] || notYetImplemented;
}

export function getAllCounties() {
  return TEXAS_COUNTIES;
}
