import { forwardRef } from "react";
import { leaderImageProxyUrl } from "./LeaderThumb";
import { verdictFor, type FavoredRow, type FavoredSummary, type Verdict } from "../lib/favored";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const pctOrDash = (n: number | null) => (n === null ? "—" : pct(n));
const verdictOrNull = (n: number | null): Verdict | null => (n === null ? null : verdictFor(n));

const VERDICT_LABEL: Record<Verdict, string> = {
  favored: "Favored",
  unfavored: "Unfavored",
  even: "Coinflip",
};

function ShareThumb({ leaderKey, size }: { leaderKey: string; size: number }) {
  return (
    <img
      className="share-card__thumb"
      style={{ width: size, height: size }}
      src={leaderImageProxyUrl(leaderKey)}
      alt=""
      referrerPolicy="no-referrer"
    />
  );
}

function ShareRow({ row }: { row: FavoredRow }) {
  return (
    <div className="share-card__row" data-verdict={row.verdict}>
      <ShareThumb leaderKey={row.opponentKey} size={48} />
      <div className="share-card__row-main">
        <div className="share-card__row-top">
          <span className="share-card__row-name">{row.opponentName}</span>
          <span className="share-card__row-badge">{VERDICT_LABEL[row.verdict]}</span>
          <span className="share-card__row-rate">{pct(row.winRate)}</span>
        </div>
        <div className="share-card__row-split">
          <span>
            1st{" "}
            <span
              className="share-card__row-split-value"
              data-verdict={verdictOrNull(row.firstWinRate)}
            >
              {pctOrDash(row.firstWinRate)}
            </span>
          </span>
          <span>
            2nd{" "}
            <span
              className="share-card__row-split-value"
              data-verdict={verdictOrNull(row.secondWinRate)}
            >
              {pctOrDash(row.secondWinRate)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

interface Props {
  leaderKey: string;
  leaderName: string;
  topN: number;
  summary: FavoredSummary;
  origin: string;
}

// Rendered off-screen and rasterized to PNG by the Share button — a
// self-contained summary of the page for posting somewhere a link preview
// wouldn't show the actual data (Discord, Reddit, etc).
//
// Forwards the ref onto this root node (not the off-screen positioning
// wrapper around it) — html-to-image clones the captured node's own style,
// so if the wrapper's `position: fixed; left: -99999px` were captured
// instead, the clone would inherit that and render off-canvas, producing a
// blank image.
export const ShareCard = forwardRef<HTMLDivElement, Props>(function ShareCard(
  { leaderKey, leaderName, topN, summary, origin },
  ref
) {
  const half = Math.ceil(summary.rows.length / 2);
  const left = summary.rows.slice(0, half);
  const right = summary.rows.slice(half);

  return (
    <div className="share-card" ref={ref}>
      <div className="share-card__header">
        <ShareThumb leaderKey={leaderKey} size={96} />
        <div className="share-card__heading">
          <div className="share-card__title">{leaderName}</div>
          <div className="share-card__subtitle">Favored matchups vs. the top {topN} leaders</div>
        </div>
      </div>

      <div className="share-card__summary">
        <span className="share-card__count share-card__count--favored">
          {summary.counts.favored} favored
        </span>
        <span className="share-card__count share-card__count--unfavored">
          {summary.counts.unfavored} unfavored
        </span>
        <span className="share-card__count share-card__count--even">
          {summary.counts.even} coinflip
        </span>
        {summary.missing > 0 && (
          <span className="share-card__count">no data for {summary.missing}</span>
        )}
      </div>

      <div className="share-card__columns">
        <div className="share-card__column">
          {left.map((row) => (
            <ShareRow key={row.opponentKey} row={row} />
          ))}
        </div>
        <div className="share-card__column">
          {right.map((row) => (
            <ShareRow key={row.opponentKey} row={row} />
          ))}
        </div>
      </div>

      <div className="share-card__footer">OP Match Stats · {origin}</div>
    </div>
  );
});
