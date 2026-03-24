import { createOrUpdateCalendarEvent } from "../lib/google-calendar";
import { isSyncContestRequest, type SyncContestResponse } from "../lib/messages";

async function getTokenInteractive(interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (result) => {
      const token = typeof result === "string" ? result : result?.token;
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message ?? "Failed to get auth token"));
        return;
      }
      resolve(token);
    });
  });
}

async function getFreshToken(): Promise<string> {
  try {
    return await getTokenInteractive(true);
  } catch {
    // If cached auth state is stale, clear token once and force a fresh interactive flow.
    const cachedToken = await getTokenInteractive(false).catch(() => null);
    if (cachedToken) {
      await new Promise<void>((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: cachedToken }, () => resolve());
      });
    }
    return getTokenInteractive(true);
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: SyncContestResponse) => void) => {
  if (!isSyncContestRequest(message)) {
    sendResponse({ ok: false, code: "BAD_REQUEST", message: "Invalid sync request payload." });
    return false;
  }

  (async () => {
    try {
      const token = await getFreshToken();
      const action = await createOrUpdateCalendarEvent(message, token);
      sendResponse({ ok: true, action });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown background error";
      const code = msg.includes("auth") || msg.includes("token") ? "AUTH" : "API";
      sendResponse({ ok: false, code, message: msg });
    }
  })();

  return true;
});
