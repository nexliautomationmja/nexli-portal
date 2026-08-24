import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

// Contract analysis can take a while (large PDF + a thorough model pass).
export const maxDuration = 300;

const MAX_SIZE = 4 * 1024 * 1024; // 4MB — Vercel serverless request-body ceiling
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const SYSTEM_PROMPT = `You are a senior contracts attorney reviewing an agreement on behalf of the reader's business. Read the entire document and produce a clear, practical assessment for a non-lawyer business owner.

Return ONLY a single JSON object — no preamble, no reasoning, no markdown fences — with exactly this shape:
{
  "verdict": "green" | "yellow" | "red",
  "verdictLabel": string,          // short, e.g. "Looks good to sign", "Negotiate a few points first", "Do not sign as written"
  "verdictReason": string,         // one sentence explaining the verdict
  "documentType": string,          // e.g. "Master Services Agreement", "Commercial Lease"
  "summary": string,               // one plain-English paragraph
  "bulletPoints": string[],        // the whole contract in plain-English bullet points, section by section
  "keyTerms": [{ "label": string, "value": string }],   // Parties, Term, Payment, Termination, Liability, Renewal, Governing law, etc.
  "redFlags": [{ "severity": "high" | "medium" | "low", "title": string, "detail": string }],
  "favorable": string[],           // terms that benefit the reader
  "recommendations": string[]      // what to clarify or negotiate before signing
}

Guidance:
- "green" = standard, balanced terms, safe to sign. "yellow" = signable but has points worth negotiating or clarifying. "red" = contains terms that could seriously harm the reader; don't sign as-is.
- Be specific in red flags: name the clause and the concrete risk (auto-renewal, unilateral termination, uncapped liability, IP assignment, non-compete, personal guarantee, one-sided indemnification, hidden fees, etc.).
- If the document isn't a contract or is unreadable, set verdict "yellow", explain in verdictReason, and fill what you can.
- Keep every string plain-English and jargon-free. Output valid JSON only.`;

interface AnalysisContentBlock {
  type: "document" | "image" | "text";
  source?: {
    type: "base64";
    media_type: string;
    data: string;
  };
  text?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file || !file.size) {
    return NextResponse.json({ error: "Please choose a contract to analyze." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File is over 4MB. Please upload a smaller PDF, image, or text file." },
      { status: 400 }
    );
  }

  const mime = file.type;
  const isPdf = mime === "application/pdf";
  const isImage = IMAGE_TYPES.has(mime);
  const isText = mime === "text/plain" || file.name.toLowerCase().endsWith(".txt");

  if (!isPdf && !isImage && !isText) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a PDF, an image (JPG/PNG/WEBP), or a .txt file." },
      { status: 400 }
    );
  }

  // Build the document content block for Claude.
  const fileBlock: AnalysisContentBlock = isText
    ? { type: "text", text: (await file.text()).slice(0, 200_000) }
    : isPdf
      ? {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: Buffer.from(await file.arrayBuffer()).toString("base64"),
          },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: mime,
            data: Buffer.from(await file.arrayBuffer()).toString("base64"),
          },
        };

  const content = [
    fileBlock,
    {
      type: "text" as const,
      text: "Analyze this contract and respond with the JSON object described in your instructions.",
    },
  ];

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: "user", content: content as any }],
    });

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      }
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Couldn't read the analysis. Please try again." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ analysis: parsed, fileName: file.name });
  } catch (err) {
    console.error("[Contract Analyzer] failed:", err);
    return NextResponse.json(
      { error: "Analysis failed. Please try again in a moment." },
      { status: 500 }
    );
  }
}
