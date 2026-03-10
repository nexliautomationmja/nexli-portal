"use client";

import { useState, useEffect, useCallback } from "react";

interface LinkMeta {
  clientName: string | null;
  message: string | null;
  requiredDocuments: string[] | null;
  maxUploads: number;
  uploadCount: number;
  expiresAt: string;
}

interface UploadedFile {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  category?: string;
}

const FILE_TYPE_PILLS = [
  "W-2",
  "1099-INT",
  "1099-DIV",
  "1099-MISC",
  "1098",
  "Bank Statement",
  "ID / License",
];

export function UploadClient({ token }: { token: string }) {
  const [meta, setMeta] = useState<LinkMeta | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  // Validate token on mount
  useEffect(() => {
    fetch(`/api/upload/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "This link is invalid or has expired.");
          return;
        }
        const data = await res.json();
        setMeta(data);
        if (data.clientName) setClientName(data.clientName);
      })
      .catch(() => setError("Unable to verify this upload link."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  }, []);

  function addFiles(newFiles: File[]) {
    const MAX_SIZE = 25 * 1024 * 1024;
    const valid = newFiles.filter((f) => {
      if (f.size > MAX_SIZE) {
        alert(`"${f.name}" exceeds 25MB limit.`);
        return false;
      }
      return true;
    });

    setFiles((prev) => [
      ...prev,
      ...valid.map((file) => ({
        file,
        progress: 0,
        status: "pending" as const,
      })),
    ]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);

    const formData = new FormData();
    for (const f of files) {
      formData.append("files", f.file);
    }
    if (clientName) formData.append("clientName", clientName);
    if (clientEmail) formData.append("clientEmail", clientEmail);

    // Update all files to uploading
    setFiles((prev) =>
      prev.map((f) => ({ ...f, status: "uploading" as const, progress: 30 }))
    );

    try {
      const res = await fetch(`/api/upload/${token}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setFiles((prev) =>
          prev.map((f) => ({ ...f, status: "error" as const }))
        );
        setError(data.error || "Upload failed.");
        return;
      }

      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: "success" as const, progress: 100 }))
      );
      setUploadComplete(true);
    } catch {
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: "error" as const }))
      );
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Error state (invalid/expired link)
  if (error && !meta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-white mb-2">Link Unavailable</h1>
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (uploadComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-white mb-2">Upload Complete!</h1>
          <p className="text-sm text-gray-400 mb-6">
            Your documents have been securely uploaded and encrypted. Your CPA will be notified.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            AES-256 Encrypted &middot; IRS Pub 4557 Compliant
          </div>
          <button
            onClick={() => {
              setFiles([]);
              setUploadComplete(false);
            }}
            className="mt-6 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
          >
            Upload More Documents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Ambient background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.08) 0%, transparent 60%)",
        }}
      />

      <div className="relative max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <span className="text-lg font-black tracking-tight">NEXLI</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-2">
            Secure Document Upload
          </h1>
          {meta?.clientName && (
            <p className="text-gray-400 text-sm">
              Welcome, <span className="text-white font-medium">{meta.clientName}</span>
            </p>
          )}
          {meta?.message && (
            <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 text-left">
              {meta.message}
            </div>
          )}
        </div>

        {/* Client info (if not pre-filled) */}
        {!meta?.clientName && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Full name"
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                Email
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Required documents checklist */}
        {meta?.requiredDocuments && meta.requiredDocuments.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
              Requested Documents
            </p>
            <div className="flex flex-wrap gap-2">
              {meta.requiredDocuments.map((doc) => (
                <span
                  key={doc}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
                >
                  {doc}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
            dragging
              ? "border-blue-500 bg-blue-500/5"
              : "border-white/10 hover:border-white/20"
          }`}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.multiple = true;
            input.accept = ".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx,.csv";
            input.onchange = () => {
              if (input.files) addFiles(Array.from(input.files));
            };
            input.click();
          }}
        >
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          <p className="text-sm font-medium text-gray-300 mb-1">
            Drag and drop files here, or click to browse
          </p>
          <p className="text-xs text-gray-500">
            PDF, JPG, PNG, XLSX &middot; Max 25MB per file
          </p>
        </div>

        {/* Quick category pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {FILE_TYPE_PILLS.map((type) => (
            <button
              key={type}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.multiple = true;
                input.accept = ".pdf,.jpg,.jpeg,.png";
                input.onchange = () => {
                  if (input.files) {
                    const newFiles = Array.from(input.files).map((file) => ({
                      file,
                      progress: 0,
                      status: "pending" as const,
                      category: type,
                    }));
                    setFiles((prev) => [...prev, ...newFiles]);
                  }
                };
                input.click();
              }}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-white/10 text-gray-400 hover:border-blue-500/30 hover:text-blue-400 transition-all"
            >
              {type}
            </button>
          ))}
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-6 space-y-2">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.file.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{formatFileSize(f.file.size)}</span>
                    {f.category && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px]">
                        {f.category}
                      </span>
                    )}
                  </div>
                  {f.status === "uploading" && (
                    <div className="mt-1.5 w-full h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-1000"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                {f.status === "success" ? (
                  <svg className="w-5 h-5 text-green-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : f.status === "error" ? (
                  <svg className="w-5 h-5 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
                  </svg>
                ) : (
                  <button
                    onClick={() => removeFile(i)}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                  >
                    <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            {/* Upload button */}
            {!uploadComplete && (
              <button
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
                className="w-full mt-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Uploading & Encrypting...
                  </span>
                ) : (
                  `Upload ${files.length} Document${files.length !== 1 ? "s" : ""}`
                )}
              </button>
            )}
          </div>
        )}

        {/* Security badge */}
        <div className="mt-8 flex items-center justify-center gap-4 text-[10px] text-gray-500">
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            AES-256 Encrypted
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            </svg>
            IRS Pub 4557
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            No Account Needed
          </div>
        </div>

        {error && meta && (
          <p className="mt-4 text-center text-sm text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
