"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DashboardCharts } from "@/components/DashboardCharts";
import { ImpactMetricsPanel } from "@/components/ImpactMetricsPanel";

export default function DashboardShell() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      setLoading(true);
      fetch("/api/dashboard/stats")
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((json) => {
          setDashboardData(json);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || "Failed to load dashboard statistics");
          setLoading(false);
        });
    }
  }, [session]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-sky-800 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-medium text-slate-600">Loading AICTE Portal Session &amp; RBAC Scope…</p>
        </div>
      </div>
    );
  }

  const user = session?.user as any;
  const isInstitution = user?.role === "INSTITUTION";
  const isAdmin = user?.role === "ADMIN";
  const kpi = dashboardData?.kpi || {
    totalInstruments: 0,
    activeInstruments: 0,
    expiringIn30Days: 0,
    openDiscrepancies: 0,
    pendingReleases: 0,
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <AppHeader />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Welcome & Role Context Alert */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-sky-700">RBAC Verified Context</span>
              <h2 className="text-xl font-bold text-slate-900 mt-0.5">Welcome, {user?.name || user?.email}</h2>
              <p className="text-xs text-slate-500 mt-1">
                {isInstitution ? (
                  <>
                    Active Security Scope: <strong className="text-slate-800">Single Institution Isolation</strong>
                    {dashboardData?.institutionInfo?.name ? ` — ${dashboardData.institutionInfo.name}` : ""}.
                    You only have access to deposit records issued under your assigned AICTE institution ID.
                  </>
                ) : (
                  <>
                    Active Security Scope: <strong className="text-slate-800">Regulation Bureau Multi-Institution Access</strong> ({user?.role}).
                    Aggregated overview across all affiliated technical campuses nationwide.
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/instruments"
                className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold shadow transition"
              >
                View Instruments →
              </Link>
              <a
                href={`/api/instruments/export`}
                download
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </a>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-semibold shadow transition"
                >
                  Admin Audit &amp; Health
                </Link>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-xs mb-6">
            {error}
          </div>
        )}

        {/* 5 KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {/* KPI 1: Total Instruments */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Instruments</span>
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 mt-2">{kpi.totalInstruments}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {isInstitution ? "Campus portfolio" : "Bureau-wide registry"}
            </div>
          </div>

          {/* KPI 2: Active */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Active</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 mt-2">{kpi.activeInstruments}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Valid compliant coverage
            </div>
          </div>

          {/* KPI 3: Expiring in 30 Days */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Expiring in 30d</span>
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-3xl font-extrabold text-amber-600 mt-2">{kpi.expiringIn30Days}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Requires renewal action
            </div>
          </div>

          {/* KPI 4: Open Discrepancies */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Open Discrepancies</span>
              <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-3xl font-extrabold text-rose-600 mt-2">{kpi.openDiscrepancies}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Audit flags pending resolution
            </div>
          </div>

          {/* KPI 5: Pending Releases */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Pending Releases</span>
              <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </div>
            <div className="text-3xl font-extrabold text-sky-600 mt-2">{kpi.pendingReleases}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Under scrutiny/approval
            </div>
          </div>
        </div>

        {/* 3 Recharts Charts */}
        <DashboardCharts
          statusData={dashboardData?.charts?.statusDistribution || []}
          timelineData={dashboardData?.charts?.maturityTimeline || []}
          stateData={dashboardData?.charts?.stateWiseExposure || []}
          isInstitution={isInstitution}
        />

        {/* Impact Metrics Panel (Clearly labelled "Simulated") */}
        <ImpactMetricsPanel
          metrics={dashboardData?.impactMetrics}
          isInstitution={isInstitution}
        />

        {/* Instruments Table preview */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isInstitution
                  ? "Your Institution's Security Deposits & FDRs"
                  : "FDR Repository — Upcoming Maturities"}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Showing recent instruments {isInstitution ? "strictly for your campus" : "across affiliated institutions"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/instruments"
                className="text-xs text-sky-700 hover:underline font-semibold"
              >
                View all {kpi.totalInstruments} →
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Ref Number</th>
                  <th className="py-3 px-4">Institution</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Bank</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Maturity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {dashboardData?.recentInstruments?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                      No instruments found for this security context.
                    </td>
                  </tr>
                )}
                {dashboardData?.recentInstruments?.map((inst: any) => (
                  <tr key={inst.id} className="hover:bg-slate-50/80 transition cursor-pointer">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      <Link
                        href={`/instruments/${inst.id}`}
                        className="hover:text-sky-700 hover:underline"
                      >
                        {inst.referenceNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-4 truncate max-w-xs">{inst.institutionName}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold uppercase">
                        {inst.type === "SECURITY_DEPOSIT" ? "SEC DEP" : inst.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      ₹{inst.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4">{inst.bankName}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={inst.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(inst.maturityDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
