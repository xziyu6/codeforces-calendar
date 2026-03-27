export type RowSyncState = "idle" | "syncing" | "synced" | "error";

export interface SyncContestRequest {
  type: "CF_SYNC_CONTEST";
  contestId: string;
  title: string;
  startUtcIso: string;
  endUtcIso: string;
  sourceUrl: string;
}

export interface SyncContestFallbackRequest {
  type: "CF_SYNC_CONTEST_FALLBACK";
  contestId: string;
  title: string;
  sourceUrl: string;
}

export interface TrackContestRequest {
  type: "CF_TRACK_CONTEST";
  contestId: string;
  title: string;
  sourceUrl: string;
  startUtcIso?: string;
  endUtcIso?: string;
}

export interface GetTrackedContestsRequest {
  type: "CF_GET_TRACKED_CONTESTS";
}

export interface SyncContestOk {
  ok: true;
  action: "created" | "updated";
  warning?: string;
}

export interface SyncContestError {
  ok: false;
  code: "BAD_REQUEST" | "AUTH" | "NETWORK" | "API" | "UNKNOWN";
  message: string;
}

export type SyncContestResponse = SyncContestOk | SyncContestError;
export type TrackContestResponse = SyncContestResponse;
export type GetTrackedContestsResponse =
  | { ok: true; contestIds: string[] }
  | { ok: false; code: "API" | "UNKNOWN"; message: string };

export interface SignOutRequest {
  type: "CF_SIGN_OUT";
}

export type SignOutResponse = { ok: true } | { ok: false; message: string };

export function isSignOutRequest(value: unknown): value is SignOutRequest {
  return typeof value === "object" && value !== null && (value as SignOutRequest).type === "CF_SIGN_OUT";
}

export function isSyncContestRequest(value: unknown): value is SyncContestRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "CF_SYNC_CONTEST" &&
    typeof candidate.contestId === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.startUtcIso === "string" &&
    typeof candidate.endUtcIso === "string" &&
    typeof candidate.sourceUrl === "string"
  );
}

export function isSyncContestFallbackRequest(value: unknown): value is SyncContestFallbackRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "CF_SYNC_CONTEST_FALLBACK" &&
    typeof candidate.contestId === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.sourceUrl === "string"
  );
}

export function isTrackContestRequest(value: unknown): value is TrackContestRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "CF_TRACK_CONTEST" &&
    typeof candidate.contestId === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.sourceUrl === "string" &&
    (candidate.startUtcIso === undefined || typeof candidate.startUtcIso === "string") &&
    (candidate.endUtcIso === undefined || typeof candidate.endUtcIso === "string")
  );
}

export function isGetTrackedContestsRequest(value: unknown): value is GetTrackedContestsRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as GetTrackedContestsRequest).type === "CF_GET_TRACKED_CONTESTS"
  );
}
