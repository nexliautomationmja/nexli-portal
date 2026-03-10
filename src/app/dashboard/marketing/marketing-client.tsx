"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  useMarketingVideos,
  type MarketingVideo,
} from "@/lib/hooks/use-marketing-videos";
import { GlassCard } from "@/components/ui/glass-card";
import { VideoIcon, UploadIcon, TrashIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface MarketingClientProps {
  userId: string;
}

type WizardStep = "script" | "assets" | "generate" | "library";

const STEPS: { key: WizardStep; label: string; num: number }[] = [
  { key: "script", label: "Script & Voice", num: 1 },
  { key: "assets", label: "Avatar", num: 2 },
  { key: "generate", label: "Generate", num: 3 },
];

const TONE_OPTIONS = [
  "conversational",
  "excited",
  "professional",
  "casual",
  "urgent",
  "friendly",
];

const VOICE_OPTIONS = [
  // Custom / saved voices
  { id: "jqcCZkN6Knx8BJ5TBdYR", label: "Justine (Zara)", desc: "Female, confident" },
  { id: "pDxcmDdBPmpAPjBko2mF", label: "Dontae Brown", desc: "Male, casual" },
  { id: "GbDIo39THauInuigCmPM", label: "Nylo", desc: "Female, calm" },
  { id: "DLsHlh26Ugcm6ELvS0qi", label: "Ms. Walker", desc: "Female, southern" },
  { id: "iCrDUkL56s3C8sCRl7wb", label: "Hope", desc: "Female, soothing" },
  { id: "zubqz6JC54rePKNCKZLG", label: "Lou Berry", desc: "Female, crisp" },
  { id: "tPzOTlbmuCEa6h67Xb6k", label: "Viktoria", desc: "Female, strong" },
  { id: "GR4dBIFsYe57TxyrHKXz", label: "Eiko", desc: "Female, Japanese" },
  { id: "PmgfHCGeS5b7sH90BOOJ", label: "Fumi", desc: "Female, Japanese" },
];

export function MarketingClient({ userId }: MarketingClientProps) {
  // Wizard state
  const [step, setStep] = useState<WizardStep>("library");

  // Script state
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("conversational");
  const [duration, setDuration] = useState("30");
  const [targetAudience, setTargetAudience] = useState("");
  const [callToAction, setCallToAction] = useState("");
  const [script, setScript] = useState("");
  const [generatingScript, setGeneratingScript] = useState(false);
  const [scriptError, setScriptError] = useState("");

  // Voice / TTS state
  const [selectedVoice, setSelectedVoice] = useState("jqcCZkN6Knx8BJ5TBdYR");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioStoragePath, setAudioStoragePath] = useState("");
  const [generatingVoice, setGeneratingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  // Asset state (avatar only now)
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarStoragePath, setAvatarStoragePath] = useState("");
  const [avatarFileName, setAvatarFileName] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Generate state
  const [pollingVideoId, setPollingVideoId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [visualPrompt, setVisualPrompt] = useState(
    "4K studio interview, medium close-up, soft key-light, shallow depth of field"
  );
  const [resolution, setResolution] = useState("480p");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [generateSuccess, setGenerateSuccess] = useState(false);

  // Video library
  const { videos, loading, refetch } = useMarketingVideos();

  // ── Handlers ─────────────────────────────────────────

  const resetWizard = useCallback(() => {
    setStep("script");
    setTopic("");
    setTone("conversational");
    setDuration("30");
    setTargetAudience("");
    setCallToAction("");
    setScript("");
    setScriptError("");
    setSelectedVoice("rachel");
    setAudioUrl("");
    setAudioStoragePath("");
    setGeneratingVoice(false);
    setVoiceError("");
    setAvatarUrl("");
    setAvatarStoragePath("");
    setAvatarFileName("");
    setUploadError("");
    setTitle("");
    setVisualPrompt(
      "4K studio interview, medium close-up, soft key-light, shallow depth of field"
    );
    setResolution("480p");
    setGenerateError("");
    setGenerateSuccess(false);
  }, []);

  const handleGenerateScript = useCallback(async () => {
    if (!topic.trim()) return;
    setGeneratingScript(true);
    setScriptError("");

    try {
      const res = await fetch("/api/dashboard/marketing/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          tone,
          duration,
          targetAudience,
          callToAction,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setScriptError(data.error || "Failed to generate script");
        return;
      }

      const data = await res.json();
      setScript(data.script || "");
      // Reset voice when script changes
      setAudioUrl("");
      setAudioStoragePath("");
      setVoiceError("");
    } catch {
      setScriptError("Network error — please try again.");
    } finally {
      setGeneratingScript(false);
    }
  }, [topic, tone, duration, targetAudience, callToAction]);

  const handleGenerateVoice = useCallback(async () => {
    if (!script.trim()) return;
    setGeneratingVoice(true);
    setVoiceError("");

    try {
      const res = await fetch("/api/dashboard/marketing/generate-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          voiceId: selectedVoice,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setVoiceError(data.error || "Voice generation failed");
        return;
      }

      const data = await res.json();
      setAudioUrl(data.audioUrl);
      setAudioStoragePath(data.storagePath);
    } catch {
      setVoiceError("Network error — voice generation failed.");
    } finally {
      setGeneratingVoice(false);
    }
  }, [script, selectedVoice]);

  const handleUploadAvatar = useCallback(
    async (file: File) => {
      setUploadingAvatar(true);
      setUploadError("");

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/dashboard/marketing/upload-avatar", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          setUploadError(data.error || "Avatar upload failed");
          return;
        }

        const data = await res.json();
        setAvatarUrl(data.url);
        setAvatarStoragePath(data.storagePath);
        setAvatarFileName(file.name);
      } catch {
        setUploadError("Network error — avatar upload failed.");
      } finally {
        setUploadingAvatar(false);
      }
    },
    []
  );

  const handleGenerateVideo = useCallback(async () => {
    if (!title.trim() || !avatarUrl || !audioUrl || !script) return;
    setGenerating(true);
    setGenerateError("");
    setGenerateSuccess(false);

    try {
      const res = await fetch("/api/dashboard/marketing/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          script,
          avatarUrl,
          avatarStoragePath,
          audioUrl,
          audioStoragePath,
          visualPrompt,
          resolution,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setGenerateError(data.error || "Video generation failed");
        setGenerating(false);
        return;
      }

      const data = await res.json();
      // Start polling for completion
      setPollingVideoId(data.video?.id || null);
    } catch {
      setGenerateError("Network error — video generation failed.");
      setGenerating(false);
    }
  }, [
    title,
    script,
    avatarUrl,
    avatarStoragePath,
    audioUrl,
    audioStoragePath,
    visualPrompt,
    resolution,
  ]);

  // Poll for video generation status
  useEffect(() => {
    if (!pollingVideoId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/dashboard/marketing/${pollingVideoId}`
        );
        if (!res.ok) return;

        const data = await res.json();

        if (data.status === "completed") {
          clearInterval(interval);
          setPollingVideoId(null);
          setGenerating(false);
          setGenerateSuccess(true);
          refetch();
        } else if (data.status === "failed") {
          clearInterval(interval);
          setPollingVideoId(null);
          setGenerating(false);
          setGenerateError(data.errorMessage || "Video generation failed");
        }
        // "generating" → keep polling
      } catch {
        // Network blip — keep polling
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [pollingVideoId, refetch]);

  const handleDeleteVideo = useCallback(
    async (id: string) => {
      if (!confirm("Delete this video? This cannot be undone.")) return;

      try {
        const res = await fetch(`/api/dashboard/marketing/${id}`, {
          method: "DELETE",
        });
        if (res.ok) refetch();
      } catch {
        // silently fail
      }
    },
    [refetch]
  );

  // ── Render ───────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold"
            style={{ color: "var(--text-main)" }}
          >
            Marketing Studio
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Generate AI talking-head ad videos with Creatify Aurora.
          </p>
        </div>
        {step === "library" ? (
          <button
            onClick={resetWizard}
            className="px-4 py-2 rounded-full text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #2563EB, #06B6D4)",
            }}
          >
            + New Video
          </button>
        ) : (
          <button
            onClick={() => setStep("library")}
            className="px-4 py-2 rounded-full text-sm font-medium border border-[var(--glass-border)] transition-all duration-200 hover:border-blue-500/30"
            style={{ color: "var(--text-muted)" }}
          >
            Back to Library
          </button>
        )}
      </div>

      {/* Step indicator */}
      {step !== "library" && (
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <button
                onClick={() => setStep(s.key)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                  step === s.key
                    ? "border-blue-500/30 text-white"
                    : "border-[var(--glass-border)] hover:border-blue-500/20"
                )}
                style={{
                  color: step === s.key ? undefined : "var(--text-muted)",
                  background:
                    step === s.key
                      ? "linear-gradient(135deg, rgba(37,99,235,0.3), rgba(6,182,212,0.3))"
                      : "var(--glass-bg)",
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background:
                      step === s.key
                        ? "rgba(255,255,255,0.2)"
                        : "var(--glass-border)",
                  }}
                >
                  {s.num}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className="w-8 h-px"
                  style={{ background: "var(--glass-border)" }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Step 1: Script & Voice ───────────────────────── */}
      {step === "script" && (
        <GlassCard>
          <div className="space-y-6">
            <div>
              <h2
                className="text-lg font-bold"
                style={{ color: "var(--text-main)" }}
              >
                Generate Ad Script & Voice
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Claude writes the script, ElevenLabs generates the voice-over.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Topic */}
              <div className="md:col-span-2">
                <label
                  className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Topic / Product
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Our new AI scheduling tool that saves 5 hours per week"
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500/50 transition-colors"
                  style={{ color: "var(--text-main)" }}
                />
              </div>

              {/* Tone */}
              <div>
                <label
                  className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Tone
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                        tone === t
                          ? "border-blue-500/30 text-white"
                          : "border-[var(--glass-border)] hover:border-blue-500/20"
                      )}
                      style={{
                        color: tone === t ? undefined : "var(--text-muted)",
                        background:
                          tone === t
                            ? "linear-gradient(135deg, rgba(37,99,235,0.3), rgba(6,182,212,0.3))"
                            : "transparent",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label
                  className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Duration
                </label>
                <div className="flex gap-1.5">
                  {["15", "30", "60"].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                        duration === d
                          ? "border-blue-500/30 text-white"
                          : "border-[var(--glass-border)] hover:border-blue-500/20"
                      )}
                      style={{
                        color: duration === d ? undefined : "var(--text-muted)",
                        background:
                          duration === d
                            ? "linear-gradient(135deg, rgba(37,99,235,0.3), rgba(6,182,212,0.3))"
                            : "transparent",
                      }}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Audience */}
              <div>
                <label
                  className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Target Audience (optional)
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. Small business owners, age 30-50"
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500/50 transition-colors"
                  style={{ color: "var(--text-main)" }}
                />
              </div>

              {/* CTA */}
              <div>
                <label
                  className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Call to Action (optional)
                </label>
                <input
                  type="text"
                  value={callToAction}
                  onChange={(e) => setCallToAction(e.target.value)}
                  placeholder="e.g. Try it free for 14 days"
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500/50 transition-colors"
                  style={{ color: "var(--text-main)" }}
                />
              </div>
            </div>

            <button
              onClick={handleGenerateScript}
              disabled={!topic.trim() || generatingScript}
              className="px-6 py-2.5 rounded-full text-sm font-bold text-white disabled:opacity-50 transition-all duration-200 hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #2563EB, #06B6D4)",
              }}
            >
              {generatingScript ? "Generating Script..." : "Generate Script"}
            </button>

            {scriptError && (
              <p className="text-sm text-red-400">{scriptError}</p>
            )}

            {/* Script output + Voice generation */}
            {script && (
              <div className="space-y-4">
                <label
                  className="block text-[10px] font-black uppercase tracking-[0.2em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Generated Script
                </label>
                <textarea
                  value={script}
                  onChange={(e) => {
                    setScript(e.target.value);
                    // Reset voice when script is edited
                    if (audioUrl) {
                      setAudioUrl("");
                      setAudioStoragePath("");
                    }
                  }}
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500/50 transition-colors resize-y"
                  style={{ color: "var(--text-main)" }}
                />
                <p
                  className="text-[10px]"
                  style={{ color: "var(--text-muted)", opacity: 0.5 }}
                >
                  ~{script.split(/\s+/).length} words | Edit as needed before
                  generating voice.
                </p>

                {/* Voice selection */}
                <div
                  className="rounded-xl p-4 border border-[var(--glass-border)] space-y-3"
                  style={{ background: "var(--glass-bg)" }}
                >
                  <label
                    className="block text-[10px] font-black uppercase tracking-[0.2em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Select Voice
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {VOICE_OPTIONS.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setSelectedVoice(v.id);
                          // Reset audio if voice changes
                          if (audioUrl) {
                            setAudioUrl("");
                            setAudioStoragePath("");
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                          selectedVoice === v.id
                            ? "border-blue-500/30 text-white"
                            : "border-[var(--glass-border)] hover:border-blue-500/20"
                        )}
                        style={{
                          color:
                            selectedVoice === v.id
                              ? undefined
                              : "var(--text-muted)",
                          background:
                            selectedVoice === v.id
                              ? "linear-gradient(135deg, rgba(37,99,235,0.3), rgba(6,182,212,0.3))"
                              : "transparent",
                        }}
                      >
                        {v.label}{" "}
                        <span style={{ opacity: 0.5 }}>({v.desc})</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleGenerateVoice}
                    disabled={generatingVoice || !script.trim()}
                    className="px-5 py-2 rounded-full text-sm font-bold text-white disabled:opacity-50 transition-all duration-200 hover:opacity-90"
                    style={{
                      background: "linear-gradient(135deg, #7C3AED, #2563EB)",
                    }}
                  >
                    {generatingVoice ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Generating Voice...
                      </span>
                    ) : audioUrl ? (
                      "Regenerate Voice"
                    ) : (
                      "Generate Voice"
                    )}
                  </button>

                  {voiceError && (
                    <p className="text-xs text-red-400">{voiceError}</p>
                  )}
                </div>

                {/* Audio preview */}
                {audioUrl && (
                  <div
                    className="rounded-xl p-4 border border-emerald-500/20 space-y-2"
                    style={{ background: "rgba(16, 185, 129, 0.05)" }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <label
                        className="text-[10px] font-black uppercase tracking-[0.2em]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Voice-Over Ready
                      </label>
                    </div>
                    <audio src={audioUrl} controls className="w-full" />
                    <p
                      className="text-[10px]"
                      style={{ color: "var(--text-muted)", opacity: 0.5 }}
                    >
                      Voice:{" "}
                      {VOICE_OPTIONS.find((v) => v.id === selectedVoice)
                        ?.label || selectedVoice}
                    </p>
                  </div>
                )}

                {/* Next step button — only show when voice is generated */}
                {audioUrl && (
                  <button
                    onClick={() => setStep("assets")}
                    className="px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all duration-200 hover:opacity-90"
                    style={{
                      background: "linear-gradient(135deg, #2563EB, #06B6D4)",
                    }}
                  >
                    Next: Select Avatar
                  </button>
                )}
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* ── Step 2: Avatar ───────────────────────────────── */}
      {step === "assets" && (
        <div className="max-w-md mx-auto space-y-6">
          <GlassCard>
            <div className="space-y-4">
              <div>
                <h3
                  className="text-sm font-bold"
                  style={{ color: "var(--text-main)" }}
                >
                  Avatar Image
                </h3>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Upload a photo of the person for the talking-head video.
                  Front-facing, well-lit works best.
                </p>
              </div>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadAvatar(file);
                  e.target.value = "";
                }}
              />

              {avatarUrl ? (
                <div className="relative">
                  <img
                    src={avatarUrl}
                    alt="Avatar preview"
                    className="w-full aspect-square object-cover rounded-xl border border-[var(--glass-border)]"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className="text-xs truncate"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {avatarFileName}
                    </span>
                    <button
                      onClick={() => {
                        setAvatarUrl("");
                        setAvatarStoragePath("");
                        setAvatarFileName("");
                      }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="w-full aspect-square rounded-xl border-2 border-dashed border-[var(--glass-border)] flex flex-col items-center justify-center gap-2 hover:border-blue-500/30 transition-colors disabled:opacity-50"
                >
                  {uploadingAvatar ? (
                    <div className="w-6 h-6 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                  ) : (
                    <UploadIcon className="w-6 h-6" />
                  )}
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {uploadingAvatar ? "Uploading..." : "Upload Avatar Photo"}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)", opacity: 0.5 }}
                  >
                    PNG, JPEG, WebP (max 10MB)
                  </span>
                </button>
              )}

              {uploadError && (
                <p className="text-sm text-red-400">{uploadError}</p>
              )}

              {/* Voice-over summary */}
              {audioUrl && (
                <div
                  className="rounded-xl p-3 border border-[var(--glass-border)]"
                  style={{ background: "var(--glass-bg)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <label
                      className="text-[10px] font-black uppercase tracking-[0.2em]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Voice-Over
                    </label>
                  </div>
                  <audio src={audioUrl} controls className="w-full" />
                </div>
              )}
            </div>
          </GlassCard>

          <button
            onClick={() => setStep("generate")}
            disabled={!avatarUrl || !audioUrl}
            className="px-6 py-2.5 rounded-full text-sm font-bold text-white disabled:opacity-50 transition-all duration-200 hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #2563EB, #06B6D4)",
            }}
          >
            Next: Generate Video
          </button>
        </div>
      )}

      {/* ── Step 3: Generate ───────────────────────────────── */}
      {step === "generate" && (
        <GlassCard>
          <div className="space-y-6">
            <div>
              <h2
                className="text-lg font-bold"
                style={{ color: "var(--text-main)" }}
              >
                Generate Video
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Review your settings and generate the talking-head video.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Title */}
              <div className="md:col-span-2">
                <label
                  className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Video Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Spring Launch Ad v1"
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500/50 transition-colors"
                  style={{ color: "var(--text-main)" }}
                />
              </div>

              {/* Visual Prompt */}
              <div className="md:col-span-2">
                <label
                  className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Visual Prompt
                </label>
                <input
                  type="text"
                  value={visualPrompt}
                  onChange={(e) => setVisualPrompt(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500/50 transition-colors"
                  style={{ color: "var(--text-main)" }}
                />
                <p
                  className="text-[10px] mt-1"
                  style={{ color: "var(--text-muted)", opacity: 0.5 }}
                >
                  Describes the visual style — framing, lighting, background. Not
                  what the avatar says.
                </p>
              </div>

              {/* Resolution */}
              <div>
                <label
                  className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Resolution
                </label>
                <div className="flex gap-1.5">
                  {[
                    { val: "480p", cost: "$0.10/sec" },
                    { val: "720p", cost: "$0.14/sec" },
                  ].map((r) => (
                    <button
                      key={r.val}
                      onClick={() => setResolution(r.val)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                        resolution === r.val
                          ? "border-blue-500/30 text-white"
                          : "border-[var(--glass-border)] hover:border-blue-500/20"
                      )}
                      style={{
                        color:
                          resolution === r.val ? undefined : "var(--text-muted)",
                        background:
                          resolution === r.val
                            ? "linear-gradient(135deg, rgba(37,99,235,0.3), rgba(6,182,212,0.3))"
                            : "transparent",
                      }}
                    >
                      {r.val}{" "}
                      <span style={{ opacity: 0.5 }}>({r.cost})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div
              className="rounded-xl p-4 border border-[var(--glass-border)] space-y-2"
              style={{ background: "var(--glass-bg)" }}
            >
              <p
                className="text-[10px] font-black uppercase tracking-[0.2em]"
                style={{ color: "var(--text-muted)" }}
              >
                Summary
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Avatar:</span>{" "}
                  <span style={{ color: "var(--text-main)" }}>
                    {avatarFileName || "—"}
                  </span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Voice:</span>{" "}
                  <span style={{ color: "var(--text-main)" }}>
                    {VOICE_OPTIONS.find((v) => v.id === selectedVoice)?.label ||
                      "—"}{" "}
                    (AI Generated)
                  </span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Resolution:</span>{" "}
                  <span style={{ color: "var(--text-main)" }}>{resolution}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Script:</span>{" "}
                  <span style={{ color: "var(--text-main)" }}>
                    ~{script.split(/\s+/).length} words
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerateVideo}
              disabled={!title.trim() || generating}
              className="px-6 py-2.5 rounded-full text-sm font-bold text-white disabled:opacity-50 transition-all duration-200 hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #2563EB, #06B6D4)",
              }}
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Generating Video...
                </span>
              ) : (
                "Generate Video"
              )}
            </button>

            {generating && (
              <p
                className="text-xs"
                style={{ color: "var(--text-muted)", opacity: 0.5 }}
              >
                This may take 1-3 minutes. Please don&apos;t close this page.
              </p>
            )}

            {generateError && (
              <p className="text-sm text-red-400">{generateError}</p>
            )}

            {generateSuccess && (
              <div className="space-y-2">
                <p className="text-sm text-emerald-400">
                  Video generated successfully!
                </p>
                <button
                  onClick={() => {
                    setStep("library");
                    refetch();
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View in Library
                </button>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* ── Library ────────────────────────────────────────── */}
      {step === "library" && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-video rounded-2xl animate-pulse"
                  style={{ background: "var(--glass-border)" }}
                />
              ))}
            </div>
          ) : videos.length === 0 ? (
            <GlassCard>
              <div className="py-16 text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: "var(--glass-bg)" }}
                >
                  <VideoIcon className="w-7 h-7" />
                </div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  No marketing videos yet.
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--text-muted)", opacity: 0.5 }}
                >
                  Click &quot;+ New Video&quot; to create your first AI ad.
                </p>
              </div>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onDelete={handleDeleteVideo}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── VideoCard ──────────────────────────────────────────

function VideoCard({
  video,
  onDelete,
}: {
  video: MarketingVideo;
  onDelete: (id: string) => void;
}) {
  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    generating: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden group transition-all duration-200 hover:border-blue-500/20">
      {/* Video preview */}
      <div
        className="aspect-video relative flex items-center justify-center overflow-hidden"
        style={{ background: "var(--glass-bg)" }}
      >
        {video.status === "completed" && video.videoUrl ? (
          <video
            src={video.videoUrl}
            className="w-full h-full object-cover"
            controls
            preload="metadata"
          />
        ) : video.status === "generating" ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Generating...
            </span>
          </div>
        ) : video.status === "failed" ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <span className="text-red-400 text-xs">Generation failed</span>
            {video.errorMessage && (
              <span
                className="text-[10px]"
                style={{ color: "var(--text-muted)", opacity: 0.5 }}
              >
                {video.errorMessage}
              </span>
            )}
          </div>
        ) : (
          <VideoIcon className="w-10 h-10" />
        )}

        {/* Delete overlay */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => onDelete(video.id)}
            className="w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
            style={{ background: "rgba(0,0,0,0.5)" }}
            title="Delete"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p
          className="text-xs font-medium truncate"
          style={{ color: "var(--text-main)" }}
          title={video.title}
        >
          {video.title}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <span
            className={cn(
              "inline-block px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border",
              statusColors[video.status] || statusColors.draft
            )}
          >
            {video.status}
          </span>
          <span
            className="text-[10px]"
            style={{ color: "var(--text-muted)", opacity: 0.5 }}
          >
            {new Date(video.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}
