import {
  isGetTrackedContestsRequest,
  isTrackContestRequest,
  type GetTrackedContestsRequest,
  type GetTrackedContestsResponse,
  type RowSyncState,
  type SyncContestResponse,
  type TrackContestRequest
} from "../lib/messages";
import { utcRangeFromDom, utcRangeFromTimeanddateHref } from "../lib/time";

const STATUS_ATTR = "data-cf-sync-status";
const trackedContestIds = new Set<string>();


function setRowStatus(row: HTMLTableRowElement, status: RowSyncState, message = ""): void {
  row.setAttribute(STATUS_ATTR, status);
  const statusEl = row.querySelector<HTMLElement>(".cf-sync-status");
  if (statusEl) {
    statusEl.textContent = message || status;
  }
}

function findUpcomingTable(): HTMLTableElement | null {
  const blocks = document.querySelectorAll<HTMLElement>(".contestList .datatable");
  for (const block of blocks) {
    const heading = block.querySelector(":scope > div[style*='font-size:1.4rem']");
    const headingText = heading?.textContent?.trim() ?? "";
    if (headingText.includes("Current or upcoming contests")) {
      return block.querySelector("table") as HTMLTableElement | null;
    }
  }
  return null;
}

function ensureActionCell(row: HTMLTableRowElement): HTMLTableCellElement {
  const existing = row.querySelector("td.right:last-child");
  if (existing instanceof HTMLTableCellElement) return existing;
  const cell = document.createElement("td");
  cell.className = "right";
  row.appendChild(cell);
  return cell;
}

async function sendMessage<T>(request: unknown): Promise<{ response?: T; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(request, (response: T) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message ?? "Message channel failed." });
        return;
      }
      resolve({ response });
    });
  });
}

async function sendTrackRequest(request: TrackContestRequest): Promise<SyncContestResponse> {
  if (!isTrackContestRequest(request)) {
    return { ok: false, code: "BAD_REQUEST", message: "Client-side request validation failed." };
  }

  const { response, error } = await sendMessage<SyncContestResponse>(request);
  if (error) return { ok: false, code: "NETWORK", message: error };
  return response ?? { ok: false, code: "UNKNOWN", message: "No response received." };
}

async function loadTrackedContests(): Promise<void> {
  const request: GetTrackedContestsRequest = { type: "CF_GET_TRACKED_CONTESTS" };
  if (!isGetTrackedContestsRequest(request)) return;
  const { response } = await sendMessage<GetTrackedContestsResponse>(request);
  if (response?.ok) {
    trackedContestIds.clear();
    for (const id of response.contestIds) trackedContestIds.add(id);
  }
}

function buildSyncButton(onClick: () => Promise<void>): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cf-sync-button";
  button.textContent = "Sync";
  button.addEventListener("click", () => {
    void onClick();
  });
  return button;
}

function buildStatusElement(): HTMLSpanElement {
  const status = document.createElement("span");
  status.className = "cf-sync-status";
  status.textContent = "idle";
  return status;
}

function renderTrackedState(row: HTMLTableRowElement, button: HTMLButtonElement): void {
  setRowStatus(row, "synced", "added");
  button.textContent = "Sync";
}

function renderUntrackedState(row: HTMLTableRowElement, button: HTMLButtonElement): void {
  setRowStatus(row, "idle", "idle");
  button.textContent = "Sync";
}

async function injectButtons(): Promise<void> {
  const table = findUpcomingTable();
  if (!table) {
    return;
  }

  // Single-pass startup injection.
  const rows = table.querySelectorAll<HTMLTableRowElement>("tr[data-contestid]");
  for (const row of rows) {
    const contestId = row.getAttribute("data-contestid");
    if (!contestId) continue;

    const actionCell = ensureActionCell(row);
    const statusEl = buildStatusElement();
    actionCell.appendChild(statusEl);
  
    const button = buildSyncButton(async () => {
      const trackedBeforeClick = trackedContestIds.has(contestId);
      setRowStatus(row, "syncing", "syncing");

      let title: string;
      let range: ReturnType<typeof utcRangeFromDom> | null;

      title = row.querySelector("td.left")?.textContent?.trim() ?? "Codeforces Contest";

      const startCell = row.querySelector("td:nth-child(3)");
      const durationText = row.querySelector("td:nth-child(4)")?.textContent ?? "";
      const timeAnchor = startCell?.querySelector<HTMLAnchorElement>("a[href*='timeanddate.com']");
      const href = timeAnchor?.href ?? "";
      const startText = startCell?.textContent ?? "";
      const sourceUrl = `https://codeforces.com/contest/${contestId}`;

      range = utcRangeFromTimeanddateHref(href, durationText) ?? utcRangeFromDom(startText, durationText);
      const request: TrackContestRequest = {
        type: "CF_TRACK_CONTEST",
        contestId,
        title,
        sourceUrl,
        ...(range ? { startUtcIso: range.startUtcIso, endUtcIso: range.endUtcIso } : {})
      };
      const response = await sendTrackRequest(request);
      if (response.ok) {
        trackedContestIds.add(contestId);
        if (!range) {
          setRowStatus(row, "error", `${response.action} (fallback)`);
          button.textContent = "Sync";
        } else if (response.warning) {
          setRowStatus(row, "error", `${response.action} (fallback)`);
          button.textContent = "Sync";
        } else {
          renderTrackedState(row, button);
        }
      } else {
        setRowStatus(row, "error", response.message);
        button.textContent = "Sync";
      }
    });
    actionCell.appendChild(button);

    if (trackedContestIds.has(contestId)) {
      renderTrackedState(row, button);
    } else {
      renderUntrackedState(row, button);
    }
  }
}

void (async () => {
  await loadTrackedContests();
  await injectButtons();
})();
