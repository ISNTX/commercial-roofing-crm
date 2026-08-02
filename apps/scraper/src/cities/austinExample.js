// Example / template city scraper.
//
// This is a reference implementation showing the shape every city scraper
// should return, NOT a verified integration with Austin's permit system —
// the real source (e.g. the city's public open-data permits dataset) needs
// to be confirmed before this goes live. Copy this file per-city once
// you've identified and verified that city's real permit/bid-notice
// source.
//
// Each scraper must return an array of lead objects shaped like:
//   {
//     project_type: 'reroof' | 'new_construction' | 'repair' | ...,
//     project_value_estimate: number | null,
//     address, city, zip,
//     contact_name, contact_phone, contact_email,
//     permit_url,
//     raw_data: { ...whatever the source gave us, for auditing },
//   }

export async function scrapeAustin() {
  // TODO: replace with the real data source once confirmed. Left
  // unimplemented so the daily run reports 0 leads instead of
  // fabricating data.
  return [];
}
