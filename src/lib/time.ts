import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

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
  const parsed = dayjs(startText.trim(), ["MMM/DD/YYYY HH:mm", "MMM/D/YYYY HH:mm"], true);
  if (!parsed.isValid()) return null;
  const durationSeconds = parseDurationToSeconds(durationText);
  if (durationSeconds === null) return null;
  const startUtcIso = parsed.utc().toISOString();
  const endUtcIso = parsed.add(durationSeconds, "second").utc().toISOString();
  return { startUtcIso, endUtcIso };
}
