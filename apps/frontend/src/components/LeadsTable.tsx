import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { Lead } from "@/lib/api";
import StatusBadge from "./StatusBadge";

const columns: ColumnDef<Lead>[] = [
  {
    header: "County",
    accessorFn: (row) => row.counties?.name ?? "—",
  },
  {
    header: "Project type",
    accessorKey: "project_type",
    cell: (info) => info.getValue() ?? "—",
  },
  {
    header: "Est. value",
    accessorKey: "project_value_estimate",
    cell: (info) => {
      const value = info.getValue<number | null>();
      return value ? `$${value.toLocaleString()}` : "—";
    },
  },
  {
    header: "Address",
    accessorFn: (row) => [row.address, row.city].filter(Boolean).join(", ") || "—",
  },
  {
    header: "Contact",
    accessorFn: (row) => row.contact_name ?? row.contact_phone ?? "—",
  },
  {
    header: "Status",
    accessorKey: "status",
    cell: (info) => <StatusBadge status={info.getValue<string>()} />,
  },
  {
    header: "Scraped",
    accessorKey: "scraped_at",
    cell: (info) => new Date(info.getValue<string>()).toLocaleDateString(),
  },
];

export default function LeadsTable({ leads, loading }: { leads: Lead[]; loading: boolean }) {
  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead className="border-b bg-slate-50 text-left text-slate-500">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 font-medium">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                Loading leads…
              </td>
            </tr>
          ) : leads.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                No leads match these filters yet.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
