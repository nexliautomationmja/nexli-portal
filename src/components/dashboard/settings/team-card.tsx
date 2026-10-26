"use client";

import { useCallback, useEffect, useState } from "react";
import type { TeamMember } from "@/app/api/dashboard/settings/team/route";

const INPUT =
  "w-full px-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500 transition-colors";
const LABEL = "block text-[10px] font-black uppercase tracking-[0.2em] mb-2";

/** Settings → Team: logins that work inside this workspace with full admin access. */
export function TeamCard() {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/dashboard/settings/team");
    const body = await r.json().catch(() => null);
    setMembers(r.ok && body?.members ? body.members : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/settings/team")
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!cancelled) setMembers(ok && b?.members ? b.members : []);
      })
      .catch(() => !cancelled && setMembers([]));
    return () => {
      cancelled = true;
    };
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/dashboard/settings/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const body = await r.json().catch(() => null);
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: `${email} can now sign in at portal.nexli.net.` });
      setName("");
      setEmail("");
      setPassword("");
      load();
    } else {
      setMsg({ ok: false, text: body?.error || "Couldn’t add that member" });
    }
  }

  async function remove(m: TeamMember) {
    if (!confirm(`Remove ${m.email}? They will no longer be able to sign in.`)) return;
    const r = await fetch(`/api/dashboard/settings/team?id=${encodeURIComponent(m.id)}`, { method: "DELETE" });
    if (r.ok) load();
  }

  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Team members sign in with their own email and password and see this whole workspace with full admin
        access: clients, engagements, invoices, ads and messages.
      </p>

      {members && members.length > 0 && (
        <ul className="divide-y rounded-xl border" style={{ borderColor: "var(--glass-border)" }}>
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: "var(--glass-border)" }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-main)" }}>
                  {m.name || m.email}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {m.email} ·{" "}
                  {m.lastLoginAt ? `last signed in ${new Date(m.lastLoginAt).toLocaleDateString()}` : "hasn’t signed in yet"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(m)}
                className="text-xs font-semibold text-rose-500 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="grid gap-4 sm:grid-cols-3 items-end">
        <div>
          <label className={LABEL} style={{ color: "var(--text-muted)" }}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} style={{ color: "var(--text-main)" }} />
        </div>
        <div>
          <label className={LABEL} style={{ color: "var(--text-muted)" }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
            style={{ color: "var(--text-main)" }}
          />
        </div>
        <div>
          <label className={LABEL} style={{ color: "var(--text-muted)" }}>Password</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
            style={{ color: "var(--text-main)" }}
          />
        </div>
        <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="btn-primary px-6 py-2.5 text-sm">
            {busy ? "Adding…" : "Add team member"}
          </button>
          {msg && <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>}
        </div>
      </form>
    </div>
  );
}
