"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

// Roles allowed to see this page (mirrors the API)
const ALLOWED_ROLES = ["SCRUTINY_OFFICER", "APPROVING_AUTHORITY", "ADMIN"];

interface StateRow {
  state: string;
  totalAmount: number;
  totalCrores: number;
  instrumentCount: number;
  institutionCount: number;
  expiringIn30Days: number;
  mismatchCount: number;
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

const StateBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as StateRow;
    const totalCrores = d.totalCrores.toLocaleString("en-IN", { maximumFractionDigits: 2 });
    return (
      <div className="bg-slate-900 text-white text-xs p-3 rounded-lg shadow-lg border border-slate-700 min-w-[200px]">
        <p className="font-bold text-slate-200 mb-1.5 text-sm">{d.state}</p>
        <p className="text-emerald-400 font-semibold">₹{totalCrores} Cr</p>
        <div className="mt-1.5 space-y-0.5 text-slate-300">
          <p>Instruments: <span className="font-medium text-slate-100">{d.instrumentCount}</span></p>
          <p>Institutions: <span className="font-medium text-slate-100">{d.institutionCount}</span></p>
          {d.expiringIn30Days > 0 && (
            <p className="text-amber-400">Expiring ≤30d: <span className="font-medium">{d.expiringIn30Days}</span></p>
          )}
          {d.mismatchCount > 0 && (
            <p className="text-rose-400">Mismatches: <span className="font-medium">{d.mismatchCount}</span></p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// ── CSV export helper ─────────────────────────────────────────────────────────

function exportCsv(rows: StateRow[], totalExposure: number) {
  const header = "State,Instruments,Institutions,Total (₹ Cr),Share (%),Expiring ≤30d,Mismatches";
  const lines = rows.map((r) => {
    const share =
      totalExposure > 0
        ? ((r.totalAmount / totalExposure) * 100).toFixed(2)
        : "0.00";
    return [
      `"${r.state}"`,
      r.instrumentCount,
      r.institutionCount,
      r.totalCrores.toFixed(2),
      share,
      r.expiringIn30Days,
      r.mismatchCount,
    ].join(",");
  });
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aicte_state_exposure_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Main inner component ──────────────────────────────────────────────────────

function StateExposureInner() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const user = session?.user as any;

  // Filters
  const [limit, setLimit] = useState<number>(
    parseInt(searchParams.get("limit") || "10", 10)
  );
  const [filterType, setFilterType] = useState(searchParams.get("type") || "");
  const [filterBank, setFilterBank] = useState(searchParams.get("bank") || "");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "");

  // Data
  const [data, setData] = useState<StateRow[]>([]);
  const [meta, setMeta] = useState<{ totalStates: number; generatedAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Role guard
  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (sessionStatus === "authenticated" && !ALLOWED_ROLES.includes(user?.role)) {
      router.push("/dashboard");
    }
  }, [sessionStatus, user, router]);

  const fetchData = useCallback(() => {
    if (sessionStatus !== "authenticated") return;
    if (!ALLOWED_ROLES.includes(user?.role)) return;

    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (filterType) params.set("type", filterType);
    if (filterBank) params.set("bank", filterBank);
    if (filterStatus) params.set("status", filterStatus);

    fetch(`/api/reports/state-exposure?${params.toString()}`)
      .then((res) => {
        if (res.status === 403) throw new Error("You do not have permission to view this report.");
        if (!res.ok) throw new Error(`Request failed: HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json.data ?? []);
        setMeta(json.meta ?? null);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message || "Failed to load state exposure data.");
        setLoading(false);
      });
  }, [sessionStatus, user, limit, filterType, filterBank, filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (sessionStatus === "loading") {
    return <PageSkeleton />;
  }

  // Summary calculations
  const totalExposure = data.reduce((s, r) => s + r.totalAmount, 0);
  const totalInstruments = data.reduce((s, r) => s + r.instrumentCount, 0);
  const topState = data[0] ?? null;
  const totalCrores = totalExposure / 10_000_000;

  const inrFmt = (n: number) =>
    n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">State-Wise Exposure</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live instrument exposure aggregated by state ·{" "}
              {meta ? (
                <span>
                  {meta.totalStates} states in DB · last updated{" "}
                  {new Date(meta.generatedAt).toLocaleTimeString("en-IN")}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCsv(data, totalExposure)}
              disabled={data.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-40"
              aria-label="Export filtered data as CSV"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            label="Total Exposure"
            value={`₹${inrFmt(totalCrores)} Cr`}
            color="emerald"
          />
          <SummaryCard
            label="States"
            value={String(data.length)}
            color="sky"
          />
          <SummaryCard
            label="Live Instruments"
            value={totalInstruments.toLocaleString("en-IN")}
            color="indigo"
          />
          <SummaryCard
            label="Top State"
            value={topState ? topState.state : "—"}
            sub={topState ? `₹${inrFmt(topState.totalCrores)} Cr` : undefined}
            color="amber"
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Limit */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Show
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                className="w-full px-2 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                aria-label="Number of states to show"
              >
                <option value={10}>Top 10</option>
                <option value={15}>Top 15</option>
                <option value={200}>All</option>
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Instrument Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-2 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                aria-label="Filter by instrument type"
              >
                <option value="">All Types</option>
                <option value="FDR">FDR</option>
                <option value="SECURITY_DEPOSIT">Security Deposit</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-2 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                aria-label="Filter by status"
              >
                <option value="">All Live Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRING_SOON">Expiring Soon</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="VERIFIED">Verified</option>
                <option value="MISMATCH">Mismatch</option>
              </select>
            </div>

            {/* Bank */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Bank (contains)
              </label>
              <input
                type="text"
                value={filterBank}
                onChange={(e) => setFilterBank(e.target.value)}
                placeholder="e.g. State Bank"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                aria-label="Filter by bank name"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700 text-sm mb-5" role="alert">
            {error}
          </div>
        )}

        {/* Chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Total Exposure by State</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">
              ₹ Crores
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-72">
              <div className="w-8 h-8 border-4 border-sky-700 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-72 text-slate-400">
              <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm font-medium">No data matches the current filters.</p>
            </div>
          ) : (
            <div
              style={{ height: Math.max(280, data.length * 32) }}
              className="w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="state"
                    tick={{ fontSize: 11, fill: "#475569" }}
                    width={130}
                    interval={0}
                  />
                  <Tooltip content={<StateBarTooltip />} />
                  <Bar
                    dataKey="totalCrores"
                    name="₹ Crores"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={22}
                    isAnimationActive={true}
                  >
                    {data.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={activeIndex === index ? "#f97316" : "#1e3a5f"}
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseLeave={() => setActiveIndex(null)}
                        style={{ cursor: "pointer" }}
                        onClick={() =>
                          router.push(
                            `/instruments?state=${encodeURIComponent(data[index].state)}`
                          )
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Table */}
        {!loading && data.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">State Summary Table</h3>
              <p className="text-[11px] text-slate-500">Click a row to view instruments for that state</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap">#</th>
                    <th className="py-3 px-4 whitespace-nowrap">State</th>
                    <th className="py-3 px-4 whitespace-nowrap text-right">Instruments</th>
                    <th className="py-3 px-4 whitespace-nowrap text-right">Institutions</th>
                    <th className="py-3 px-4 whitespace-nowrap text-right">₹ Crores</th>
                    <th className="py-3 px-4 whitespace-nowrap text-right">Share %</th>
                    <th className="py-3 px-4 whitespace-nowrap text-right">Expiring ≤30d</th>
                    <th className="py-3 px-4 whitespace-nowrap text-right">Mismatches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((row, idx) => {
                    const share =
                      totalExposure > 0
                        ? ((row.totalAmount / totalExposure) * 100).toFixed(1)
                        : "0.0";
                    return (
                      <tr
                        key={row.state}
                        onClick={() =>
                          router.push(
                            `/instruments?state=${encodeURIComponent(row.state)}`
                          )
                        }
                        className="hover:bg-slate-50 transition cursor-pointer"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            router.push(
                              `/instruments?state=${encodeURIComponent(row.state)}`
                            );
                          }
                        }}
                        aria-label={`View instruments for ${row.state}`}
                      >
                        <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          <Link
                            href={`/instruments?state=${encodeURIComponent(row.state)}`}
                            className="hover:text-sky-700 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.state}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {row.instrumentCount.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {row.institutionCount.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          ₹{inrFmt(row.totalCrores)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div
                              className="h-1.5 rounded-full bg-sky-600 opacity-60"
                              style={{ width: `${Math.round(parseFloat(share))}px` }}
                              aria-hidden="true"
                            />
                            <span>{share}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {row.expiringIn30Days > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              {row.expiringIn30Days}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {row.mismatchCount > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              {row.mismatchCount}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: "emerald" | "sky" | "indigo" | "amber";
}) {
  const border = {
    emerald: "border-emerald-200 bg-emerald-50",
    sky: "border-sky-200 bg-sky-50",
    indigo: "border-indigo-200 bg-indigo-50",
    amber: "border-amber-200 bg-amber-50",
  }[color];
  const text = {
    emerald: "text-emerald-700",
    sky: "text-sky-700",
    indigo: "text-indigo-700",
    amber: "text-amber-700",
  }[color];

  return (
    <div className={`rounded-xl border p-4 ${border}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${text} truncate`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="h-16 bg-slate-900" />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>
    </div>
  );
}

// ── Export wrapped in Suspense (required for useSearchParams) ─────────────────

export default function StateExposurePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StateExposureInner />
    </Suspense>
  );
}

