export const STORAGE_KEYS = {
  selectedCalendarId: "selectedCalendarId",
  selectedCalendarSummary: "selectedCalendarSummary"
} as const;

const DEFAULT_CALENDAR_ID = "primary";

export async function getSelectedCalendarId(): Promise<string> {
  const data = await chrome.storage.sync.get(STORAGE_KEYS.selectedCalendarId);
  const id = data[STORAGE_KEYS.selectedCalendarId];
  return typeof id === "string" && id.length > 0 ? id : DEFAULT_CALENDAR_ID;
}

export async function setSelectedCalendar(id: string, summary: string): Promise<void> {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.selectedCalendarId]: id,
    [STORAGE_KEYS.selectedCalendarSummary]: summary
  });
}

export async function getStoredCalendarSummary(): Promise<string | undefined> {
  const data = await chrome.storage.sync.get(STORAGE_KEYS.selectedCalendarSummary);
  const s = data[STORAGE_KEYS.selectedCalendarSummary];
  return typeof s === "string" && s.length > 0 ? s : undefined;
}
