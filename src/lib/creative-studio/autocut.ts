import { execFile } from "child_process";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import type {
  ClipTranscript,
  CreativeFormat,
  CutClipPlan,
  CutOverride,
  CutSettings,
  ManualTrim,
} from "@/lib/creative-studio/tables";
import { computeSegments, round3 } from "@/lib/creative-studio/cutplan";

/**
 * Auto-cut: after Kling renders every clip, cut each one tight (1.2× speed,
 * pauses capped at ~0.25 s), join them into a rough cut, and let Marcel fix
 * it in plain words ("tighter where she says…").
 *
 * The plan is pure and deterministic (word timings + settings + overrides →
 * kept segments), so pieces are cached by a hash of their plan and only the
 * clips whose plan changed are re-rendered.
 */

export { DEFAULT_CUT } from "@/lib/creative-studio/cutplan";

export function planHash(clipId: string, version: number, segments: { start: number; end: number }[], settings: CutSettings, format: CreativeFormat) {
  return createHash("sha1")
    .update(JSON.stringify({ clipId, version, segments, speed: settings.speed, format, v: 1 }))
    .digest("hex")
    .slice(0, 16);
}

/** Kept segments for one clip. */
export function buildClipPlan(args: {
  clipId: string;
  version: number;
  transcript: ClipTranscript | null;
  sourceS: number;
  settings: CutSettings;
  overrides: CutOverride[];
  format: CreativeFormat;
  manual?: ManualTrim | null;
}): CutClipPlan {
  const { clipId, version, transcript, sourceS, settings, overrides, format } = args;
  const manual = args.manual ?? null;
  const { segments, keptS } = computeSegments({ transcript, sourceS, settings, overrides, manual });
  return {
    clipId,
    version,
    ...(manual ? { manual } : {}),
    segments,
    overrides,
    sourceS: round3(sourceS),
    keptS,
    hash: planHash(clipId, version, segments, settings, format),
  };
}

// ── ffmpeg ────────────────────────────────────────────────────────────

let binary: Promise<string> | null = null;

/**
 * The bundled ffmpeg from @ffmpeg-installer (a plain per-platform npm
 * package, so no install script is needed to fetch it). Copied to /tmp and
 * made executable if the deployment bundle lost its exec bit.
 */
function ffmpegBinary(): Promise<string> {
  if (!binary) {
    binary = (async () => {
      const platformPkg = `${os.platform()}-${os.arch()}`;
      const candidates = [
        process.env.FFMPEG_PATH,
        path.join(process.cwd(), "node_modules/@ffmpeg-installer", platformPkg, "ffmpeg"),
      ].filter((p): p is string => Boolean(p));
      for (const p of candidates) {
        try {
          await fs.access(p, fs.constants.X_OK);
          return p;
        } catch {
          try {
            await fs.access(p);
            const tmp = path.join(os.tmpdir(), "ffmpeg-bin");
            await fs.copyFile(p, tmp);
            await fs.chmod(tmp, 0o755);
            return tmp;
          } catch {
            /* try the next candidate */
          }
        }
      }
      throw new Error("ffmpeg isn't available on the server");
    })().catch((err) => {
      binary = null;
      throw err;
    });
  }
  return binary;
}

function run(args: string[], timeoutMs = 240_000): Promise<{ stderr: string }> {
  return ffmpegBinary().then(
    (bin) =>
      new Promise((resolve, reject) => {
        execFile(bin, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, _stdout, stderr) => {
          if (err) reject(new Error(`ffmpeg failed: ${String(stderr).split("\n").slice(-6).join(" ").slice(0, 600)}`));
          else resolve({ stderr: String(stderr) });
        });
      })
  );
}

/** Media duration in seconds (parsed from ffmpeg's header output). */
export async function probeDuration(file: string): Promise<number> {
  const bin = await ffmpegBinary();
  const stderr: string = await new Promise((resolve) => {
    execFile(bin, ["-hide_banner", "-i", file], { timeout: 30_000 }, (_err, _o, se) => resolve(String(se)));
  });
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

export async function tempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

/**
 * Render one clip's piece: keep the planned segments, speed up (pitch kept),
 * normalise frame size + 60 fps CFR (editing rulebook), and run the
 * rulebook's audio chain. Every piece gets identical encoding settings so
 * the rough cut can be joined without re-encoding.
 */
export async function renderPiece(input: string, output: string, plan: CutClipPlan, settings: CutSettings, format: CreativeFormat) {
  const [w, h] = format === "vsl_16x9" ? [1920, 1080] : [1080, 1920];
  const parts: string[] = [];
  const labels: string[] = [];
  plan.segments.forEach((s, i) => {
    parts.push(`[0:v]trim=start=${s.start}:end=${s.end},setpts=PTS-STARTPTS[v${i}]`);
    parts.push(`[0:a]atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS[a${i}]`);
    labels.push(`[v${i}][a${i}]`);
  });
  parts.push(`${labels.join("")}concat=n=${plan.segments.length}:v=1:a=1[vc][ac]`);
  parts.push(
    `[vc]setpts=PTS/${settings.speed},scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=60,format=yuv420p[vo]`
  );
  parts.push(
    `[ac]atempo=${settings.speed},highpass=f=80,afftdn=nf=-20,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100,aformat=channel_layouts=stereo[ao]`
  );
  await run([
    "-hide_banner",
    "-y",
    "-i",
    input,
    "-filter_complex",
    parts.join(";"),
    "-map",
    "[vo]",
    "-map",
    "[ao]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-maxrate",
    "6M",
    "-bufsize",
    "12M",
    "-r",
    "60",
    "-vsync",
    "cfr",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-movflags",
    "+faststart",
    output,
  ]);
}

/** Join pieces (identical encodes) without re-encoding. */
export async function joinPieces(pieces: string[], output: string, workDir: string) {
  const list = path.join(workDir, "list.txt");
  await fs.writeFile(list, pieces.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
  await run(["-hide_banner", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", output], 280_000);
}

// ── Plain-English fixes ───────────────────────────────────────────────

export interface CutRevision {
  settings: { speed: number | null; gap: number | null };
  edits: { clip: number; fromWord: number; toWord: number; action: CutOverride["action"]; gapSeconds: number | null }[];
  rerender: { clip: number; note: string }[];
  summary: string;
}

const NUM_OR_NULL = { type: ["number", "null"] } as const;
const REVISION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["settings", "edits", "rerender", "summary"],
  properties: {
    settings: {
      type: "object",
      additionalProperties: false,
      required: ["speed", "gap"],
      properties: { speed: NUM_OR_NULL, gap: NUM_OR_NULL },
    },
    edits: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["clip", "fromWord", "toWord", "action", "gapSeconds"],
        properties: {
          clip: { type: "integer" },
          fromWord: { type: "integer" },
          toWord: { type: "integer" },
          action: { type: "string", enum: ["tighten", "loosen", "cut", "restore"] },
          gapSeconds: NUM_OR_NULL,
        },
      },
    },
    rerender: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["clip", "note"],
        properties: { clip: { type: "integer" }, note: { type: "string" } },
      },
    },
    summary: { type: "string" },
  },
} as const;

const REVISE_SYSTEM = `You edit the timing of a talking-head video rough cut. The video is a sequence of clips; each clip's words are numbered from 0 with their start time in seconds (source time). The cut keeps each clip's words, trims dead air, and caps every pause at the global "gap" (seconds at playback speed); the whole video plays at the global "speed".

Turn the user's note into edits:
- tighten / loosen a word range in one clip (the pauses inside and just before that range). Default tighten ≈ 0.12 s, loosen ≈ 0.45 s; set gapSeconds only when the user names a length.
- cut a word range (remove those words), or restore a range (undo earlier cuts / tightening there).
- change the global speed (e.g. "slow it to 1.1x" → 1.1; keep within 0.8–1.6) or the global gap (keep within 0.05–1.5); null when unchanged.
- rerender a clip when the problem is the performance itself (a mispronounced or doubled number, a garbled word, wrong delivery) — timing can't fix that. Put a short, specific note for the redo.

Match the words the user quotes to the closest clip and word indexes (they paraphrase; be forgiving). If they say "clip N", clips are numbered from 1. If nothing in the note maps to an edit, return empty lists and explain in the summary. The summary is one or two plain sentences saying what you changed.`;

export async function reviseCut(args: {
  note: string;
  settings: CutSettings;
  clips: { number: number; section: string; line: string; transcript: ClipTranscript | null; overrides: CutOverride[] }[];
}): Promise<CutRevision> {
  const listing = args.clips
    .map((c) => {
      const words = (c.transcript?.words ?? []).map((w, i) => `[${i}]${w.text}@${w.start.toFixed(2)}`).join(" ");
      const ov = c.overrides.length ? ` | current overrides: ${JSON.stringify(c.overrides)}` : "";
      return `Clip ${c.number} (${c.section}) — script: "${c.line}"\n  words: ${words || "(no transcript)"}${ov}`;
    })
    .join("\n");
  const client = new Anthropic({ timeout: 120_000, maxRetries: 1 });
  const params = {
    model: "claude-opus-5-5",
    max_tokens: 8000,
    system: REVISE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Current settings: speed ${args.settings.speed}×, gap ${args.settings.gap}s.\n\n${listing}\n\nThe user's note: ${args.note}`,
      },
    ],
    output_config: { effort: "medium", format: { type: "json_schema", schema: REVISION_SCHEMA } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  } as unknown as Parameters<typeof client.beta.messages.create>[0];
  const message = (await client.beta.messages.create(params)) as Anthropic.Beta.BetaMessage;
  if (message.stop_reason === "refusal") throw new Error("Claude couldn't apply that note. Try rewording it.");
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return JSON.parse(text) as CutRevision;
  } catch {
    throw new Error("Claude returned an unreadable edit. Please try again.");
  }
}

/** Merge a revision's edits into per-clip overrides and clamp the settings. */
export function applyRevision(
  settings: CutSettings,
  overrides: Map<number, CutOverride[]>,
  rev: CutRevision,
  clipCount: number,
  wordCounts: number[]
): { settings: CutSettings; overrides: Map<number, CutOverride[]> } {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const next: CutSettings = {
    speed: rev.settings.speed !== null && Number.isFinite(rev.settings.speed) ? round3(clamp(rev.settings.speed, 0.8, 1.6)) : settings.speed,
    gap: rev.settings.gap !== null && Number.isFinite(rev.settings.gap) ? round3(clamp(rev.settings.gap, 0.05, 1.5)) : settings.gap,
  };
  const out = new Map<number, CutOverride[]>([...overrides].map(([k, v]) => [k, [...v]]));
  for (const e of rev.edits) {
    const idx = e.clip - 1;
    if (idx < 0 || idx >= clipCount) continue;
    const max = Math.max(0, (wordCounts[idx] ?? 1) - 1);
    const from = clamp(Math.min(e.fromWord, e.toWord), 0, max);
    const to = clamp(Math.max(e.fromWord, e.toWord), 0, max);
    const o: CutOverride = { fromWord: from, toWord: to, action: e.action };
    if (e.gapSeconds !== null && Number.isFinite(e.gapSeconds)) o.gapSeconds = round3(clamp(e.gapSeconds, 0.03, 2));
    out.set(idx, [...(out.get(idx) ?? []), o]);
  }
  return { settings: next, overrides: out };
}
