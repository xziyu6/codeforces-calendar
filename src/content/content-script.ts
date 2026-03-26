import { buildUpcomingContestMap, fetchContestList, type CfContest } from "../lib/codeforces";
import { isSyncContestRequest, type RowSyncState, type SyncContestRequest, type SyncContestResponse } from "../lib/messages";
import { utcRangeFromContest, utcRangeFromDom } from "../lib/time";

const INJECTED_ATTR = "data-cf-sync-injected";
const STATUS_ATTR = "data-cf-sync-status";


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

async function sendSyncRequest(request: SyncContestRequest): Promise<SyncContestResponse> {
  if (!isSyncContestRequest(request)) {
    return { ok: false, code: "BAD_REQUEST", message: "Client-side request validation failed." };
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(request, (response: SyncContestResponse) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, code: "NETWORK", message: chrome.runtime.lastError.message ?? "Message channel failed." });
        return;
      }
      resolve(response);
    });
  });
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

async function injectButtons(): Promise<void> {
  const table = findUpcomingTable();
  if (!table) {
    return;
  }

  // Inject once per row; observer re-runs this when Codeforces redraws the table.
  const rows = table.querySelectorAll<HTMLTableRowElement>("tr[data-contestid]");
  for (const row of rows) {
    if (row.getAttribute(INJECTED_ATTR) === "1") continue;
    row.setAttribute(INJECTED_ATTR, "1");

    const contestId = row.getAttribute("data-contestid");
    if (!contestId) continue;

    const actionCell = ensureActionCell(row);
    const statusEl = buildStatusElement();
    actionCell.appendChild(statusEl);
  
    const button = buildSyncButton(async () => {
      performance.mark("syncButtonClickStart");
      setRowStatus(row, "syncing", "syncing");

      let title: string;
      let range: ReturnType<typeof utcRangeFromContest> | null;

      try {
        performance.mark("fetchContestListStart");
        const contest = buildUpcomingContestMap(await fetchContestList()).get(contestId);
        performance.mark("fetchContestListEnd");
        performance.measure("fetchContestList", "fetchContestListStart", "fetchContestListEnd");
        console.log("fetchContestList", performance.getEntriesByType("measure").find((entry) => entry.name === "fetchContestList")?.duration);
        if (!contest) throw new Error("contest missing from API response");
        title = contest.name;
        range = utcRangeFromContest(contest.startTimeSeconds, contest.durationSeconds);
      } catch {
        title = row.querySelector("td.left")?.textContent?.trim() ?? "Codeforces Contest";
        const startText = row.querySelector("td:nth-child(3)")?.textContent ?? "";
        const durationText = row.querySelector("td:nth-child(4)")?.textContent ?? "";
        range = utcRangeFromDom(startText, durationText);
      }

      if (!range) {
        setRowStatus(row, "error", "time parse failed");
        return;
      }

      const request: SyncContestRequest = {
        type: "CF_SYNC_CONTEST",
        contestId,
        title,
        startUtcIso: range.startUtcIso,
        endUtcIso: range.endUtcIso,
        sourceUrl: `https://codeforces.com/contest/${contestId}`
      };
      performance.mark("sendSyncRequestStart");
      const response = await sendSyncRequest(request);
      performance.mark("sendSyncRequestEnd");
      performance.measure("sendSyncRequest", "sendSyncRequestStart", "sendSyncRequestEnd");
      console.log("sendSyncRequest", performance.getEntriesByType("measure").find((entry) => entry.name === "sendSyncRequest")?.duration);
      if (response.ok) {
        setRowStatus(row, "synced", response.action);
      } else {
        setRowStatus(row, "error", response.message);
      }
      performance.mark("syncButtonClickEnd");
      performance.measure("syncButtonClick", "syncButtonClickStart", "syncButtonClickEnd");
      console.log("syncButtonClick", performance.getEntriesByType("measure").find((entry) => entry.name === "syncButtonClick")?.duration);
    });

    actionCell.appendChild(button);
    setRowStatus(row, "idle", "idle");
  }
}

void injectButtons();

const observer = new MutationObserver(() => {
  void injectButtons();
});
observer.observe(document.body, { childList: true, subtree: true });
