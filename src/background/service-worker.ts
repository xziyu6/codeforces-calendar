import { createOrUpdateCalendarEvent, patchCalendarEvent } from "../lib/google-calendar";
import { getFreshAuthToken, signOutFromGoogle } from "../lib/chrome-identity";
import {
  addTrackedContest,
  clearSelectedCalendar,
  clearTrackedContests,
  getSelectedCalendarId,
  getTrackedContests,
  setTrackedContests
} from "../lib/storage";
import { fetchContestById, fetchContestList, type CfContest } from "../lib/codeforces";
import { utcRangeFromContest } from "../lib/time";
import {
  isGetTrackedContestsRequest,
  isSignOutRequest,
  isTrackContestRequest,
  type GetTrackedContestsResponse,
  type SignOutResponse,
  type SyncContestRequest,
  type SyncContestResponse
} from "../lib/messages";

const RECURRING_SYNC_ALARM = "CF_RECURRING_SYNC_ALARM";
const RECURRING_SYNC_INTERVAL_MINUTES = 240;

function toSyncErrorCode(message: string): "AUTH" | "API" {
  return message.includes("auth") || message.includes("token") ? "AUTH" : "API";
}

function isGoogleNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Google API failed (404):");
}

function buildSyncRequestFromContest(contest: CfContest): SyncContestRequest {
  const range = utcRangeFromContest(contest.startTimeSeconds, contest.durationSeconds);
  return {
    type: "CF_SYNC_CONTEST",
    contestId: String(contest.id),
    title: contest.name,
    startUtcIso: range.startUtcIso,
    endUtcIso: range.endUtcIso,
    sourceUrl: `https://codeforces.com/contest/${contest.id}`
  };
}

function ensureRecurringSyncAlarm(): void {
  // Replacing an existing alarm updates its period (e.g. after interval change in an update).
  chrome.alarms.create(RECURRING_SYNC_ALARM, { periodInMinutes: RECURRING_SYNC_INTERVAL_MINUTES });
}

async function reconcileTrackedContests(): Promise<void> {
  const trackedIds = await getTrackedContests();
  if (trackedIds.length === 0) return;

  const [token, calendarId, contests] = await Promise.all([
    getFreshAuthToken(),
    getSelectedCalendarId(),
    fetchContestList()
  ]);
  const contestMap = new Map(contests.map((contest) => [String(contest.id), contest]));
  const stillTracked: string[] = [];

  for (const contestId of trackedIds) {
    const contest = contestMap.get(contestId);
    if (!contest || contest.phase !== "BEFORE") {
      continue;
    }
    stillTracked.push(contestId);
    const request = buildSyncRequestFromContest(contest);
    try {
      await patchCalendarEvent(request, token, calendarId);
    } catch (error) {
      if (isGoogleNotFoundError(error)) {
        await createOrUpdateCalendarEvent(request, token, calendarId);
      } else {
        throw error;
      }
    }
  }

  await setTrackedContests(stillTracked);
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureRecurringSyncAlarm();
});
chrome.runtime.onStartup.addListener(() => {
  void ensureRecurringSyncAlarm();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RECURRING_SYNC_ALARM) {
    void reconcileTrackedContests();
  }
});

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender,
    sendResponse: (response: SignOutResponse | SyncContestResponse | GetTrackedContestsResponse) => void
  ) => {
    if (isSignOutRequest(message)) {
      (async () => {
        try {
          await signOutFromGoogle();
          await clearSelectedCalendar();
          await clearTrackedContests();
          sendResponse({ ok: true });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Sign-out failed.";
          sendResponse({ ok: false, message: msg });
        }
      })();
      return true;
    }

    if (isGetTrackedContestsRequest(message)) {
      (async () => {
        try {
          const contestIds = await getTrackedContests();
          sendResponse({ ok: true, contestIds });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown background error";
          sendResponse({ ok: false, code: "UNKNOWN", message: msg });
        }
      })();
      return true;
    }

    if (isTrackContestRequest(message)) {
      (async () => {
        try {
          const [token, calendarId] = await Promise.all([getFreshAuthToken(), getSelectedCalendarId()]);
          let action: "created" | "updated";
          if (message.startUtcIso && message.endUtcIso) {
            const request: SyncContestRequest = {
              type: "CF_SYNC_CONTEST",
              contestId: message.contestId,
              title: message.title,
              startUtcIso: message.startUtcIso,
              endUtcIso: message.endUtcIso,
              sourceUrl: message.sourceUrl
            };

            // Fast path with DOM values; verify against API in parallel and correct mismatches.
            const upsertPromise = createOrUpdateCalendarEvent(request, token, calendarId);
            const contestPromise = fetchContestById(message.contestId).catch(() => null);
            const [upsertAction, contest] = await Promise.all([upsertPromise, contestPromise]);
            action = upsertAction;

            if (contest?.startTimeSeconds) {
              const canonical = buildSyncRequestFromContest(contest);
              const timeMismatch =
                canonical.startUtcIso !== request.startUtcIso || canonical.endUtcIso !== request.endUtcIso;
              const titleMismatch = canonical.title !== request.title;
              if (timeMismatch || titleMismatch) {
                await patchCalendarEvent(canonical, token, calendarId);
              }
            }
          } else {
            const contest = await fetchContestById(message.contestId);
            if (!contest) throw new Error("contest missing from API response");
            const request = buildSyncRequestFromContest(contest);
            action = await createOrUpdateCalendarEvent(request, token, calendarId);
          }

          await addTrackedContest(message.contestId);
          sendResponse({ ok: true, action });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown background error";
          const code = toSyncErrorCode(msg);
          sendResponse({ ok: false, code, message: msg });
        }
      })();
      return true;
    }

    sendResponse({ ok: false, code: "BAD_REQUEST", message: "Invalid sync request payload." });
    return false;
  }
);
