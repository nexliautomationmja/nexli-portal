"use client";

import { useState } from "react";
import { CopyField, FIELD, Field, Surface } from "@/components/rainmaker";
import { MetaLogo } from "@/components/creative-studio/meta";

const SOURCE_PRESETS = ["{{site_source_name}}", "facebook", "instagram", "google", "email", "youtube", "tiktok"];

/**
 * Slugify a value but keep ad-platform dynamic parameters such as
 * {{site_source_name}} or {{campaign.name}} verbatim — Meta replaces them
 * at click time (site_source_name → fb / ig / msg / an).
 */
function slug(v: string): string {
  return v
    .trim()
    .split(/(\{\{[^{}]+\}\})/)
    .map((part) =>
      /^\{\{[^{}]+\}\}$/.test(part)
        ? part.replace(/\s+/g, "")
        : part.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "")
    )
    .join("");
}

/** URLSearchParams percent-encodes braces; Meta needs them literal. */
function keepMacros(s: string): string {
  return s.replace(/%7B%7B(.*?)%7D%7D/gi, (_, inner: string) => `{{${decodeURIComponent(inner)}}}`);
}

/** Meta preset: one link for every placement; Meta fills in the platform. */
const META_AUTO = {
  source: "{{site_source_name}}",
  medium: "paid_social",
  campaign: "{{campaign.name}}",
  content: "{{ad.name}}",
};

/**
 * UTM link builder — assemble a tracked URL to paste into an ad, email, or
 * post. Pure client-side. Campaign = the angle, Content = the specific ad
 * (matches the Ad analytics "By campaign" / "By creative" breakdowns).
 * The section heading comes from the page.
 */
export function UtmBuilder() {
  const [base, setBase] = useState("");
  const [source, setSource] = useState("facebook");
  const [medium, setMedium] = useState("paid");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [term, setTerm] = useState("");

  function buildParams(): URLSearchParams {
    const params = new URLSearchParams();
    const set = (k: string, v: string) => {
      const s = slug(v);
      if (s) params.set(k, s);
    };
    set("utm_source", source);
    set("utm_medium", medium);
    set("utm_campaign", campaign);
    set("utm_content", content);
    set("utm_term", term);
    return params;
  }

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
    for (const [k, v] of buildParams()) params.set(k, v);
    url.search = params.toString();
    return keepMacros(url.toString());
  }

  const result = buildUrl();
  const paramsOnly = keepMacros(buildParams().toString());

  function applyMetaAuto() {
    setSource(META_AUTO.source);
    setMedium(META_AUTO.medium);
    setCampaign(META_AUTO.campaign);
    setContent(META_AUTO.content);
    setTerm("");
  }

  return (
    <Surface className="space-y-5 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={applyMetaAuto}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-full border border-lime-400/30 bg-lime-400/10 px-4 text-xs font-bold text-lime-200 transition-colors hover:border-lime-300/60 hover:bg-lime-400/15"
        >
          <MetaLogo className="h-auto w-[16px]" />
          Meta: auto Facebook / Instagram
        </button>
        <span className="text-xs text-neutral-400">One link for every placement. Meta fills in fb / ig, so the Overview can split them.</span>
      </div>

      <Field label="Destination URL">
        {(id) => <input id={id} type="url" inputMode="url" value={base} onChange={(e) => setBase(e.target.value)} placeholder="yourclient.com/tax-planning" className={FIELD} />}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Source">
          {(id) => (
            <>
              <input id={id} value={source} onChange={(e) => setSource(e.target.value)} list="utm-sources" placeholder="facebook" className={FIELD} />
              <datalist id="utm-sources">
                {SOURCE_PRESETS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Medium">{(id) => <input id={id} value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="paid" className={FIELD} />}</Field>
        <Field label="Campaign · the angle" hint="Shows up under By campaign">
          {(id) => <input id={id} value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="tax-planning-q3" className={FIELD} />}
        </Field>
        <Field label="Content · the specific ad" hint="Shows up under By creative">
          {(id) => <input id={id} value={content} onChange={(e) => setContent(e.target.value)} placeholder="video-hook-a" className={FIELD} />}
        </Field>
        <Field label="Term" hint="Optional (search keywords)">
          {(id) => <input id={id} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="cpa near me" className={FIELD} />}
        </Field>
      </div>

      <div className="space-y-4 border-t border-white/10 pt-4">
        <CopyField label="Tracked link" value={result} />
        {!result && base.trim() && <p className="-mt-2 text-xs text-amber-200">That doesn&apos;t look like a web address yet.</p>}
        <CopyField label="URL parameters only (for Meta's URL parameters box)" value={paramsOnly} />
      </div>
    </Surface>
  );
}
