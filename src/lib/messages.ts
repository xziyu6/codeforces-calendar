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
