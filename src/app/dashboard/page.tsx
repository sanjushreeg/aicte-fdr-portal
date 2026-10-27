"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";

export default function DashboardShell() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetch("/api/instruments?page=1&sortBy=maturityDate&sortDir=asc")
        .then((res) => res.json())
        .then((json) => {
          setData(json);
          setLoading(false);
        })
        .catch(() => setLoading(false));
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
                    Active Security Scope: <strong className="text-slate-800">Single Institution Isolation</strong>. You only have access to deposit records issued under your assigned AICTE institution ID.
                  </>
                ) : (
                  <>
                    Active Security Scope: <strong className="text-slate-800">Regulation Bureau Multi-Institution Access</strong> ({user?.role}).
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/instruments"
                className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold shadow transition"
              >
                View All Instruments →
              </Link>
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

        {/* Quick RBAC Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 font-medium">Accessible Instruments</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{data?.total ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {isInstitution ? "Filtered strictly for your campus" : "Accessible bureau-wide records"}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 font-medium">Session Security</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">Active (AES-256)</div>
            <div className="text-[11px] text-slate-400 mt-1">JWT encrypted with 1-hr timeout</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 font-medium">Audit Status</div>
            <div className="text-2xl font-bold text-sky-700 mt-1">Append-Only</div>
            <div className="text-[11px] text-slate-400 mt-1">Every access event logged to DB</div>
          </div>
        </div>

        {/* Instruments Table preview */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              {isInstitution
                ? "Your Institution's Security Deposits & FDRs"
                : "FDR Repository — Upcoming Maturities"}
            </h3>
            <Link
              href="/instruments"
              className="text-xs text-sky-700 hover:underline font-semibold"
            >
              View all {data?.total ?? ""} →
            </Link>
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
                {data?.instruments?.slice(0, 10).map((inst: any) => (
                  <tr key={inst.id} className="hover:bg-slate-50/80 transition cursor-pointer">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      <Link
                        href={`/instruments/${inst.id}`}
                        className="hover:text-sky-700 hover:underline"
                      >
                        {inst.referenceNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-4 truncate max-w-xs">{inst.institution?.name}</td>
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
