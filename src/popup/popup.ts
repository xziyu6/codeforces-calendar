import { fetchCalendarList, type CalendarListEntry } from "../lib/google-calendar";
import { getAuthTokenInteractive, removeCachedAuthToken } from "../lib/chrome-identity";
import { getSelectedCalendarId, getStoredCalendarSummary, setSelectedCalendar } from "../lib/storage";

const statusEl = document.getElementById("status") as HTMLParagraphElement;
const authSection = document.getElementById("auth-section") as HTMLDivElement;
const calendarSection = document.getElementById("calendar-section") as HTMLDivElement;
const calendarSelect = document.getElementById("calendar-select") as HTMLSelectElement;
const btnSignIn = document.getElementById("btn-sign-in") as HTMLButtonElement;
const btnSave = document.getElementById("btn-save") as HTMLButtonElement;
const btnSwitchAccount = document.getElementById("btn-switch-account") as HTMLButtonElement;

function setStatus(text: string): void {
  statusEl.textContent = text;
}

function showAuthOnly(): void {
  authSection.hidden = false;
  calendarSection.hidden = true;
}

function showCalendarUi(): void {
  authSection.hidden = true;
  calendarSection.hidden = false;
}

async function trySilentToken(): Promise<string | null> {
  try {
    return await getAuthTokenInteractive(false);
  } catch {
    return null;
  }
}

function fillSelect(entries: CalendarListEntry[]): void {
  calendarSelect.replaceChildren();
  for (const entry of entries) {
    const opt = document.createElement("option");
    opt.value = entry.id;
    opt.textContent = entry.primary ? `${entry.summary} (primary)` : entry.summary;
    calendarSelect.appendChild(opt);
  }
}

async function loadCalendarsAndUi(token: string): Promise<void> {
  setStatus("Loading calendars…");
  const list = await fetchCalendarList(token);
  if (list.length === 0) {
    setStatus("No writable calendars found.");
    showCalendarUi();
    calendarSelect.replaceChildren();
    return;
  }
  fillSelect(list);
  const storedId = await getSelectedCalendarId();
  const match = list.find((c) => c.id === storedId);
  const firstEntry = list[0];
  if (!firstEntry) {
    return;
  }
  calendarSelect.value = match ? storedId : firstEntry.id;
  const summary = await getStoredCalendarSummary();
  setStatus(summary ? `Saved: ${summary}` : "Choose a calendar and click Save.");
  showCalendarUi();
}

async function onSignIn(): Promise<void> {
  try {
    setStatus("Signing in…");
    const token = await getAuthTokenInteractive(true);
    await loadCalendarsAndUi(token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sign-in failed.";
    setStatus(msg);
    showAuthOnly();
  }
}

async function onSave(): Promise<void> {
  const id = calendarSelect.value;
  const opt = calendarSelect.selectedOptions[0];
  const summary = opt?.textContent?.replace(/\s*\(primary\)\s*$/, "").trim() ?? id;
  try {
    await setSelectedCalendar(id, summary);
    setStatus(`Saved: ${summary}`);
  } catch {
    setStatus("Could not save settings.");
  }
}

async function onSwitchAccount(): Promise<void> {
  try {
    setStatus("Switching account…");
    const token = await trySilentToken();
    if (token) {
      await removeCachedAuthToken(token);
    }
    const fresh = await getAuthTokenInteractive(true);
    await loadCalendarsAndUi(fresh);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not switch account.";
    setStatus(msg);
    showAuthOnly();
  }
}

async function init(): Promise<void> {
  btnSignIn.addEventListener("click", () => void onSignIn());
  btnSave.addEventListener("click", () => void onSave());
  btnSwitchAccount.addEventListener("click", () => void onSwitchAccount());

  const summary = await getStoredCalendarSummary();
  if (summary) {
    setStatus(`Saved: ${summary}`);
  } else {
    setStatus("");
  }

  const token = await trySilentToken();
  if (!token) {
    setStatus("Sign in to choose a calendar.");
    showAuthOnly();
    return;
  }
  try {
    await loadCalendarsAndUi(token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load calendars.";
    setStatus(msg);
    showAuthOnly();
  }
}

void init();
