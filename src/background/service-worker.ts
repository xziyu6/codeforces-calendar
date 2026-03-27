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
  isSyncContestRequest,
  isSyncContestFallbackRequest,
  type GetTrackedContestsResponse,
  type SignOutResponse,
  type SyncContestRequest,
  type SyncContestResponse
} from "../lib/messages";

const RECURRING_SYNC_ALARM = "CF_RECURRING_SYNC_ALARM";
const RECURRING_SYNC_INTERVAL_MINUTES = 30;

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

async function ensureRecurringSyncAlarm(): Promise<void> {
  const alarm = await chrome.alarms.get(RECURRING_SYNC_ALARM);
  if (!alarm) {
    chrome.alarms.create(RECURRING_SYNC_ALARM, { periodInMinutes: RECURRING_SYNC_INTERVAL_MINUTES });
  }
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
    await createOrUpdateCalendarEvent(buildSyncRequestFromContest(contest), token, calendarId);
  }

  await setTrackedContests(stillTracked);
}

void ensureRecurringSyncAlarm();
chrome.runtime.onInstalled.addListener(() => {
  void ensureRecurringSyncAlarm();
});
chrome.runtime.onStartup.addListener(() => {
  void ensureRecurringSyncAlarm();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== RECURRING_SYNC_ALARM) return;
  void reconcileTrackedContests();
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
          let request: SyncContestRequest;

          if (message.startUtcIso && message.endUtcIso) {
            request = {
              type: "CF_SYNC_CONTEST",
              contestId: message.contestId,
              title: message.title,
              startUtcIso: message.startUtcIso,
              endUtcIso: message.endUtcIso,
              sourceUrl: message.sourceUrl
            };
          } else {
            const contest = await fetchContestById(message.contestId);
            if (!contest) throw new Error("contest missing from API response");
            request = buildSyncRequestFromContest(contest);
          }

          const action = await createOrUpdateCalendarEvent(request, token, calendarId);
          await addTrackedContest(message.contestId);
          await ensureRecurringSyncAlarm();
          sendResponse({ ok: true, action });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown background error";
          const code = msg.includes("auth") || msg.includes("token") ? "AUTH" : "API";
          sendResponse({ ok: false, code, message: msg });
        }
      })();
      return true;
    }

    if (isSyncContestFallbackRequest(message)) {
      (async () => {
        try {
          const [token, calendarId] = await Promise.all([getFreshAuthToken(), getSelectedCalendarId()]);
          const contest = await fetchContestById(message.contestId);
          if (!contest) throw new Error("contest missing from API response");

          const range = utcRangeFromContest(contest.startTimeSeconds, contest.durationSeconds);

          const request = {
            type: "CF_SYNC_CONTEST" as const,
            contestId: message.contestId,
            title: message.title,
            startUtcIso: range.startUtcIso,
            endUtcIso: range.endUtcIso,
            sourceUrl: message.sourceUrl
          };

          const action = await createOrUpdateCalendarEvent(request, token, calendarId);
          sendResponse({ ok: true, action, warning: "fallback" });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown background error";
          const code = msg.includes("auth") || msg.includes("token") ? "AUTH" : "API";
          sendResponse({ ok: false, code, message: msg });
        }
      })();
      return true;
    }

    if (isSyncContestRequest(message)) {
      (async () => {
        try {
          const [token, calendarId] = await Promise.all([getFreshAuthToken(), getSelectedCalendarId()]);

          // Run Google upsert and Codeforces verification in parallel.
          const upsertPromise = createOrUpdateCalendarEvent(message, token, calendarId);
          const contestPromise = fetchContestById(message.contestId).catch(() => null);

          const [action, contest] = await Promise.all([upsertPromise, contestPromise]);

          // Non-blocking correction: patch only if API data disagrees with DOM-href parsed times/title.
          if (contest?.startTimeSeconds) {
            const canonicalRange = utcRangeFromContest(contest.startTimeSeconds, contest.durationSeconds);
            const timeMismatch =
              canonicalRange.startUtcIso !== message.startUtcIso || canonicalRange.endUtcIso !== message.endUtcIso;

            const titleMismatch = contest.name !== message.title;

            if (timeMismatch || titleMismatch) {
              await patchCalendarEvent(
                { ...message, title: contest.name, startUtcIso: canonicalRange.startUtcIso, endUtcIso: canonicalRange.endUtcIso },
                token,
                calendarId
              );
            }
          }

          sendResponse({ ok: true, action });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown background error";
          const code = msg.includes("auth") || msg.includes("token") ? "AUTH" : "API";
          sendResponse({ ok: false, code, message: msg });
        }
      })();
      return true;
    }

    sendResponse({ ok: false, code: "BAD_REQUEST", message: "Invalid sync request payload." });
    return false;
  }
);
