"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { Users2 } from "lucide-react";

interface StatItem {
    label: string;
    value: string | number;
}

interface StatsOverviewProps {
    stats: StatItem[];
}

export function StatsOverview({ stats }: StatsOverviewProps) {
    return (
        <GlassCard className="!p-8">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Users2 size={20} />
                </div>
                <h3 className="text-xl font-bold text-[var(--text-main)]">Your Audience</h3>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                {stats.map((stat, index) => (
                    <div key={index} className="text-center group">
                        <p className="text-5xl md:text-6xl font-bold text-[var(--text-main)] mb-3 group-hover:scale-110 transition-transform duration-300">
                            {stat.value}
                        </p>
                        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-60">
                            {stat.label}
                        </p>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
