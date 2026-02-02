"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import Image from "next/image";

function MapPinIcon({ size, className }: { size: number; className?: string }) {
    return (
        <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}

function BriefcaseIcon({ size, className }: { size: number; className?: string }) {
    return (
        <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            <rect width="20" height="14" x="2" y="6" rx="2" />
        </svg>
    );
}

function CalendarIcon({ size, className }: { size: number; className?: string }) {
    return (
        <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4" /><path d="M16 2v4" />
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M3 10h18" />
        </svg>
    );
}

function GlobeIcon({ size, className }: { size: number; className?: string }) {
    return (
        <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
        </svg>
    );
}

function MoreHorizontalIcon({ size, className }: { size: number; className?: string }) {
    return (
        <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
        </svg>
    );
}

function CodeIcon({ size, className }: { size: number; className?: string }) {
    return (
        <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
        </svg>
    );
}

function CopyIcon({ size, className }: { size: number; className?: string }) {
    return (
        <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
    );
}

function CheckIcon({ size, className }: { size: number; className?: string }) {
    return (
        <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

function LinkIcon({ size, className }: { size: number; className?: string }) {
    return (
        <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
    );
}

interface ProfileSidebarProps {
    business: {
        name: string;
        type: string;
        location: string;
        avatarUrl?: string;
        joinedDate: string;
        description?: string;
    };
    websiteUrl?: string | null;
    isActive?: boolean;
    clientId?: string;
    ghlLocationId?: string | null;
}

export function ProfileSidebar({ business, websiteUrl, isActive, clientId, ghlLocationId }: ProfileSidebarProps) {
    const [copied, setCopied] = useState(false);
    const [ghlId, setGhlId] = useState(ghlLocationId ?? "");
    const [ghlConnected, setGhlConnected] = useState(!!ghlLocationId);
    const [ghlStatus, setGhlStatus] = useState<"idle" | "saving" | "success" | "error" | "disconnecting">("idle");
    const [ghlError, setGhlError] = useState("");

    const trackingSnippet = clientId
        ? `<script defer src="https://portal.nexli.net/t.js" data-client-id="${clientId}"></script>`
        : null;

    async function saveGhl(e: React.FormEvent) {
        e.preventDefault();
        if (!clientId || !ghlId.trim()) return;
        setGhlStatus("saving");
        setGhlError("");

        const res = await fetch(`/api/dashboard/admin/clients/${clientId}/ghl`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locationId: ghlId.trim() }),
        });

        if (res.ok) {
            setGhlStatus("success");
            setGhlConnected(true);
        } else {
            const data = await res.json();
            setGhlError(data.error || "Failed to connect");
            setGhlStatus("error");
        }
    }

    async function disconnectGhl() {
        if (!clientId) return;
        if (!confirm("Disconnect GoHighLevel for this client?")) return;
        setGhlStatus("disconnecting");
        setGhlError("");

        const res = await fetch(`/api/dashboard/admin/clients/${clientId}/ghl`, {
            method: "DELETE",
        });

        if (res.ok) {
            setGhlId("");
            setGhlConnected(false);
            setGhlStatus("idle");
        } else {
            setGhlError("Failed to disconnect");
            setGhlStatus("error");
        }
    }

    function copySnippet() {
        if (!trackingSnippet) return;
        navigator.clipboard.writeText(trackingSnippet).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }
    return (
        <div className="space-y-6">
            {/* Main Profile Card */}
            <GlassCard className="text-center">
                <div className="relative inline-block mb-4">
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-[var(--glass-border)] mx-auto">
                        {business.avatarUrl ? (
                            <Image
                                src={business.avatarUrl}
                                alt={business.name}
                                width={128}
                                height={128}
                                className="object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-3xl font-bold">
                                {business.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    {isActive !== undefined && (
                        <div
                            className={`absolute bottom-1 right-1 text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-[var(--bg-main)] ${
                                isActive
                                    ? "bg-green-500 text-white"
                                    : "bg-yellow-500 text-white"
                            }`}
                        >
                            {isActive ? "Active" : "Inactive"}
                        </div>
                    )}
                </div>

                <h2 className="text-xl md:text-2xl font-bold text-[var(--text-main)] mb-1">
                    {business.name}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                    {business.type}
                </p>

                <div className="flex items-center justify-center gap-1 text-xs text-[var(--text-muted)] mb-6">
                    <MapPinIcon size={12} />
                    <span className="truncate max-w-[180px]">{business.location}</span>
                </div>

                {websiteUrl && (
                    <a
                        href={websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <GlobeIcon size={16} />
                        Open Website
                    </a>
                )}
            </GlassCard>

            {/* Details Card */}
            <GlassCard variant="compact">
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <BriefcaseIcon size={18} className="text-blue-500 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-[var(--text-main)]">Business Type</p>
                            <p className="text-xs text-[var(--text-muted)]">{business.type}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <CalendarIcon size={18} className="text-cyan-500 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-[var(--text-main)]">Member Since</p>
                            <p className="text-xs text-[var(--text-muted)]">{business.joinedDate}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-[var(--glass-border)]">
                    <button className="w-full group flex items-center justify-between text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                        <span>View All Details</span>
                        <MoreHorizontalIcon size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </GlassCard>

            {/* GHL Connection */}
            {clientId && (
                <GlassCard variant="compact">
                    <div className="flex items-center gap-2 mb-3">
                        <LinkIcon size={16} className="text-purple-500" />
                        <p className="text-sm font-bold text-[var(--text-main)]">GoHighLevel</p>
                        <div className={`w-2 h-2 rounded-full ml-auto ${ghlConnected ? "bg-green-400" : "bg-gray-500"}`} />
                    </div>

                    <form onSubmit={saveGhl} className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-1.5" style={{ color: "var(--text-muted)" }}>
                                Location ID
                            </label>
                            <input
                                type="text"
                                value={ghlId}
                                onChange={(e) => setGhlId(e.target.value)}
                                placeholder="e.g. yamjttuJWWdstfF9N0zu"
                                className="w-full px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-transparent text-xs outline-none focus:border-blue-500 transition-colors"
                                style={{ color: "var(--text-main)" }}
                            />
                        </div>

                        {ghlStatus === "success" && (
                            <p className="text-[11px] text-green-400">Connected successfully.</p>
                        )}
                        {ghlStatus === "error" && (
                            <p className="text-[11px] text-red-400">{ghlError}</p>
                        )}

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={ghlStatus === "saving" || ghlStatus === "disconnecting" || !ghlId.trim()}
                                className="flex-1 py-2 px-3 rounded-xl text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all"
                            >
                                {ghlStatus === "saving" ? "Testing..." : ghlConnected ? "Update" : "Connect"}
                            </button>
                            {ghlConnected && (
                                <button
                                    type="button"
                                    onClick={disconnectGhl}
                                    disabled={ghlStatus === "saving" || ghlStatus === "disconnecting"}
                                    className="py-2 px-3 rounded-xl text-[11px] font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-50 transition-all"
                                >
                                    {ghlStatus === "disconnecting" ? "..." : "Disconnect"}
                                </button>
                            )}
                        </div>
                    </form>
                </GlassCard>
            )}

            {/* Tracking Script */}
            {trackingSnippet && (
                <GlassCard variant="compact">
                    <div className="flex items-center gap-2 mb-3">
                        <CodeIcon size={16} className="text-blue-500" />
                        <p className="text-sm font-bold text-[var(--text-main)]">Tracking Script</p>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mb-3">
                        Add this to the client&apos;s website <code className="text-blue-400">&lt;head&gt;</code> tag.
                    </p>
                    <div
                        className="rounded-xl p-3 text-[10px] font-mono break-all leading-relaxed border border-[var(--glass-border)]"
                        style={{ background: "var(--glass-bg)", color: "var(--text-muted)" }}
                    >
                        {trackingSnippet}
                    </div>
                    <button
                        onClick={copySnippet}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold border border-[var(--glass-border)] hover:border-blue-500/30 transition-all"
                        style={{ background: "var(--glass-bg)", color: "var(--text-main)" }}
                    >
                        {copied ? (
                            <>
                                <CheckIcon size={14} className="text-green-400" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <CopyIcon size={14} />
                                Copy Snippet
                            </>
                        )}
                    </button>
                </GlassCard>
            )}
        </div>
    );
}
