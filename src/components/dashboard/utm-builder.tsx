"use client";

import { useState } from "react";
import { CopyIcon, LinkIcon } from "@/components/ui/icons";

const SOURCE_PRESETS = ["facebook", "instagram", "google", "email", "youtube", "tiktok"];

function slug(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "");
}

/**
 * UTM link builder — assemble a tracked URL to paste into an ad, email, or
 * post. Pure client-side. Campaign = the angle, Content = the specific ad
 * (matches the Ad Analytics "By Campaign" / "By Creative" breakdowns).
 */
export function UtmBuilder() {
  const [base, setBase] = useState("");
  const [source, setSource] = useState("facebook");
  const [medium, setMedium] = useState("paid");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [term, setTerm] = useState("");
  const [copied, setCopied] = useState(false);

  function buildUrl(): string {
    const raw = base.trim();
    if (!raw) return "";
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let url: URL;
    try {
      url = new URL(withProto);
    } catch {
      return "";
    }
    const params = url.searchParams;
    const set = (k: string, v: string) => {
      const s = slug(v);
      if (s) params.set(k, s);
    };
    set("utm_source", source);
    set("utm_medium", medium);
    set("utm_campaign", campaign);
    set("utm_content", content);
    set("utm_term", term);
    url.search = params.toString();
    return url.toString();
  }

  const result = buildUrl();

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const labelCls = "block text-[10px] font-black uppercase tracking-[0.15em] mb-1";
  const inputCls =
    "w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors";
  const inputStyle = {
    background: "var(--input-bg)",
    borderColor: "var(--card-border)",
    color: "var(--text-main)",
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <LinkIcon className="w-4 h-4 text-blue-500" />
        <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
          UTM Link Builder
        </h2>
      </div>
      <p className="text-xs -mt-2" style={{ color: "var(--text-muted)" }}>
        Build a tracked link for an ad or campaign. <b>Campaign</b> = the angle,
        <b> Content</b> = the specific ad — they show up in Ad Analytics above.
      </p>

      <div>
        <label className={labelCls} style={{ color: "var(--text-muted)" }}>
          Destination URL
        </label>
        <input
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="yourclient.com/tax-planning"
          className={inputCls}
          style={inputStyle}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls} style={{ color: "var(--text-muted)" }}>
            Source
          </label>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            list="utm-sources"
            placeholder="facebook"
            className={inputCls}
            style={inputStyle}
          />
          <datalist id="utm-sources">
            {SOURCE_PRESETS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelCls} style={{ color: "var(--text-muted)" }}>
            Medium
          </label>
          <input
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            placeholder="paid"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: "var(--text-muted)" }}>
            Campaign (angle) *
          </label>
          <input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="tax-planning-q3"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: "var(--text-muted)" }}>
            Content (ad/creative)
          </label>
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="video-hook-a"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} style={{ color: "var(--text-muted)" }}>
            Term (keyword, optional)
          </label>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="cpa near me"
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Result */}
      <div>
        <label className={labelCls} style={{ color: "var(--text-muted)" }}>
          Your tracked link
        </label>
        <div className="flex gap-2">
          <div
            className="flex-1 px-3 py-2 rounded-lg border text-xs break-all font-mono"
            style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-main)" }}
          >
            {result || (
              <span style={{ color: "var(--text-muted)" }}>
                Enter a destination URL and campaign to generate a link.
              </span>
            )}
          </div>
          <button
            onClick={copy}
            disabled={!result}
            className="shrink-0 px-4 rounded-lg text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
          >
            <CopyIcon className="w-4 h-4" />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
