export const STORAGE_KEYS = {
  selectedCalendarId: "selectedCalendarId",
  selectedCalendarName: "selectedCalendarSummary"
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
    [STORAGE_KEYS.selectedCalendarName]: summary
  });
}

export async function getStoredCalendarSummary(): Promise<string | undefined> {
  const data = await chrome.storage.sync.get(STORAGE_KEYS.selectedCalendarName);
  const s = data[STORAGE_KEYS.selectedCalendarName];
  return typeof s === "string" && s.length > 0 ? s : undefined;
}

export async function clearSelectedCalendar(): Promise<void> {
  await chrome.storage.sync.remove([
    STORAGE_KEYS.selectedCalendarId,
    STORAGE_KEYS.selectedCalendarName
  ]);
}
