"use client";

import { useState, useRef, useCallback } from "react";
import { useBrandFiles, type BrandFile } from "@/lib/hooks/use-brand-files";
import { GlassCard } from "@/components/ui/glass-card";
import {
  ImageIcon,
  UploadIcon,
  DownloadIcon,
  FolderIcon,
  TrashIcon,
} from "@/components/ui/icons";

interface LogoFilesWidgetProps {
  isAdmin: boolean;
}

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
]);

const CATEGORY_LABELS: Record<string, string> = {
  logo: "Logo",
  brand_guideline: "Guideline",
  photo: "Photo",
  design_file: "Design",
};

const CATEGORY_COLORS: Record<string, string> = {
  logo: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  brand_guideline: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  photo: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  design_file: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LogoFilesWidget({ isAdmin }: LogoFilesWidgetProps) {
  const { files, loading, refetch } = useBrandFiles();
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("logo");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("clientId", "self");
        formData.append("category", uploadCategory);

        const res = await fetch("/api/dashboard/brand-files", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          alert(err.error || "Upload failed");
          return;
        }

        refetch();
      } finally {
        setUploading(false);
      }
    },
    [uploadCategory, refetch]
  );

  const handleDelete = useCallback(
    async (fileId: string) => {
      if (!confirm("Delete this file?")) return;
      const res = await fetch(`/api/dashboard/brand-files/${fileId}`, {
        method: "DELETE",
      });
      if (res.ok) refetch();
    },
    [refetch]
  );

  const handleDownload = useCallback(
    async (fileId: string, fileName: string) => {
      const res = await fetch(
        `/api/dashboard/brand-files/${fileId}/download`
      );
      const data = await res.json();
      if (data.url) {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = fileName;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
      }
    },
    []
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      e.target.value = "";
    },
    [handleUpload]
  );

  return (
    <GlassCard>
      {/* Header with upload controls */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-bold"
          style={{ color: "var(--text-main)" }}
        >
          Brand Files
        </h3>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-[10px] border border-[var(--glass-border)] bg-transparent focus:outline-none"
              style={{ color: "var(--text-muted)" }}
            >
              <option value="logo">Logo</option>
              <option value="brand_guideline">Guideline</option>
              <option value="photo">Photo</option>
              <option value="design_file">Design</option>
            </select>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
            >
              <UploadIcon className="w-3 h-3" />
              {uploading ? "Uploading..." : "Upload"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.ai,.psd,.zip"
              onChange={onFileSelect}
            />
          </div>
        )}
      </div>

      {/* File grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl animate-pulse"
              style={{ background: "var(--glass-border)" }}
            />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div
          className="py-8 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          <span style={{ color: "var(--text-muted)" }}>
            <ImageIcon className="w-6 h-6 mx-auto mb-2" />
          </span>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isAdmin
              ? "No files yet. Upload logos, guidelines, or photos above."
              : "No brand files available yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              isAdmin={isAdmin}
              onDownload={handleDownload}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function FileCard({
  file,
  isAdmin,
  onDownload,
  onDelete,
}: {
  file: BrandFile;
  isAdmin: boolean;
  onDownload: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const isImage = IMAGE_TYPES.has(file.mimeType);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden group transition-all duration-200 border border-[var(--glass-border)] hover:border-blue-500/20"
      style={{ background: "var(--glass-bg)" }}
    >
      {/* Thumbnail */}
      <div className="aspect-square relative flex items-center justify-center overflow-hidden">
        {isImage && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.storageUrl}
            alt={file.fileName}
            className="w-full h-full object-contain p-3"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="flex flex-col items-center gap-1"
            style={{ color: "var(--text-muted)" }}
          >
            {file.mimeType === "application/pdf" ? (
              <FolderIcon className="w-8 h-8" />
            ) : (
              <ImageIcon className="w-8 h-8" />
            )}
            <span
              className="text-[8px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)", opacity: 0.5 }}
            >
              {file.mimeType.split("/").pop()}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
          <button
            onClick={() => onDownload(file.id, file.fileName)}
            className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            title="Download"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
          </button>
          {isAdmin && (
            <button
              onClick={() => onDelete(file.id)}
              className="w-8 h-8 rounded-full bg-red-500/20 backdrop-blur-sm flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-colors"
              title="Delete"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="px-2.5 pb-2.5 pt-1">
        <p
          className="text-[10px] font-medium truncate"
          style={{ color: "var(--text-main)" }}
          title={file.fileName}
        >
          {file.fileName}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span
            className={`inline-block px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-wider border ${
              CATEGORY_COLORS[file.category] ||
              "bg-gray-500/10 text-gray-400 border-gray-500/20"
            }`}
          >
            {CATEGORY_LABELS[file.category] || file.category}
          </span>
          <span
            className="text-[9px]"
            style={{ color: "var(--text-muted)", opacity: 0.5 }}
          >
            {formatFileSize(file.fileSize)}
          </span>
        </div>
      </div>
    </div>
  );
}
