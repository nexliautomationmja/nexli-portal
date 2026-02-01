"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useBrandFiles, type BrandFile } from "@/lib/hooks/use-brand-files";
import { GlassCard } from "@/components/ui/glass-card";
import {
  ImageIcon,
  UploadIcon,
  DownloadIcon,
  TrashIcon,
  FolderIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface BrandFilesClientProps {
  isAdmin: boolean;
  userId: string;
}

interface ClientOption {
  id: string;
  name: string | null;
  companyName: string | null;
}

const CATEGORIES = [
  { value: "", label: "All Files" },
  { value: "logo", label: "Logos" },
  { value: "brand_guideline", label: "Guidelines" },
  { value: "photo", label: "Photos" },
  { value: "design_file", label: "Design Files" },
] as const;

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

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"]);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BrandFilesClient({ isAdmin, userId }: BrandFilesClientProps) {
  const [category, setCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [uploadCategory, setUploadCategory] = useState("logo");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { files, loading, refetch } = useBrandFiles(
    isAdmin ? selectedClientId || undefined : undefined,
    category || undefined
  );

  // Admin: fetch client list for the dropdown
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/dashboard/admin/clients")
      .then((r) => r.json())
      .then((d) => {
        setClients(
          (d.clients || []).map((c: ClientOption & Record<string, unknown>) => ({
            id: c.id,
            name: c.name,
            companyName: c.companyName,
          }))
        );
      })
      .catch(() => setClients([]));
  }, [isAdmin]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!selectedClientId) return;
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("clientId", selectedClientId);
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
    [selectedClientId, uploadCategory, refetch]
  );

  const handleDelete = useCallback(
    async (fileId: string) => {
      if (!confirm("Delete this file? This cannot be undone.")) return;
      const res = await fetch(`/api/dashboard/brand-files/${fileId}`, {
        method: "DELETE",
      });
      if (res.ok) refetch();
    },
    [refetch]
  );

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

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
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
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-2xl md:text-3xl font-bold"
          style={{ color: "var(--text-main)" }}
        >
          Brand Files
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          {isAdmin
            ? "Upload and manage branding assets for your clients."
            : "View and download your branding assets."}
        </p>
      </div>

      {/* Admin controls: client selector + upload */}
      {isAdmin && (
        <GlassCard>
          <h3
            className="text-sm font-bold mb-4"
            style={{ color: "var(--text-main)" }}
          >
            Upload Files
          </h3>

          {/* Client selector + category */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <label
                className="block text-[10px] font-black uppercase tracking-[0.2em] mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                Client
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border border-[var(--glass-border)] bg-transparent focus:outline-none focus:border-blue-500/50 transition-colors"
                style={{ color: "var(--text-main)" }}
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName || c.name || c.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:w-48">
              <label
                className="block text-[10px] font-black uppercase tracking-[0.2em] mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                Category
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border border-[var(--glass-border)] bg-transparent focus:outline-none focus:border-blue-500/50 transition-colors"
                style={{ color: "var(--text-main)" }}
              >
                <option value="logo">Logo</option>
                <option value="brand_guideline">Brand Guideline</option>
                <option value="photo">Photo</option>
                <option value="design_file">Design File</option>
              </select>
            </div>
          </div>

          {/* Drop zone */}
          <div
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer",
              !selectedClientId && "opacity-40 pointer-events-none",
              dragOver
                ? "border-blue-500/50 bg-blue-500/5"
                : "border-[var(--glass-border)] hover:border-blue-500/30"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.ai,.psd,.zip"
              onChange={onFileSelect}
            />
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "var(--glass-bg)" }}
              >
                <UploadIcon className="w-5 h-5 text-blue-400" />
              </div>
              {uploading ? (
                <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                  Uploading...
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
                    Drag & drop a file or click to browse
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    PNG, JPG, SVG, WebP, PDF, AI, PSD, ZIP (max 50MB)
                  </p>
                </>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Category filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
              category === cat.value
                ? "border-blue-500/30 text-white"
                : "border-[var(--glass-border)] hover:border-blue-500/20"
            )}
            style={{
              color: category === cat.value ? undefined : "var(--text-muted)",
              background:
                category === cat.value
                  ? "linear-gradient(135deg, rgba(37,99,235,0.3), rgba(6,182,212,0.3))"
                  : "var(--glass-bg)",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* File grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-2xl animate-pulse"
              style={{ background: "var(--glass-border)" }}
            />
          ))}
        </div>
      ) : files.length === 0 ? (
        <GlassCard>
          <div className="py-16 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--glass-bg)" }}
            >
              <span style={{ color: "var(--text-muted)" }}><ImageIcon className="w-7 h-7" /></span>
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              {isAdmin && !selectedClientId
                ? "Select a client to view their brand files."
                : "No brand files yet."}
            </p>
            {isAdmin && selectedClientId && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                Upload logos, brand guidelines, photos, or design files above.
              </p>
            )}
            {!isAdmin && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                Your branding assets will appear here once uploaded.
              </p>
            )}
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
    </div>
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
    <div className="glass-card rounded-2xl overflow-hidden group transition-all duration-200 hover:border-blue-500/20">
      {/* Thumbnail */}
      <div
        className="aspect-square relative flex items-center justify-center overflow-hidden"
        style={{ background: "var(--glass-bg)" }}
      >
        {isImage && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.storageUrl}
            alt={file.fileName}
            className="w-full h-full object-contain p-3"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2" style={{ color: "var(--text-muted)" }}>
            {file.mimeType === "application/pdf" ? (
              <FolderIcon className="w-10 h-10" />
            ) : (
              <ImageIcon className="w-10 h-10" />
            )}
            <span
              className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)", opacity: 0.5 }}
            >
              {file.mimeType.split("/").pop()}
            </span>
          </div>
        )}

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
          <button
            onClick={() => onDownload(file.id, file.fileName)}
            className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            title="Download"
          >
            <DownloadIcon className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button
              onClick={() => onDelete(file.id)}
              className="w-9 h-9 rounded-full bg-red-500/20 backdrop-blur-sm flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-colors"
              title="Delete"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p
          className="text-xs font-medium truncate"
          style={{ color: "var(--text-main)" }}
          title={file.fileName}
        >
          {file.fileName}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <span
            className={cn(
              "inline-block px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border",
              CATEGORY_COLORS[file.category] || "bg-gray-500/10 text-gray-400 border-gray-500/20"
            )}
          >
            {CATEGORY_LABELS[file.category] || file.category}
          </span>
          <span
            className="text-[10px]"
            style={{ color: "var(--text-muted)", opacity: 0.5 }}
          >
            {formatFileSize(file.fileSize)}
          </span>
        </div>
      </div>
    </div>
  );
}
