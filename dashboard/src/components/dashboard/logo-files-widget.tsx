"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useBrandFiles, type BrandFile } from "@/lib/hooks/use-brand-files";
import { GlassCard } from "@/components/ui/glass-card";
import {
  ImageIcon,
  UploadIcon,
  DownloadIcon,
  FolderIcon,
  TrashIcon,
  XIcon,
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

const PREVIEWABLE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
  "application/pdf",
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
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [uploadCategory, setUploadCategory] = useState("logo");
  const [previewFile, setPreviewFile] = useState<BrandFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
    }
  }, []);

  const uploadFiles = useCallback(
    async (fileList: File[]) => {
      if (fileList.length === 0) return;
      setUploading(true);
      setUploadProgress({ done: 0, total: fileList.length });

      let completed = 0;
      for (const file of fileList) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("clientId", "self");
        formData.append("category", uploadCategory);

        try {
          const res = await fetch("/api/dashboard/brand-files", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            const err = await res.json();
            console.error(`Failed to upload ${file.name}:`, err.error);
          }
        } catch (e) {
          console.error(`Failed to upload ${file.name}:`, e);
        }

        completed++;
        setUploadProgress({ done: completed, total: fileList.length });
      }

      refetch();
      setUploading(false);
      setUploadProgress({ done: 0, total: 0 });
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
      const selected = e.target.files;
      if (selected && selected.length > 0) {
        uploadFiles(Array.from(selected));
      }
      e.target.value = "";
    },
    [uploadFiles]
  );

  const handlePreview = useCallback(async (file: BrandFile) => {
    try {
      const res = await fetch(
        `/api/dashboard/brand-files/${file.id}/download`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.url) {
        setPreviewFile({ ...file, storageUrl: data.url });
      }
    } catch {
      // Silently fail - preview just won't open
    }
  }, []);

  return (
    <>
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
                {uploading
                  ? `Uploading ${uploadProgress.done}/${uploadProgress.total}...`
                  : "Upload Files"}
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
              >
                <FolderIcon className="w-3 h-3" />
                Folder
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.ai,.psd,.zip"
                multiple
                onChange={onFileSelect}
              />
              <input
                ref={folderInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={onFileSelect}
              />
            </div>
          )}
        </div>

        {/* Upload progress bar */}
        {uploading && uploadProgress.total > 1 && (
          <div className="mb-4">
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--glass-border)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(uploadProgress.done / uploadProgress.total) * 100}%`,
                  background: "linear-gradient(90deg, #2563EB, #06B6D4)",
                }}
              />
            </div>
            <p
              className="text-[10px] mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              Uploading {uploadProgress.done} of {uploadProgress.total} files...
            </p>
          </div>
        )}

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
                onPreview={handlePreview}
              />
            ))}
          </div>
        )}
      </GlassCard>

      {/* Preview Modal */}
      {previewFile && (
        <PreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownload}
        />
      )}
    </>
  );
}

function FileCard({
  file,
  isAdmin,
  onDownload,
  onDelete,
  onPreview,
}: {
  file: BrandFile;
  isAdmin: boolean;
  onDownload: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onPreview: (file: BrandFile) => void;
}) {
  const isImage = IMAGE_TYPES.has(file.mimeType);
  const canPreview = PREVIEWABLE_TYPES.has(file.mimeType);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden group transition-all duration-200 border border-[var(--glass-border)] hover:border-blue-500/20"
      style={{ background: "var(--glass-bg)" }}
    >
      {/* Thumbnail */}
      <div
        className={`aspect-square relative flex items-center justify-center overflow-hidden ${canPreview ? "cursor-pointer" : ""}`}
        onClick={() => canPreview && onPreview(file)}
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
          {canPreview && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview(file);
              }}
              className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              title="Preview"
            >
              <EyeIcon className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(file.id, file.fileName);
            }}
            className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            title="Download"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
          </button>
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file.id);
              }}
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

function PreviewModal({
  file,
  onClose,
  onDownload,
}: {
  file: BrandFile;
  onClose: () => void;
  onDownload: (id: string, name: string) => void;
}) {
  const isImage = IMAGE_TYPES.has(file.mimeType);
  const isPdf = file.mimeType === "application/pdf";

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal content */}
      <div
        className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden border border-[var(--glass-border)]"
        style={{ background: "var(--glass-bg)", zIndex: 10000 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-3 min-w-0">
            <p
              className="text-sm font-bold truncate"
              style={{ color: "var(--text-main)" }}
              title={file.fileName}
            >
              {file.fileName}
            </p>
            <span
              className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border ${
                CATEGORY_COLORS[file.category] ||
                "bg-gray-500/10 text-gray-400 border-gray-500/20"
              }`}
            >
              {CATEGORY_LABELS[file.category] || file.category}
            </span>
            <span
              className="shrink-0 text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {formatFileSize(file.fileSize)}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={() => onDownload(file.id, file.fileName)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              <DownloadIcon className="w-3 h-3" />
              Download
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--glass-border)] transition-colors hover:border-red-500/30 hover:text-red-400"
              style={{ color: "var(--text-muted)" }}
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div className="flex items-center justify-center overflow-auto" style={{ maxHeight: "calc(90vh - 60px)" }}>
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.storageUrl}
              alt={file.fileName}
              className="max-w-full max-h-[80vh] object-contain p-4"
            />
          ) : isPdf ? (
            <iframe
              src={file.storageUrl}
              title={file.fileName}
              className="w-full border-0"
              style={{ height: "80vh" }}
            />
          ) : (
            <div
              className="py-20 text-center"
              style={{ color: "var(--text-muted)" }}
            >
              <ImageIcon className="w-12 h-12 mx-auto mb-3" />
              <p className="text-sm">Preview not available for this file type.</p>
              <p className="text-xs mt-1" style={{ opacity: 0.5 }}>
                Click Download to view the file.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
