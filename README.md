# OP Match Stats

A small React + TypeScript + Vite web app for One Piece TCG matchup stats,
leader rankings, and turn-order recommendations, using live matchup win rates
from the Card Kaizoku stats API.

Pick **your leader** and the **opponent leader**, hit **Analyze**, and the app
compares the first-turn vs second-turn win rate for that pairing and tells you
which turn order to choose. It also has Top 10 Leaders and Favored Matchups
views for browsing the wider meta.

## Running locally

```bash
npm install
npm run dev
```

Then open the printed URL (default http://localhost:5173).

Production build:

```bash
npm run build
npm run preview
```

## Tests

```bash
npm test        # run once
npm run test:watch
```

[Vitest](https://vitest.dev) covers the two pieces of real logic: the
first/second recommendation (`src/lib/recommend.ts`, including ties and
missing-data nulls) and the stats service (`src/services/statsApi.ts`) — dynamic
date resolution, the walk-back when recent snapshots 404, and rejection of
network/JSON/shape failures.

## Deploying to Vercel (free)

The production site needs the same `/api/stats/*` → CDN proxy the dev server
provides (see below). `vercel.json` configures that rewrite, so no server code is
required. Leader images load straight from the CDN via `<img>`, so only the JSON
is proxied.

```bash
npm i -g vercel     # or use: npx vercel
vercel              # first run: link/create project, accept the defaults
vercel --prod       # deploy to your public URL
```

Vercel auto-detects the Vite build (`npm run build` → `dist`). The rewrite in
`vercel.json` forwards `/api/stats/...` to `https://cdn.cardkaizoku.com/stats/...`
(query string preserved), so the exact same fetch path works in dev and prod.
Once deployed you get a `https://<project>.vercel.app` URL you can open on your
phone. (You can also connect the Git repo in the Vercel dashboard for auto-deploys
on push.)

> After the first deploy, load the site once and confirm the matchup data loads —
> this verifies the CDN accepts Vercel's server-side proxy request (it accepts the
> `/stats/` path for normal requests; only the image `/cards_en/` path is
> bot-filtered, and those are loaded client-side).

## Why there is a proxy (CORS)

The stats endpoint (e.g.)

```
https://cdn.cardkaizoku.com/stats/stats_op17_lw_20260830.json?v=20260830
```

returns `200 OK` and valid JSON, **but it does not send an
`Access-Control-Allow-Origin` header** (verified with a cross-origin request).
A browser will therefore refuse to let client-side JavaScript read the response.

As the plan requires, this is solved with a server-side proxy rather than an
insecure client-side workaround. The Vite dev server proxies same-origin
`/api/stats/...` requests to the CDN (see `vite.config.ts`), so the browser only
ever makes a same-origin request.

> Note: the proxy is provided by the Vite dev server. For a static production
> deployment you would put the same rewrite in front of the app (e.g. a Netlify/
> Vercel rewrite, Nginx `proxy_pass`, or a tiny serverless function) pointing
> `/api/stats/*` at `https://cdn.cardkaizoku.com/stats/*`.

## Dynamic snapshot date

The filename embeds a date (`..._lw_20260830.json`). The CDN publishes a new
**daily** snapshot and retains a rolling window (~8 days); older/future dates
return 404. Rather than hardcode a date, `statsApi.ts` starts at today and walks
backwards a day at a time until a snapshot loads, so the app always uses the most
recent available data (and gracefully handles timezone skew or a not-yet-published
day). The resolved date is shown in the footer. The set prefix (`op17`) is a
constant since it only changes on a new set release.

## How the data flows

```
Vite dev server proxy  ──►  Card Kaizoku CDN
        ▲
        │ same-origin fetch("/api/stats/...json")
        │
statsApi.fetchStats()          # fetch + validate (network / status / JSON / shape)
        │
        ▼
App state: stats (LeaderStats[])
        │
        ├─► nameByKey: Map<leaderKey, leaderName>   # human-readable labels
        ├─► myOptions:       every top-level leader  → "Your Leader" dropdown
        └─► opponentOptions: matchups of the chosen  → "Opponent Leader" dropdown
                              leader only
        │
   user selects myLeader + opponent, clicks Analyze
        │
        ▼
leader = stats.find(l => l.leaderKey === myLeader)
matchup = leader.matchups.find(m => m.opponentKey === opponent)
        │
        ▼
recommend(matchup.first_win_rate, matchup.second_win_rate)
   first > second → GO FIRST
   second > first → GO SECOND
   equal          → NO CLEAR ADVANTAGE
        │
        ▼
<MatchupResult /> shows the headline + both win rates + sample sizes
```

### Data shape (from the real response)

The live JSON is richer than the example in the plan. Each of the 119 leaders
carries aggregate stats plus a `matchups` array. The fields this app relies on:

- Leader: `leaderKey`, `leaderName`, `matchups`
- Matchup: `opponentKey`, `opponent`, `first_win_rate`, `second_win_rate`,
  `first_games`, `second_games`

Types live in `src/types/stats.ts`, and `src/services/statsApi.ts` validates the
response at runtime (rejecting network failures, non-200 responses, invalid JSON,
and unexpected shapes) so the UI never shows misleading numbers.

## Leader art

The stats JSON has no color or image data, but the CDN serves leader art. The
dropdowns and result show thumbnails (loaded directly via `<img>`, which doesn't
require CORS). `LeaderThumb.tsx` tries two paths, then a fallback:

1. `https://cdn.cardkaizoku.com/images/leaders/{leaderKey}.png` — cropped leader
   art, loaded straight from the CDN (covers ~102 of 119 leaders).
2. `/api/img/cards_en/{SET}/{leaderKey}.png` — full-card art for the rest (mostly
   the newest OP17/OP18/PRB01/EB01 cards and some promos), via our proxy.
3. If neither loads, a colored initials chip.

Path #2 is proxied because the CDN's WAF only serves `/cards_en/` images when the
request carries a `cardkaizoku.com` `Referer` — which a browser `<img>` from our
own origin can't send. The proxy (`api/img/[...path].ts`, a Vercel **Node**
serverless function; `vite.config.ts` in dev) fetches server-side with that
header and returns the image. (It must be the Node runtime, not Edge — Edge's
spec-compliant fetch strips the forbidden `Referer` header.)

### Caching (why it's not "100+ images every time")

- Only **visible** thumbnails load, thanks to `loading="lazy"` on each `<img>`.
- The CDN already marks images `Cache-Control: public` (≈1h primary, ≈24h
  fallback), so the browser serves repeat views from its own cache — no refetch.
- The proxied images get a stronger `Cache-Control: public, max-age=86400,
  s-maxage=2592000, immutable`, so Vercel's edge caches them for ~30 days across
  all visitors and the origin is hit at most once per image.

## Handled edge cases

- **Loading** — "Loading matchup data…" while fetching.
- **Fetch/JSON/shape failure** — "Unable to load matchup data." with a retry.
- **No matchup for the pairing** — "No matchup data available for this pairing."
  (opponent dropdown is already scoped to valid opponents, but the lookup is
  still guarded).
- **Equal win rates** — shown as "NO CLEAR ADVANTAGE", never arbitrarily
  favoring a side.

## Project structure

```
api/
  img/[...path].ts      # Vercel Node proxy for referer-gated CDN images
src/
  components/
    LeaderSelect.tsx    # searchable dropdown (keyboard + mouse)
    LeaderThumb.tsx     # leader art with two-path + initials fallback
    MatchupResult.tsx   # prominent recommendation + win rates
  lib/
    recommend.ts        # first/second recommendation logic (unit-tested)
  services/
    statsApi.ts         # fetch, dynamic date, runtime validation
  types/
    stats.ts            # API + view-model types
  App.tsx               # state, lookup, wiring
  main.tsx
  styles.css
vite.config.ts          # dev proxy (stats + images) + vitest config
vercel.json             # prod /api/stats rewrite
```
