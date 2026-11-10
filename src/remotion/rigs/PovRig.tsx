import React from "react";
import { AbsoluteFill } from "remotion";
import type { EditProps } from "../types";
import { Plate } from "./Plate";
import { PovSticker } from "../components/Overlays";
import { SourcePip, plateVolume } from "../components/SourcePip";

/**
 * Organic / POV: Instagram's white text-sticker idiom. No brand palette, no
 * dark glass, no captions, light top scrim only (rulebook) — anything heavier
 * reads as an ad.
 */
export const PovRig: React.FC<EditProps> = ({ videoUrl, overlays, format, pip }) => (
  <AbsoluteFill>
    <Plate src={videoUrl} volume={pip ? plateVolume(pip.windows) : undefined} />
    {pip && <SourcePip pip={pip} vertical={format !== "vsl_16x9"} titled={false} at={overlays.layout?.pip} />}
    <AbsoluteFill style={{ height: 520, background: "linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0))" }} />
    {overlays.stickers.map((s, i) => (
      <PovSticker key={i} s={s} at={overlays.layout?.stickers} />
    ))}
  </AbsoluteFill>
);
