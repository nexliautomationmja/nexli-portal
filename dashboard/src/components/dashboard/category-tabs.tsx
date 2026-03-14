"use client";

import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { value: "analytics", label: "Analytics" },
  { value: "leads", label: "Leads" },
  { value: "pipeline", label: "Pipeline" },
];

export function CategoryTabs({ activeTab, onTabChange }: CategoryTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-[var(--glass-border)]">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
          className={cn(
            "relative px-4 py-2.5 text-sm font-medium transition-colors duration-200",
            activeTab === tab.value
              ? "font-bold"
              : "hover:text-[var(--text-main)]"
          )}
          style={{
            color:
              activeTab === tab.value
                ? "var(--text-main)"
                : "var(--text-muted)",
          }}
        >
          {tab.label}
          {activeTab === tab.value && (
            <span
              className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full"
              style={{
                background: "linear-gradient(90deg, #2563EB, #06B6D4)",
              }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
