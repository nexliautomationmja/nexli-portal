import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { EditProps, Zoom } from "../types";
import { Plate } from "./Plate";
import { Captions } from "../components/Captions";
import { CtaCard, LadderRungs, PovSticker, QualifierBand, TitleBanner, VslCardView } from "../components/Overlays";
import { SourceCaptions, SourcePip, pipSpans, plateVolume } from "../components/SourcePip";

/**
 * "Your way": the edit Marcel describes in his own words. A sibling of the
 * four rulebook rigs (composed from their pieces, not a generalisation of
 * them), so approved Solo / POV / VSL / Ladder cuts are untouched. Any slot
 * may be used; captions can be switched off; zooms punch in on the plate.
 */
export const CustomRig: React.FC<EditProps> = ({ videoUrl, words, overlays, format, pip, durationS }) => {
  const { width } = useVideoConfig();
  const vertical = format !== "vsl_16x9";
  const at = overlays.layout ?? {};
  return (
    <AbsoluteFill>
      <ZoomPlate src={videoUrl} zooms={overlays.zooms ?? []} volume={pip ? plateVolume(pip.windows) : undefined} />
      {/* The corner video doesn't zoom with the plate. */}
      {pip && <SourcePip pip={pip} vertical={vertical} titled={Boolean(overlays.title)} at={at.pip} />}
      {overlays.captions !== false && (
        <Captions words={words} size={vertical ? 52 : 48} vertical={vertical} at={at.captions} look={overlays.captionStyle} hide={pip ? pipSpans(pip) : undefined} />
      )}
      {overlays.captions !== false && pip && (
        <SourceCaptions pip={pip} durationS={durationS} size={vertical ? 52 : 48} vertical={vertical} at={at.captions} look={overlays.captionStyle} />
      )}
      {overlays.title && <TitleBanner title={overlays.title} vertical={vertical} at={at.title} scale={overlays.sizes?.title} />}
      {vertical && <LadderRungs rungs={overlays.rungs} width={width} />}
      {overlays.qualifier && <QualifierBand q={overlays.qualifier} vertical={vertical} at={at.qualifier} scale={overlays.sizes?.qualifier} />}
      {overlays.cta && <CtaCard cta={overlays.cta} vertical={vertical} at={at.cta} scale={overlays.sizes?.cta} />}
      {/* Stickers sit below the title when both are on (unless placed by hand). */}
      <AbsoluteFill style={{ transform: overlays.title && !at.stickers ? "translateY(150px)" : undefined }}>
        {overlays.stickers.map((s, i) => (
          <PovSticker key={i} s={s} at={at.stickers} scale={overlays.sizes?.stickers} />
        ))}
      </AbsoluteFill>
      {overlays.cards.map((c, i) => (
        <VslCardView key={i} card={c} at={at.cards} scale={overlays.sizes?.cards} />
      ))}
    </AbsoluteFill>
  );
};

const RAMP = 0.25;

function zoomAt(t: number, zooms: Zoom[]): number {
  let scale = 1;
  for (const z of zooms) {
    if (t < z.start || t > z.end + RAMP) continue;
    const s = interpolate(t, [z.start, z.start + RAMP, z.end, z.end + RAMP], [1, z.scale, z.scale, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    scale = Math.max(scale, s);
  }
  return scale;
}

const ZoomPlate: React.FC<{ src: string; zooms: Zoom[]; volume?: (frame: number) => number }> = ({ src, zooms, volume }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = zoomAt(frame / fps, zooms);
  return (
    <AbsoluteFill style={{ transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: "50% 38%" }}>
      <Plate src={src} volume={volume} />
    </AbsoluteFill>
  );
};
