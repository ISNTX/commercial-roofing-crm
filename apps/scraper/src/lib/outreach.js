import { env } from "./env.js";

// Every app in the standard stack forwards captured leads to the central
// outreach engine, source-tagged with APP_NAME. No-op if unconfigured so a
// single app can be run standalone during development.
export async function sendToOutreachEngine(lead) {
  if (!env.outreachEngineUrl) return;

  const res = await fetch(env.outreachEngineUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.outreachEngineApiKey
        ? { Authorization: `Bearer ${env.outreachEngineApiKey}` }
        : {}),
    },
    body: JSON.stringify({
      source: env.appName,
      contact_name: lead.contact_name,
      contact_phone: lead.contact_phone,
      contact_email: lead.contact_email,
      metadata: {
        county: lead.county,
        project_type: lead.project_type,
        address: lead.address,
      },
    }),
  });

  if (!res.ok) {
    console.error(
      `outreach engine rejected lead: ${res.status} ${await res.text()}`
    );
  }
}
