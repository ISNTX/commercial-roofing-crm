import { supabase } from "./supabaseClient";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface Lead {
  id: string;
  county_id: string | null;
  counties: { name: string } | null;
  city_id: string | null;
  cities: { name: string } | null;
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

export interface City {
  id: string;
  name: string;
  county_id: string;
  counties: { name: string } | null;
}

export interface LeadsFilters {
  county?: string;
  city?: string;
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
  const res = await fetch(`${API_URL}/leads?${params.toString()}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch leads: ${res.status}`);
  return res.json();
}

export async function fetchCounties(): Promise<County[]> {
  const res = await fetch(`${API_URL}/counties`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch counties: ${res.status}`);
  return res.json();
}

export async function fetchCities(): Promise<City[]> {
  const res = await fetch(`${API_URL}/cities`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch cities: ${res.status}`);
  return res.json();
}
