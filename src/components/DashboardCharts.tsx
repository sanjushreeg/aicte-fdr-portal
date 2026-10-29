"use client";

import React, { useEffect, useState } from "react";
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

// ── Shared interfaces ─────────────────────────────────────────────────────────

interface StatusChartItem {
  status: string;
  label: string;
  count: number;
  fill: string;
}

interface MaturityTimelineItem {
  month: string;
  count: number;
  amountLakhs: number;
  totalAmount: number;
}

interface StateWiseExposureItem {
  state: string;
  count: number;
  amountCrores: number;
  totalAmount: number;
}

interface DashboardChartsProps {
  statusData: StatusChartItem[];
  timelineData: MaturityTimelineItem[];
  stateData: StateWiseExposureItem[];
  isInstitution?: boolean;
}

// ── Tooltip: Instruments by Status ────────────────────────────────────────────
const StatusTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as StatusChartItem;
    return (
      <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg border border-slate-700">
        <p className="font-bold text-slate-200">{d.label}</p>
        <p className="mt-1">
          Count:{" "}
          <span className="font-semibold text-white">
            {d.count.toLocaleString("en-IN")}
          </span>
        </p>
      </div>
    );
  }
  return null;
};

// ── Tooltip: Maturity Timeline ────────────────────────────────────────────────
const TimelineTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as MaturityTimelineItem;
    const lakhs = d.amountLakhs.toLocaleString("en-IN", { maximumFractionDigits: 2 });
    return (
      <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg border border-slate-700 min-w-[160px]">
        <p className="font-bold text-slate-200">{label || d.month}</p>
        <p className="text-sky-400 mt-1">
          Instruments:{" "}
          <span className="font-semibold text-white">
            {d.count.toLocaleString("en-IN")}
          </span>
        </p>
        <p className="text-emerald-400 mt-0.5">
          Value:{" "}
          <span className="font-semibold text-white">₹{lakhs} L</span>
        </p>
      </div>
    );
  }
  return null;
};

// ── Tooltip: State-Wise Exposure ──────────────────────────────────────────────
const StateTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as StateWiseExposureItem;
    const crores = Number(d.amountCrores).toLocaleString("en-IN", { maximumFractionDigits: 2 });
    const rupees = Number(d.totalAmount).toLocaleString("en-IN");
    return (
      <div className="bg-slate-900 text-white text-xs p-3 rounded-lg shadow-lg border border-slate-700 min-w-[190px]">
        <p className="font-bold text-slate-200 mb-1">{d.state}</p>
        <p className="text-emerald-400 font-semibold">₹{crores} Cr</p>
        <p className="text-slate-400 text-[11px]">₹{rupees}</p>
        <p className="text-slate-300 mt-1">
          Instruments:{" "}
          <span className="font-medium text-slate-100">
            {d.count.toLocaleString("en-IN")}
          </span>
        </p>
      </div>
    );
  }
  return null;
};

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardCharts({
  statusData,
  timelineData,
  stateData,
  isInstitution = false,
}: DashboardChartsProps) {
  const [mounted, setMounted] = useState(false);
  const [activeStateIndex, setActiveStateIndex] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Top 10 states sorted by raw totalAmount (most precise) then amountCrores as fallback
  const topStateData = (stateData || [])
    .slice()
    .sort((a, b) => (b.totalAmount ?? b.amountCrores) - (a.totalAmount ?? a.amountCrores))
    .slice(0, 10);

  // Whether any status has at least one instrument
  const hasStatusData = statusData.some((s) => s.count > 0);

  // Whether any month in the timeline has at least one maturity
  const hasTimelineData = timelineData.some((m) => m.count > 0);

  // Loading skeleton — shown during SSR / before hydration
  if (!mounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-80 flex items-center justify-center"
          >
            <div className="w-7 h-7 border-2 border-sky-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

      {/* ── Chart 1: Instruments by Status ──────────────────────────────── */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Instruments by Status</h3>
            <p className="text-[11px] text-slate-500">
              {isInstitution ? "Campus portfolio lifecycle" : "Bureau registry distribution"}
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
            Lifecycle
          </span>
        </div>

        {/* Height sized for up to 11 bars × ~24 px each + margins */}
        <div className="h-80 w-full">
          {!hasStatusData ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-xs font-medium">No instrument records available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusData}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#475569" }}
                  width={88}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<StatusTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="count" name="Instruments" radius={[0, 4, 4, 0]} maxBarSize={16}>
                  {statusData.map((entry, index) => (
                    <Cell key={`status-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Chart 2: Maturity Timeline by Month ─────────────────────────── */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Maturity Timeline by Month</h3>
            <p className="text-[11px] text-slate-500">
              {isInstitution ? "Upcoming maturities schedule" : "Upcoming bureau maturity curve"}
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-sky-50 text-sky-700 rounded">
            12 Months
          </span>
        </div>

        <div className="h-80 w-full">
          {!hasTimelineData ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs font-medium">No upcoming maturities in the next 12 months</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={timelineData}
                margin={{ top: 4, right: 8, left: -14, bottom: 28 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  angle={-35}
                  textAnchor="end"
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<TimelineTooltip />} cursor={{ fill: "#f0f9ff" }} />
                <Bar
                  dataKey="count"
                  name="Maturities"
                  fill="#0284c7"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Chart 3: State-Wise Exposure ─────────────────────────────────── */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">State-Wise Exposure</h3>
            <p className="text-[11px] text-slate-500">
              {isInstitution
                ? "Geographic deposit distribution"
                : "Top states by total deposit value"}
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">
            ₹ Crores
          </span>
        </div>

        <div className="h-80 w-full flex-1">
          {topStateData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
              <p className="text-xs font-medium">No regional exposure data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topStateData}
                layout="vertical"
                margin={{ top: 4, right: 28, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={(val) => `₹${val}`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="state"
                  tick={{ fontSize: 10, fill: "#475569" }}
                  width={104}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<StateTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar
                  dataKey="amountCrores"
                  name="Total Deposit"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                >
                  {topStateData.map((entry, index) => (
                    <Cell
                      key={`state-${index}`}
                      fill={activeStateIndex === index ? "#f97316" : "#1e3a5f"}
                      onMouseEnter={() => setActiveStateIndex(index)}
                      onMouseLeave={() => setActiveStateIndex(null)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {!isInstitution && topStateData.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
            <Link
              href="/reports/state-exposure"
              className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 hover:underline transition"
              aria-label="View full state-wise exposure report"
            >
              View full report →
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}
