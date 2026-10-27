"use client";

import { useState } from "react";

export function RunRemindersButton() {
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/run-reminders", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setFeedback({
        type: "success",
        message: json.message || "Maturity reminder scan completed successfully.",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "Failed to trigger reminder scan",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handleRun}
          disabled={running}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50"
        >
          {running ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Scanning Maturities…</span>
            </>
          ) : (
            <>
              <span>⏰</span>
              <span>Run Reminders</span>
            </>
          )}
        </button>
        <span className="text-xs text-slate-500">
          Scans all active instruments for 90/60/30/15/7 day thresholds and dispatches notifications
        </span>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-2 text-sm"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
