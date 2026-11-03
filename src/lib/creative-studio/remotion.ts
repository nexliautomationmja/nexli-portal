import {
  getRenderProgress,
  presignUrl,
  renderMediaOnLambda,
  speculateFunctionName,
  type AwsRegion,
} from "@remotion/lambda/client";
import { COMPOSITION_ID, FPS, type EditProps } from "@/remotion/types";

/**
 * Remotion Lambda (AWS). The function and the site (the bundled
 * src/remotion project) are deployed by .github/workflows/remotion-deploy.yml
 * with these same settings, so the function name can be derived here instead
 * of being another env var. Credentials come from REMOTION_AWS_ACCESS_KEY_ID /
 * REMOTION_AWS_SECRET_ACCESS_KEY, which @remotion/lambda reads itself.
 */
// 3008, not 3009: new AWS accounts cap Lambda memory at 3008 MB.
export const LAMBDA_MEMORY_MB = 3008;
export const LAMBDA_DISK_MB = 2048;
export const LAMBDA_TIMEOUT_S = 900;

/** Keep a render inside a new AWS account's default concurrency (≈10 functions). */
const MAX_LAMBDAS = 8;

const region = () => (process.env.REMOTION_AWS_REGION || "us-east-1") as AwsRegion;
const functionName = () =>
  speculateFunctionName({ memorySizeInMb: LAMBDA_MEMORY_MB, diskSizeInMb: LAMBDA_DISK_MB, timeoutInSeconds: LAMBDA_TIMEOUT_S });

/** What's missing before a render can start (empty = ready). */
export function remotionMissing(): string[] {
  const missing: string[] = [];
  if (!process.env.REMOTION_AWS_ACCESS_KEY_ID) missing.push("REMOTION_AWS_ACCESS_KEY_ID");
  if (!process.env.REMOTION_AWS_SECRET_ACCESS_KEY) missing.push("REMOTION_AWS_SECRET_ACCESS_KEY");
  if (!process.env.REMOTION_SERVE_URL) missing.push("REMOTION_SERVE_URL");
  return missing;
}

export async function startRender(props: EditProps): Promise<{ renderId: string; bucketName: string }> {
  const frames = Math.max(1, Math.round(FPS * props.durationS));
  const { renderId, bucketName } = await renderMediaOnLambda({
    region: region(),
    functionName: functionName(),
    serveUrl: process.env.REMOTION_SERVE_URL!,
    composition: COMPOSITION_ID[props.style],
    inputProps: props,
    codec: "h264",
    jpegQuality: 90,
    privacy: "private",
    framesPerLambda: Math.max(20, Math.ceil(frames / MAX_LAMBDAS)),
    downloadBehavior: { type: "download", fileName: "nexli-edit.mp4" },
    maxRetries: 2,
  });
  return { renderId, bucketName };
}

export interface RenderState {
  done: boolean;
  failed: string | null;
  /** 0–1 */
  progress: number;
  outKey: string | null;
  outBucket: string | null;
  sizeBytes: number | null;
}

export async function renderState(renderId: string, bucketName: string): Promise<RenderState> {
  const p = await getRenderProgress({ renderId, bucketName, functionName: functionName(), region: region() });
  const fatal = p.errors.find((e) => e.isFatal) ?? (p.fatalErrorEncountered ? p.errors[0] : undefined);
  return {
    done: p.done,
    failed: p.fatalErrorEncountered ? (fatal?.message ?? "The render failed on Lambda.").slice(0, 500) : null,
    progress: Math.max(0, Math.min(1, p.overallProgress)),
    outKey: p.outKey,
    outBucket: p.outBucket,
    sizeBytes: p.outputSizeInBytes ?? null,
  };
}

export function presignOutput(bucketName: string, key: string, seconds = 6 * 3600): Promise<string> {
  return presignUrl({ region: region(), bucketName, objectKey: key, expiresInSeconds: seconds });
}
