import type { SyncContestRequest } from "./messages";



interface GoogleCalendarListItem {
  id: string;
  summary?: string;
  summaryOverride?: string;
  primary?: boolean;
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarListItem[];
}

export interface CalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
}

interface GoogleEventUpsertBody {
  status: "confirmed";
  summary: string;
  description: string;
  start: { dateTime: string };
  end: { dateTime: string };
  extendedProperties: { private: { cfContestId: string } };
  source: { title: string; url: string };
}

function eventBodyFromRequest(request: SyncContestRequest): GoogleEventUpsertBody {
  return {
    status: "confirmed",
    summary: request.title,
    description: `${request.sourceUrl}\n\nSynced from Codeforces contest ${request.contestId}.`,
    start: { dateTime: request.startUtcIso },
    end: { dateTime: request.endUtcIso },
    extendedProperties: {
      private: {
        cfContestId: request.contestId
      }
    },
    source: {
      title: "Codeforces",
      url: request.sourceUrl
    }
  };
}

async function googleFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google API failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

function calendarEventsBasePath(calendarId: string): string {
  return `/calendars/${encodeURIComponent(calendarId)}/events`;
}

function contestEventId(contestId: string): string {
  return `cfcontest${contestId}@codeforces-calendar`;
}

export async function fetchCalendarList(token: string): Promise<CalendarListEntry[]> {
  const params = new URLSearchParams({ minAccessRole: "writer" });
  const data = await googleFetch<GoogleCalendarListResponse>(`/users/me/calendarList?${params.toString()}`, token);
  const items = data.items ?? [];
  const mapped: CalendarListEntry[] = items.map((item) => ({
    id: item.id,
    summary: item.summaryOverride?.trim() || item.summary?.trim() || item.id,
    primary: item.primary
  }));
  mapped.sort((a, b) => {
    if (a.primary && !b.primary) return -1;
    if (!a.primary && b.primary) return 1;
    return a.summary.localeCompare(b.summary, undefined, { sensitivity: "base" });
  });
  return mapped;
}

export async function createOrUpdateCalendarEvent(
  request: SyncContestRequest,
  token: string,
  calendarId: string
): Promise<"created" | "updated"> {
  const base = calendarEventsBasePath(calendarId);
  const eventId = contestEventId(request.contestId);
  const body = JSON.stringify({ ...eventBodyFromRequest(request), id: eventId });

  // POST-first: create with deterministic id; if already exists, fall back to PATCH.
  const postResponse = await fetch(`https://www.googleapis.com/calendar/v3${base}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body
  });

  if (postResponse.ok) return "created";

  if (postResponse.status === 409) {
    await patchCalendarEvent(request, token, calendarId);
    return "updated";
  }

  const text = await postResponse.text();
  throw new Error(`Google API failed (${postResponse.status}): ${text}`);
}

export async function patchCalendarEvent(
  request: SyncContestRequest,
  token: string,
  calendarId: string
): Promise<void> {
  const base = calendarEventsBasePath(calendarId);
  const eventId = contestEventId(request.contestId);
  await googleFetch(`${base}/${encodeURIComponent(eventId)}`, token, {
    method: "PATCH",
    body: JSON.stringify(eventBodyFromRequest(request))
  });
}
