import { fetchCalendarList, type CalendarListEntry } from "../lib/google-calendar";
import { getAuthTokenInteractive, getAuthTokenWithAccountPicker } from "../lib/chrome-identity";
import type { SignOutResponse } from "../lib/messages";
import {
  clearTrackedContests,
  getSelectedCalendarId,
  getStoredCalendarId,
  getStoredCalendarSummary,
  setSelectedCalendar
} from "../lib/storage";

const statusEl = document.getElementById("status") as HTMLParagraphElement;
const authSection = document.getElementById("auth-section") as HTMLDivElement;
const calendarSection = document.getElementById("calendar-section") as HTMLDivElement;
const calendarSelect = document.getElementById("calendar-select") as HTMLSelectElement;
const btnSignIn = document.getElementById("btn-sign-in") as HTMLButtonElement;
const btnSignOut = document.getElementById("btn-sign-out") as HTMLButtonElement;

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
  setStatus(summary ? `Saved: ${summary}` : "Choose a calendar.");
  showCalendarUi();
}

async function onSignIn(): Promise<void> {
  try {
    setStatus("Signing in…");
    const token = await getAuthTokenWithAccountPicker();
    await loadCalendarsAndUi(token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sign-in failed.";
    setStatus(msg);
    showAuthOnly();
  }
}

async function onSignOut(): Promise<void> {
  try {
    setStatus("Signing out…");
    const res = (await chrome.runtime.sendMessage({ type: "CF_SIGN_OUT" })) as SignOutResponse;
    if (res?.ok === true) {
      setStatus("Signed out. Sign in to choose a calendar.");
      showAuthOnly();
      return;
    }
    setStatus(res?.ok === false ? res.message : "Sign-out failed.");
  } catch (e) {
    setStatus(e instanceof Error ? e.message : "Sign-out failed.");
  }
}

async function persistCalendarSelection(): Promise<void> {
  const id = calendarSelect.value;
  const opt = calendarSelect.selectedOptions[0];
  const summary = opt?.textContent?.replace(/\s*\(primary\)\s*$/, "").trim() ?? id;
  try {
    const previousId = await getStoredCalendarId();
    if (previousId !== undefined && previousId !== id) {
      await clearTrackedContests();
    }
    await setSelectedCalendar(id, summary);
    setStatus(`Saved: ${summary}`);
  } catch {
    setStatus("Could not save calendar choice.");
  }
}

async function init(): Promise<void> {
  btnSignIn.addEventListener("click", () => void onSignIn());
  btnSignOut.addEventListener("click", () => void onSignOut());
  calendarSelect.addEventListener("change", () => void persistCalendarSelection());

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
