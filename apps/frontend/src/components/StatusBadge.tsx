import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-amber-100 text-amber-800",
  qualified: "bg-green-100 text-green-800",
  disqualified: "bg-slate-100 text-slate-600",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] || "bg-slate-100 text-slate-600"
      )}
    >
      {status}
    </span>
  );
}
