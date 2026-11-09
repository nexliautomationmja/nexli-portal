// ─── Nexli legal footer ────────────────────────────────────
// Who the client is dealing with + the policies on nexli.net. Only for
// Nexli's OWN pages (its letters, invoices and Launch Pad) — never a firm
// tenant's white-label page.

import { NEXLI_LEGAL, NEXLI_POLICY_LINKS } from "@/lib/nexli-legal";

const linkCls = "underline decoration-neutral-700 underline-offset-2 hover:text-neutral-300";

export function NexliLegalFooter({ align = "center", className = "" }: { align?: "center" | "left"; className?: string }) {
  return (
    <div
      className={`${align === "center" ? "text-center" : "text-left"} text-[11px] leading-relaxed text-neutral-500 [overflow-wrap:anywhere] ${className}`}
    >
      <p>
        {NEXLI_LEGAL.name} · {NEXLI_LEGAL.street}, {NEXLI_LEGAL.cityLine} ·{" "}
        <a href={`tel:${NEXLI_LEGAL.phoneE164}`} className={`${linkCls} whitespace-nowrap`}>
          {NEXLI_LEGAL.phoneDisplay}
        </a>{" "}
        ·{" "}
        <a href={`mailto:${NEXLI_LEGAL.email}`} className={linkCls}>
          {NEXLI_LEGAL.email}
        </a>
      </p>
      <p className="mt-1">
        {NEXLI_POLICY_LINKS.map((l, i) => (
          <span key={l.href}>
            {i > 0 && " · "}
            <a href={l.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
              {l.label}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}
