import { createOrUpdateCalendarEvent } from "../lib/google-calendar";
import { getFreshAuthToken } from "../lib/chrome-identity";
import { getSelectedCalendarId } from "../lib/storage";
import { isSyncContestRequest, type SyncContestResponse } from "../lib/messages";

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: SyncContestResponse) => void) => {
  if (!isSyncContestRequest(message)) {
    sendResponse({ ok: false, code: "BAD_REQUEST", message: "Invalid sync request payload." });
    return false;
  }

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
});
