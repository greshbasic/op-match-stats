import { useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import type { LeaderOption, Stats } from "../types/stats";
import { LeaderSelect } from "./LeaderSelect";
import { LeaderThumb } from "./LeaderThumb";
import { ShareCard } from "./ShareCard";
import { sortByPlayRate } from "../lib/sortOptions";
import { computeFavoredSummary, verdictFor, type Verdict } from "../lib/favored";

const TOP_N = 20;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const VERDICT_LABEL: Record<Verdict, string> = {
  favored: "Favored",
  unfavored: "Unfavored",
  even: "Coinflip",
};

const pctOrDash = (n: number | null) => (n === null ? "—" : pct(n));
const verdictOrNull = (n: number | null): Verdict | null => (n === null ? null : verdictFor(n));

export function FavoredMatchups({ stats, onBack }: { stats: Stats; onBack: () => void }) {
  const [leaderKey, setLeaderKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

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

  async function handleShare() {
    if (!shareRef.current || !leader) return;
    setIsSharing(true);
    try {
      // html-to-image's image cache keys by URL with the query string
      // stripped by default, so every leader's `/api/img?p=...` thumbnail
      // collapses to the same cache key and all rows end up showing whoever
      // resolved first. includeQueryParams keeps them distinct.
      const blob = await toBlob(shareRef.current, { pixelRatio: 2, includeQueryParams: true });
      if (!blob) throw new Error("Failed to render share image");

      const filename = `${leader.leaderName.toLowerCase().replace(/\s+/g, "-")}-favored-matchups.png`;
      const file = new File([blob], filename, { type: "image/png" });

      // On mobile, sharing a file opens the native share sheet, where "Save
      // Image" drops it straight into the camera roll — much easier than
      // digging a downloaded file out of Downloads. Desktop browsers mostly
      // don't support sharing files, so fall back to a plain download there.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "OP Match Stats",
          text: `${leader.leaderName} favored matchups vs. the top ${topLeaders.length} leaders`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // The user closing the native share sheet also rejects as AbortError.
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Failed to render share image", err);
      }
    } finally {
      setIsSharing(false);
    }
  }

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
          onChange={(key) => {
            setLeaderKey(key);
            setExpandedKey(null);
          }}
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
            {summary.rows.length > 0 && (
              <button
                type="button"
                className="btn btn--share"
                onClick={handleShare}
                disabled={isSharing}
              >
                {isSharing ? "Rendering…" : "📤 Share as image"}
              </button>
            )}
          </p>

          {summary.rows.length === 0 && (
            <div className="state state--empty">
              No matchup data against the top {topLeaders.length} leaders yet.
            </div>
          )}

          <ol className="favored-list">
            {summary.rows.map(({ opponentKey, opponentName, winRate, verdict, firstWinRate, secondWinRate }) => {
              const isExpanded = expandedKey === opponentKey;
              return (
                <li key={opponentKey} className="favored-list__item">
                  <button
                    type="button"
                    className="favored-list__row"
                    data-verdict={verdict}
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedKey(isExpanded ? null : opponentKey)}
                  >
                    <LeaderThumb leaderKey={opponentKey} name={opponentName} size={40} />
                    <span className="favored-list__name">{opponentName}</span>
                    <span className="favored-list__badge">{VERDICT_LABEL[verdict]}</span>
                    <span className="favored-list__rate">{pct(winRate)}</span>
                  </button>

                  {isExpanded && (
                    <div className="favored-detail">
                      <div className="favored-detail__stat">
                        <span className="favored-detail__label">Going first</span>
                        <span
                          className="favored-detail__value"
                          data-verdict={verdictOrNull(firstWinRate)}
                        >
                          {pctOrDash(firstWinRate)}
                        </span>
                      </div>
                      <div className="favored-detail__stat">
                        <span className="favored-detail__label">Going second</span>
                        <span
                          className="favored-detail__value"
                          data-verdict={verdictOrNull(secondWinRate)}
                        >
                          {pctOrDash(secondWinRate)}
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="share-card-wrap" aria-hidden>
            <ShareCard
              ref={shareRef}
              leaderKey={leader.leaderKey}
              leaderName={leader.leaderName}
              rawWinRate={leader.raw_win_rate}
              firstWinRate={leader.first_win_rate}
              secondWinRate={leader.second_win_rate}
              topN={topLeaders.length}
              summary={summary}
              origin={typeof window !== "undefined" ? window.location.host : "op-match-stats"}
            />
          </div>
        </>
      )}
    </main>
  );
}
