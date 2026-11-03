import React from "react";
import { AbsoluteFill } from "remotion";
import type { EditProps } from "../types";
import { Plate } from "./Plate";
import { Captions } from "../components/Captions";
import { VslCardView } from "../components/Overlays";

/**
 * Landscape VSL: speaker centre-frame, no top-banner slot — everything lives
 * in one left-column slot, sequenced so two cards are never on screen at once.
 */
export const VslRig: React.FC<EditProps> = ({ videoUrl, words, overlays }) => (
  <AbsoluteFill>
    <Plate src={videoUrl} />
    <Captions words={words} size={48} vertical={false} at={overlays.layout?.captions} look={overlays.captionStyle} />
    {overlays.cards.map((c, i) => (
      <VslCardView key={i} card={c} at={overlays.layout?.cards} />
    ))}
  </AbsoluteFill>
);
