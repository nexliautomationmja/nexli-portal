"use client";

import { useState } from "react";

interface TrackingSnippetProps {
  clientId: string;
}

export function TrackingSnippet({ clientId }: TrackingSnippetProps) {
  const [copied, setCopied] = useState(false);

  const snippet = `<script defer src="https://portal.nexli.net/t.js" data-client-id="${clientId}"></script>`;

  function handleCopy() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Add this snippet to your website&apos;s <code className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">&lt;head&gt;</code> tag to start tracking visitors.
      </p>
      <div className="relative">
        <pre
          className="p-4 rounded-xl border border-[var(--glass-border)] text-xs overflow-x-auto"
          style={{ background: "var(--glass-bg)", color: "var(--text-main)" }}
        >
          {snippet}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white transition-all"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
