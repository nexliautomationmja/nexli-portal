import { NextResponse } from "next/server";
import { buildEngagementRequestEmail } from "@/lib/email";

// Dev-only route to preview email templates in the browser
// Visit: http://localhost:3000/api/preview/email
export async function GET() {
  const { html } = buildEngagementRequestEmail({
    clientName: "John Smith",
    senderName: "Marcel Allen",
    subject: "2025 Tax Preparation Engagement Letter",
    engageUrl: "https://portal.nexli.net/engage/demo-token-preview",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  // Replace production URL with localhost so logos render in local preview
  const previewHtml = html.replace(
    /https:\/\/portal\.nexli\.net/g,
    "http://localhost:3000"
  );

  return new NextResponse(previewHtml, {
    headers: { "Content-Type": "text/html" },
  });
}
