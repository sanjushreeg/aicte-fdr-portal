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
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Verification & Discrepancy state
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveAction, setResolveAction] = useState<"RESOLVED" | "WAIVED">("RESOLVED");
  const [resolveNote, setResolveNote] = useState("");
  const [submittingResolve, setSubmittingResolve] = useState(false);
  const [resolveError, setResolveError] = useState("");

  // Renewal state
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewRefNum, setRenewRefNum] = useState("");
  const [renewMaturityDate, setRenewMaturityDate] = useState("");
  const [renewAmount, setRenewAmount] = useState("");
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState("");

  // Release state
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releaseRemarks, setReleaseRemarks] = useState("");
  const [requestingRelease, setRequestingRelease] = useState(false);
  const [releaseError, setReleaseError] = useState("");

  // Scrutiny Review state
  const [showScrutinyModal, setShowScrutinyModal] = useState(false);
  const [checkOriginalFdr, setCheckOriginalFdr] = useState(false);
  const [checkNoDues, setCheckNoDues] = useState(false);
  const [checkLockin, setCheckLockin] = useState(false);
  const [scrutinyRemarks, setScrutinyRemarks] = useState("");
  const [submittingScrutiny, setSubmittingScrutiny] = useState(false);

  // Authority Approval / Rejection state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);
  const [submittingFinalApprove, setSubmittingFinalApprove] = useState(false);

  const user = session?.user as any;
  const role = user?.role;
  const isInstitution = role === "INSTITUTION";
  const isAdmin = role === "ADMIN";

  const fetchInstrument = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/instruments/${id}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to refresh instrument", err);
    }
  };

  const handleRunVerification = async () => {
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const res = await fetch(`/api/instruments/${id}/verify`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setVerifyMsg({
        type: "success",
        text:
          json.instrumentStatus === "VERIFIED"
            ? "Verification completed: All records matched. Instrument marked as VERIFIED."
            : "Verification completed: Discrepancy detected and flagged for review.",
      });
      await fetchInstrument();
      setActiveTab("verification");
    } catch (err: any) {
      setVerifyMsg({ type: "error", text: err.message || "Verification failed" });
    } finally {
      setVerifying(false);
    }
  };

  const handleOpenResolve = (discrepancyId: string, action: "RESOLVED" | "WAIVED") => {
    setResolvingId(discrepancyId);
    setResolveAction(action);
    setResolveNote("");
    setResolveError("");
  };

  const handleConfirmResolve = async () => {
    if (!resolvingId || !resolveNote.trim()) {
      setResolveError("A resolution note is required");
      return;
    }
    setSubmittingResolve(true);
    setResolveError("");
    try {
      const res = await fetch(`/api/discrepancies/${resolvingId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: resolveAction, note: resolveNote.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setResolvingId(null);
      setResolveNote("");
      await fetchInstrument();
    } catch (err: any) {
      setResolveError(err.message || "Failed to resolve discrepancy");
    } finally {
      setSubmittingResolve(false);
    }
  };

  const handleOpenRenewModal = () => {
    if (data?.instrument) {
      setRenewRefNum(`${data.instrument.referenceNumber}-R1`);
      setRenewAmount(String(data.instrument.amount));
      const nextYear = new Date(data.instrument.maturityDate);
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setRenewMaturityDate(nextYear.toISOString().slice(0, 10));
    }
    setRenewError("");
    setShowRenewModal(true);
  };

  const handleRenewSubmit = async () => {
    if (!renewRefNum.trim() || !renewMaturityDate) {
      setRenewError("Reference number and maturity date are required.");
      return;
    }
    setRenewing(true);
    setRenewError("");
    try {
      const res = await fetch(`/api/instruments/${id}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceNumber: renewRefNum.trim(),
          maturityDate: renewMaturityDate,
          amount: renewAmount ? parseFloat(renewAmount) : undefined,
        }),
      });
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // Handle non-JSON or empty response from server
      }

      if (!res.ok) {
        throw new Error(
          json?.error ||
          json?.message ||
          `Server returned HTTP ${res.status} (${res.statusText || "Request Failed"})`
        );
      }

      if (!json || !json.newInstrument) {
        throw new Error("Invalid response received from server. Instrument may not have been renewed.");
      }

      setShowRenewModal(false);
      router.push(`/instruments/${json.newInstrument.id}`);
    } catch (err: any) {
      setRenewError(err?.message || "Failed to renew instrument");
    } finally {
      setRenewing(false);
    }
  };

  const handleReleaseRequestSubmit = async () => {
    setRequestingRelease(true);
    setReleaseError("");
    try {
      const res = await fetch(`/api/instruments/${id}/release-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: releaseRemarks.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setShowReleaseModal(false);
      setReleaseRemarks("");
      await fetchInstrument();
      setVerifyMsg({ type: "success", text: "Release request submitted successfully." });
    } catch (err: any) {
      setReleaseError(err?.message || "Failed to submit release request");
    } finally {
      setRequestingRelease(false);
    }
  };

  const handleScrutinyApproveSubmit = async () => {
    if (!checkOriginalFdr || !checkNoDues || !checkLockin) {
      setReleaseError("All 3 checklist requirements must be confirmed true.");
      return;
    }
    setSubmittingScrutiny(true);
    setReleaseError("");
    try {
      const res = await fetch(`/api/instruments/${id}/release-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SCRUTINY_APPROVE",
          checklist: [checkOriginalFdr, checkNoDues, checkLockin],
          remarks: scrutinyRemarks.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setShowScrutinyModal(false);
      await fetchInstrument();
      setVerifyMsg({ type: "success", text: "Scrutiny approval recorded. Forwarded to Approving Authority." });
    } catch (err: any) {
      setReleaseError(err?.message || "Failed to submit scrutiny approval");
    } finally {
      setSubmittingScrutiny(false);
    }
  };

  const handleFinalApproveSubmit = async () => {
    setSubmittingFinalApprove(true);
    try {
      const res = await fetch(`/api/instruments/${id}/release-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FINAL_APPROVE" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      await fetchInstrument();
      setVerifyMsg({ type: "success", text: "Final approval granted. Instrument released successfully." });
    } catch (err: any) {
      setVerifyMsg({ type: "error", text: err?.message || "Failed to grant final approval" });
    } finally {
      setSubmittingFinalApprove(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectNote.trim()) {
      setReleaseError("A rejection note is required.");
      return;
    }
    setSubmittingReject(true);
    try {
      const res = await fetch(`/api/instruments/${id}/release-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", note: rejectNote.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setShowRejectModal(false);
      setRejectNote("");
      await fetchInstrument();
      setVerifyMsg({ type: "success", text: "Release request rejected." });
    } catch (err: any) {
      setReleaseError(err?.message || "Failed to reject release request");
    } finally {
      setSubmittingReject(false);
    }
  };

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

              <div className="mt-3 flex items-center justify-end gap-2 flex-wrap">
                {/* 1. Verification Trigger */}
                {!isInstitution && (
                  <button
                    onClick={handleRunVerification}
                    disabled={verifying}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-700 text-white hover:bg-sky-800 disabled:opacity-50 transition shadow-xs"
                  >
                    {verifying ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Verifying…</span>
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        <span>Run verification</span>
                      </>
                    )}
                  </button>
                )}

                {/* 2. Renewal Trigger */}
                {(isAdmin || (isInstitution && user?.institutionId === inst.institutionId)) &&
                  inst.status !== "RENEWED" && (
                    <button
                      onClick={handleOpenRenewModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs"
                    >
                      <span>🔄</span>
                      <span>Renew</span>
                    </button>
                  )}

                {/* 3. Release Triggers by Role */}
                {/* Institution Owner: Request Release */}
                {isInstitution && user?.institutionId === inst.institutionId && (
                  <>
                    {inst.releaseRequests?.find((r: any) =>
                      ["PENDING_SCRUTINY", "SCRUTINY_APPROVED", "SUBMITTED"].includes(r.status)
                    ) ? (
                      <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
                        Release:{" "}
                        {
                          inst.releaseRequests.find((r: any) =>
                            ["PENDING_SCRUTINY", "SCRUTINY_APPROVED", "SUBMITTED"].includes(r.status)
                          ).status
                        }
                      </span>
                    ) : (
                      inst.status !== "RELEASED" && (
                        <button
                          onClick={() => {
                            setReleaseError("");
                            setReleaseRemarks("");
                            setShowReleaseModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs"
                        >
                          <span>🔓</span>
                          <span>Request Release</span>
                        </button>
                      )
                    )}
                  </>
                )}

                {/* Scrutiny Officer: Scrutiny Approve or Reject */}
                {(role === "SCRUTINY_OFFICER" || isAdmin) &&
                  inst.releaseRequests?.find((r: any) =>
                    ["PENDING_SCRUTINY", "SUBMITTED"].includes(r.status)
                  ) && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setCheckOriginalFdr(false);
                          setCheckNoDues(false);
                          setCheckLockin(false);
                          setScrutinyRemarks("");
                          setReleaseError("");
                          setShowScrutinyModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 transition shadow-xs"
                      >
                        <span>📋</span>
                        <span>Scrutiny Review</span>
                      </button>
                      <button
                        onClick={() => {
                          setRejectNote("");
                          setReleaseError("");
                          setShowRejectModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                {/* Approving Authority: Final Approve or Reject */}
                {(role === "APPROVING_AUTHORITY" || isAdmin) &&
                  inst.releaseRequests?.find((r: any) => r.status === "SCRUTINY_APPROVED") && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleFinalApproveSubmit}
                        disabled={submittingFinalApprove}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 transition shadow-xs"
                      >
                        {submittingFinalApprove ? "Approving…" : "Final Approve Release"}
                      </button>
                      <button
                        onClick={() => {
                          setRejectNote("");
                          setReleaseError("");
                          setShowRejectModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                      >
                        Reject
                      </button>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* Verification Status Alert Banner */}
        {verifyMsg && (
          <div
            className={`mb-4 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between shadow-xs ${
              verifyMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            <span>{verifyMsg.text}</span>
            <button
              onClick={() => setVerifyMsg(null)}
              className="text-slate-400 hover:text-slate-600 font-bold ml-2 text-sm"
            >
              ✕
            </button>
          </div>
        )}

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
                        {!isInstitution && <th className="py-2.5 px-4 text-right">Actions</th>}
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
                                <div>
                                  <span className="text-slate-600">
                                    {details.description || JSON.stringify(details).slice(0, 80)}
                                  </span>
                                  {details.resolutionNote && (
                                    <p className="mt-1 text-[11px] text-emerald-700 italic">
                                      Note: {details.resolutionNote}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-500">{fmtDate(d.detectedAt)}</td>
                            <td className="py-3 px-4 text-slate-500">
                              {d.resolvedAt ? fmtDate(d.resolvedAt) : "—"}
                            </td>
                            {!isInstitution && (
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                {d.status === "OPEN" ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenResolve(d.id, "RESOLVED")}
                                      className="px-2 py-1 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                                    >
                                      Resolve
                                    </button>
                                    <button
                                      onClick={() => handleOpenResolve(d.id, "WAIVED")}
                                      className="px-2 py-1 text-[10px] font-bold rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
                                    >
                                      Waive
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400 font-medium">—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Resolution Modal */}
              {resolvingId && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-base font-bold text-slate-900">
                        {resolveAction === "RESOLVED" ? "Resolve Discrepancy" : "Waive Discrepancy"}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          resolveAction === "RESOLVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {resolveAction}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                      Please enter a mandatory administrative note detailing why this discrepancy is being{" "}
                      {resolveAction.toLowerCase()}.
                    </p>

                    {resolveError && (
                      <div className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                        {resolveError}
                      </div>
                    )}

                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Resolution Note (Required)
                    </label>
                    <textarea
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      rows={3}
                      placeholder="e.g. Bank core system reconciliation addendum verified and approved by officer..."
                      className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 mb-4 text-slate-800"
                    />

                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setResolvingId(null);
                          setResolveNote("");
                          setResolveError("");
                        }}
                        disabled={submittingResolve}
                        className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmResolve}
                        disabled={submittingResolve || !resolveNote.trim()}
                        className={`px-4 py-1.5 text-xs text-white font-semibold rounded-lg transition disabled:opacity-50 ${
                          resolveAction === "RESOLVED"
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : "bg-amber-600 hover:bg-amber-700"
                        }`}
                      >
                        {submittingResolve
                          ? "Submitting…"
                          : `Confirm ${resolveAction === "RESOLVED" ? "Resolve" : "Waive"}`}
                      </button>
                    </div>
                  </div>
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

        {/* ── Modals: Renew, Release, Scrutiny Review, Reject ── */}

        {/* 1. Renew Modal */}
        {showRenewModal && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
              <h4 className="text-base font-bold text-slate-900 mb-1">Renew Deposit / FDR</h4>
              <p className="text-xs text-slate-500 mb-4">
                Creates a new continuation instrument chained to parent #{inst.referenceNumber} and sets
                the current one to RENEWED.
              </p>

              {renewError && (
                <div className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                  {renewError}
                </div>
              )}

              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    New Reference Number
                  </label>
                  <input
                    type="text"
                    value={renewRefNum}
                    onChange={(e) => setRenewRefNum(e.target.value)}
                    placeholder="e.g. FDR-2024001-R1"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    New Maturity Date
                  </label>
                  <input
                    type="date"
                    value={renewMaturityDate}
                    onChange={(e) => setRenewMaturityDate(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Amount (₹ INR)
                  </label>
                  <input
                    type="number"
                    value={renewAmount}
                    onChange={(e) => setRenewAmount(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowRenewModal(false)}
                  disabled={renewing}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenewSubmit}
                  disabled={renewing || !renewRefNum.trim() || !renewMaturityDate}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {renewing ? "Renewing…" : "Confirm Renewal"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Release Request Modal */}
        {showReleaseModal && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
              <h4 className="text-base font-bold text-slate-900 mb-1">Request Instrument Release</h4>
              <p className="text-xs text-slate-500 mb-4">
                Submit an official request to AICTE Regulation Bureau for the release of security deposit #{inst.referenceNumber}.
              </p>

              {releaseError && (
                <div className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                  {releaseError}
                </div>
              )}

              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Remarks / Justification
              </label>
              <textarea
                value={releaseRemarks}
                onChange={(e) => setReleaseRemarks(e.target.value)}
                rows={3}
                placeholder="e.g. Mandatory affiliation obligations completed; request FDR release..."
                className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 mb-4"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowReleaseModal(false)}
                  disabled={requestingRelease}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReleaseRequestSubmit}
                  disabled={requestingRelease}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {requestingRelease ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Scrutiny Review Modal */}
        {showScrutinyModal && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
              <h4 className="text-base font-bold text-slate-900 mb-1">Scrutiny Officer Release Checklist</h4>
              <p className="text-xs text-slate-500 mb-4">
                All 3 mandatory verification checks must be completed and confirmed before approval can be recorded.
              </p>

              {releaseError && (
                <div className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                  {releaseError}
                </div>
              )}

              <div className="space-y-3 mb-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkOriginalFdr}
                    onChange={(e) => setCheckOriginalFdr(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600"
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    1. Original FDR deposit certificate surrendered & verified against bank records.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkNoDues}
                    onChange={(e) => setCheckNoDues(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600"
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    2. Institutional No-Dues clearance confirmed (faculty salaries, student dues, AICTE fee).
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkLockin}
                    onChange={(e) => setCheckLockin(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600"
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    3. Mandatory AICTE lock-in period compliance satisfied (minimum deposit tenure complete).
                  </span>
                </label>
              </div>

              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Scrutiny Assessment Remarks (Optional)
              </label>
              <textarea
                value={scrutinyRemarks}
                onChange={(e) => setScrutinyRemarks(e.target.value)}
                rows={2}
                placeholder="e.g. Physical FDR copy verified on addendum ledger; approved for release."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 mb-4"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowScrutinyModal(false)}
                  disabled={submittingScrutiny}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScrutinyApproveSubmit}
                  disabled={submittingScrutiny || !checkOriginalFdr || !checkNoDues || !checkLockin}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {submittingScrutiny ? "Approving…" : "Approve Scrutiny"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
              <h4 className="text-base font-bold text-slate-900 mb-1">Reject Release Request</h4>
              <p className="text-xs text-slate-500 mb-4">
                Please enter a required official reason for rejecting this release request.
              </p>

              {releaseError && (
                <div className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                  {releaseError}
                </div>
              )}

              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Rejection Note (Required)
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
                placeholder="e.g. Unresolved student grievances pending; lock-in period not fulfilled..."
                className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 mb-4"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowRejectModal(false)}
                  disabled={submittingReject}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={submittingReject || !rejectNote.trim()}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-50"
                >
                  {submittingReject ? "Rejecting…" : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
