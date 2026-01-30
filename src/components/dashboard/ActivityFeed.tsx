"use client";

import { GlassCard } from "@/components/ui/glass-card";
import Image from "next/image";
import { Plus } from "lucide-react";

interface ActivityUser {
    id: string;
    name: string;
    action: string;
    time: string;
    avatarUrl?: string;
    dotColor: string;
}

interface ActivityFeedProps {
    activities: ActivityUser[];
}

const filters = ["All", "Follows", "Appreciations", "Comments", "Saves"];

export function ActivityFeed({ activities }: ActivityFeedProps) {
    return (
        <GlassCard className="!p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-[var(--text-main)]">Who Interacted With Your Work</h3>
                    <span className="bg-blue-600/10 text-blue-500 text-[10px] font-black px-2 py-0.5 rounded uppercase">PRO</span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                    {filters.map((filter) => (
                        <button
                            key={filter}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${filter === "All"
                                ? "bg-[var(--text-main)] text-[var(--bg-main)]"
                                : "hover:bg-[var(--glass-border)] text-[var(--text-muted)]"
                                }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activities.map((activity) => (
                    <div
                        key={activity.id}
                        className="group p-4 bg-[var(--glass-bg)] hover:bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-2xl transition-all duration-300 flex items-center gap-4 cursor-pointer"
                    >
                        <div className="relative">
                            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-transparent group-hover:border-blue-500 transition-colors">
                                {activity.avatarUrl ? (
                                    <Image
                                        src={activity.avatarUrl}
                                        alt={activity.name}
                                        width={48}
                                        height={48}
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white text-lg font-bold">
                                        {activity.name.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <div
                                className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-[var(--bg-main)] text-white`}
                                style={{ backgroundColor: activity.dotColor }}
                            >
                                <Plus size={12} strokeWidth={4} />
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-[var(--text-main)] truncate">
                                {activity.name}
                            </h4>
                            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold opacity-60">
                                {activity.time}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
