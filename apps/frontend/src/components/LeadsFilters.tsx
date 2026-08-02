import type { County } from "@/lib/api";

const PROJECT_TYPES = ["reroof", "new_construction", "repair"];
const STATUSES = ["new", "contacted", "qualified", "disqualified"];

interface Props {
  counties: County[];
  county: string;
  projectType: string;
  status: string;
  onCountyChange: (value: string) => void;
  onProjectTypeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

export default function LeadsFilters({
  counties,
  county,
  projectType,
  status,
  onCountyChange,
  onProjectTypeChange,
  onStatusChange,
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap gap-3">
      <select
        className="rounded-md border bg-white px-3 py-2 text-sm"
        value={county}
        onChange={(e) => onCountyChange(e.target.value)}
      >
        <option value="">All counties</option>
        {counties.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        className="rounded-md border bg-white px-3 py-2 text-sm"
        value={projectType}
        onChange={(e) => onProjectTypeChange(e.target.value)}
      >
        <option value="">All project types</option>
        {PROJECT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <select
        className="rounded-md border bg-white px-3 py-2 text-sm"
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
