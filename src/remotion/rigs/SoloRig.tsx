import React from "react";
import { AbsoluteFill } from "remotion";
import type { EditProps } from "../types";
import { Plate } from "./Plate";
import { Captions } from "../components/Captions";
import { TitleBanner } from "../components/Overlays";
import { SourceCaptions, SourcePip, pipSpans, plateVolume } from "../components/SourcePip";

/** Solo: captions plus one persistent title banner — no ladder, no cards (rulebook). */
export const SoloRig: React.FC<EditProps> = ({ videoUrl, words, overlays, format, pip, durationS }) => {
  const vertical = format !== "vsl_16x9";
  return (
    <AbsoluteFill>
      <Plate src={videoUrl} volume={pip ? plateVolume(pip.windows) : undefined} />
      {pip && <SourcePip pip={pip} vertical={vertical} titled={Boolean(overlays.title)} at={overlays.layout?.pip} />}
      <Captions words={words} size={vertical ? 54 : 48} vertical={vertical} at={overlays.layout?.captions} look={overlays.captionStyle} hide={pip ? pipSpans(pip) : undefined} />
      {pip && <SourceCaptions pip={pip} durationS={durationS} size={vertical ? 54 : 48} vertical={vertical} at={overlays.layout?.captions} look={overlays.captionStyle} />}
      {overlays.title && <TitleBanner title={overlays.title} vertical={vertical} at={overlays.layout?.title} scale={overlays.sizes?.title} />}
    </AbsoluteFill>
  );
};
