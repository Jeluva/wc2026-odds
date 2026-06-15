# ⚽ WC 2026 Odds Tracker

![Node](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-deployed-000000?style=flat-square&logo=vercel&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-automated-2088FF?style=flat-square&logo=githubactions&logoColor=white)

> Real-time 2026 FIFA World Cup odds tracker — pre-match moneylines, win probabilities, and live scores for all 48 teams across 12 groups. Data refreshed every 15 minutes via GitHub Actions.

## 🌐 Live

**[wc2026-odds-three.vercel.app](https://wc2026-odds-three.vercel.app)**

---

## 📊 What it shows

| Page | Description |
|---|---|
| **Home** | Hero card for the live/next match with win probabilities; upcoming match list |
| **Groups** | All 12 groups with live standings + match results and upcoming fixtures |
| **Standings** | Full group-stage standings table |
| **Team Detail** | Per-team match history and upcoming schedule |

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

> **Note:** Odds are pre-match and do not update in-play. Live scores and match clock are fetched directly from ESPN in real time.

---

## 🏗️ Architecture

```
ESPN public API ──────────────────────────────────┐
  scoreboardv2  (matches + odds)                   │
  standings     (group tables)                     │
                                                   ▼
                              backend/scraper.js  (Node.js ESM)
                              polls every 15 min (local)
                              or --once (GitHub Actions)
                                                   │
                        ┌──────────────────────────┘
                        │
              frontend/public/data/
              ├── matches.json      ← all matches + odds + team info
              └── standings.json   ← group standings

                        │
              React 19 + Vite + TypeScript + Tailwind
              ├── useLiveMatches hook   ← polls matches.json every 30s
              │                           + overlays ESPN real-time
              │                             state/score/clock
              ├── Home      (hero + upcoming list)
              ├── Groups    (12 groups: standings + fixtures)
              ├── Standings (full standings table)
              └── Team      (per-team detail)
                        │
                   Vercel (static deploy)
              ESPN API proxy via vercel.json rewrites
              (avoids CORS in production)
```

**GitHub Actions** runs `node scraper.js --once` every 15 minutes, commits updated JSONs, and Vercel auto-redeploys on push.

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
node scraper.js          # polls every 15 min continuously
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
├── docs/
│   └── DATA_ANALYSIS.md               ← Data analyst reference
└── frontend/
    ├── public/data/
    │   ├── matches.json               ← Scraped match + odds data
    │   └── standings.json             ← Group standings
    ├── src/
    │   ├── hooks/
    │   │   ├── useLiveMatches.ts      ← Polls + ESPN real-time overlay
    │   │   └── useDominantColor.ts    ← Flag color extraction
    │   ├── components/
    │   │   ├── MatchDetailModal.tsx   ← Full odds + Poisson analysis
    │   │   ├── Nav.tsx
    │   │   ├── Footer.tsx
    │   │   └── ProgressBar.tsx
    │   ├── pages/
    │   │   ├── Home.tsx
    │   │   ├── Groups.tsx
    │   │   ├── Standings.tsx
    │   │   └── Team.tsx
    │   ├── i18n/                      ← EN/ES translations
    │   └── types.ts
    └── vercel.json                    ← ESPN API proxy rewrite rules
```

---

## 📦 Data sources

| Source | Role |
|---|---|
| ESPN `site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard` | Matches, odds (DraftKings), live scores |
| ESPN `site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings` | Group standings |
| [flagcdn.com](https://flagcdn.com) | Country flag images (w160 for retina) |

---

## ⚠️ Disclaimer

Odds sourced from DraftKings via ESPN public API. All probabilities are statistical estimates — **not betting advice**. Pre-match only; not updated in-play. 18+.

---

## 📄 License

MIT — free to use, fork, and build on.
