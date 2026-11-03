import React from "react";
import { AbsoluteFill, OffthreadVideo } from "remotion";

/** The final cut as the plate. <OffthreadVideo>, never <Video> (rulebook). The cut already carries its processed audio. */
export const Plate: React.FC<{ src: string }> = ({ src }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    {src ? <OffthreadVideo src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
  </AbsoluteFill>
);
