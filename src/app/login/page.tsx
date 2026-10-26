"use client";

import { signIn, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const DEMO_PRESETS = [
  {
    role: "ADMIN",
    label: "Admin (AICTE Central Bureau)",
    email: "admin0@example.com",
    name: "Dr. Rajesh Sharma",
    desc: "Full oversight, reminder rules, system health & append-only audit trail",
  },
  {
    role: "SCRUTINY_OFFICER",
    label: "Scrutiny Officer (Regulation Bureau)",
    email: "scrutinyofficer1@example.com",
    name: "Shri. Arvind Kumar",
    desc: "Verify submissions, detect discrepancies, compare bank data & checklists",
  },
  {
    role: "APPROVING_AUTHORITY",
    label: "Approving Authority (Bureau Head)",
    email: "approving_authority2@example.com",
    name: "Dr. K. S. Radhakrishnan",
    desc: "Review scrutiny recommendations, approve/reject release & refund cases",
  },
  {
    role: "INSTITUTION",
    label: "Institution User (NIT AP)",
    email: "institution0@example.com",
    name: "Registrar - Institution 0 (NIT AP)",
    desc: "Submit FDRs, track maturities, view renewals, manage own deposits only",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [email, setEmail] = useState("admin0@example.com");
  const [password, setPassword] = useState("Password123");
  const [selectedRole, setSelectedRole] = useState("ADMIN");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  const handlePresetSelect = (preset: (typeof DEMO_PRESETS)[0]) => {
    setSelectedRole(preset.role);
    setEmail(preset.email);
    setPassword("Password123");
    setErrorMsg("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    setLoading(false);

    if (res?.error) {
      setErrorMsg("Invalid credentials. Please verify your email and password.");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Top Header Banner */}
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center mb-6">
        <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur px-4 py-1.5 rounded-full border border-white/20 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs uppercase tracking-widest text-emerald-300 font-semibold">
            Govt. of India · Ministry of Education
          </span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
          AICTE Security Deposit & FDR Management Portal
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Centralized Regulatory Bureau Platform for Fixed Deposit Receipts (FDR) Lifecycle & Compliance
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white shadow-2xl rounded-2xl p-6 sm:p-8 border border-slate-100">
          {/* Quick Role Selection Presets */}
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Select Demo Role Preset (Instant Autofill)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEMO_PRESETS.map((p) => {
                const isSelected = email === p.email;
                return (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => handlePresetSelect(p)}
                    className={`text-left p-3 rounded-xl border text-xs transition-all ${
                      isSelected
                        ? "border-sky-600 bg-sky-50 ring-2 ring-sky-500/30"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900">{p.role}</span>
                      {isSelected && (
                        <span className="inline-block w-2 h-2 rounded-full bg-sky-600"></span>
                      )}
                    </div>
                    <div className="font-medium text-slate-700">{p.name}</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{p.email}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-semibold">Or Sign In with Credentials</span>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">All demo accounts use password: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-600">Password123</code></p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-sky-900 hover:bg-sky-950 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow transition-all disabled:opacity-50"
            >
              {loading ? "Authenticating..." : `Sign In as ${selectedRole}`}
            </button>
          </form>

          {/* Security & Compliance notice */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>🔒 AES-256 Encrypted Session</span>
            <span>Append-Only Audit Logging Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
