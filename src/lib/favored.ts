import type { LeaderStats } from "../types/stats";

export const FAVORED_THRESHOLD = 0.525;
export const UNFAVORED_THRESHOLD = 0.475;

export type Verdict = "favored" | "unfavored" | "even";

// >=52.5% is favored, <=47.5% is unfavored (the opponent is favored), and
// anything in between is treated as a coinflip rather than favored either
// way, per the whole point of this view: skip results too close to 50/50.
export function verdictFor(winRate: number): Verdict {
  if (winRate >= FAVORED_THRESHOLD) return "favored";
  if (winRate <= UNFAVORED_THRESHOLD) return "unfavored";
  return "even";
}

export interface FavoredRow {
  opponentKey: string;
  opponentName: string;
  winRate: number;
  verdict: Verdict;
  firstWinRate: number | null;
  secondWinRate: number | null;
}

export interface FavoredSummary {
  rows: FavoredRow[];
  counts: Record<Verdict, number>;
  // Leaders in the comparison pool with no matchup data against this leader
  // (e.g. a low-play leader that hasn't faced everyone in the top N yet).
  missing: number;
}

// Computes favored/unfavored/coinflip rows for `leader` against every other
// leader in `pool` (typically the top N by weighted win rate). Leaders in the
// pool with no recorded matchup against `leader` are excluded from `rows`
// and counted in `missing` instead of being silently dropped.
export function computeFavoredSummary(
  leader: LeaderStats,
  pool: LeaderStats[]
): FavoredSummary {
  const opponents = pool.filter((o) => o.leaderKey !== leader.leaderKey);

  const rows: FavoredRow[] = [];
  let missing = 0;

  for (const opp of opponents) {
    const matchup = leader.matchups.find((m) => m.opponentKey === opp.leaderKey);
    if (!matchup) {
      missing++;
      continue;
    }
    rows.push({
      opponentKey: opp.leaderKey,
      opponentName: opp.leaderName,
      winRate: matchup.matchup_win_rate,
      verdict: verdictFor(matchup.matchup_win_rate),
      firstWinRate: matchup.first_win_rate,
      secondWinRate: matchup.second_win_rate,
    });
  }

  rows.sort((a, b) => b.winRate - a.winRate);

  const counts: Record<Verdict, number> = { favored: 0, unfavored: 0, even: 0 };
  rows.forEach((r) => counts[r.verdict]++);

  return { rows, counts, missing };
}
