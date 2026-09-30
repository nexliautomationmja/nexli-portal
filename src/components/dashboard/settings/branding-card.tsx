"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeHexColor } from "@/lib/branding";

interface BrandingState {
  portalDisplayName: string;
  logoUrl: string | null;
  brandColor: string;
  fallbackDisplayName: string;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ACCEPTED = "image/png,image/svg+xml,image/jpeg";

/**
 * Per-firm branding: display name, accent color and logo. What clients see in
 * the portal sidebar, on invoices / engagement letters, and in emails.
 */
export function BrandingCard() {
  const [state, setState] = useState<BrandingState | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "success" | "error">(
    "loading"
  );
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/settings/branding")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then((data: BrandingState) => {
        if (cancelled) return;
        setState(data);
        setDisplayName(data.portalDisplayName || "");
        setColor(data.brandColor || "");
        setStatus("idle");
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load your branding settings.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Object-URL preview for a freshly picked logo. Created/revoked in the
  // change handler; the ref lets the unmount cleanup revoke the last one.
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function pickLogo(file: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = file ? URL.createObjectURL(file) : null;
    previewUrlRef.current = url;
    setLogoPreview(url);
    setLogoFile(file);
  }

  const normalizedColor = sanitizeHexColor(color);
  const colorInvalid = color.trim() !== "" && !normalizedColor;
  const previewName = displayName.trim() || state?.fallbackDisplayName || "Your Firm";
  const shownLogo = logoPreview || state?.logoUrl || null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setError("");
    if (!file) {
      pickLogo(null);
      return;
    }
    if (!ACCEPTED.split(",").includes(file.type)) {
      setError("Logo must be a PNG, SVG or JPEG image.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("Logo must be 2MB or smaller.");
      e.target.value = "";
      return;
    }
    pickLogo(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (colorInvalid) {
      setError("Brand color must be a hex value like #0f766e.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setError("");

    const form = new FormData();
    form.set("portalDisplayName", displayName.trim());
    form.set("brandColor", normalizedColor || "");
    if (logoFile) form.set("logo", logoFile);

    try {
      const res = await fetch("/api/dashboard/settings/branding", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to save branding.");
        setStatus("error");
        return;
      }
      setState((prev) =>
        prev
          ? {
              ...prev,
              portalDisplayName: data.portalDisplayName ?? "",
              logoUrl: data.logoUrl ?? prev.logoUrl,
              brandColor: data.brandColor ?? "",
            }
          : prev
      );
      setColor(data.brandColor ?? "");
      pickLogo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStatus("success");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Loading branding...
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Your clients see this in their portal, on invoices and engagement
        letters, and in the emails we send on your behalf. Leave a field blank
        to use the default.
      </p>

      {/* Live preview */}
      <div
        className="rounded-xl overflow-hidden border border-[var(--card-border)]"
        aria-label="Branding preview"
      >
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{
            background: "#0a0a0f",
            borderTop: normalizedColor ? `4px solid ${normalizedColor}` : undefined,
          }}
        >
          {shownLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownLogo}
              alt={previewName}
              className="h-7 max-w-[160px] object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logos/nexli-logo-white-wordmark@2x.png"
              alt="Nexli"
              className="h-7"
            />
          )}
          <span className="text-sm font-semibold text-white/80 truncate">
            {previewName}
          </span>
          <span
            className="ml-auto text-[9px] font-bold uppercase tracking-[0.2em]"
            style={{ color: normalizedColor || "#2563EB" }}
          >
            Client Portal
          </span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4 max-w-md">
        {/* Display name */}
        <div>
          <label
            htmlFor="branding-display-name"
            className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Portal Display Name
          </label>
          <input
            id="branding-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={state?.fallbackDisplayName || "Your Firm"}
            maxLength={80}
            className="w-full px-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500 transition-colors"
            style={{ color: "var(--text-main)" }}
          />
        </div>

        {/* Brand color */}
        <div>
          <label
            htmlFor="branding-color"
            className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Brand Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label="Pick brand color"
              value={normalizedColor || "#2563eb"}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-[var(--glass-border)] bg-transparent cursor-pointer p-0.5"
            />
            <input
              id="branding-color"
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#2563eb"
              maxLength={7}
              className="flex-1 px-4 py-2.5 rounded-xl border bg-transparent text-sm font-mono outline-none focus:border-blue-500 transition-colors"
              style={{
                color: "var(--text-main)",
                borderColor: colorInvalid ? "#ef4444" : "var(--glass-border)",
              }}
            />
            {color && (
              <button
                type="button"
                onClick={() => setColor("")}
                className="text-xs font-medium hover:underline"
                style={{ color: "var(--text-muted)" }}
              >
                Clear
              </button>
            )}
          </div>
          {colorInvalid && (
            <p className="mt-1 text-xs text-red-400">Enter a hex color like #0f766e.</p>
          )}
        </div>

        {/* Logo */}
        <div>
          <label
            htmlFor="branding-logo"
            className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Logo
          </label>
          <input
            id="branding-logo"
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            onChange={handleFileChange}
            className="block w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
            style={{ color: "var(--text-muted)" }}
          />
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            PNG, SVG or JPEG, up to 2MB. A light-on-transparent logo looks best
            on the dark header.
            {state?.logoUrl && !logoFile && " Current logo shown in the preview above."}
          </p>
        </div>

        {status === "success" && !error && (
          <p className="text-sm text-green-400">Branding saved.</p>
        )}
        {status === "error" && error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        {status !== "error" && error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={status === "saving" || colorInvalid}
          className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all"
        >
          {status === "saving" ? "Saving..." : "Save Branding"}
        </button>
      </form>
    </div>
  );
}
