# ⚽ WC 2026 Odds Tracker

![Node](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-deployed-000000?style=flat-square&logo=vercel&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-automated-2088FF?style=flat-square&logo=githubactions&logoColor=white)

> Real-time 2026 FIFA World Cup odds tracker — pre-match moneylines, win probabilities, and live scores for all 48 group-stage matches across 12 groups. Data refreshed every 15 minutes via GitHub Actions; live scores overlay directly from ESPN every 30 seconds.

## 🌐 Live

**[wc2026-odds-three.vercel.app](https://wc2026-odds-three.vercel.app)**

---

## 📊 What it shows

| Page | Description |
|---|---|
| **Home** | Hero card for the live/next match (flag dominant-color gradient, win probability bar); "Awaiting Odds" section for real-team upcoming matches; recent results as score-only rows |
| **Groups** | All 12 groups with live standings + match results and upcoming fixtures |
| **Standings** | Full group-stage standings table (P/W/D/L/GF/GA/GD/Pts) |
| **Team Detail** | Per-team match history and upcoming schedule |

Clicking any match opens the **Match Detail Modal** with four tabs:

| Tab | Contents |
|---|---|
| **Odds** | 1X2 moneylines + implied probabilities + opening→closing movement arrows; Double Chance; Draw No Bet; Over/Under line & odds; Asian Handicap (both sides); DraftKings deep-link bet buttons |
| **Form & Stats** | Last-5 results for each team; avg goals scored/conceded; clean sheets; Head-to-Head record |
| **Analysis** | Poisson model — expected goals from form averages, top-8 scoreline probabilities |
| **Chatbot** | Coming Soon placeholder |

Available in **English and Spanish** (toggle in the nav).

---

## 🧠 How probabilities are calculated

Odds come from **DraftKings via the ESPN public API** (moneyline format). They are converted to implied probabilities and then de-vigged (overround removed) so the three outcomes always sum to 100%:

```
# Implied probability from American moneyline
p = 100 / (ml + 100)          # positive line  e.g. +150
p = |ml| / (|ml| + 100)       # negative line  e.g. -220

# Remove bookmaker overround (vig)
homeWinPct = p_home / (p_home + p_draw + p_away) × 100
```

The scraper only emits odds when at least one real moneyline is present — no fake 33.3/33.3/33.3 objects for unpriced matches.

> **Note:** Odds are pre-match and do not update in-play. Live scores and match clock are fetched directly from ESPN in real time.

---

## 🏗️ Architecture

```
ESPN public API ──────────────────────────────────────┐
  scoreboardv2  (matches + odds, June 11–July 19)     │
  standings     (group tables)                         │
  summary?event=<id>  (enriched odds for next 7 days) │
                                                       ▼
                              backend/scraper.js  (Node.js ESM)
                              --once (GitHub Actions, every 15 min)
                              or continuous with dynamic interval:
                                15 min normally · 1 min when live
                                                       │
                        ┌──────────────────────────────┘
                        │
              frontend/public/data/
              ├── matches.json      ← all matches + odds + team info
              └── standings.json   ← group standings

                        │
              React 19 + Vite + TypeScript + Tailwind
              ├── useLiveMatches hook
              │     ├── polls matches.json every 30 s (scraper updates)
              │     └── polls ESPN scoreboard every 30 s when live
              │           → overlays real-time state/score/clock
              │             onto cached records
              ├── Home      (hero card + awaiting odds + results)
              ├── Groups    (12 groups: standings + fixtures)
              ├── Standings (full standings table)
              ├── Team      (per-team detail)
              └── MatchDetailModal
                    (Odds · Form & Stats · Analysis · Chatbot)
                        │
                   Vercel (static deploy)
              ESPN API proxy via vercel.json rewrites
              (avoids CORS in production)
```

**GitHub Actions** runs `node scraper.js --once` every 15 minutes, commits updated JSONs, and Vercel auto-redeploys on push. The workflow can also be triggered manually from the GitHub UI.

---

## 🚀 Quick start

### Frontend (uses pre-built data)

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
```

### Scraper (update data locally)

```bash
cd backend
npm install
node scraper.js          # polls continuously (15 min / 1 min live)
node scraper.js --once   # single run, then exits
```

---

## 📁 Project structure

```
WC2026ODDS/
├── .github/workflows/update-data.yml   ← GitHub Actions cron (every 15 min)
├── backend/
│   ├── scraper.js                      ← Node.js ESM scraper (ESPN API)
│   └── package.json
├── data-pipeline/                      ← Legacy Python/Playwright scraper
│   ├── scraper.py                        (OddsPortal + Wikipedia). Superseded
│   └── outputs/                          by the Node scraper; not consumed by
│       ├── bracket.json                  the live app.
│       ├── champion_probs.json
│       ├── groups.json
│       └── match_results.json
└── frontend/
    ├── public/data/
    │   ├── matches.json               ← Scraped match + odds data
    │   ├── standings.json             ← Group standings
    │   └── bracket.json               ← Static knockout bracket skeleton
    ├── src/
    │   ├── hooks/
    │   │   ├── useLiveMatches.ts      ← Polls JSON + ESPN real-time overlay
    │   │   └── useDominantColor.ts    ← Flag color extraction for gradients
    │   ├── components/
    │   │   ├── Flag.tsx               ← Null-safe flag renderer (skips placeholder slots)
    │   │   ├── MatchDetailModal.tsx   ← Full odds + Form & Stats + Poisson analysis
    │   │   ├── Nav.tsx
    │   │   ├── Footer.tsx
    │   │   └── ProgressBar.tsx
    │   ├── pages/
    │   │   ├── Home.tsx
    │   │   ├── Groups.tsx
    │   │   ├── Standings.tsx
    │   │   └── Team.tsx
    │   ├── i18n/                      ← EN/ES translations (LangContext)
    │   └── types.ts
    └── vercel.json                    ← ESPN API proxy rewrite rules
```

---

## 📦 Data sources

| Source | Role |
|---|---|
| ESPN `site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard` | Matches, odds (DraftKings), live scores |
| ESPN `site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=<id>` | Enriched odds: opening lines, O/U, spread, DK bet URLs |
| ESPN `site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings` | Group standings |
| [flagcdn.com](https://flagcdn.com) | Country flag images (w160 for retina) |

---

## 🏳️ Data integrity

Knockout fixtures use placeholder "teams" (e.g. `RD32`, `QFW1`, `1A`) that have no real country behind them. The scraper maps ESPN abbreviations to ISO 3166-1 alpha-2 codes via an explicit `TEAM_ISO` lookup and returns `flagUrl: null` for any abbreviation not in that table — never guessing from the first two characters, which would silently render the wrong country's flag. The `<Flag>` component skips rendering entirely when `flagUrl` is null, so placeholder slots show a neutral badge with no broken-image requests.

---

## ⚠️ Disclaimer

Odds sourced from DraftKings via ESPN public API. All probabilities are statistical estimates — **not betting advice**. Pre-match only; not updated in-play. 18+.

---

## 📄 License

MIT — free to use, fork, and build on.
