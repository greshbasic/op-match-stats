import { useState } from "react";

// Leader art lives on the CDN at two possible paths. Images load fine in <img>
// tags (no CORS needed for display). We try each candidate in order and advance
// on error, ending at a colored initials chip if none load.
const setOf = (leaderKey: string) => leaderKey.slice(0, leaderKey.indexOf("-"));

// Same-origin, so it's always embeddable in an exported canvas (e.g. the
// share-card image) without running into the CDN's lack of CORS headers.
export function leaderImageProxyUrl(leaderKey: string): string {
  return `/api/img?p=${encodeURIComponent(`cards_en/${setOf(leaderKey)}/${leaderKey}.png`)}`;
}

function imageUrls(leaderKey: string): string[] {
  const key = encodeURIComponent(leaderKey);
  const set = encodeURIComponent(setOf(leaderKey));
  return [
    // 1) Cropped leader art — not WAF-gated, straight from the CDN.
    `https://cdn.cardkaizoku.com/images/leaders/${key}.png`,
    // 2) Full-card art direct from the CDN. The WAF blocks a *foreign* Referer,
    //    but the <img> below sends none (referrerPolicy="no-referrer"), which
    //    the CDN allows — same as opening the URL directly in a browser.
    `https://cdn.cardkaizoku.com/cards_en/${set}/${key}.png`,
    // 3) Last resort: our server-side proxy (spoofs the Referer). Path goes in a
    //    query param so Vercel routes it to the function, not the static layer.
    leaderImageProxyUrl(leaderKey),
  ];
}

// Deterministic hue from the leader id so each fallback chip has a stable color.
function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

function initials(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, "");
  return (letters.slice(0, 2) || "?").toUpperCase();
}

interface Props {
  leaderKey: string;
  name: string;
  size?: number;
}

// Session memo: leaderKey -> the candidate index that resolved (or urls.length
// if all failed → initials chip). Thumbnails remount whenever the search list
// re-filters; without this each remount would re-walk the whole fallback chain
// and re-request the CDN's un-cacheable 404s. Starting from the remembered
// index avoids that entirely.
const resolvedIndex = new Map<string, number>();

export function LeaderThumb({ leaderKey, name, size = 28 }: Props) {
  const urls = imageUrls(leaderKey);
  const [srcIndex, setSrcIndex] = useState(() => resolvedIndex.get(leaderKey) ?? 0);
  const style = { width: size, height: size } as const;
  const failed = srcIndex >= urls.length;

  if (failed) {
    const hue = hueFor(leaderKey);
    return (
      <span
        className="thumb thumb--fallback"
        style={{
          ...style,
          background: `linear-gradient(135deg, hsl(${hue} 55% 40%), hsl(${(hue + 40) % 360} 55% 30%))`,
          fontSize: Math.round(size * 0.4),
        }}
        aria-hidden
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <img
      key={urls[srcIndex]}
      className="thumb"
      style={style}
      src={urls[srcIndex]}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onLoad={() => resolvedIndex.set(leaderKey, srcIndex)}
      onError={() =>
        setSrcIndex((i) => {
          const next = i + 1;
          resolvedIndex.set(leaderKey, next); // remember (incl. urls.length = chip)
          return next;
        })
      }
    />
  );
}
