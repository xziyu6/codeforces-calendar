export const STORAGE_KEYS = {
  selectedCalendarId: "selectedCalendarId",
  selectedCalendarName: "selectedCalendarSummary",
  trackedContestIds: "trackedContestIds"
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

export async function getTrackedContests(): Promise<string[]> {
  const data = await chrome.storage.sync.get(STORAGE_KEYS.trackedContestIds);
  const raw = data[STORAGE_KEYS.trackedContestIds];
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function setTrackedContests(ids: string[]): Promise<void> {
  const normalized = [...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))];
  await chrome.storage.sync.set({ [STORAGE_KEYS.trackedContestIds]: normalized });
}

export async function addTrackedContest(id: string): Promise<void> {
  const current = await getTrackedContests();
  if (current.includes(id)) return;
  await setTrackedContests([...current, id]);
}

export async function removeTrackedContest(id: string): Promise<void> {
  const current = await getTrackedContests();
  await setTrackedContests(current.filter((existing) => existing !== id));
}

export async function clearTrackedContests(): Promise<void> {
  await chrome.storage.sync.remove([STORAGE_KEYS.trackedContestIds]);
}
