import { createOrUpdateCalendarEvent } from "../lib/google-calendar";
import { getFreshAuthToken, signOutFromGoogle } from "../lib/chrome-identity";
import { clearSelectedCalendar, getSelectedCalendarId } from "../lib/storage";
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
          const token = await getFreshAuthToken();
          const calendarId = await getSelectedCalendarId();
          const action = await createOrUpdateCalendarEvent(message, token, calendarId);
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
