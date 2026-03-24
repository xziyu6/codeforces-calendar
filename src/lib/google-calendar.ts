import type { SyncContestRequest } from "./messages";

interface GoogleEvent {
  id: string;
}

interface GoogleListResponse {
  items?: GoogleEvent[];
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

async function findExistingEvent(request: SyncContestRequest, token: string): Promise<string | null> {
  const params = new URLSearchParams({
    privateExtendedProperty: `cfContestId=${request.contestId}`,
    singleEvents: "true",
    maxResults: "1",
    timeMin: request.startUtcIso,
    timeMax: request.endUtcIso
  });
  const data = await googleFetch<GoogleListResponse>(`/calendars/primary/events?${params.toString()}`, token);
  return data.items?.[0]?.id ?? null;
}

export async function createOrUpdateCalendarEvent(
  request: SyncContestRequest,
  token: string
): Promise<"created" | "updated"> {
  // Idempotency key: if an event already carries this contest ID, update it instead of creating a duplicate.
  const existingEventId = await findExistingEvent(request, token);
  const body = JSON.stringify(eventBodyFromRequest(request));

  if (existingEventId) {
    await googleFetch(`/calendars/primary/events/${encodeURIComponent(existingEventId)}`, token, {
      method: "PATCH",
      body
    });
    return "updated";
  }

  await googleFetch("/calendars/primary/events", token, {
    method: "POST",
    body
  });
  return "created";
}
