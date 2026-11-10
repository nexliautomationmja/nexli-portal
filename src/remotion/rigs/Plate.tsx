import React from "react";
import { AbsoluteFill, OffthreadVideo } from "remotion";

/**
 * The final cut as the plate. <OffthreadVideo>, never <Video> (rulebook). The
 * cut already carries its processed audio. `volume` only in a reaction video
 * (quiet while the corner video plays); absence = full volume, as before.
 */
export const Plate: React.FC<{ src: string; volume?: (frame: number) => number }> = ({ src, volume }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    {src ? <OffthreadVideo src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} {...(volume ? { volume } : {})} /> : null}
  </AbsoluteFill>
);
