import { forwardRef, useEffect, useState } from "react";
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

// html-to-image re-fetches every <img> itself at capture time unless the src
// is already a data: URL, in which case it uses it as-is with no network
// activity at all. Relying on the browser reusing its HTTP cache for that
// re-fetch turned out to be unreliable (particularly on mobile Safari), so
// instead we fetch each thumbnail once here and hand html-to-image an
// already-resolved data URL — nothing left for it to fetch or fail on.
// Cached by leaderKey across leader switches, since most opponent
// thumbnails are shared across the whole top-20 pool.
const dataUrlCache = new Map<string, string>();

function useThumbDataUrl(leaderKey: string, onSettle?: (leaderKey: string) => void) {
  const [dataUrl, setDataUrl] = useState<string | null>(() => dataUrlCache.get(leaderKey) ?? null);

  useEffect(() => {
    const cached = dataUrlCache.get(leaderKey);
    if (cached) {
      setDataUrl(cached);
      onSettle?.(leaderKey);
      return;
    }

    let cancelled = false;
    fetch(leaderImageProxyUrl(leaderKey))
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          })
      )
      .then((url) => {
        dataUrlCache.set(leaderKey, url);
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        // Leave dataUrl null — the <img> falls back to the network URL,
        // which is a best-effort attempt rather than a guarantee.
      })
      .finally(() => {
        if (!cancelled) onSettle?.(leaderKey);
      });

    return () => {
      cancelled = true;
    };
  }, [leaderKey, onSettle]);

  return dataUrl;
}

function ShareThumb({
  leaderKey,
  size,
  onSettle,
}: {
  leaderKey: string;
  size: number;
  onSettle?: (leaderKey: string) => void;
}) {
  const dataUrl = useThumbDataUrl(leaderKey, onSettle);
  return (
    <img
      className="share-card__thumb"
      style={{ width: size, height: size }}
      src={dataUrl ?? leaderImageProxyUrl(leaderKey)}
      alt=""
      referrerPolicy="no-referrer"
    />
  );
}

function ShareRow({
  row,
  onSettle,
}: {
  row: FavoredRow;
  onSettle?: (leaderKey: string) => void;
}) {
  return (
    <div className="share-card__row" data-verdict={row.verdict}>
      <ShareThumb leaderKey={row.opponentKey} size={48} onSettle={onSettle} />
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
  rawWinRate: number;
  firstWinRate: number;
  secondWinRate: number;
  topN: number;
  summary: FavoredSummary;
  origin: string;
  onImageSettle?: (leaderKey: string) => void;
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
  {
    leaderKey,
    leaderName,
    rawWinRate,
    firstWinRate,
    secondWinRate,
    topN,
    summary,
    origin,
    onImageSettle,
  },
  ref
) {
  const half = Math.ceil(summary.rows.length / 2);
  const left = summary.rows.slice(0, half);
  const right = summary.rows.slice(half);

  return (
    <div className="share-card" ref={ref}>
      <div className="share-card__header">
        <ShareThumb leaderKey={leaderKey} size={96} onSettle={onImageSettle} />
        <div className="share-card__heading">
          <div className="share-card__title">{leaderName}</div>
          <div className="share-card__subtitle">Favored matchups vs. the top {topN} leaders</div>
          <div className="share-card__overall">
            <span>
              Overall{" "}
              <span className="share-card__overall-value">{pct(rawWinRate)}</span>
            </span>
            <span>
              1st{" "}
              <span
                className="share-card__overall-value"
                data-verdict={verdictFor(firstWinRate)}
              >
                {pct(firstWinRate)}
              </span>
            </span>
            <span>
              2nd{" "}
              <span
                className="share-card__overall-value"
                data-verdict={verdictFor(secondWinRate)}
              >
                {pct(secondWinRate)}
              </span>
            </span>
          </div>
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
            <ShareRow key={row.opponentKey} row={row} onSettle={onImageSettle} />
          ))}
        </div>
        <div className="share-card__column">
          {right.map((row) => (
            <ShareRow key={row.opponentKey} row={row} onSettle={onImageSettle} />
          ))}
        </div>
      </div>

      <div className="share-card__footer">OP Match Stats · {origin}</div>
    </div>
  );
});
