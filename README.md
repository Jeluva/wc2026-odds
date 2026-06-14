# ⚽ WC 2026 Odds — World Cup Predictor

![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-automated-2088FF?style=flat-square&logo=githubactions&logoColor=white)

> **ML-powered 2026 FIFA World Cup predictions** — championship win probabilities for all 48 teams, updated daily from 10,000 Monte Carlo tournament simulations.

## 🌐 Live Demo

> Deploy to Vercel and add your URL here

---

## 📊 What it shows

| Section | Description |
|---|---|
| **Ranking** | All 48 teams ranked by win probability with QF/Semi/Final progression |
| **Groups** | Live group standings + match results for Groups A–L |
| **Bracket** | Full knockout bracket with per-slot win probabilities |
| **Team Detail** | Individual team page: stats, progression chart, matches |

Available in **English and Spanish** (toggle in nav).

---

## 🧠 Methodology

### 1 · Historical data
International results since 1872 sourced from [martj42/international_results](https://github.com/martj42/international_results) (25,000+ matches). FIFA rankings provide the current team strength baseline.

### 2 · ML prediction model
A **Gradient Boosting Classifier** (scikit-learn) is trained on 25,000+ international fixtures using 9 engineered features per match:

| Feature | Description |
|---|---|
| `elo_diff` | Dynamic ELO rating gap (updated after every match, K=32, decay=0.85/yr) |
| `home_form_scored` | Rolling avg goals scored (last 15 matches) |
| `home_form_conceded` | Rolling avg goals conceded (last 15 matches) |
| `away_form_scored` | Same for the away team |
| `away_form_conceded` | Same for the away team |
| `h2h_home_win_rate` | Head-to-head historical win rate |
| `h2h_draw_rate` | Head-to-head historical draw rate |

Final match probability blends the ML model with a **Poisson goal distribution** model (70%/30%) to smooth extreme edge cases.

### 3 · Monte Carlo simulation
The full 48-team 2026 tournament bracket is simulated **10,000 times** from scratch each run. Each simulation:
1. Samples match outcomes from the hybrid model probabilities
2. Builds 12 group tables (pts → GD → GF tiebreakers)
3. Advances top 2 per group + 8 best third-placed teams to the R32
4. Runs all knockout rounds through the Final

After 10,000 runs, each team's win count / 10,000 = their championship probability.

### 4 · Bookmaker calibration
Final probabilities are blended with de-vigged bookmaker market odds at a **40% model / 60% market** ratio. Bookmaker odds encode real-time squad news, injuries, and tactical information that historical data alone cannot capture.

---

## 🏗️ Architecture

```
martj42 data ─────────────────────────────────┐
FIFA rankings ─────────────────────────────────┤
                                               ▼
                              data-pipeline/fetch_data.py
                                               │
                              data-pipeline/run_predictions.py
                              (GBM train → MC 10,000 sims)
                                               │
                              data-pipeline/blend_odds.py
                              (40% model + 60% bookmaker odds)
                                               │
                              data-pipeline/export_json.py
                                               │
                        ┌──────────────────────┼──────────────────────┐
                        │                      │                      │
              champion_probs.json       match_results.json       bracket.json
                        │                      │                      │
                        └──────────────────────┴──────────────────────┘
                                               │
                          frontend/public/data/ (static JSON)
                                               │
                          React + Vite + TypeScript + Tailwind
                          ├── Home    (ranking + top 3 cards)
                          ├── Groups  (standings + results)
                          ├── Bracket (knockout + odds)
                          └── Team    (detail + progression)
                                               │
                                        Vercel Deploy
                                (auto-redeploy on every git push)
```

**GitHub Actions** runs the Python pipeline daily at 06:00 UTC, commits updated JSONs, and triggers an automatic Vercel redeploy.

---

## 🚀 Quick start

### Frontend only (pre-built data)

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
```

### Full pipeline

```bash
cd data-pipeline
pip install -r requirements.txt
python fetch_data.py          # downloads martj42 + FIFA data
python run_predictions.py     # trains GBM, runs 10,000 MC sims
python blend_odds.py          # blends with bookmaker odds
python export_json.py         # writes outputs/*.json

cp outputs/*.json ../frontend/public/data/
cd ../frontend && npm run dev
```

---

## 📁 Project structure

```
WC2026ODDS/
├── .github/workflows/update-data.yml  ← Daily automation
├── data-pipeline/
│   ├── fetch_data.py                  ← martj42 + FIFA downloader
│   ├── run_predictions.py             ← GBM + Monte Carlo engine
│   ├── blend_odds.py                  ← Bookmaker blending
│   ├── export_json.py                 ← JSON normalizer
│   └── outputs/                       ← Generated JSONs (committed)
└── frontend/
    ├── src/
    │   ├── i18n/                      ← EN/ES translations + context
    │   ├── components/                ← TeamCard, RankingTable, MatchCard...
    │   └── pages/                     ← Home, Groups, Bracket, Team
    └── vercel.json
```

---

## 📦 Data sources

| Source | Role |
|---|---|
| [martj42/international_results](https://github.com/martj42/international_results) | 25,000+ historical international matches |
| [SasiruVirajith/fifa-world-cup-2026-predictor](https://github.com/SasiruVirajith/fifa-world-cup-2026-predictor) | GBM match model + Monte Carlo architecture |
| [kunalkongari/FifaWorldCupOracle-ML](https://github.com/kunalkongari/FifaWorldCupOracle-ML) | XGBoost + Poisson hybrid reference |
| [IoakeimKyrgiafinis/WorldCup2026ML](https://github.com/IoakeimKyrgiafinis/WorldCup2026ML-MonteCarloSimulationPrediction) | Bookmaker blending methodology |
| FIFA Rankings API | Current team strength baseline |

---

## ⚠️ Disclaimer

All outputs are **statistical estimates based on historical data** — not betting advice. Football outcomes are inherently stochastic and this model explicitly leaves ~28–35% probability for upsets in any given match.

---

## 📄 License

MIT — free to use, fork, and build on.
