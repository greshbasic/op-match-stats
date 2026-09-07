import { describe, it, expect } from "vitest";
import { computeFavoredSummary, verdictFor } from "./favored";
import type { LeaderStats, Matchup } from "../types/stats";

function makeMatchup(opponentKey: string, matchupWinRate: number): Matchup {
  return {
    opponent: opponentKey,
    opponentKey,
    wins: 0,
    total_games: 0,
    matchup_win_rate: matchupWinRate,
    first_wins: 0,
    first_games: 0,
    first_win_rate: null,
    second_wins: 0,
    second_games: 0,
    second_win_rate: null,
  };
}

function makeLeader(
  leaderKey: string,
  overrides: Partial<LeaderStats> = {}
): LeaderStats {
  return {
    leader: leaderKey,
    leaderKey,
    variantName: null,
    leaderName: leaderKey,
    wins: 0,
    number_of_matches: 0,
    total_matches: 0,
    raw_win_rate: 0,
    play_rate: 0,
    weighted_win_rate: 0,
    first_win_rate: 0,
    second_win_rate: 0,
    matchups: [],
    ...overrides,
  };
}

describe("verdictFor", () => {
  it("is favored at exactly the 53.5% threshold", () => {
    expect(verdictFor(0.535)).toBe("favored");
  });

  it("is unfavored at exactly the 46.5% threshold", () => {
    expect(verdictFor(0.465)).toBe("unfavored");
  });

  it("is a coinflip between the thresholds", () => {
    expect(verdictFor(0.5)).toBe("even");
    expect(verdictFor(0.51)).toBe("even");
    expect(verdictFor(0.49)).toBe("even");
  });

  it("is favored/unfavored well outside the thresholds", () => {
    expect(verdictFor(0.71)).toBe("favored");
    expect(verdictFor(0.29)).toBe("unfavored");
  });
});

describe("computeFavoredSummary", () => {
  it("buckets rows by verdict and sorts by win rate descending", () => {
    const b = makeLeader("b");
    const c = makeLeader("c");
    const d = makeLeader("d");
    const leader = makeLeader("a", {
      matchups: [makeMatchup("b", 0.7), makeMatchup("c", 0.5), makeMatchup("d", 0.3)],
    });

    const summary = computeFavoredSummary(leader, [leader, b, c, d]);

    expect(summary.rows.map((r) => r.opponentKey)).toEqual(["b", "c", "d"]);
    expect(summary.counts).toEqual({ favored: 1, unfavored: 1, even: 1 });
    expect(summary.missing).toBe(0);
  });

  it("excludes the leader itself from the opponent pool", () => {
    const leader = makeLeader("a", { matchups: [] });
    const summary = computeFavoredSummary(leader, [leader]);

    expect(summary.rows).toEqual([]);
    expect(summary.missing).toBe(0);
  });

  it("counts pool leaders with no recorded matchup as missing instead of dropping them silently", () => {
    const b = makeLeader("b");
    const c = makeLeader("c");
    // A low-play leader that has only faced one of the two pool opponents.
    const leader = makeLeader("a", { matchups: [makeMatchup("b", 0.6)] });

    const summary = computeFavoredSummary(leader, [leader, b, c]);

    expect(summary.rows.map((r) => r.opponentKey)).toEqual(["b"]);
    expect(summary.counts).toEqual({ favored: 1, unfavored: 0, even: 0 });
    expect(summary.missing).toBe(1);
  });

  it("returns an empty summary when the pool has no data for the leader at all", () => {
    const b = makeLeader("b");
    const c = makeLeader("c");
    const leader = makeLeader("a", { matchups: [] });

    const summary = computeFavoredSummary(leader, [leader, b, c]);

    expect(summary.rows).toEqual([]);
    expect(summary.counts).toEqual({ favored: 0, unfavored: 0, even: 0 });
    expect(summary.missing).toBe(2);
  });
});
