"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { MapPin, Briefcase, Calendar, Globe, MoreHorizontal, Code, Copy, Check } from "lucide-react";
import Image from "next/image";

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
}

export function ProfileSidebar({ business, websiteUrl, isActive, clientId }: ProfileSidebarProps) {
    const [copied, setCopied] = useState(false);

    const trackingSnippet = clientId
        ? `<script defer src="https://portal.nexli.net/t.js" data-client-id="${clientId}"></script>`
        : null;

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
                    <MapPin size={12} />
                    <span className="truncate max-w-[180px]">{business.location}</span>
                </div>

                {websiteUrl && (
                    <a
                        href={websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <Globe size={16} />
                        Open Website
                    </a>
                )}
            </GlassCard>

            {/* Details Card */}
            <GlassCard variant="compact">
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <Briefcase size={18} className="text-blue-500 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-[var(--text-main)]">Business Type</p>
                            <p className="text-xs text-[var(--text-muted)]">{business.type}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Calendar size={18} className="text-cyan-500 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-[var(--text-main)]">Member Since</p>
                            <p className="text-xs text-[var(--text-muted)]">{business.joinedDate}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-[var(--glass-border)]">
                    <button className="w-full group flex items-center justify-between text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                        <span>View All Details</span>
                        <MoreHorizontal size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </GlassCard>

            {/* Tracking Script */}
            {trackingSnippet && (
                <GlassCard variant="compact">
                    <div className="flex items-center gap-2 mb-3">
                        <Code size={16} className="text-blue-500" />
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
                                <Check size={14} className="text-green-400" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy size={14} />
                                Copy Snippet
                            </>
                        )}
                    </button>
                </GlassCard>
            )}
        </div>
    );
}
