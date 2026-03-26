import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

function parseUtcOffsetMinutes(input: string): number | null {
  // Codeforces fixed time appears like: "UTC-7" in a <sup> element.
  // We parse it as a numeric offset in minutes.
  const match = input.match(/UTC\s*([+-])\s*(\d{1,2})/i);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  if (Number.isNaN(hours)) return null;
  return sign * hours * 60;
}

export function utcIsoFromUnixSeconds(seconds: number): string {
  return dayjs.unix(seconds).utc().toISOString();
}

export function utcRangeFromContest(startTimeSeconds: number, durationSeconds: number): {
  startUtcIso: string;
  endUtcIso: string;
} {
  const startUtcIso = utcIsoFromUnixSeconds(startTimeSeconds);
  const endUtcIso = utcIsoFromUnixSeconds(startTimeSeconds + durationSeconds);
  return { startUtcIso, endUtcIso };
}

function parseDurationToSeconds(durationText: string): number | null {
  const match = durationText.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 3600 + minutes * 60;
}

export function utcRangeFromDom(startText: string, durationText: string): {
  startUtcIso: string;
  endUtcIso: string;
} | null {
  const offsetMinutes = parseUtcOffsetMinutes(startText);
  const startWithoutOffset = startText.replace(/UTC\s*([+-])\s*(\d{1,2})/i, "").trim();

  const parsed = dayjs(startWithoutOffset, ["MMM/DD/YYYY HH:mm", "MMM/D/YYYY HH:mm", "DD.MM.YYYY HH:mm"], true);
  if (!parsed.isValid()) return null;
  const durationSeconds = parseDurationToSeconds(durationText);
  if (durationSeconds === null) return null;

  // Interpret the DOM's date/time as being in the offset shown by the <sup>.
  if (offsetMinutes === null) {
    const startUtc = parsed.utc();
    const endUtc = startUtc.add(durationSeconds, "second");
    return { startUtcIso: startUtc.toISOString(), endUtcIso: endUtc.toISOString() };
  }

  const startUtc = parsed.utcOffset(offsetMinutes, true).utc();
  const endUtc = startUtc.add(durationSeconds, "second");
  return { startUtcIso: startUtc.toISOString(), endUtcIso: endUtc.toISOString() };
}

export function utcRangeFromTimeanddateHref(href: string, durationText: string): {
  startUtcIso: string;
  endUtcIso: string;
} | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  if (!url.hostname.includes("timeanddate.com")) return null;

  // Example query:
  // fixedtime.html?day=28&month=3&year=2026&hour=17&min=35&sec=0&p1=166
  const day = Number(url.searchParams.get("day"));
  const month = Number(url.searchParams.get("month"));
  const year = Number(url.searchParams.get("year"));
  const hour = Number(url.searchParams.get("hour"));
  const minute = Number(url.searchParams.get("min"));
  const second = Number(url.searchParams.get("sec") ?? "0");

  if ([day, month, year, hour, minute, second].some((n) => Number.isNaN(n))) return null;

  const durationSeconds = parseDurationToSeconds(durationText);
  if (durationSeconds === null) return null;

  // Based on your observation, this link's timezone is consistently Moscow.
  const startUtc = dayjs.tz(
    `${year}-${month}-${day} ${hour}:${minute}:${second}`,
    "YYYY-M-D H:m:s",
    "Europe/Moscow"
  ).utc();

  const endUtc = startUtc.add(durationSeconds, "second");
  return { startUtcIso: startUtc.toISOString(), endUtcIso: endUtc.toISOString() };
}
