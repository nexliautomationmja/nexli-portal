import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const GHL_WEBHOOK_URL =
  process.env.GHL_AUDIT_WEBHOOK_URL ||
  "https://services.leadconnectorhq.com/hooks/yamjttuJWWdstfF9N0zu/webhook-trigger/c08ab845-6f7c-4016-bdf0-bbcb6b5782e6";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`form-audit:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    const name =
      typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
    const email =
      typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
    const websiteUrl =
      typeof body.websiteUrl === "string"
        ? body.websiteUrl.trim().slice(0, 500)
        : "";
    const firmType =
      typeof body.firmType === "string" ? body.firmType.trim().slice(0, 100) : "";
    const phone =
      typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : "";

    if (!name || !email || !firmType) {
      return NextResponse.json(
        { error: "Name, email, and firm type are required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const res = await fetch(GHL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        websiteUrl,
        firmType,
        phone,
        marketingSmsOptIn: !!body.marketingSmsOptIn,
        nonMarketingSmsOptIn: !!body.nonMarketingSmsOptIn,
      }),
    });

    if (!res.ok) {
      console.error("GHL audit webhook failed:", res.status);
      return NextResponse.json(
        { error: "Submission failed." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Audit form error:", error);
    return NextResponse.json(
      { error: "Submission failed." },
      { status: 500 }
    );
  }
}
