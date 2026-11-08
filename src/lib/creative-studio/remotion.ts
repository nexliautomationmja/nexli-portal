import {
  getAwsClient,
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

/**
 * AWS caps how many Lambda copies run at once (new accounts: often just 10).
 * One render = 1 launch function + N renderers, and every progress check is
 * one more invocation — so renders are sized to the account's real limit and
 * queued (render-queue.ts) instead of spilling over it ("Rate Exceeded").
 */
const MAX_RENDERERS = 40;
const MAX_PARALLEL_RENDERS = 8;
/** Lambda "Concurrent executions" quota. */
const QUOTA_CODE = "L-B99A9384";
/** What we ask AWS for: the normal limit of an established account. */
export const WANTED_LIMIT = 1000;
/** Assumed when AWS won't tell us. */
const FALLBACK_LIMIT = 10;

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

/**
 * Renderer copies for one render on this limit, leaving room for its launch
 * function, progress checks and a retried chunk. Each AWS refusal steps down
 * (…, 2, then 1 = the whole video on the launch function itself).
 */
export function renderersFor(limit: number, attempt = 0): number {
  const base = Math.max(1, Math.min(MAX_RENDERERS, limit - 3));
  const half = Math.ceil(base / 2);
  const ladder = [base, half, Math.min(2, half), 1];
  return ladder[Math.min(Math.max(0, attempt), ladder.length - 1)];
}

/** Renders that fit side by side on this limit (10 → one at a time). */
export function parallelRenders(limit: number): number {
  return Math.max(1, Math.min(MAX_PARALLEL_RENDERS, Math.floor((limit - 1) / (renderersFor(limit) + 2))));
}

/** AWS refused to start more Lambda copies (concurrency or burst limit). */
export function isRateLimit(message: string | null | undefined): boolean {
  return /concurrency limit|rate exceeded|too ?many ?requests|ConcurrentInvocationLimitExceeded/i.test(message ?? "");
}

export async function startRender(props: EditProps, renderers: number): Promise<{ renderId: string; bucketName: string }> {
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
    // Never more renderers than ~20 frames each would need.
    concurrency: Math.max(1, Math.min(renderers, Math.ceil(frames / 20))),
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

export interface QuotaRequest {
  desired: number;
  /** PENDING | CASE_OPENED | APPROVED | DENIED | NOT_APPROVED | CASE_CLOSED | INVALID_REQUEST */
  status: string;
  caseId: string | null;
  requestedAt: string | null;
}

export interface LambdaLimits {
  /** Lambda copies this AWS account may run at once in the region. */
  limit: number;
  /** False when AWS wouldn't say and `limit` is the new-account guess. */
  known: boolean;
  parallel: number;
  renderers: number;
  accountId: string | null;
  /** The newest request to raise the limit, if any. */
  request: QuotaRequest | null;
  wanted: number;
  /** Where to raise it by hand in the AWS console. */
  consoleUrl: string;
  error: string | null;
}

let limitsCache: { at: number; value: LambdaLimits } | null = null;
const LIMITS_TTL_MS = 5 * 60_000;

const quotas = () => getAwsClient({ region: region(), service: "servicequotas" });
const awsMessage = (err: unknown) => (err instanceof Error ? `${err.name}: ${err.message}` : String(err));

/**
 * The account's real Lambda concurrency limit, its account id and the latest
 * request to raise it (cached 5 minutes). Never throws: if AWS won't answer,
 * it assumes a new account's 10.
 */
export async function lambdaLimits(fresh = false): Promise<LambdaLimits> {
  if (!fresh && limitsCache && Date.now() - limitsCache.at < LIMITS_TTL_MS) return limitsCache.value;
  const consoleUrl = `https://${region()}.console.aws.amazon.com/servicequotas/home/services/lambda/quotas/${QUOTA_CODE}`;
  if (remotionMissing().length) {
    const limit = FALLBACK_LIMIT;
    return { limit, known: false, parallel: parallelRenders(limit), renderers: renderersFor(limit), accountId: null, request: null, wanted: WANTED_LIMIT, consoleUrl, error: null };
  }
  const { client, sdk } = quotas();
  const sts = getAwsClient({ region: region(), service: "sts" });
  const [quota, history, identity] = await Promise.allSettled([
    client.send(new sdk.GetServiceQuotaCommand({ ServiceCode: "lambda", QuotaCode: QUOTA_CODE })),
    client.send(new sdk.ListRequestedServiceQuotaChangeHistoryByQuotaCommand({ ServiceCode: "lambda", QuotaCode: QUOTA_CODE })),
    sts.client.send(new sts.sdk.GetCallerIdentityCommand({})),
  ]);
  const value = quota.status === "fulfilled" ? quota.value.Quota?.Value : undefined;
  const limit = typeof value === "number" && value > 0 ? Math.floor(value) : FALLBACK_LIMIT;
  const latest =
    history.status === "fulfilled"
      ? [...(history.value.RequestedQuotas ?? [])].sort((a, b) => (b.Created?.getTime() ?? 0) - (a.Created?.getTime() ?? 0))[0]
      : undefined;
  const result: LambdaLimits = {
    limit,
    known: typeof value === "number" && value > 0,
    parallel: parallelRenders(limit),
    renderers: renderersFor(limit),
    accountId: identity.status === "fulfilled" ? (identity.value.Account ?? null) : null,
    request: latest
      ? {
          desired: latest.DesiredValue ?? 0,
          status: latest.Status ?? "PENDING",
          caseId: latest.CaseId ?? null,
          requestedAt: latest.Created?.toISOString() ?? null,
        }
      : null,
    wanted: WANTED_LIMIT,
    consoleUrl,
    error: quota.status === "rejected" ? awsMessage(quota.reason).slice(0, 300) : null,
  };
  if (quota.status === "rejected") console.warn("[creative-studio] Lambda quota lookup failed:", result.error);
  limitsCache = { at: Date.now(), value: result };
  return result;
}

/** Ask AWS to raise the Lambda concurrency limit to WANTED_LIMIT (one open request at a time). */
export async function requestLimitRaise(): Promise<{ ok: true; limits: LambdaLimits } | { ok: false; error: string; limits: LambdaLimits }> {
  const current = await lambdaLimits(true);
  if (current.limit >= WANTED_LIMIT) return { ok: false, error: `The limit is already ${current.limit}.`, limits: current };
  if (current.request && (current.request.status === "PENDING" || current.request.status === "CASE_OPENED")) {
    return { ok: false, error: "A request is already with AWS.", limits: current };
  }
  const { client, sdk } = quotas();
  try {
    await client.send(new sdk.RequestServiceQuotaIncreaseCommand({ ServiceCode: "lambda", QuotaCode: QUOTA_CODE, DesiredValue: WANTED_LIMIT }));
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    console.warn("[creative-studio] Lambda quota request failed:", awsMessage(err));
    const error =
      name === "AccessDeniedException"
        ? "The Remotion AWS user isn't allowed to ask for this. Sign in to AWS as the root user and request it on the Service Quotas page."
        : name === "DependencyAccessDeniedException"
          ? "This AWS account is part of an organization, so the request has to be made in the AWS console."
          : `AWS didn't take the request: ${err instanceof Error ? err.message : "unknown error"}`.slice(0, 300);
    return { ok: false, error, limits: current };
  }
  return { ok: true, limits: await lambdaLimits(true) };
}
