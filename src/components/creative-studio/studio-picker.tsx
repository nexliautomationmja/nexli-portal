"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CTA_CLASSES, SYNE } from "@/components/launch-pad";
import { CANVAS_VARS, ErrorStrip, GradientText, SP, StudioCanvas, SvgIcon } from "@/components/creative-studio/canvas";
import { studioHref } from "@/components/creative-studio/client";
import type { StudioCard } from "@/lib/creative-studio/studios";

interface PortalClient {
  id: string;
  label: string;
  companyName: string | null;
  email: string;
  website: string | null;
  logoUrl: string | null;
  studioKey: string | null;
}

/** What the modal edits: a new studio, or an existing client studio's details. */
type Editing = { mode: "new" } | { mode: "edit"; studio: StudioCard };

const API = "/api/dashboard/creative-studio/studios";

function ago(iso: string | null): string {
  if (!iso) return "nothing yet";
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 60) return min <= 1 ? "just now" : `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} day${d > 1 ? "s" : ""} ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * "What creative studio are we going for?" — where Creative Studio opens.
 * Nexli's own studio first, then one per client firm; everything made in a
 * studio stays in it. Anyone on the team can open any studio.
 */
export function StudioPicker({ editKey }: { editKey?: string }) {
  const router = useRouter();
  const [studios, setStudios] = useState<StudioCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);

  async function load() {
    const r = await fetch(API, { cache: "no-store" }).catch(() => null);
    const b = (await r?.json().catch(() => null)) as { studios?: StudioCard[]; error?: string } | null;
    if (!r?.ok || !b?.studios) {
      setError(b?.error ?? "Couldn't load the studios.");
      setStudios([]);
      return;
    }
    setStudios(b.studios);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(API, { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { studios?: StudioCard[]; error?: string }) => {
        if (cancelled) return;
        if (b?.studios) {
          setStudios(b.studios);
          // Arriving from a studio's "Add About this firm" link: open its details.
          const toEdit = editKey ? b.studios.find((s) => s.key === editKey && s.kind === "client") : undefined;
          if (toEdit) setEditing({ mode: "edit", studio: toEdit });
        } else {
          setError(b?.error ?? "Couldn't load the studios.");
          setStudios([]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't load the studios.");
        setStudios([]);
      });
    return () => {
      cancelled = true;
    };
  }, [editKey]);

  async function setArchived(s: StudioCard, archived: boolean) {
    setMenu(null);
    if (archived && !confirm(`Archive ${s.name}'s studio? It disappears from this list; its videos and copy are kept and you can bring it back from "Archived".`)) return;
    const r = await fetch(`${API}/${s.key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    }).catch(() => null);
    if (!r?.ok) setError("That didn't save. Try again.");
    await load();
  }

  const nexli = studios?.find((s) => s.kind === "nexli");
  const clients = (studios ?? []).filter((s) => s.kind === "client" && !s.archived);
  const archived = (studios ?? []).filter((s) => s.kind === "client" && s.archived);

  return (
    <StudioCanvas>
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-10 sm:px-6 sm:pt-20">
        <p className="lp-card text-center text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300/80">Creative Studio</p>
        <h1 className="lp-card mt-3 text-center text-4xl font-bold tracking-tighter text-white sm:text-5xl" style={{ ...SYNE, animationDelay: "0.05s" }}>
          What creative studio are <GradientText>we going for?</GradientText>
        </h1>
        <p className="lp-card mx-auto mt-3 max-w-xl text-center text-sm text-neutral-400 sm:text-base" style={{ animationDelay: "0.1s" }}>
          Nexli&apos;s own ads, or a client firm&apos;s. Everything you make stays in the studio you make it in.
        </p>

        {error && (
          <div className="mt-6">
            <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>
          </div>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {studios === null ? (
            [0, 1].map((i) => <div key={i} className="h-56 animate-pulse rounded-3xl bg-white/5" />)
          ) : (
            <>
              {nexli && (
                <StudioTile studio={nexli} delay={0.15} onOpen={() => router.push(studioHref(nexli.key))} />
              )}
              {clients.map((s, i) => (
                <StudioTile
                  key={s.key}
                  studio={s}
                  delay={Math.min(0.4, 0.2 + i * 0.04)}
                  onOpen={() => router.push(studioHref(s.key))}
                  menuOpen={menu === s.key}
                  onMenu={() => setMenu((m) => (m === s.key ? null : s.key))}
                  onEdit={() => {
                    setMenu(null);
                    setEditing({ mode: "edit", studio: s });
                  }}
                  onArchive={() => void setArchived(s, true)}
                />
              ))}
              <button
                type="button"
                onClick={() => setEditing({ mode: "new" })}
                className="lp-card group flex min-h-56 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-white/10 p-6 text-center transition-all hover:-translate-y-0.5 hover:border-violet-400/50 hover:bg-violet-500/[0.05]"
                style={{ animationDelay: "0.3s" }}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-2xl font-light text-violet-200 transition-transform group-hover:scale-110">+</span>
                <span className="text-base font-bold text-white" style={SYNE}>
                  New client studio
                </span>
                <span className="max-w-[16rem] text-xs leading-relaxed text-neutral-500">
                  For a firm Nexli makes ads for. Pick one of your portal clients, or just type the firm&apos;s name.
                </span>
              </button>
            </>
          )}
        </div>

        {archived.length > 0 && (
          <div className="mt-8">
            <button type="button" onClick={() => setShowArchived((v) => !v)} className="min-h-9 text-xs font-semibold text-neutral-500 hover:text-white">
              {showArchived ? "▾" : "▸"} Archived ({archived.length})
            </button>
            {showArchived && (
              <ul className="mt-2 divide-y divide-white/5 rounded-2xl border border-white/10">
                {archived.map((s) => (
                  <li key={s.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-300">{s.name}</span>
                    <span className="text-[11px] text-neutral-500">
                      {s.videos} video{s.videos === 1 ? "" : "s"}
                    </span>
                    <Link href={studioHref(s.key)} className="min-h-9 rounded-full px-3 py-2 text-xs font-semibold text-neutral-400 hover:bg-white/5 hover:text-white">
                      Open
                    </Link>
                    <button type="button" onClick={() => void setArchived(s, false)} className="min-h-9 rounded-full bg-white/5 px-3 text-xs font-bold text-white hover:bg-white/10">
                      Bring back
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {editing && (
        <StudioModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={async (key, isNew) => {
            setEditing(null);
            // New studio, or details edited from inside a studio: go (back) into it.
            if (isNew || key === editKey) router.push(studioHref(key));
            else await load();
          }}
        />
      )}
    </StudioCanvas>
  );
}

function StudioTile({
  studio,
  delay,
  onOpen,
  menuOpen,
  onMenu,
  onEdit,
  onArchive,
}: {
  studio: StudioCard;
  delay: number;
  onOpen: () => void;
  menuOpen?: boolean;
  onMenu?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
}) {
  const client = studio.kind === "client";
  return (
    <div
      className={`lp-card group relative overflow-hidden rounded-3xl border bg-gradient-to-br p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl sm:p-6 ${
        client
          ? "border-violet-400/20 from-violet-500/[0.10] via-[#0b1220] to-fuchsia-500/[0.05] hover:border-violet-300/50 hover:shadow-violet-500/10"
          : "border-cyan-400/25 from-blue-600/[0.14] via-[#0b1220] to-cyan-500/[0.07] hover:border-cyan-300/50 hover:shadow-cyan-500/10"
      }`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full blur-3xl ${client ? "bg-violet-500/15" : "bg-cyan-400/15"}`}
      />
      {/* The whole card opens the studio; the ⋯ menu sits above it. */}
      <button type="button" onClick={onOpen} className="absolute inset-0 z-0" aria-label={`Open ${studio.name}'s studio`} />
      <div className="pointer-events-none relative z-10">
        <div className="flex items-start gap-3">
          {studio.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- firm logo from its portal account
            <img src={studio.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-2xl bg-white object-contain p-1.5" />
          ) : (
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white shadow-lg ${
                client ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-violet-500/30" : "bg-gradient-to-br from-blue-600 to-cyan-500 shadow-cyan-500/30"
              }`}
            >
              {studio.name.trim().charAt(0).toUpperCase() || "S"}
            </span>
          )}
          <div className="min-w-0 flex-1 pr-8">
            <p className="truncate text-lg font-bold text-white" style={SYNE}>
              {studio.name}
            </p>
            <p className="text-xs text-neutral-400">{client ? (studio.clientName ? `Client · ${studio.clientName}` : "Client studio") : "Nexli's own ads · Daniela"}</p>
          </div>
        </div>
        {client && (
          <p className={`mt-3 line-clamp-2 text-xs leading-relaxed ${studio.about ? "text-neutral-400" : "text-amber-200/80"}`}>
            {studio.about || "No “About this firm” yet: add what they offer so Claude sells the right thing."}
          </p>
        )}
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="flex -space-x-3">
            {studio.thumbs.length ? (
              studio.thumbs.map((t, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                <img key={i} src={t} alt="" className="h-16 w-10 rounded-lg border-2 border-[#0b1220] object-cover shadow-lg" style={{ transform: `rotate(${(i - 1) * 4}deg)` }} />
              ))
            ) : (
              <span className="flex h-16 w-10 items-center justify-center rounded-lg border border-dashed border-white/10 text-neutral-600">
                <SvgIcon d={SP.film} size={14} />
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-white">
              {studio.videos} video{studio.videos === 1 ? "" : "s"}
            </p>
            <p className="text-[11px] text-neutral-500">{studio.videos ? `Active ${ago(studio.lastActivity)}` : "Starts fresh"}</p>
          </div>
        </div>
        <p className={`mt-4 text-sm font-bold ${client ? "text-violet-200" : "text-cyan-200"}`}>Open studio →</p>
      </div>

      {client && onMenu && (
        <div className="absolute right-3 top-3 z-20">
          <button
            type="button"
            onClick={onMenu}
            className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-neutral-400 hover:bg-white/10 hover:text-white"
            aria-label={`${studio.name} studio options`}
            aria-expanded={menuOpen}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0b1220] py-1 text-sm shadow-2xl shadow-black/60">
              <button type="button" onClick={onEdit} className="block min-h-10 w-full px-4 text-left text-neutral-200 hover:bg-white/5">
                Edit details
              </button>
              <button type="button" onClick={onArchive} className="block min-h-10 w-full px-4 text-left text-neutral-400 hover:bg-white/5 hover:text-rose-300">
                Archive
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ABOUT_PLACEHOLDER =
  "What they offer (e.g. year-round tax planning for business owners making $1M+), who they serve and where, anything proven they're OK to say, and the call to action (e.g. book a free planning call).";

function StudioModal({ editing, onClose, onSaved }: { editing: Editing; onClose: () => void; onSaved: (key: string, isNew: boolean) => void | Promise<void> }) {
  const existing = editing.mode === "edit" ? editing.studio : null;
  const [clients, setClients] = useState<PortalClient[] | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<PortalClient | null>(null);
  const [name, setName] = useState(existing?.name ?? "");
  const [website, setWebsite] = useState(existing?.website ?? "");
  const [about, setAbout] = useState(existing?.about ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New studio: the portal's client firms to pick from.
  useEffect(() => {
    if (existing) return;
    let cancelled = false;
    fetch(`${API}/clients`, { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { clients?: PortalClient[] }) => !cancelled && setClients(b?.clients ?? []))
      .catch(() => !cancelled && setClients([]));
    return () => {
      cancelled = true;
    };
  }, [existing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prev;
    };
  }, [onClose]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = clients ?? [];
    return (q ? list.filter((c) => `${c.label} ${c.email} ${c.companyName ?? ""}`.toLowerCase().includes(q)) : list).slice(0, 8);
  }, [clients, search]);

  function pick(c: PortalClient) {
    setPicked(c);
    setName(c.companyName || c.label);
    if (c.website && !website) setWebsite(c.website);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const body = { name: name.trim(), website: website.trim(), about: about.trim(), ...(picked ? { clientUserId: picked.id } : {}) };
    const r = await fetch(existing ? `${API}/${existing.key}` : API, {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const b = (await r?.json().catch(() => null)) as { key?: string; error?: string } | null;
    setSaving(false);
    if (!r?.ok) {
      setError(b?.error ?? "That didn't save. Try again.");
      return;
    }
    await onSaved(existing ? existing.key : b?.key ?? "", !existing);
  }

  const field =
    "w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-base text-white placeholder:text-neutral-600 focus:border-violet-400/60 focus:outline-none sm:text-sm";
  const label = "mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6" style={CANVAS_VARS} onClick={onClose}>
      <div
        className="lp-card relative flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#020617] text-white shadow-2xl shadow-black/60 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={existing ? `Edit ${existing.name}'s studio` : "New client studio"}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-white" style={SYNE}>
              {existing ? `${existing.name} studio` : "New client studio"}
            </h2>
            <p className="text-xs text-neutral-400">{existing ? "Claude uses these details for every script and ad here." : "A separate studio for a firm Nexli makes ads for."}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Close">
            <SvgIcon d={SP.x} />
          </button>
        </div>

        <div className="cs-scroll flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
          {!existing && (
            <div>
              <span className={label}>Which firm?</span>
              {picked ? (
                <div className="flex items-center gap-3 rounded-xl border border-violet-400/40 bg-violet-500/10 px-3.5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{picked.label}</span>
                  <button type="button" onClick={() => setPicked(null)} className="min-h-8 text-xs font-semibold text-neutral-400 hover:text-white">
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your portal clients" className={field} aria-label="Search your portal clients" />
                  <div className="mt-2 space-y-1">
                    {clients === null ? (
                      <p className="px-1 text-xs text-neutral-500">Loading clients…</p>
                    ) : matches.length === 0 ? (
                      <p className="px-1 text-xs text-neutral-500">{clients.length === 0 ? "No client firms in the portal yet." : "No client matches that."} Type the firm&apos;s name below instead.</p>
                    ) : (
                      matches.map((c) =>
                        c.studioKey ? (
                          <Link
                            key={c.id}
                            href={studioHref(c.studioKey)}
                            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-neutral-400 hover:bg-white/5"
                          >
                            <span className="min-w-0 flex-1 truncate">{c.label}</span>
                            <span className="shrink-0 text-[11px] font-semibold text-violet-200">Has a studio · Open</span>
                          </Link>
                        ) : (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => pick(c)}
                            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-neutral-200 hover:bg-white/5"
                          >
                            <span className="min-w-0 flex-1 truncate font-semibold">{c.label}</span>
                            <span className="hidden truncate text-[11px] text-neutral-500 sm:block">{c.email}</span>
                          </button>
                        )
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <label className="block">
            <span className={label}>{existing || picked ? "Firm name" : "Or type the firm's name"}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Smith & Co. CPAs" className={field} maxLength={120} />
          </label>
          <label className="block">
            <span className={label}>Website (optional)</span>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="smithcpas.com" className={field} maxLength={300} inputMode="url" />
          </label>
          <label className="block">
            <span className={label}>About this firm</span>
            <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={5} placeholder={ABOUT_PLACEHOLDER} className={`${field} resize-y leading-relaxed`} maxLength={4000} />
            <span className="mt-1.5 block text-[11px] leading-relaxed text-neutral-500">
              Claude writes this studio&apos;s scripts, batch plans and Meta ad copy for the firm from this, never Nexli&apos;s offer. You can fill it in later.
            </span>
          </label>
          {error && <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>}
        </div>

        <div className="flex gap-2 border-t border-white/10 px-5 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-full border border-white/10 px-5 text-sm font-semibold text-neutral-300 hover:bg-white/5 sm:flex-none">
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={saving || !name.trim()} className={`${CTA_CLASSES} flex-1 disabled:opacity-50 sm:ml-auto sm:flex-none`}>
            {saving ? "Saving…" : existing ? "Save" : "Create studio"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
