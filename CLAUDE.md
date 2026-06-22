# WC 2026 Odds — Project Guide

Live: https://wc2026-odds-three.vercel.app/

**Stack:** React 19 + Vite + TypeScript + Tailwind (frontend, deployed on Vercel) ·
Node.js ESM scraper (backend) · GitHub Actions cron pipeline.

**Data flow:** `.github/workflows/update-data.yml` runs `backend/scraper.js --once`
every 15 min → fetches ESPN public API (DraftKings odds embedded) → writes
`frontend/public/data/{matches,standings}.json` → commits & pushes → Vercel redeploys.
The frontend reads those static JSON files; `/espn-api/*` is proxied to ESPN (Vite proxy
in dev, `vercel.json` rewrite in prod) for on-demand form/H2H data.

---

## Known bugs / issues
_(found 2026-06-17 by live audit of the deployed site + source review)_

**Status:** #1, #2, #3 **FIXED** 2026-06-17 (scraper map + `flagUrl→null` for
unmapped/placeholder teams; new `<Flag>` component skips render + colour hook when
`flagUrl` is null; data regenerated). Verified on a local prod build: console errors
**58 → 0**, `za`/`cw` flags load 200, no Serbia/Cuba mis-requests. #4 and #5 still open
(low priority). Changes are local — `git push` to deploy.

### 1. Wrong flags for unmapped teams — DATA CORRECTNESS (high) ✅ FIXED
`backend/scraper.js:51` falls back to `abbr.toLowerCase().slice(0, 2)` when an ESPN
abbreviation is missing from the `TEAM_ISO` map. This silently produces a **valid but
wrong** ISO code — no 404, no error, just the wrong country's flag. Currently affected:
- **RSA** (South Africa) → `rs` → renders **Serbia's** flag
- **CUW** (Curaçao) → `cu` → renders **Cuba's** flag

`TEAM_ISO` has `ZAF` for South Africa, but ESPN sends `RSA`; Curaçao isn't mapped at all.
**Fix:** add `RSA: 'za'`, `CUW: 'cw'` (and audit other CONCACAF/CAF abbrs); replace the
`slice(0,2)` fallback with `null` so unmapped teams degrade to no-flag instead of a wrong flag.

### 2. Placeholder/knockout slots request bogus flags — 58 console errors (medium) ✅ FIXED
Knockout fixtures use placeholder "teams" with abbreviations like `RD32`, `RD16 W1`,
`QFW1`, `QW4`, `SF L1`, `SFW1`, and group slots `1A`–`2L`, `3R`. `flagUrl()` turns these
into `flagcdn.com/w160/{1a,rd,qf,sf,...}.png`, which don't exist. On the live home page this
fires **58 console errors per load** (≈29 placeholder slots × 2: a 404 from the visible
`<img>`, plus a CORS error from the `useDominantColor` crossorigin `Image`). The visible
flag is hidden via `onError` so the UI looks OK, but a recruiter opening DevTools sees a
wall of red errors. **Fix:** detect placeholder teams in the scraper (e.g. abbr not a real
country) and set `flagUrl: null`; in the frontend skip the `<img>` and `useDominantColor`
when `flagUrl` is null, showing a neutral badge instead.

### 3. `useDominantColor` silently no-ops on placeholders & wastes work (low) ✅ FIXED
`frontend/src/hooks/useDominantColor.ts` sets `img.crossOrigin = 'anonymous'` and reads the
canvas. flagcdn serves CORS headers for real flags (so this works for actual teams), but for
non-existent placeholder codes the error response has no CORS header → `getImageData` path is
never reached and the `catch` silently keeps the fallback. Net effect: it's the source of the
CORS half of issue #2, and runs 2× per card (home + away) for every match including placeholders.
**Fix:** guard on a valid `flagUrl` before invoking the hook.

### 4. Config drift — docs say 15 min, code says 5 (low) ✅ FIXED
`REFRESH_MS` updated from 5 min to 15 min to match the Actions cron and docs.

### 5. Dead / redundant pipeline — `data-pipeline/scraper.py` (low, portfolio-relevant)
A separate Python/Playwright scraper (OddsPortal + cuotasahora + Wikipedia/CBS, hardcoded Elo
table) outputs `champion_probs.json` / `groups.json` / `match_results.json` — files the current
app no longer consumes. It's superseded by the Node ESPN scraper. Either delete it or clearly
mark it as a legacy/alternative approach in the README, so the repo doesn't present two
competing "the scraper" stories.

---

## Design principles (user-confirmed)

- **If data has no use, don't show it.** No fake 33.3%/33.3%/33.3% odds. No odds tab on
  finished matches. No placeholder knockout matches flooding the home page. Scraper must
  return `null` odds when moneylines are missing, not a fake normalized object.
- **Finished matches = result only.** Modal opens to Form & Stats, no odds/analysis tabs.
  The home page shows recent results as score-only rows.
- **Awaiting Odds section** is limited to matches with real teams (both `flagUrl` non-null)
  within 14 days. Knockout placeholders are excluded.

---

### Not bugs (verified working on live site)
- Vercel `/espn-api` rewrite works in production (Form & Stats tab fetched `summary?event=…` → 200).
- Match modal: Odds (1X2 + movement arrows, Double Chance, Draw No Bet, O/U, Asian Handicap),
  Form & Stats (last-5, avg scored/conceded, clean sheets, H2H) all render correctly.
- Double-chance math checks out (e.g. ENG 56.4 + Draw 25.4 = 82% "ENG or Draw").
- The "🤖 Chatbot" tab is an intentional "Coming Soon" placeholder, not a broken feature.

> Note: issues #1–#3 generalize to `/groups` and `/standings` (same flag rendering path);
> not separately re-verified live.
