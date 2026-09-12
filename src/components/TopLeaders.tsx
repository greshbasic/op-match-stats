import type { Stats } from "../types/stats";
import { LeaderThumb, setCodeOf } from "./LeaderThumb";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function TopLeaders({ stats, onBack }: { stats: Stats; onBack: () => void }) {
  const top10 = [...stats]
    .sort((a, b) => b.weighted_win_rate - a.weighted_win_rate)
    .slice(0, 10);

  return (
    <main className="app__main">
      <button className="btn btn--back" onClick={onBack}>
        ← Back
      </button>

      <ol className="top-leaders">
        {top10.map((leader, i) => (
          <li key={leader.leaderKey} className="top-leaders__row">
            <span className="top-leaders__rank">{i + 1}</span>
            <LeaderThumb leaderKey={leader.leaderKey} name={leader.leaderName} size={44} />
            <span className="top-leaders__name">{leader.leaderName}</span>
            <span className="top-leaders__set">{setCodeOf(leader.leaderKey)}</span>
            <span className="top-leaders__stats">
              <span className="top-leaders__stat">
                <span className="top-leaders__stat-label">Wtd WR</span>
                <span className="top-leaders__stat-value">{pct(leader.weighted_win_rate)}</span>
              </span>
              <span className="top-leaders__stat">
                <span className="top-leaders__stat-label">Play rate</span>
                <span className="top-leaders__stat-value">{pct(leader.play_rate)}</span>
              </span>
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
