import React from "react";
import { AbsoluteFill } from "remotion";
import type { EditProps } from "../types";
import { Plate } from "./Plate";
import { MediaLayer } from "../components/MediaLayer";
import { Captions } from "../components/Captions";
import { VslCardView } from "../components/Overlays";
import { SourceCaptions, SourcePip, pipSpans, plateVolume } from "../components/SourcePip";

/**
 * Landscape VSL: speaker centre-frame, no top-banner slot — everything lives
 * in one left-column slot, sequenced so two cards are never on screen at once.
 */
export const VslRig: React.FC<EditProps> = ({ videoUrl, words, overlays, pip, durationS, media }) => (
  <AbsoluteFill>
    <Plate src={videoUrl} volume={pip ? plateVolume(pip.windows) : undefined} />
    {/* Clips on screen (the presenter keeps talking over them). */}
    {media && <MediaLayer media={media} plateSrc={videoUrl} vertical={false} />}
    {pip && <SourcePip pip={pip} vertical={false} titled={false} at={overlays.layout?.pip} />}
    <Captions words={words} size={48} vertical={false} at={overlays.layout?.captions} look={overlays.captionStyle} hide={pip ? pipSpans(pip) : undefined} />
    {pip && <SourceCaptions pip={pip} durationS={durationS} size={48} vertical={false} at={overlays.layout?.captions} look={overlays.captionStyle} />}
    {overlays.cards.map((c, i) => (
      <VslCardView key={i} card={c} at={overlays.layout?.cards} scale={overlays.sizes?.cards} />
    ))}
  </AbsoluteFill>
);
