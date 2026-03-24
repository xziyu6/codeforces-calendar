export interface CfContest {
  id: number;
  name: string;
  phase: string;
  durationSeconds: number;
  startTimeSeconds?: number;
  type?: string;
}

interface CfContestListResponse {
  status: string;
  result: CfContest[];
}

export async function fetchContestList(): Promise<CfContest[]> {
  const response = await fetch("https://codeforces.com/api/contest.list");
  if (!response.ok) {
    throw new Error(`Codeforces API failed: ${response.status}`);
  }

  const data = (await response.json()) as CfContestListResponse;
  if (data.status !== "OK" || !Array.isArray(data.result)) {
    throw new Error("Codeforces API returned invalid payload");
  }

  return data.result;
}

export function buildUpcomingContestMap(contests: CfContest[]): Map<string, CfContest> {
  const map = new Map<string, CfContest>();
  for (const contest of contests) {
    if (contest.phase === "BEFORE") {
      map.set(String(contest.id), contest);
    }
  }
  return map;
}
