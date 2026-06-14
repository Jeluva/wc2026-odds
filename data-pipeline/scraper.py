"""
WC 2026 Odds Scraper
====================
Scrapes real-time odds and standings from:
  - OddsPortal  (champion win odds)
  - cuotasahora.com  (AI forecast probabilities)
  - Wikipedia / CBS Sports  (group standings & match results)

Usage:
    pip install playwright requests beautifulsoup4
    playwright install chromium
    python scraper.py

Outputs (written to ../frontend/public/data/):
    champion_probs.json   - win % per team
    groups.json           - group standings
    match_results.json    - all fixtures + results
"""

import asyncio
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import async_playwright, Page

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent
OUT_DIR = ROOT / "outputs"
PUB_DIR = ROOT.parent / "frontend" / "public" / "data"
OUT_DIR.mkdir(exist_ok=True)
PUB_DIR.mkdir(parents=True, exist_ok=True)

# ── Team metadata (flags, groups) ────────────────────────────────────────────
TEAM_META: dict[str, dict] = {
    "France":               {"id": "FRA", "flag": "🇫🇷", "group": "I", "elo": 2006},
    "Spain":                {"id": "ESP", "flag": "🇪🇸", "group": "H", "elo": 1998},
    "Portugal":             {"id": "POR", "flag": "🇵🇹", "group": "K", "elo": 1975},
    "England":              {"id": "ENG", "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "group": "L", "elo": 1968},
    "Argentina":            {"id": "ARG", "flag": "🇦🇷", "group": "J", "elo": 1964},
    "Brazil":               {"id": "BRA", "flag": "🇧🇷", "group": "C", "elo": 1958},
    "Netherlands":          {"id": "NED", "flag": "🇳🇱", "group": "F", "elo": 1940},
    "Germany":              {"id": "GER", "flag": "🇩🇪", "group": "E", "elo": 1936},
    "United States":        {"id": "USA", "flag": "🇺🇸", "group": "D", "elo": 1830},
    "Norway":               {"id": "NOR", "flag": "🇳🇴", "group": "I", "elo": 1860},
    "Belgium":              {"id": "BEL", "flag": "🇧🇪", "group": "G", "elo": 1880},
    "Mexico":               {"id": "MEX", "flag": "🇲🇽", "group": "A", "elo": 1820},
    "Colombia":             {"id": "COL", "flag": "🇨🇴", "group": "K", "elo": 1824},
    "Japan":                {"id": "JPN", "flag": "🇯🇵", "group": "F", "elo": 1836},
    "Morocco":              {"id": "MAR", "flag": "🇲🇦", "group": "C", "elo": 1840},
    "Uruguay":              {"id": "URU", "flag": "🇺🇾", "group": "H", "elo": 1858},
    "South Korea":          {"id": "KOR", "flag": "🇰🇷", "group": "A", "elo": 1826},
    "Croatia":              {"id": "CRO", "flag": "🇭🇷", "group": "L", "elo": 1860},
    "Senegal":              {"id": "SEN", "flag": "🇸🇳", "group": "I", "elo": 1858},
    "Switzerland":          {"id": "SUI", "flag": "🇨🇭", "group": "B", "elo": 1835},
    "Austria":              {"id": "AUT", "flag": "🇦🇹", "group": "J", "elo": 1840},
    "Turkey":               {"id": "TUR", "flag": "🇹🇷", "group": "D", "elo": 1838},
    "Turkiye":              {"id": "TUR", "flag": "🇹🇷", "group": "D", "elo": 1838},
    "Sweden":               {"id": "SWE", "flag": "🇸🇪", "group": "F", "elo": 1825},
    "Ivory Coast":          {"id": "CIV", "flag": "🇨🇮", "group": "E", "elo": 1822},
    "Ecuador":              {"id": "ECU", "flag": "🇪🇨", "group": "E", "elo": 1818},
    "Algeria":              {"id": "ALG", "flag": "🇩🇿", "group": "J", "elo": 1815},
    "Scotland":             {"id": "SCO", "flag": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "group": "C", "elo": 1820},
    "Egypt":                {"id": "EGY", "flag": "🇪🇬", "group": "G", "elo": 1818},
    "Ghana":                {"id": "GHA", "flag": "🇬🇭", "group": "L", "elo": 1808},
    "Tunisia":              {"id": "TUN", "flag": "🇹🇳", "group": "F", "elo": 1812},
    "Australia":            {"id": "AUS", "flag": "🇦🇺", "group": "D", "elo": 1820},
    "Czech Republic":       {"id": "CZE", "flag": "🇨🇿", "group": "A", "elo": 1825},
    "Czechia":              {"id": "CZE", "flag": "🇨🇿", "group": "A", "elo": 1825},
    "Bosnia and Herzegovina": {"id": "BIH", "flag": "🇧🇦", "group": "B", "elo": 1832},
    "Bosnia & Herzegovina": {"id": "BIH", "flag": "🇧🇦", "group": "B", "elo": 1832},
    "Qatar":                {"id": "QAT", "flag": "🇶🇦", "group": "B", "elo": 1750},
    "Iran":                 {"id": "IRN", "flag": "🇮🇷", "group": "G", "elo": 1805},
    "Saudi Arabia":         {"id": "SAU", "flag": "🇸🇦", "group": "H", "elo": 1758},
    "DR Congo":             {"id": "COD", "flag": "🇨🇩", "group": "K", "elo": 1780},
    "Cape Verde":           {"id": "CPV", "flag": "🇨🇻", "group": "H", "elo": 1770},
    "Paraguay":             {"id": "PAR", "flag": "🇵🇾", "group": "D", "elo": 1808},
    "Canada":               {"id": "CAN", "flag": "🇨🇦", "group": "B", "elo": 1822},
    "Panama":               {"id": "PAN", "flag": "🇵🇦", "group": "L", "elo": 1755},
    "Uzbekistan":           {"id": "UZB", "flag": "🇺🇿", "group": "K", "elo": 1760},
    "New Zealand":          {"id": "NZL", "flag": "🇳🇿", "group": "G", "elo": 1750},
    "South Africa":         {"id": "RSA", "flag": "🇿🇦", "group": "A", "elo": 1788},
    "Haiti":                {"id": "HTI", "flag": "🇭🇹", "group": "C", "elo": 1680},
    "Jordan":               {"id": "JOR", "flag": "🇯🇴", "group": "J", "elo": 1720},
    "Iraq":                 {"id": "IRQ", "flag": "🇮🇶", "group": "I", "elo": 1745},
    "Curaçao":              {"id": "CUW", "flag": "🇨🇼", "group": "E", "elo": 1710},
    "Curacao":              {"id": "CUW", "flag": "🇨🇼", "group": "E", "elo": 1710},
}


def find_team(name: str) -> dict | None:
    """Fuzzy match a scraped team name to our metadata."""
    name = name.strip()
    if name in TEAM_META:
        return TEAM_META[name]
    # partial match
    for key, meta in TEAM_META.items():
        if key.lower() in name.lower() or name.lower() in key.lower():
            return meta
    return None


# ── OddsPortal scraper ────────────────────────────────────────────────────────
async def scrape_oddsportal(page: Page) -> list[dict]:
    """Scrape outright winner odds from OddsPortal."""
    print("→ OddsPortal: loading outright odds...")
    await page.goto(
        "https://www.oddsportal.com/football/world/world-cup-2026/outrights/",
        wait_until="networkidle",
        timeout=60_000,
    )
    await page.wait_for_timeout(3000)

    # OddsPortal renders via JS. Extract team rows from the outright table.
    rows = await page.query_selector_all("div[class*='OutrightTableRow']")
    if not rows:
        # fallback: look for table rows with team names + odds
        rows = await page.query_selector_all("tr[class*='table-main']")

    results: list[dict] = []
    for row in rows:
        text = (await row.inner_text()).strip()
        if not text:
            continue
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        if not lines:
            continue

        team_name = lines[0]
        meta = find_team(team_name)
        if not meta:
            continue

        # Try to extract a decimal odd or implied probability
        odds_val: float | None = None
        for token in lines[1:]:
            try:
                val = float(token.replace(",", "."))
                if 1.5 < val < 500:   # sanity-check: decimal odds range
                    odds_val = val
                    break
            except ValueError:
                pass

        if odds_val is not None:
            # Convert decimal odds to implied probability (%)
            win_pct = round(100 / odds_val, 2)
        else:
            win_pct = 0.0

        results.append({
            "team": team_name,
            "meta": meta,
            "win_pct": win_pct,
            "decimal_odds": odds_val,
        })

    print(f"   OddsPortal: found {len(results)} teams")
    return results


# ── cuotasahora.com scraper ───────────────────────────────────────────────────
async def scrape_cuotasahora(page: Page) -> list[dict]:
    """Scrape AI forecast probabilities from cuotasahora.com."""
    print("→ cuotasahora.com: loading AI forecast...")
    try:
        await page.goto(
            "https://cuotasahora.com",
            wait_until="networkidle",
            timeout=60_000,
        )
        await page.wait_for_timeout(2000)

        # Search for World Cup winner section
        content = await page.content()
        # Look for team probability patterns in the page HTML
        matches = re.findall(
            r'([A-ZÁÉÍÓÚa-záéíóúñü\s\-]+)\s*[:\-–]\s*(\d+(?:[.,]\d+)?)\s*%',
            content, re.IGNORECASE
        )

        results: list[dict] = []
        for name, pct_str in matches:
            meta = find_team(name.strip())
            if meta:
                pct = float(pct_str.replace(",", "."))
                if 0 < pct < 100:
                    results.append({"team": name.strip(), "meta": meta, "win_pct": pct})

        print(f"   cuotasahora.com: found {len(results)} teams")
        return results
    except Exception as e:
        print(f"   cuotasahora.com: failed ({e}), skipping")
        return []


# ── Wikipedia standings scraper ───────────────────────────────────────────────
GROUP_WIKI: dict[str, str] = {
    "A": "2026_FIFA_World_Cup_Group_A",
    "B": "2026_FIFA_World_Cup_Group_B",
    "C": "2026_FIFA_World_Cup_Group_C",
    "D": "2026_FIFA_World_Cup_Group_D",
    "E": "2026_FIFA_World_Cup_Group_E",
    "F": "2026_FIFA_World_Cup_Group_F",
    "G": "2026_FIFA_World_Cup_Group_G",
    "H": "2026_FIFA_World_Cup_Group_H",
    "I": "2026_FIFA_World_Cup_Group_I",
    "J": "2026_FIFA_World_Cup_Group_J",
    "K": "2026_FIFA_World_Cup_Group_K",
    "L": "2026_FIFA_World_Cup_Group_L",
}


async def scrape_group_standings(page: Page, group_id: str) -> dict | None:
    """Scrape a single group's standings from Wikipedia."""
    wiki_name = GROUP_WIKI[group_id]
    url = f"https://en.wikipedia.org/wiki/{wiki_name}"
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
    except Exception as e:
        print(f"   Group {group_id}: timeout ({e})")
        return None

    # Find the standings table (wikitable with P W D L columns)
    tables = await page.query_selector_all("table.wikitable")
    for table in tables:
        headers = await table.query_selector_all("th")
        header_texts = [await h.inner_text() for h in headers]
        flat = " ".join(header_texts).upper()
        if "PTS" in flat and ("PLD" in flat or "MP" in flat or "P\n" in flat):
            rows = await table.query_selector_all("tr")
            teams: list[dict] = []
            for row in rows[1:]:
                cols = await row.query_selector_all("td")
                if len(cols) < 8:
                    continue
                texts = [await c.inner_text() for c in cols]
                texts = [t.strip().split("\n")[0] for t in texts]
                try:
                    name = texts[0]
                    meta = find_team(name)
                    if not meta:
                        continue
                    mp  = int(texts[1]) if texts[1].isdigit() else 0
                    w   = int(texts[2]) if texts[2].isdigit() else 0
                    d   = int(texts[3]) if texts[3].isdigit() else 0
                    l   = int(texts[4]) if texts[4].isdigit() else 0
                    gf  = int(texts[5]) if texts[5].isdigit() else 0
                    ga  = int(texts[6]) if texts[6].isdigit() else 0
                    pts = int(texts[-1]) if texts[-1].isdigit() else 0
                    teams.append({
                        "id": meta["id"], "name": name, "flag": meta["flag"],
                        "played": mp, "won": w, "drawn": d, "lost": l,
                        "gf": gf, "ga": ga, "gd": gf - ga, "pts": pts,
                    })
                except (ValueError, IndexError):
                    continue
            if teams:
                print(f"   Group {group_id}: {len(teams)} teams scraped")
                return {"id": group_id, "teams": teams}

    print(f"   Group {group_id}: table not found or no data yet")
    return None


async def scrape_match_results(page: Page, group_id: str) -> list[dict]:
    """Scrape match results for a group from Wikipedia."""
    wiki_name = GROUP_WIKI[group_id]
    url = f"https://en.wikipedia.org/wiki/{wiki_name}"
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
    except Exception:
        return []

    results: list[dict] = []
    # Look for match result tables / infoboxes
    match_elements = await page.query_selector_all(".football-match-info, .wikitable[class*='match']")
    # Fallback: parse page text for score patterns like "Team A 2–1 Team B"
    content = await page.inner_text("body")
    # Pattern: captures "Team 2–1 Team" or "Team 2 - 1 Team"
    score_patterns = re.findall(
        r'([A-ZÁÉa-záé\s\-]+?)\s+(\d)\s*[–\-]\s*(\d)\s+([A-ZÁÉa-záé\s\-]+)',
        content
    )
    match_id_counter = 0
    for home_name, hg, ag, away_name in score_patterns:
        home_meta = find_team(home_name.strip())
        away_meta = find_team(away_name.strip())
        if home_meta and away_meta and home_meta["group"] == group_id:
            match_id_counter += 1
            results.append({
                "id": f"wiki_{group_id}_{match_id_counter}",
                "stage": "group",
                "group": group_id,
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "home": home_meta["id"],
                "away": away_meta["id"],
                "home_goals": int(hg),
                "away_goals": int(ag),
                "status": "finished",
            })
    return results[:3]  # max 3 finished matches per group in group stage


# ── Merge & normalise ─────────────────────────────────────────────────────────
def merge_odds(oddsportal: list[dict], cuotasahora: list[dict]) -> list[dict]:
    """
    Merge OddsPortal market odds with cuotasahora AI forecasts.
    OddsPortal is weighted 70%, cuotasahora 30%.
    """
    by_id: dict[str, dict] = {}

    for item in oddsportal:
        tid = item["meta"]["id"]
        by_id[tid] = {
            "win_pct_op": item["win_pct"],
            "win_pct_ca": None,
            "meta": item["meta"],
        }

    for item in cuotasahora:
        tid = item["meta"]["id"]
        if tid in by_id:
            by_id[tid]["win_pct_ca"] = item["win_pct"]
        else:
            by_id[tid] = {
                "win_pct_op": None,
                "win_pct_ca": item["win_pct"],
                "meta": item["meta"],
            }

    probs: list[dict] = []
    for tid, data in by_id.items():
        op = data["win_pct_op"]
        ca = data["win_pct_ca"]
        meta = data["meta"]

        if op is not None and ca is not None:
            win_pct = round(op * 0.7 + ca * 0.3, 2)
        elif op is not None:
            win_pct = op
        else:
            win_pct = ca or 0.0

        # Estimate stage probabilities from win_pct using empirical scaling
        qf_pct   = round(min(win_pct * 4.0, 95.0), 1)
        semi_pct = round(min(win_pct * 2.5, 80.0), 1)
        final_pct = round(min(win_pct * 1.7, 65.0), 1)

        probs.append({
            "id":         meta["id"],
            "name":       list(TEAM_META.keys())[[v["id"] for v in TEAM_META.values()].index(meta["id"])],
            "flag":       meta["flag"],
            "win_pct":    win_pct,
            "qf_pct":     qf_pct,
            "semi_pct":   semi_pct,
            "final_pct":  final_pct,
            "group":      meta["group"],
            "elo":        meta["elo"],
        })

    return sorted(probs, key=lambda x: x["win_pct"], reverse=True)


# ── Save helpers ──────────────────────────────────────────────────────────────
def save(name: str, data: object) -> None:
    for path in [OUT_DIR / name, PUB_DIR / name]:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✓ Saved {name}")


# ── Main ──────────────────────────────────────────────────────────────────────
async def main() -> None:
    print(f"\n{'='*50}")
    print(f"  WC2026 Odds Scraper — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*50}\n")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()

        # 1. Champion odds
        op_data = await scrape_oddsportal(page)
        ca_data = await scrape_cuotasahora(page)

        if op_data or ca_data:
            champion_probs = merge_odds(op_data, ca_data)
            save("champion_probs.json", champion_probs)
        else:
            print("⚠  No odds data scraped — keeping existing file")

        # 2. Group standings
        groups_data: list[dict] = []
        matches_data: list[dict] = []
        match_counter = 1

        for gid in "ABCDEFGHIJKL":
            group = await scrape_group_standings(page, gid)
            if group:
                groups_data.append(group)
            await page.wait_for_timeout(800)   # be polite to Wikipedia

        if groups_data:
            save("groups.json", groups_data)
        else:
            print("⚠  No group standings scraped — keeping existing file")

        await browser.close()

    print(f"\n✅ Done — {datetime.now().strftime('%H:%M:%S')}\n")


if __name__ == "__main__":
    asyncio.run(main())
