"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export function AppHeader() {
  const { data: session } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);

  const user = session?.user as any;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      // Write LOGOUT AuditLog entry server-side, then sign out
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Non-fatal; proceed with sign-out regardless
    }
    // Use next-auth signOut via redirect to avoid client-side import issues
    // We call the NextAuth signout endpoint directly so the server event fires
    const { signOut } = await import("next-auth/react");
    await signOut({ callbackUrl: "/login" });
    setLoggingOut(false);
  };

  const isInstitution = user?.role === "INSTITUTION";

  return (
    <header className="bg-slate-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center font-bold text-slate-950 text-sm shrink-0">
            AICTE
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">
              Security Deposit / FDR Management Portal
            </h1>
            <p className="text-[11px] text-slate-400">
              Regulation Bureau · Ministry of Education, Govt. of India
            </p>
          </div>
        </div>

        <nav className="hidden md:flex items-center space-x-4 mr-4">
          <Link
            href="/dashboard"
            className="text-xs text-slate-300 hover:text-white font-medium transition"
          >
            Dashboard
          </Link>
          <Link
            href="/instruments"
            className="text-xs text-slate-300 hover:text-white font-medium transition"
          >
            Instruments
          </Link>
          <Link
            href="/notifications"
            className="text-xs text-slate-300 hover:text-white font-medium transition"
          >
            Notifications
          </Link>
          {!isInstitution && (
            <Link
              href="/reports/state-exposure"
              className="text-xs text-slate-300 hover:text-white font-medium transition"
            >
              State Exposure
            </Link>
          )}
        </nav>

        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold">{user?.name || user?.email}</div>
            <div className="inline-flex items-center gap-1.5 mt-0.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-sky-800 text-sky-200">
                {user?.role}
              </span>
              {isInstitution && (
                <span className="text-[10px] text-amber-300 font-medium">
                  Institution Scope
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg border border-white/20 font-medium transition disabled:opacity-50"
          >
            {loggingOut ? "Logging out…" : "Logout"}
          </button>
        </div>
      </div>
    </header>
  );
}
