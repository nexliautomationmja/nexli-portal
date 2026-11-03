"use client";

import { useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { RIGS } from "@/remotion/Root";
import { FPS, type EditProps } from "@/remotion/types";

/**
 * Live preview of the edit: the same Remotion composition Lambda renders,
 * playing the real final cut. Loaded client-only (next/dynamic) so the
 * Remotion runtime and fonts only load on the edit step.
 */
export default function EditPreview({
  props,
  seek,
  interactive = true,
}: {
  props: EditProps;
  /** Jump to t seconds (n changes on every request); play unless `still`. */
  seek: { t: number; n: number; still?: boolean } | null;
  /** Off while placing things: no controls, no click-to-play. */
  interactive?: boolean;
}) {
  const ref = useRef<PlayerRef>(null);
  const vertical = props.format !== "vsl_16x9";

  useEffect(() => {
    if (!seek || !ref.current) return;
    ref.current.seekTo(Math.max(0, Math.round(seek.t * FPS)));
    if (seek.still) ref.current.pause();
    else ref.current.play();
  }, [seek]);

  return (
    <Player
      ref={ref}
      component={RIGS[props.style]}
      inputProps={props}
      durationInFrames={Math.max(1, Math.round(FPS * props.durationS))}
      fps={FPS}
      compositionWidth={vertical ? 1080 : 1920}
      compositionHeight={vertical ? 1920 : 1080}
      controls={interactive}
      clickToPlay={interactive}
      doubleClickToFullscreen={interactive}
      spaceKeyToPlayOrPause={interactive}
      style={{ width: "100%", aspectRatio: vertical ? "9 / 16" : "16 / 9", backgroundColor: "#000" }}
    />
  );
}
