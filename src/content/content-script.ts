import {
  isSyncContestFallbackRequest,
  isSyncContestRequest,
  type RowSyncState,
  type SyncContestFallbackRequest,
  type SyncContestRequest,
  type SyncContestResponse
} from "../lib/messages";
import { utcRangeFromDom, utcRangeFromTimeanddateHref } from "../lib/time";

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

async function sendSyncRequest(request: SyncContestRequest | SyncContestFallbackRequest): Promise<SyncContestResponse> {
  if (!isSyncContestRequest(request) && !isSyncContestFallbackRequest(request)) {
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
      setRowStatus(row, "syncing", "syncing");

      let title: string;
      let range: ReturnType<typeof utcRangeFromDom> | null;

      title = row.querySelector("td.left")?.textContent?.trim() ?? "Codeforces Contest";

      const startCell = row.querySelector("td:nth-child(3)");
      const durationText = row.querySelector("td:nth-child(4)")?.textContent ?? "";
      const timeAnchor = startCell?.querySelector<HTMLAnchorElement>("a[href*='timeanddate.com']");
      const href = timeAnchor?.href ?? "";
      const startText = startCell?.textContent ?? "";

      range = utcRangeFromTimeanddateHref(href, durationText) ?? utcRangeFromDom(startText, durationText);

      if (!range) {
        const fallbackRequest: SyncContestFallbackRequest = {
          type: "CF_SYNC_CONTEST_FALLBACK",
          contestId,
          title,
          sourceUrl: `https://codeforces.com/contest/${contestId}`
        };

        const response = await sendSyncRequest(fallbackRequest);
        if (response.ok) {
          if (response.warning) {
            setRowStatus(row, "error", `${response.action} (fallback)`);
          } else {
            setRowStatus(row, "synced", response.action);
          }
        } else {
          setRowStatus(row, "error", response.message);
        }
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
      const response = await sendSyncRequest(request);
      if (response.ok) {
        if (response.warning) {
          setRowStatus(row, "error", `${response.action} (fallback)`);
        } else {
          setRowStatus(row, "synced", response.action);
        }
      } else {
        setRowStatus(row, "error", response.message);
      }
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
