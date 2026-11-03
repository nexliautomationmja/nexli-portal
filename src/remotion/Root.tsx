import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { COMPOSITION_ID, EMPTY_OVERLAYS, FPS, type EditProps, type EditStyle } from "./types";
import { SoloRig } from "./rigs/SoloRig";
import { PovRig } from "./rigs/PovRig";
import { VslRig } from "./rigs/VslRig";
import { LadderRig } from "./rigs/LadderRig";

/** Variant registry (rulebook § Compose): one component per rig, registered by .map(). */
export const RIGS: Record<EditStyle, React.FC<EditProps>> = {
  solo: SoloRig,
  pov: PovRig,
  vsl: VslRig,
  ladder: LadderRig,
};

const calculateMetadata: CalculateMetadataFunction<EditProps> = ({ props }) => {
  const vertical = props.format !== "vsl_16x9";
  return {
    durationInFrames: Math.max(1, Math.round(FPS * props.durationS)),
    width: vertical ? 1080 : 1920,
    height: vertical ? 1920 : 1080,
  };
};

const sample = (style: EditStyle): EditProps => ({
  style,
  format: style === "vsl" ? "vsl_16x9" : "ad_9x16",
  videoUrl: "",
  durationS: 6,
  words: [
    { word: "IF", start: 0.2, end: 0.4 },
    { word: "YOU", start: 0.4, end: 0.6 },
    { word: "THINK", start: 0.6, end: 1.0 },
    { word: "YOUR", start: 1.0, end: 1.2 },
    { word: "CPA", start: 1.2, end: 1.7 },
    { word: "FIRM", start: 1.7, end: 2.1 },
  ],
  overlays: { ...EMPTY_OVERLAYS, title: { text: "The volume trap", start: 0, end: 6 } },
});

export const Root: React.FC = () => (
  <>
    {(Object.keys(RIGS) as EditStyle[]).map((style) => (
      <Composition
        key={style}
        id={COMPOSITION_ID[style]}
        component={RIGS[style]}
        fps={FPS}
        width={style === "vsl" ? 1920 : 1080}
        height={style === "vsl" ? 1080 : 1920}
        durationInFrames={360}
        defaultProps={sample(style)}
        calculateMetadata={calculateMetadata}
      />
    ))}
  </>
);
