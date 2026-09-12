import type { MatchupResultData } from "../types/stats";
import { LeaderThumb, setCodeOf } from "./LeaderThumb";

const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);

const HEADLINE: Record<MatchupResultData["recommendation"], string> = {
  FIRST: "GO FIRST",
  SECOND: "GO SECOND",
  EVEN: "NO CLEAR ADVANTAGE",
};

export function MatchupResult({ data }: { data: MatchupResultData }) {
  const { recommendation } = data;
  const firstWins = recommendation === "FIRST";
  const secondWins = recommendation === "SECOND";

  return (
    <section className="result" data-rec={recommendation}>
      <div className="result__matchup">
        <span className="result__vs-leader">
          <LeaderThumb leaderKey={data.myKey} name={data.myName} size={56} />
          <strong>{data.myName}</strong>
          <span className="result__vs-leader-set">{setCodeOf(data.myKey)}</span>
        </span>
        <span className="result__vs">vs</span>
        <span className="result__vs-leader">
          <LeaderThumb leaderKey={data.opponentKey} name={data.opponentName} size={56} />
          <strong>{data.opponentName}</strong>
          <span className="result__vs-leader-set">{setCodeOf(data.opponentKey)}</span>
        </span>
      </div>

      <div className={`result__headline result__headline--${recommendation.toLowerCase()}`}>
        {HEADLINE[recommendation]}
      </div>

      <div className="result__raw">Raw win rate: {pct(data.rawWinRate)}</div>

      <div className="result__rates">
        <div className={"result__rate" + (firstWins ? " is-winner" : "")}>
          <span className="result__rate-label">First</span>
          <span className="result__rate-value">{pct(data.firstWinRate)}</span>
          <span className="result__rate-games">{data.firstGames.toLocaleString()} games</span>
        </div>
        <div className={"result__rate" + (secondWins ? " is-winner" : "")}>
          <span className="result__rate-label">Second</span>
          <span className="result__rate-value">{pct(data.secondWinRate)}</span>
          <span className="result__rate-games">{data.secondGames.toLocaleString()} games</span>
        </div>
      </div>
    </section>
  );
}
