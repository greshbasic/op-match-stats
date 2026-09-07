import { useMemo, useState } from "react";
import type { LeaderOption, Stats } from "../types/stats";
import { LeaderSelect } from "./LeaderSelect";
import { LeaderThumb } from "./LeaderThumb";
import { sortByPlayRate } from "../lib/sortOptions";
import { computeFavoredSummary, type Verdict } from "../lib/favored";

const TOP_N = 20;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const VERDICT_LABEL: Record<Verdict, string> = {
  favored: "Favored",
  unfavored: "Unfavored",
  even: "Coinflip",
};

export function FavoredMatchups({ stats, onBack }: { stats: Stats; onBack: () => void }) {
  const [leaderKey, setLeaderKey] = useState<string | null>(null);

  const playRateByKey = useMemo(() => {
    const map = new Map<string, number>();
    stats.forEach((l) => map.set(l.leaderKey, l.play_rate));
    return map;
  }, [stats]);

  const leaderOptions: LeaderOption[] = useMemo(
    () =>
      sortByPlayRate(
        stats.map((l) => ({ id: l.leaderKey, name: l.leaderName })),
        playRateByKey
      ),
    [stats, playRateByKey]
  );

  // The "meta" against which favorability is judged: the top 20 leaders by
  // weighted win rate (same ranking used on the Top 10 Leaders page).
  const topLeaders = useMemo(
    () => [...stats].sort((a, b) => b.weighted_win_rate - a.weighted_win_rate).slice(0, TOP_N),
    [stats]
  );

  const leader = useMemo(
    () => stats.find((l) => l.leaderKey === leaderKey) ?? null,
    [stats, leaderKey]
  );

  const summary = useMemo(
    () => (leader ? computeFavoredSummary(leader, topLeaders) : null),
    [leader, topLeaders]
  );

  return (
    <main className="app__main">
      <button className="btn btn--back" onClick={onBack}>
        ← Back
      </button>

      <div className="controls favored__controls">
        <LeaderSelect
          label="Leader"
          options={leaderOptions}
          value={leaderKey}
          onChange={setLeaderKey}
          placeholder="Search leader…"
        />
      </div>

      {!leader && (
        <div className="state state--empty">Pick a leader to see its favored matchups.</div>
      )}

      {leader && summary && (
        <>
          <p className="favored__summary">
            Vs. the top {topLeaders.length} leaders:{" "}
            <span className="favored__count favored__count--favored">
              {summary.counts.favored} favored
            </span>
            {" · "}
            <span className="favored__count favored__count--unfavored">
              {summary.counts.unfavored} unfavored
            </span>
            {" · "}
            <span className="favored__count favored__count--even">
              {summary.counts.even} coinflip
            </span>
            {summary.missing > 0 &&
              ` · no data yet for ${summary.missing} of them`}
          </p>

          {summary.rows.length === 0 && (
            <div className="state state--empty">
              No matchup data against the top {topLeaders.length} leaders yet.
            </div>
          )}

          <ol className="favored-list">
            {summary.rows.map(({ opponentKey, opponentName, winRate, verdict }) => (
              <li key={opponentKey} className="favored-list__row" data-verdict={verdict}>
                <LeaderThumb leaderKey={opponentKey} name={opponentName} size={40} />
                <span className="favored-list__name">{opponentName}</span>
                <span className="favored-list__badge">{VERDICT_LABEL[verdict]}</span>
                <span className="favored-list__rate">{pct(winRate)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  );
}
