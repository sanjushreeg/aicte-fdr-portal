import prisma from "@/lib/prisma";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any)?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [users, auditLogs, institutions] = await Promise.all([
    prisma.user.findMany({ include: { institution: true }, take: 15 }),
    prisma.auditLog.findMany({ take: 10, orderBy: { timestamp: "desc" }, include: { performedBy: true } }),
    prisma.institution.findMany({ take: 10 }),
  ]);

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Control & Append-Only Audit Trail</h1>
            <p className="text-xs text-slate-500">Restricted to ADMIN Role · Full System Monitoring</p>
          </div>
          <Link
            href="/dashboard"
            className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Audit Log Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Recent Immutable Audit Logs (Append-Only)</h2>
            <span className="text-[11px] text-emerald-600 font-semibold">● Tamper-Resistant</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b">
                <tr>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Entity</th>
                  <th className="py-2.5 px-4">Performed By</th>
                  <th className="py-2.5 px-4">IP Address</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{log.action}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px]">{log.entity}</td>
                    <td className="py-2.5 px-4">{log.performedBy.name}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{log.ip}</td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
