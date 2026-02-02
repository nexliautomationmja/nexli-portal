"use client";

import { useBrandFiles } from "@/lib/hooks/use-brand-files";
import { GlassCard } from "@/components/ui/glass-card";
import { ImageIcon } from "@/components/ui/icons";
import Link from "next/link";

export function LogoFilesWidget() {
  const { files, loading } = useBrandFiles();

  const fileCount = files.length;
  const logoCount = files.filter((f) => f.category === "logo").length;
  const photoCount = files.filter((f) => f.category === "photo").length;
  const otherCount = fileCount - logoCount - photoCount;

  return (
    <GlassCard>
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div
          className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(6,182,212,0.15))",
          }}
        >
          <ImageIcon className="w-6 h-6 text-blue-400" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
            Brand Files
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {loading
              ? "Loading..."
              : fileCount === 0
                ? "Your logos, photos, and design assets"
                : `${fileCount} file${fileCount !== 1 ? "s" : ""}`
                  + (logoCount > 0 ? ` \u00b7 ${logoCount} logo${logoCount !== 1 ? "s" : ""}` : "")
                  + (photoCount > 0 ? ` \u00b7 ${photoCount} photo${photoCount !== 1 ? "s" : ""}` : "")
                  + (otherCount > 0 ? ` \u00b7 ${otherCount} other` : "")}
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/dashboard/brand-files"
          className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
        >
          Access Brand Files
        </Link>
      </div>
    </GlassCard>
  );
}
