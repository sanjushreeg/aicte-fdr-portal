"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge, DaysToMaturityBadge } from "@/components/StatusBadge";

const STATUSES = [
  "ACTIVE",
  "EXPIRING_SOON",
  "SUBMITTED",
  "VERIFIED",
  "MISMATCH",
  "MATURED",
  "EXPIRED",
  "RENEWED",
  "REPLACED",
  "RELEASED",
  "REJECTED",
];

const MATURITY_WINDOWS = [
  { label: "Overdue", value: "overdue" },
  { label: "Within 7 days", value: "7" },
  { label: "Within 30 days", value: "30" },
  { label: "Within 60 days", value: "60" },
  { label: "Within 90 days", value: "90" },
];

function InstrumentsPageInner() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter state
  const [filters, setFilters] = useState({
    status: searchParams.get("status") || "",
    type: searchParams.get("type") || "",
    state: searchParams.get("state") || "",
    institution: searchParams.get("institution") || "",
    maturity: searchParams.get("maturity") || "",
    openDiscrepancy: searchParams.get("openDiscrepancy") || "",
    search: searchParams.get("search") || "",
  });
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1", 10));
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || "maturityDate");
  const [sortDir, setSortDir] = useState(searchParams.get("sortDir") || "asc");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const user = session?.user as any;
  const isInstitution = user?.role === "INSTITUTION";

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [sessionStatus, router]);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.type) params.set("type", filters.type);
    if (filters.state) params.set("state", filters.state);
    if (filters.institution && !isInstitution) params.set("institution", filters.institution);
    if (filters.maturity) params.set("maturity", filters.maturity);
    if (filters.openDiscrepancy) params.set("openDiscrepancy", filters.openDiscrepancy);
    if (filters.search) params.set("search", filters.search);
    params.set("page", String(page));
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    return params.toString();
  }, [filters, page, sortBy, sortDir, isInstitution]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    setLoading(true);
    setError("");
    const qs = buildQueryString();
    fetch(`/api/instruments?${qs}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load instruments");
        setLoading(false);
      });
  }, [sessionStatus, buildQueryString]);

  const handleSortToggle = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  };

  const handleFilterChange = (key: string, val: string) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setPage(1);
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const qs = buildQueryString();
      const res = await fetch(`/api/instruments/export?${qs}`);
      if (!res.ok) throw new Error("CSV export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `aicte_instruments_${isInstitution ? "institution" : "bureau"}_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Failed to export instruments CSV: " + (err?.message || err));
    } finally {
      setExporting(false);
    }
  };

  if (sessionStatus === "loading" || (sessionStatus === "authenticated" && loading && !data)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-sky-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading instruments…</p>
        </div>
      </div>
    );
  }

  const SortArrow = ({ col }: { col: string }) => {
    if (sortBy !== col) return <span className="text-slate-400 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {/* Page title */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Instruments</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isInstitution
                ? "Showing your institution's FDRs and Security Deposits"
                : "Bureau-wide instrument registry"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data ? (
              <span className="text-xs text-slate-500 hidden sm:inline">
                {data.total} total · page {data.page} of {data.totalPages}
              </span>
            ) : null}
            <button
              onClick={handleExportCsv}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
              title="Export instruments matching current filters to CSV"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? "Exporting CSV…" : "Export CSV"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {/* Search */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-2 xl:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Search (Ref / Bank)
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                placeholder="e.g. FDR-MISMATCH or State Bank"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full px-2 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">All Statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange("type", e.target.value)}
                className="w-full px-2 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">All Types</option>
                <option value="FDR">FDR</option>
                <option value="SECURITY_DEPOSIT">Security Deposit</option>
              </select>
            </div>

            {/* Maturity window */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Maturity Window
              </label>
              <select
                value={filters.maturity}
                onChange={(e) => handleFilterChange("maturity", e.target.value)}
                className="w-full px-2 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Any</option>
                {MATURITY_WINDOWS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>

            {/* State */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                State
              </label>
              <input
                type="text"
                value={filters.state}
                onChange={(e) => handleFilterChange("state", e.target.value)}
                placeholder="e.g. Maharashtra"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Institution (hidden for institution users) */}
            {!isInstitution && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Institution ID
                </label>
                <input
                  type="text"
                  value={filters.institution}
                  onChange={(e) => handleFilterChange("institution", e.target.value)}
                  placeholder="UUID…"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            )}

            {/* Open discrepancy toggle */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.openDiscrepancy === "true"}
                  onChange={(e) =>
                    handleFilterChange("openDiscrepancy", e.target.checked ? "true" : "")
                  }
                  className="w-4 h-4 rounded border-slate-300 text-rose-600"
                />
                <span className="text-xs font-medium text-slate-700">Has Open Discrepancy</span>
              </label>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-sky-700 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap">Ref / FDR #</th>
                    <th className="py-3 px-4 whitespace-nowrap">Institution</th>
                    <th className="py-3 px-4 whitespace-nowrap">State</th>
                    <th className="py-3 px-4 whitespace-nowrap">Bank</th>
                    <th
                      className="py-3 px-4 whitespace-nowrap cursor-pointer hover:text-slate-800 select-none"
                      onClick={() => handleSortToggle("amount")}
                    >
                      Amount <SortArrow col="amount" />
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">Type</th>
                    <th className="py-3 px-4 whitespace-nowrap">Status</th>
                    <th
                      className="py-3 px-4 whitespace-nowrap cursor-pointer hover:text-slate-800 select-none"
                      onClick={() => handleSortToggle("maturityDate")}
                    >
                      Maturity <SortArrow col="maturityDate" />
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">Days Left</th>
                    <th className="py-3 px-4 whitespace-nowrap">Open Disc.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.instruments?.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="py-10 text-center text-slate-400 font-medium"
                      >
                        No instruments match the current filters.
                      </td>
                    </tr>
                  )}
                  {data?.instruments?.map((inst: any) => (
                    <tr
                      key={inst.id}
                      className="hover:bg-slate-50 transition cursor-pointer"
                      onClick={() => router.push(`/instruments/${inst.id}`)}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <Link
                          href={`/instruments/${inst.id}`}
                          className="hover:text-sky-700 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {inst.referenceNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4 max-w-[180px] truncate">
                        {inst.institution?.name}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">{inst.institution?.state}</td>
                      <td className="py-3 px-4 whitespace-nowrap">{inst.bankName}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        ₹{inst.amount.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold uppercase">
                          {inst.type === "SECURITY_DEPOSIT" ? "SEC DEP" : inst.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={inst.status} />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        {new Date(inst.maturityDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <DaysToMaturityBadge days={inst.daysToMaturity} />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {inst.openDiscrepancyCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            {inst.openDiscrepancyCount}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs text-slate-500">
                Showing {(data.page - 1) * data.pageSize + 1}–
                {Math.min(data.page * data.pageSize, data.total)} of {data.total}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={data.page <= 1}
                  className="px-3 py-1.5 text-xs rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-40 font-medium"
                >
                  ← Prev
                </button>
                <span className="px-3 py-1.5 text-xs font-semibold">
                  {data.page} / {data.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={data.page >= data.totalPages}
                  className="px-3 py-1.5 text-xs rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-40 font-medium"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function InstrumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-10 h-10 border-4 border-sky-800 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <InstrumentsPageInner />
    </Suspense>
  );
}
