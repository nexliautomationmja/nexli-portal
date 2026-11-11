import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import type { EditProps } from "../types";
import { Plate } from "./Plate";
import { Captions } from "../components/Captions";
import { CtaCard, LadderRungs, QualifierBand, TitleBanner } from "../components/Overlays";
import { SourceCaptions, SourcePip, pipSpans, plateVolume } from "../components/SourcePip";

/**
 * Two- and three-founder comparison ladder: title banner, a price/outcome pill
 * and client-type tag per person, red qualifier. The qualifier and CTA share
 * the bottom chrome slot in time (rulebook: when the band runs out, sequence).
 */
export const LadderRig: React.FC<EditProps> = ({ videoUrl, words, overlays, pip, durationS }) => {
  const { width } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Plate src={videoUrl} volume={pip ? plateVolume(pip.windows) : undefined} />
      {pip && <SourcePip pip={pip} vertical titled={Boolean(overlays.title)} at={overlays.layout?.pip} />}
      <Captions words={words} size={50} vertical at={overlays.layout?.captions} look={overlays.captionStyle} hide={pip ? pipSpans(pip) : undefined} />
      {pip && <SourceCaptions pip={pip} durationS={durationS} size={50} vertical at={overlays.layout?.captions} look={overlays.captionStyle} />}
      {overlays.title && <TitleBanner title={overlays.title} vertical at={overlays.layout?.title} scale={overlays.sizes?.title} />}
      <LadderRungs rungs={overlays.rungs} width={width} />
      {overlays.qualifier && <QualifierBand q={overlays.qualifier} vertical at={overlays.layout?.qualifier} scale={overlays.sizes?.qualifier} />}
      {overlays.cta && <CtaCard cta={overlays.cta} vertical at={overlays.layout?.cta} scale={overlays.sizes?.cta} />}
    </AbsoluteFill>
  );
};
