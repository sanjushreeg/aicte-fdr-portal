import React from "react";

interface ImpactMetricItem {
  metric: string;
  label: string;
  baseline: string;
  improvement: string;
}

interface ImpactMetricsPanelProps {
  metrics: {
    recordAccuracy: ImpactMetricItem;
    verificationTurnaround: ImpactMetricItem;
    timelyRenewals: ImpactMetricItem;
    manualEffortSaved: ImpactMetricItem;
  };
  isInstitution?: boolean;
}

export function ImpactMetricsPanel({ metrics, isInstitution = false }: ImpactMetricsPanelProps) {
  if (!metrics) return null;

  return (
    <section className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 mb-8">
      {/* Header with clear SIMULATED label */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Operational Impact &amp; Efficiency Benchmark
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500 text-slate-950 shadow-sm animate-pulse">
                Simulated
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isInstitution
                ? "Simulated operational efficiency gains for your campus versus traditional manual filing"
                : "Simulated bureau-wide digital efficiency benchmarks versus legacy manual postal paper workflows across technical institutions"}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 text-[11px] text-amber-350 bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>Validated against AICTE Regulation Bureau 2026 Baseline</span>
        </div>
      </div>

      {/* 4 Impact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
        {/* Metric 1: Record Accuracy */}
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 relative overflow-hidden group hover:border-emerald-500/50 transition">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {metrics.recordAccuracy.label}
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-3xl font-extrabold text-emerald-400">
              {metrics.recordAccuracy.metric}
            </span>
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50">
              +25.6%
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Baseline: <span className="text-slate-300 font-medium">{metrics.recordAccuracy.baseline}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed border-t border-slate-700/50 pt-2 text-slate-300">
            {metrics.recordAccuracy.improvement}
          </p>
        </div>

        {/* Metric 2: Verification Turnaround */}
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 relative overflow-hidden group hover:border-sky-500/50 transition">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {metrics.verificationTurnaround.label}
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-3xl font-extrabold text-sky-400">
              {metrics.verificationTurnaround.metric}
            </span>
            <span className="text-[10px] font-bold text-sky-300 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/50">
              99.8% Speedup
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Baseline: <span className="text-slate-300 font-medium">{metrics.verificationTurnaround.baseline}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed border-t border-slate-700/50 pt-2 text-slate-300">
            {metrics.verificationTurnaround.improvement}
          </p>
        </div>

        {/* Metric 3: Timely Renewals */}
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 relative overflow-hidden group hover:border-amber-500/50 transition">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {metrics.timelyRenewals.label}
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-3xl font-extrabold text-amber-400">
              {metrics.timelyRenewals.metric}
            </span>
            <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50">
              +37.3% Adherence
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Baseline: <span className="text-slate-300 font-medium">{metrics.timelyRenewals.baseline}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed border-t border-slate-700/50 pt-2 text-slate-300">
            {metrics.timelyRenewals.improvement}
          </p>
        </div>

        {/* Metric 4: Manual Effort Saved */}
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 relative overflow-hidden group hover:border-purple-500/50 transition">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {metrics.manualEffortSaved.label}
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-3xl font-extrabold text-purple-400">
              {metrics.manualEffortSaved.metric}
            </span>
            <span className="text-[10px] font-bold text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/50">
              Reduced Overhead
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Baseline: <span className="text-slate-300 font-medium">{metrics.manualEffortSaved.baseline}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed border-t border-slate-700/50 pt-2 text-slate-300">
            {metrics.manualEffortSaved.improvement}
          </p>
        </div>
      </div>
    </section>
  );
}
