export interface CfContest {
  id: number;
  name: string;
  phase: string;
  durationSeconds: number;
  startTimeSeconds: number;
  type?: string;
}

interface CfContestListResponse {
  status: string;
  result: CfContest[];
}

export async function fetchContestList(): Promise<CfContest[]> {
  const response = await fetch("https://codeforces.com/api/contest.list?gym=false");
  if (!response.ok) {
    throw new Error(`Codeforces API failed: ${response.status}`);
  }

  const data = (await response.json()) as CfContestListResponse;
  if (data.status !== "OK" || !Array.isArray(data.result)) {
    throw new Error("Codeforces API returned invalid payload");
  }

  return data.result;
}

export async function fetchContestById(contestId: string): Promise<CfContest | null> {
  const contests = await fetchContestList();
  return contests.find((contest) => String(contest.id) === contestId) ?? null;
}
