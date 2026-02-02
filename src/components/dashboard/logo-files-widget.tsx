"use client";

import { useState, useCallback } from "react";
import { useBrandFiles, type BrandFile } from "@/lib/hooks/use-brand-files";
import { GlassCard } from "@/components/ui/glass-card";
import { ImageIcon, DownloadIcon, FolderIcon } from "@/components/ui/icons";
import Link from "next/link";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"]);

export function LogoFilesWidget() {
  const { files, loading } = useBrandFiles(undefined, "logo");

  const handleDownload = useCallback(async (fileId: string, fileName: string) => {
    const res = await fetch(`/api/dashboard/brand-files/${fileId}/download`);
    const data = await res.json();
    if (data.url) {
      const a = document.createElement("a");
      a.href = data.url;
      a.download = fileName;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    }
  }, []);

  const displayFiles = files.slice(0, 6);

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
          Logo Files
        </h3>
        <Link
          href="/dashboard/brand-files"
          className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
        >
          {files.length > 0 ? `View all (${files.length})` : "Manage files"}
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl animate-pulse"
              style={{ background: "var(--glass-border)" }}
            />
          ))}
        </div>
      ) : displayFiles.length === 0 ? (
        <div className="py-6 text-center" style={{ color: "var(--text-muted)" }}>
          <span style={{ color: "var(--text-muted)" }}>
            <ImageIcon className="w-6 h-6 mx-auto mb-2" />
          </span>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No logos uploaded yet.
          </p>
          <Link
            href="/dashboard/brand-files"
            className="inline-block mt-2 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
          >
            Upload your first logo →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {displayFiles.map((file) => (
            <LogoThumbnail
              key={file.id}
              file={file}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function LogoThumbnail({
  file,
  onDownload,
}: {
  file: BrandFile;
  onDownload: (id: string, name: string) => void;
}) {
  const isImage = IMAGE_TYPES.has(file.mimeType);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="aspect-square rounded-xl overflow-hidden group relative cursor-pointer"
      style={{ background: "var(--glass-bg)" }}
    >
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        {isImage && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.storageUrl}
            alt={file.fileName}
            className="w-full h-full object-contain p-2"
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{ color: "var(--text-muted)" }}>
            <FolderIcon className="w-6 h-6" />
          </span>
        )}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1">
        <button
          onClick={() => onDownload(file.id, file.fileName)}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          title="Download"
        >
          <DownloadIcon className="w-3.5 h-3.5" />
        </button>
        <p className="text-[8px] text-white/70 truncate max-w-full px-1">
          {file.fileName}
        </p>
      </div>
    </div>
  );
}
