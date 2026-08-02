const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface Lead {
  id: string;
  county_id: string | null;
  counties: { name: string } | null;
  project_type: string | null;
  project_value_estimate: number | null;
  address: string | null;
  city: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: string;
  scraped_at: string;
}

export interface LeadsResponse {
  items: Lead[];
  total: number;
  limit: number;
  offset: number;
}

export interface County {
  id: string;
  name: string;
  fips_code: string | null;
}

export interface LeadsFilters {
  county?: string;
  project_type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function fetchLeads(filters: LeadsFilters = {}): Promise<LeadsResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const res = await fetch(`${API_URL}/leads?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch leads: ${res.status}`);
  return res.json();
}

export async function fetchCounties(): Promise<County[]> {
  const res = await fetch(`${API_URL}/counties`);
  if (!res.ok) throw new Error(`Failed to fetch counties: ${res.status}`);
  return res.json();
}
