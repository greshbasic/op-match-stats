import { describe, it, expect } from "vitest";
import { computeFavoredSummary, verdictFor } from "./favored";
import type { LeaderStats, Matchup } from "../types/stats";

function makeMatchup(
  opponentKey: string,
  matchupWinRate: number,
  overrides: Partial<Matchup> = {}
): Matchup {
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
    ...overrides,
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
  it("is favored at exactly the 52.5% threshold", () => {
    expect(verdictFor(0.525)).toBe("favored");
  });

  it("is unfavored at exactly the 47.5% threshold", () => {
    expect(verdictFor(0.475)).toBe("unfavored");
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

    const summary = computeFavoredSummary(leader, [b, c, d]);

    expect(summary.rows.map((r) => r.opponentKey)).toEqual(["b", "c", "d"]);
    expect(summary.counts).toEqual({ favored: 1, unfavored: 1, even: 1 });
    expect(summary.missing).toBe(0);
  });

  it("includes the mirror matchup when the leader is in its own pool and has mirror data", () => {
    const leader = makeLeader("a", { matchups: [makeMatchup("a", 0.55)] });
    const summary = computeFavoredSummary(leader, [leader]);

    expect(summary.rows.map((r) => r.opponentKey)).toEqual(["a"]);
    expect(summary.counts).toEqual({ favored: 1, unfavored: 0, even: 0 });
    expect(summary.missing).toBe(0);
  });

  it("counts the mirror as missing rather than dropping it when there's no mirror data", () => {
    const leader = makeLeader("a", { matchups: [] });
    const summary = computeFavoredSummary(leader, [leader]);

    expect(summary.rows).toEqual([]);
    expect(summary.missing).toBe(1);
  });

  it("counts pool leaders with no recorded matchup as missing instead of dropping them silently", () => {
    const b = makeLeader("b");
    const c = makeLeader("c");
    // A low-play leader that has only faced one of the two pool opponents.
    const leader = makeLeader("a", { matchups: [makeMatchup("b", 0.6)] });

    const summary = computeFavoredSummary(leader, [b, c]);

    expect(summary.rows.map((r) => r.opponentKey)).toEqual(["b"]);
    expect(summary.counts).toEqual({ favored: 1, unfavored: 0, even: 0 });
    expect(summary.missing).toBe(1);
  });

  it("carries through the first/second win rate split so turn-order-driven matchups aren't hidden", () => {
    const b = makeLeader("b");
    const leader = makeLeader("a", {
      matchups: [makeMatchup("b", 0.5, { first_win_rate: 0.8, second_win_rate: 0.2 })],
    });

    const summary = computeFavoredSummary(leader, [b]);

    expect(summary.rows[0].firstWinRate).toBe(0.8);
    expect(summary.rows[0].secondWinRate).toBe(0.2);
  });

  it("returns an empty summary when the pool has no data for the leader at all", () => {
    const b = makeLeader("b");
    const c = makeLeader("c");
    const leader = makeLeader("a", { matchups: [] });

    const summary = computeFavoredSummary(leader, [b, c]);

    expect(summary.rows).toEqual([]);
    expect(summary.counts).toEqual({ favored: 0, unfavored: 0, even: 0 });
    expect(summary.missing).toBe(2);
  });
});
