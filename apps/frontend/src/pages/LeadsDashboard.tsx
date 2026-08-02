import { useEffect, useState } from "react";
import {
  fetchCities,
  fetchCounties,
  fetchLeads,
  type City,
  type County,
  type Lead,
} from "@/lib/api";
import LeadsFilters from "@/components/LeadsFilters";
import LeadsTable from "@/components/LeadsTable";

const PAGE_SIZE = 25;

export default function LeadsDashboard() {
  const [counties, setCounties] = useState<County[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [projectType, setProjectType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchCounties().then(setCounties).catch(() => setCounties([]));
    fetchCities().then(setCities).catch(() => setCities([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchLeads({
      county: county || undefined,
      city: city || undefined,
      project_type: projectType || undefined,
      status: status || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((res) => {
        setLeads(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [county, city, projectType, status, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <LeadsFilters
        counties={counties}
        cities={cities}
        county={county}
        city={city}
        projectType={projectType}
        status={status}
        onCountyChange={(v) => {
          setCounty(v);
          setPage(0);
        }}
        onCityChange={(v) => {
          setCity(v);
          setPage(0);
        }}
        onProjectTypeChange={(v) => {
          setProjectType(v);
          setPage(0);
        }}
        onStatusChange={(v) => {
          setStatus(v);
          setPage(0);
        }}
      />

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <LeadsTable leads={leads} loading={loading} />

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>{total} leads</span>
        <div className="flex gap-2">
          <button
            className="rounded-md border bg-white px-3 py-1 disabled:opacity-50"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button
            className="rounded-md border bg-white px-3 py-1 disabled:opacity-50"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
