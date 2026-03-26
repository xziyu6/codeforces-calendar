import { createOrUpdateCalendarEvent, patchCalendarEvent } from "../lib/google-calendar";
import { getFreshAuthToken, signOutFromGoogle } from "../lib/chrome-identity";
import { clearSelectedCalendar, getSelectedCalendarId } from "../lib/storage";
import { fetchContestById } from "../lib/codeforces";
import { utcRangeFromContest } from "../lib/time";
import {
  isSignOutRequest,
  isSyncContestRequest,
  type SignOutResponse,
  type SyncContestResponse
} from "../lib/messages";

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender,
    sendResponse: (response: SignOutResponse | SyncContestResponse) => void
  ) => {
    if (isSignOutRequest(message)) {
      (async () => {
        try {
          await signOutFromGoogle();
          await clearSelectedCalendar();
          sendResponse({ ok: true });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Sign-out failed.";
          sendResponse({ ok: false, message: msg });
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
