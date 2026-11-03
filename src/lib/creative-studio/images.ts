import sharp from "sharp";
import type { CreativeFormat } from "@/lib/creative-studio/tables";

/**
 * Turn any image into a Kling-ready frame: ads are center-cropped to 9:16
 * (framework §5: nw = round(h*9/16), x = (w-nw)/2; a frame taller than 9:16
 * is cropped in height), VSL frames keep their shape. Kling wants PNG/JPG
 * below 4K, so the long edge is capped at 3840.
 */
export async function toFrame(
  input: Buffer,
  format: CreativeFormat
): Promise<{ bytes: Buffer; width: number; height: number }> {
  const img = sharp(input, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  let w = meta.width ?? 0;
  let h = meta.height ?? 0;
  if (meta.orientation && meta.orientation >= 5) [w, h] = [h, w];
  if (!w || !h) throw new Error("That image couldn't be read");

  let pipeline = img;
  if (format === "ad_9x16") {
    if (w / h > 9 / 16) {
      const nw = Math.round((h * 9) / 16);
      pipeline = pipeline.extract({ left: Math.floor((w - nw) / 2), top: 0, width: nw, height: h });
      w = nw;
    } else if (w / h < 9 / 16) {
      const nh = Math.round((w * 16) / 9);
      pipeline = pipeline.extract({ left: 0, top: Math.floor((h - nh) / 2), width: w, height: nh });
      h = nh;
    }
  }
  const long = Math.max(w, h);
  if (long > 3840) {
    const scale = 3840 / long;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    pipeline = pipeline.resize(w, h);
  }
  const bytes = await pipeline.png().toBuffer();
  return { bytes, width: w, height: h };
}
