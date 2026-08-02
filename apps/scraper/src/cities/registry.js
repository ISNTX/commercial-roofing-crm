import { scrapeAustin } from "./austinExample.js";

// Stub used by every city that doesn't have a real scraper wired up yet.
// Returns no leads rather than fabricating data.
async function notYetImplemented() {
  return [];
}

const CITY_SCRAPERS = {
  Austin: scrapeAustin,
};

export function getCityScraper(cityName) {
  return CITY_SCRAPERS[cityName] || notYetImplemented;
}
