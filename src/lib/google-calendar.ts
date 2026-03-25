import type { SyncContestRequest } from "./messages";

interface GoogleEvent {
  id: string;
}

interface GoogleListResponse {
  items?: GoogleEvent[];
}

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
  summary: string;
  description: string;
  start: { dateTime: string };
  end: { dateTime: string };
  extendedProperties: { private: { cfContestId: string } };
  source: { title: string; url: string };
}

function eventBodyFromRequest(request: SyncContestRequest): GoogleEventUpsertBody {
  return {
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

async function findExistingEvent(
  request: SyncContestRequest,
  token: string,
  calendarId: string
): Promise<string | null> {
  const params = new URLSearchParams({
    privateExtendedProperty: `cfContestId=${request.contestId}`,
    singleEvents: "true",
    maxResults: "1",
    timeMin: request.startUtcIso,
    timeMax: request.endUtcIso
  });
  const data = await googleFetch<GoogleListResponse>(
    `${calendarEventsBasePath(calendarId)}?${params.toString()}`,
    token
  );
  return data.items?.[0]?.id ?? null;
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
  const existingEventId = await findExistingEvent(request, token, calendarId);
  const body = JSON.stringify(eventBodyFromRequest(request));

  if (existingEventId) {
    await googleFetch(`${base}/${encodeURIComponent(existingEventId)}`, token, {
      method: "PATCH",
      body
    });
    return "updated";
  }

  await googleFetch(base, token, {
    method: "POST",
    body
  });
  return "created";
}
