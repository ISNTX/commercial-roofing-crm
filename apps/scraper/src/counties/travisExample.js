// Example / template county scraper.
//
// This is a reference implementation showing the shape every county
// scraper should return, NOT a verified integration with Travis County's
// permit system — the real source URL and HTML/JSON structure need to be
// confirmed before this goes live. Copy this file per-county once you've
// identified that county's public permit or bid-notice source.
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

export async function scrapeTravisCounty() {
  // TODO: replace with the real data source, e.g. Travis County's
  // Accela/Citizen Access permit search, once confirmed. Left unimplemented
  // so the daily run reports 0 leads instead of fabricating data.
  return [];
}
