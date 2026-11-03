import React from "react";
import { AbsoluteFill } from "remotion";
import type { EditProps } from "../types";
import { Plate } from "./Plate";
import { Captions } from "../components/Captions";
import { TitleBanner } from "../components/Overlays";

/** Solo: captions plus one persistent title banner — no ladder, no cards (rulebook). */
export const SoloRig: React.FC<EditProps> = ({ videoUrl, words, overlays, format }) => {
  const vertical = format !== "vsl_16x9";
  return (
    <AbsoluteFill>
      <Plate src={videoUrl} />
      <Captions words={words} size={vertical ? 54 : 48} vertical={vertical} at={overlays.layout?.captions} look={overlays.captionStyle} />
      {overlays.title && <TitleBanner title={overlays.title} vertical={vertical} at={overlays.layout?.title} />}
    </AbsoluteFill>
  );
};
