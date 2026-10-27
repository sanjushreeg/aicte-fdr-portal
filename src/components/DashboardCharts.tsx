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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg border border-slate-700">
        <p className="font-bold text-slate-200">{label || data.name}</p>
        <p className="text-amber-400 mt-1">
          {data.name}: <span className="font-semibold text-white">{data.value}</span>
        </p>
        {data.payload?.amountLakhs !== undefined && (
          <p className="text-slate-300 text-[11px]">
            Total Value: ₹{data.payload.amountLakhs.toLocaleString("en-IN")} Lakhs
          </p>
        )}
        {data.payload?.amountCrores !== undefined && (
          <p className="text-slate-300 text-[11px]">
            Exposure: ₹{data.payload.amountCrores.toLocaleString("en-IN")} Cr ({data.payload.count} instruments)
          </p>
        )}
      </div>
    );
  }
  return null;
};

export function DashboardCharts({
  statusData,
  timelineData,
  stateData,
  isInstitution = false,
}: DashboardChartsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-72 flex items-center justify-center"
          >
            <div className="w-7 h-7 border-3 border-sky-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* Chart 1: Instruments by Status */}
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

        <div className="h-64 w-full flex-1">
          {statusData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No status records available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#475569" }}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Instruments" radius={[0, 4, 4, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 2: Maturity Timeline by Month */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Maturity Timeline by Month</h3>
            <p className="text-[11px] text-slate-500">
              {isInstitution ? "Upcoming maturities schedule" : "Upcoming bureau maturity curve"}
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-sky-50 text-sky-700 rounded">
            Monthly
          </span>
        </div>

        <div className="h-64 w-full flex-1">
          {timelineData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No upcoming maturities recorded
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={timelineData}
                margin={{ top: 5, right: 10, left: -10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  angle={-30}
                  textAnchor="end"
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  interval={0}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="count"
                  name="Maturities"
                  fill="#0284c7"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 3: State-wise Exposure */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">State-Wise Exposure</h3>
            <p className="text-[11px] text-slate-500">
              {isInstitution ? "Geographic deposit distribution" : "Top states by total deposit value"}
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">
            ₹ Crores
          </span>
        </div>

        <div className="h-64 w-full flex-1">
          {stateData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No regional exposure data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stateData}
                margin={{ top: 5, right: 10, left: -10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="state"
                  angle={-30}
                  textAnchor="end"
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="amountCrores"
                  name="Amount (₹ Cr)"
                  fill="#0d9488"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
