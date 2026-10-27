"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge, SeverityBadge, DaysToMaturityBadge } from "@/components/StatusBadge";

type Tab = "overview" | "documents" | "verification" | "discrepancies" | "history" | "audit";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "verification", label: "Verification" },
  { id: "discrepancies", label: "Discrepancies" },
  { id: "history", label: "History" },
  { id: "audit", label: "Audit Log" },
];

function fmt(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtBytes(bytes: number) {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function InstrumentDetailPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !id) return;
    setLoading(true);
    fetch(`/api/instruments/${id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || `HTTP ${res.status}`);
          setLoading(false);
          return;
        }
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load instrument");
        setLoading(false);
      });
  }, [sessionStatus, id]);

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-sky-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading instrument…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <AppHeader />
        <div className="max-w-4xl mx-auto px-4 py-12 w-full">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
            <p className="text-lg font-bold text-rose-800 mb-2">Access Denied or Not Found</p>
            <p className="text-sm text-rose-600 mb-4">{error}</p>
            <Link
              href="/instruments"
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
            >
              ← Back to Instruments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inst = data?.instrument;
  const auditLogs = data?.auditLogs || [];

  if (!inst) return null;

  const discrepancyTabLabel = `Discrepancies${inst.openDiscrepancyCount > 0 ? ` (${inst.openDiscrepancyCount})` : ""}`;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {/* Breadcrumb */}
        <nav className="mb-4 text-xs text-slate-500">
          <Link href="/instruments" className="hover:text-slate-700 font-medium">
            Instruments
          </Link>
          <span className="mx-2">›</span>
          <span className="text-slate-800 font-semibold font-mono">{inst.referenceNumber}</span>
        </nav>

        {/* Instrument header */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h2 className="text-xl font-bold text-slate-900 font-mono">
                  {inst.referenceNumber}
                </h2>
                <StatusBadge status={inst.status} />
                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold uppercase">
                  {inst.type === "SECURITY_DEPOSIT" ? "Security Deposit" : "FDR"}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                <span className="font-semibold">{inst.institution?.name}</span>
                <span className="text-slate-400 mx-2">·</span>
                {inst.institution?.state}
                <span className="text-slate-400 mx-2">·</span>
                AICTE ID: <code className="text-xs">{inst.institution?.aicteId}</code>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {inst.bankName} — {inst.bankBranch}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-2xl font-bold text-slate-900">
                ₹{inst.amount.toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Maturity: {fmtDate(inst.maturityDate)}
              </div>
              <div className="mt-1">
                <DaysToMaturityBadge days={inst.daysToMaturity} />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4">
          <div className="flex gap-1 flex-wrap border-b border-slate-200">
            {TABS.map((t) => {
              const label = t.id === "discrepancies" ? discrepancyTabLabel : t.label;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition ${
                    activeTab === t.id
                      ? "border-sky-600 text-sky-700 bg-sky-50"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-4">Instrument Overview</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                {[
                  ["Reference Number", inst.referenceNumber],
                  ["Type", inst.type],
                  ["Status", inst.status],
                  ["Bank Name", inst.bankName],
                  ["Bank Branch", inst.bankBranch],
                  ["Amount (INR)", `₹${inst.amount.toLocaleString("en-IN")}`],
                  ["Issue Date", fmtDate(inst.issueDate)],
                  ["Maturity Date", fmtDate(inst.maturityDate)],
                  ["Days to Maturity", `${inst.daysToMaturity} days`],
                  ["Institution", inst.institution?.name],
                  ["State", inst.institution?.state],
                  ["AICTE ID", inst.institution?.aicteId],
                  ["Verified by Bank", inst.verifiedByBank ? "Yes" : "No"],
                  ["Open Discrepancies", String(inst.openDiscrepancyCount)],
                  ["Created", fmt(inst.createdAt)],
                  ["Last Updated", fmt(inst.updatedAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {label}
                    </dt>
                    <dd className="text-sm font-medium text-slate-800 mt-0.5">{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>

              {inst.createdBy && (
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Submitted by{" "}
                    <span className="font-semibold text-slate-700">{inst.createdBy.name}</span>
                    {" "}&lt;{inst.createdBy.email}&gt;{" "}
                    <span className="text-slate-400">({inst.createdBy.role})</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {activeTab === "documents" && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-4">
                Documents ({inst.documents?.length || 0})
              </h3>
              {!inst.documents?.length ? (
                <p className="text-slate-400 text-sm">No documents attached to this instrument.</p>
              ) : (
                <div className="space-y-6">
                  {inst.documents.map((doc: any) => (
                    <div key={doc.id} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 flex items-center justify-between border-b border-slate-200">
                        <div>
                          <span className="text-sm font-semibold text-slate-800">{doc.name}</span>
                          <span className="ml-3 px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700 font-semibold">
                            {doc.category}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          Current version: v{doc.currentVersion}
                        </span>
                      </div>

                      <table className="w-full text-xs text-slate-700">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-100">
                          <tr>
                            <th className="py-2 px-4 text-left">Version</th>
                            <th className="py-2 px-4 text-left">SHA-256</th>
                            <th className="py-2 px-4 text-left">Size</th>
                            <th className="py-2 px-4 text-left">Uploader</th>
                            <th className="py-2 px-4 text-left">Uploaded</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {doc.versions.map((v: any) => (
                            <tr key={v.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-4">
                                <span className={`font-bold ${v.version === doc.currentVersion ? "text-sky-700" : "text-slate-500"}`}>
                                  v{v.version}
                                  {v.version === doc.currentVersion && (
                                    <span className="ml-1.5 text-[9px] bg-sky-100 text-sky-700 px-1 py-0.5 rounded font-semibold">
                                      CURRENT
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500 max-w-[180px] truncate">
                                {v.sha256 || "—"}
                              </td>
                              <td className="py-2.5 px-4">{fmtBytes(v.sizeBytes)}</td>
                              <td className="py-2.5 px-4">
                                {v.uploadedBy?.name || "—"}
                              </td>
                              <td className="py-2.5 px-4 text-slate-500">
                                {fmt(v.uploadedAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── VERIFICATION ── */}
          {activeTab === "verification" && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-4">
                Verification Records ({inst.verifications?.length || 0})
              </h3>
              {!inst.verifications?.length ? (
                <p className="text-slate-400 text-sm">No verification records for this instrument.</p>
              ) : (
                <div className="space-y-4">
                  {inst.verifications.map((v: any, idx: number) => {
                    let bankData: any = null;
                    try {
                      if (v.bankData) bankData = JSON.parse(v.bankData);
                    } catch {}

                    return (
                      <div key={v.id} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 flex items-center justify-between border-b border-slate-200">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-700">
                              #{idx + 1} — {v.source}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                v.status === "SUCCESS"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : v.status === "MISMATCH"
                                  ? "bg-rose-100 text-rose-800"
                                  : v.status === "PENDING"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {v.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {fmt(v.requestedAt)}
                            {v.completedAt && <> → {fmt(v.completedAt)}</>}
                          </div>
                        </div>

                        <div className="px-4 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Submitted data */}
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                                Submitted Data
                              </p>
                              <dl className="space-y-1">
                                {[
                                  ["Ref #", inst.referenceNumber],
                                  ["Bank", inst.bankName],
                                  ["Branch", inst.bankBranch],
                                  ["Amount", `₹${inst.amount.toLocaleString("en-IN")}`],
                                  ["Maturity", fmtDate(inst.maturityDate)],
                                ].map(([k, val]) => (
                                  <div key={k} className="flex gap-2 text-xs">
                                    <dt className="text-slate-500 w-16 shrink-0">{k}:</dt>
                                    <dd className="font-medium text-slate-800">{val}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>

                            {/* Bank confirmed data */}
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                                Bank Confirmed Data
                              </p>
                              {bankData ? (
                                <dl className="space-y-1">
                                  {Object.entries(bankData).map(([k, val]) => (
                                    <div key={k} className="flex gap-2 text-xs">
                                      <dt className="text-slate-500 w-24 shrink-0 capitalize">
                                        {k.replace(/([A-Z])/g, " $1")}:
                                      </dt>
                                      <dd className="font-medium text-slate-800">
                                        {String(val ?? "—")}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                              ) : (
                                <p className="text-slate-400 text-xs italic">
                                  No bank data recorded.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── DISCREPANCIES ── */}
          {activeTab === "discrepancies" && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-4">
                Discrepancies ({inst.discrepancies?.length || 0})
              </h3>
              {!inst.discrepancies?.length ? (
                <p className="text-slate-400 text-sm">No discrepancies found for this instrument.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4 text-left">Code</th>
                        <th className="py-2.5 px-4 text-left">Severity</th>
                        <th className="py-2.5 px-4 text-left">Status</th>
                        <th className="py-2.5 px-4 text-left">Details</th>
                        <th className="py-2.5 px-4 text-left">Detected</th>
                        <th className="py-2.5 px-4 text-left">Resolved</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inst.discrepancies.map((d: any) => {
                        let details: any = null;
                        try {
                          if (d.details) details = JSON.parse(d.details);
                        } catch {}
                        return (
                          <tr key={d.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-mono font-bold text-slate-800">
                              {d.code}
                            </td>
                            <td className="py-3 px-4">
                              <SeverityBadge severity={d.severity} />
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  d.status === "OPEN"
                                    ? "bg-rose-100 text-rose-800"
                                    : d.status === "RESOLVED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {d.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 max-w-[240px]">
                              {details ? (
                                <span className="text-slate-600">
                                  {details.description ||
                                    JSON.stringify(details).slice(0, 80)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-500">{fmtDate(d.detectedAt)}</td>
                            <td className="py-3 px-4 text-slate-500">
                              {d.resolvedAt ? fmtDate(d.resolvedAt) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── HISTORY (Renewal Chain) ── */}
          {activeTab === "history" && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-4">Renewal Chain</h3>

              {inst.parent ? (
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Parent Instrument
                  </p>
                  <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
                    <Link
                      href={`/instruments/${inst.parent.id}`}
                      className="font-mono font-bold text-sky-700 hover:underline text-sm"
                    >
                      {inst.parent.referenceNumber}
                    </Link>
                    <StatusBadge status={inst.parent.status} />
                    <span className="text-xs text-slate-500">
                      Maturity: {fmtDate(inst.parent.maturityDate)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mb-4">This is a root instrument (no parent).</p>
              )}

              <div className="border-l-2 border-slate-200 pl-4 space-y-2">
                <div className="flex items-center gap-3 p-3 border border-sky-200 rounded-lg bg-sky-50">
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {inst.referenceNumber}
                  </span>
                  <StatusBadge status={inst.status} />
                  <span className="text-xs text-slate-500 font-semibold">← Current</span>
                </div>

                {inst.children?.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-3 mb-2">
                      Renewals / Children
                    </p>
                    {inst.children.map((child: any) => (
                      <div
                        key={child.id}
                        className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg"
                      >
                        <Link
                          href={`/instruments/${child.id}`}
                          className="font-mono font-bold text-sky-700 hover:underline text-sm"
                        >
                          {child.referenceNumber}
                        </Link>
                        <StatusBadge status={child.status} />
                        <span className="text-xs text-slate-500">
                          Maturity: {fmtDate(child.maturityDate)}
                        </span>
                      </div>
                    ))}
                  </>
                )}

                {!inst.parent && !inst.children?.length && (
                  <p className="text-slate-400 text-sm">
                    No renewal chain — this instrument has no parent or children.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── AUDIT ── */}
          {activeTab === "audit" && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-4">
                Audit Log ({auditLogs.length})
              </h3>
              {!auditLogs.length ? (
                <p className="text-slate-400 text-sm">No audit entries for this instrument.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4 text-left">Action</th>
                        <th className="py-2.5 px-4 text-left">Entity</th>
                        <th className="py-2.5 px-4 text-left">Performed By</th>
                        <th className="py-2.5 px-4 text-left">IP</th>
                        <th className="py-2.5 px-4 text-left">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-bold text-slate-800">{log.action}</td>
                          <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500">
                            {log.entity}
                          </td>
                          <td className="py-2.5 px-4">
                            {log.performedBy?.name || (
                              <span className="text-slate-400 italic">System / Unauthenticated</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500">
                            {log.ip}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">{fmt(log.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
