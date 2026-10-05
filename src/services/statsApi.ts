import type { LeaderStats, Matchup, Stats } from "../types/stats";

// The stats set prefix (e.g. "op17") only changes when a new set is released,
// so it stays a constant. The date part is dynamic: the CDN publishes a new
// daily snapshot and keeps a rolling window (~8 days), so we resolve the most
// recent available date at load time instead of hardcoding it.
const SET = "op17";
const MAX_DAYS_BACK = 14;

// In dev we hit the same-origin Vite proxy (see vite.config.ts) which forwards
// to the CDN server-side, avoiding the CDN's missing CORS headers.
export const statsUrl = (yyyymmdd: string) =>
  `/api/stats/stats_${SET}_lw_p_${yyyymmdd}.json?v=${yyyymmdd}`;

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// Candidate dates: today, then each previous day, newest first.
export function candidateDates(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i <= MAX_DAYS_BACK; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(formatDate(d));
  }
  return out;
}

export interface StatsResult {
  stats: Stats;
  date: string; // the YYYYMMDD snapshot that was actually loaded
}

export class StatsError extends Error {}

function isMatchup(x: unknown): x is Matchup {
  if (typeof x !== "object" || x === null) return false;
  const m = x as Record<string, unknown>;
  const rate = (v: unknown) => typeof v === "number" || v === null;
  return (
    typeof m.opponent === "string" &&
    rate(m.first_win_rate) &&
    rate(m.second_win_rate)
  );
}

// leaderName is occasionally null upstream (e.g. unnamed promo leaders like
// P-999) — accept it here and fall back to the leaderKey when normalizing.
function isLeaderStats(x: unknown): x is Omit<LeaderStats, "leaderName"> & { leaderName: string | null } {
  if (typeof x !== "object" || x === null) return false;
  const l = x as Record<string, unknown>;
  return (
    typeof l.leaderKey === "string" &&
    (typeof l.leaderName === "string" || l.leaderName === null) &&
    Array.isArray(l.matchups) &&
    l.matchups.every(isMatchup)
  );
}

function isStats(x: unknown): x is (Omit<LeaderStats, "leaderName"> & { leaderName: string | null })[] {
  return Array.isArray(x) && x.every(isLeaderStats);
}

function normalizeStats(raw: (Omit<LeaderStats, "leaderName"> & { leaderName: string | null })[]): Stats {
  return raw.map((l) => ({ ...l, leaderName: l.leaderName ?? l.leaderKey }));
}

export async function fetchStats(): Promise<StatsResult> {
  let sawServerError = false;

  // Walk back from today until a snapshot exists. A 404 just means that day's
  // file isn't published (yet) or has aged out, so we try the previous day.
  for (const date of candidateDates()) {
    let response: Response;
    try {
      response = await fetch(statsUrl(date));
    } catch {
      throw new StatsError("Network error while reaching the stats service.");
    }

    if (response.status === 404) continue;

    if (!response.ok) {
      sawServerError = true;
      continue;
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new StatsError("Stats service returned invalid JSON.");
    }

    if (!isStats(data)) {
      throw new StatsError("Stats data did not match the expected format.");
    }

    return { stats: normalizeStats(data), date };
  }

  throw new StatsError(
    sawServerError
      ? "Stats service is currently unavailable."
      : "No recent stats snapshot was found."
  );
}
