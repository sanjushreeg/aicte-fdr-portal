import React from "react";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  EXPIRING_SOON: "bg-amber-100 text-amber-800",
  SUBMITTED: "bg-sky-100 text-sky-800",
  VERIFIED: "bg-teal-100 text-teal-800",
  MISMATCH: "bg-rose-100 text-rose-800",
  MATURED: "bg-violet-100 text-violet-800",
  EXPIRED: "bg-slate-200 text-slate-700",
  RENEWED: "bg-blue-100 text-blue-800",
  REPLACED: "bg-indigo-100 text-indigo-800",
  RELEASED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cls}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-red-100 text-red-800",
    high: "bg-rose-100 text-rose-800",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-slate-100 text-slate-700",
  };
  const cls = map[severity] ?? "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cls}`}
    >
      {severity}
    </span>
  );
}

export function DaysToMaturityBadge({ days }: { days: number }) {
  let cls = "text-slate-500";
  if (days < 0) cls = "text-red-600 font-bold";
  else if (days <= 7) cls = "text-red-500 font-bold";
  else if (days <= 30) cls = "text-amber-600 font-semibold";
  else if (days <= 90) cls = "text-amber-500 font-medium";

  return (
    <span className={`text-xs ${cls}`}>
      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
    </span>
  );
}
