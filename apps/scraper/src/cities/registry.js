import { scrapeAustin } from "./austinExample.js";
import { scrapeOdessaMidland } from "./odessaMidland.js";

// Stub used by every city that doesn't have a real scraper wired up yet.
// Returns no leads rather than fabricating data.
async function notYetImplemented() {
  return [];
}

const CITY_SCRAPERS = {
  Austin:  scrapeAustin,
  // Odessa and Midland share a single scraper (both in the Permian Basin)
  Odessa:  scrapeOdessaMidland,
  Midland: scrapeOdessaMidland,
};

export function getCityScraper(cityName) {
  return CITY_SCRAPERS[cityName] || notYetImplemented;
}
