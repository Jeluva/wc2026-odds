/**
 * WC2026 Odds Scraper
 * Source: ESPN public API (no key required) — DraftKings odds embedded
 * Writes to frontend/public/data/{matches,standings}.json every 15 minutes
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'data')
const OUT_FILE = path.join(OUT_DIR, 'matches.json')
const STANDINGS_FILE = path.join(OUT_DIR, 'standings.json')

const REFRESH_MS     = 15 * 60 * 1000  // 15 minutes full scrape (matches Actions cron)
const LIVE_REFRESH_MS =     60 * 1000  // 1 minute when a match is live

// ESPN abbreviation → ISO 3166-1 alpha-2 (flagcdn.com codes)
const TEAM_ISO = {
  // CONCACAF
  USA: 'us', MEX: 'mx', CAN: 'ca', CRC: 'cr', HON: 'hn', PAN: 'pa',
  JAM: 'jm', SLV: 'sv', GTM: 'gt', CUB: 'cu', HAI: 'ht', TRI: 'tt',
  // CONMEBOL
  ARG: 'ar', BRA: 'br', COL: 'co', URU: 'uy', ECU: 'ec', VEN: 've',
  PER: 'pe', PAR: 'py', CHI: 'cl', BOL: 'bo',
  // UEFA
  FRA: 'fr', ENG: 'gb-eng', GER: 'de', ESP: 'es', POR: 'pt', ITA: 'it',
  NED: 'nl', BEL: 'be', CRO: 'hr', POL: 'pl', DEN: 'dk', SRB: 'rs',
  SUI: 'ch', AUT: 'at', TUR: 'tr', UKR: 'ua', SCO: 'gb-sct', WAL: 'gb-wls',
  SVK: 'sk', CZE: 'cz', HUN: 'hu', SLO: 'si', GRE: 'gr', ROU: 'ro',
  ALB: 'al', GEO: 'ge', ISL: 'is', NOR: 'no', SWE: 'se', FIN: 'fi',
  IRL: 'ie', KOS: 'xk', MKD: 'mk', BIH: 'ba', MNE: 'me', ARM: 'am',
  // AFC
  JPN: 'jp', KOR: 'kr', AUS: 'au', IRN: 'ir', SAU: 'sa', QAT: 'qa',
  IRQ: 'iq', JOR: 'jo', UZB: 'uz', OMA: 'om', BHR: 'bh', KWT: 'kw',
  UAE: 'ae', CHN: 'cn', IND: 'in', THA: 'th', VIE: 'vn', IDN: 'id',
  KSA: 'sa',
  // CAF
  MAR: 'ma', SEN: 'sn', NGA: 'ng', CMR: 'cm', GHA: 'gh', CIV: 'ci',
  TUN: 'tn', ALG: 'dz', EGY: 'eg', MLI: 'ml', GUI: 'gn', COD: 'cd',
  ZAF: 'za', RSA: 'za', ZIM: 'zw', MOZ: 'mz', TAN: 'tz', KEN: 'ke', ETH: 'et',
  BFA: 'bf', NER: 'ne', BEN: 'bj', TOG: 'tg', GAB: 'ga', COG: 'cg',
  CPV: 'cv', SLE: 'sl', LBR: 'lr', RWA: 'rw', BDI: 'bi',
  // CONCACAF / Caribbean
  CUW: 'cw',
  // OFC
  NZL: 'nz',
  // others
  PHI: 'ph', SIN: 'sg', MAL: 'my', TAH: 'pf',
}

// Returns the flagcdn URL for a known team, or null for placeholder/knockout
// slots (e.g. "RD32", "QFW1", "1A") and any unmapped abbreviation. We never guess
// an ISO code from the abbreviation — a wrong-but-valid code (e.g. RSA→"rs"=Serbia)
// silently renders the wrong country's flag, which is worse than no flag.
function isoFor(abbr) {
  return TEAM_ISO[abbr] ?? null
}

function flagUrl(abbr) {
  const iso = isoFor(abbr)
  return iso ? `https://flagcdn.com/w160/${iso}.png` : null
}

function parseML(str) {
  if (!str || str === 'EVEN') return str === 'EVEN' ? 100 : null
  const n = parseInt(str, 10)
  return isNaN(n) ? null : n
}

function mlToImplied(ml) {
  if (ml === null || ml === undefined) return null
  if (ml > 0) return 100 / (ml + 100)
  if (ml < 0) return Math.abs(ml) / (Math.abs(ml) + 100)
  return 1 / 3
}

function normalizePcts(home, draw, away) {
  const total = (home ?? 1/3) + (draw ?? 1/3) + (away ?? 1/3)
  return {
    homeWinPct: +((( home ?? 1/3) / total) * 100).toFixed(1),
    drawPct:    +((( draw ?? 1/3) / total) * 100).toFixed(1),
    awayWinPct: +((( away ?? 1/3) / total) * 100).toFixed(1),
  }
}

function parseTeam(competitor) {
  const t = competitor.team ?? competitor
  const abbr = t.abbreviation ?? ''
  return {
    id:       t.id ?? '',
    name:     t.displayName ?? t.name ?? abbr,
    abbr,
    color:    t.color ? `#${t.color}` : '#1a2d69',
    altColor: t.alternateColor ? `#${t.alternateColor}` : '#ffffff',
    isoCode:  isoFor(abbr) ?? '',
    flagUrl:  flagUrl(abbr),
    score:    competitor.score != null ? parseInt(competitor.score, 10) : null,
    winner:   competitor.winner ?? false,
  }
}

const NULL_EXTENDED = {
  homeMoneylineOpen: null, awayMoneylineOpen: null, drawMoneylineOpen: null,
  overOddsOpen: null, underOddsOpen: null,
  spreadHomeLine: null, spreadHomeOdds: null, spreadOddsOpen: null,
  dkHomeBetUrl: null, dkDrawBetUrl: null, dkAwayBetUrl: null,
  dkOverBetUrl: null, dkUnderBetUrl: null,
  dkHomeSpreadBetUrl: null, dkAwaySpreadBetUrl: null,
}

function parseOdds(oddsObj) {
  if (!oddsObj) return null
  try {
    const ml = oddsObj.moneyline ?? {}
    const homeML = parseML(ml.home?.current?.odds ?? ml.home?.close?.odds)
    const awayML = parseML(ml.away?.current?.odds ?? ml.away?.close?.odds)
    const drawML = parseML(
      ml.draw?.current?.odds ?? ml.draw?.close?.odds ??
      oddsObj.drawOdds?.moneyLine?.toString()
    )
    // No real odds data — don't emit a fake 33/33/33 object
    if (homeML === null && awayML === null && drawML === null) return null

    const pcts = normalizePcts(
      mlToImplied(homeML),
      mlToImplied(drawML),
      mlToImplied(awayML)
    )
    const total = oddsObj.total ?? {}
    const spread = oddsObj.pointSpread ?? {}
    return {
      homeMoneyline: ml.home?.current?.odds ?? ml.home?.close?.odds ?? null,
      awayMoneyline: ml.away?.current?.odds ?? ml.away?.close?.odds ?? null,
      drawMoneyline: ml.draw?.current?.odds ?? ml.draw?.close?.odds ?? oddsObj.drawOdds?.moneyLine?.toString() ?? null,
      ...NULL_EXTENDED,
      ...pcts,
      overUnder:    oddsObj.overUnder ?? null,
      overOdds:     total.over?.current?.odds ?? total.over?.close?.odds ?? oddsObj.overOdds?.toString() ?? null,
      underOdds:    total.under?.current?.odds ?? total.under?.close?.odds ?? oddsObj.underOdds?.toString() ?? null,
      spreadLine:   spread.away?.current?.line ?? spread.away?.close?.line ?? null,
      spreadOdds:   spread.away?.current?.odds ?? spread.away?.close?.odds ?? null,
      provider:     oddsObj.provider?.name ?? 'DraftKings',
    }
  } catch {
    return null
  }
}

function mapStatus(comp) {
  const s = comp.status
  if (!s) return { state: 'pre', detail: '' }
  const t = s.type ?? s
  if (t.state === 'post' || t.completed) return { state: 'post', detail: 'FT' }
  if (t.state === 'in') return { state: 'in', detail: t.shortDetail ?? t.displayClock ?? 'LIVE' }
  return { state: 'pre', detail: '' }
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
      'Accept': 'application/json',
    }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

async function fetchAllEvents() {
  // Full WC2026 group stage + knockouts: June 11 – July 19, 2026
  const url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200'
  const data = await fetchJson(url)
  return data.events ?? []
}

function dkCleanUrl(raw) {
  if (!raw) return null
  try {
    const preurl = new URL(raw).searchParams.get('preurl')
    return preurl ?? raw
  } catch {
    return raw
  }
}

async function enrichOddsFromSummary(eventId) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`
    const data = await fetchJson(url)
    const pc = Array.isArray(data.pickcenter) ? data.pickcenter[0] : data.pickcenter
    if (!pc) return null

    const ml = pc.moneyline ?? {}
    const total = pc.total ?? {}
    const spread = pc.pointSpread ?? {}

    // Moneyline close + open
    const homeMLStr = ml.home?.close?.odds ?? (pc.homeTeamOdds?.moneyLine != null ? String(pc.homeTeamOdds.moneyLine > 0 ? `+${pc.homeTeamOdds.moneyLine}` : pc.homeTeamOdds.moneyLine) : null)
    const awayMLStr = ml.away?.close?.odds ?? (pc.awayTeamOdds?.moneyLine != null ? String(pc.awayTeamOdds.moneyLine > 0 ? `+${pc.awayTeamOdds.moneyLine}` : pc.awayTeamOdds.moneyLine) : null)
    const drawMLStr = ml.draw?.close?.odds  ?? (pc.drawOdds?.moneyLine != null ? String(pc.drawOdds.moneyLine > 0 ? `+${pc.drawOdds.moneyLine}` : pc.drawOdds.moneyLine) : null)
    const homeMLOpen = ml.home?.open?.odds ?? null
    const awayMLOpen = ml.away?.open?.odds ?? null
    const drawMLOpen = ml.draw?.open?.odds ?? null

    // O/U close + open
    const overOdds  = total.over?.close?.odds  ?? (pc.overOdds  != null ? String(pc.overOdds  > 0 ? `+${Math.round(pc.overOdds)}`  : Math.round(pc.overOdds))  : null)
    const underOdds = total.under?.close?.odds ?? (pc.underOdds != null ? String(pc.underOdds > 0 ? `+${Math.round(pc.underOdds)}` : Math.round(pc.underOdds)) : null)
    const overOddsOpen  = total.over?.open?.odds  ?? null
    const underOddsOpen = total.under?.open?.odds ?? null
    const ouLine = total.over?.close?.line
    const overUnder = ouLine ? parseFloat(ouLine.replace(/[ou]/i, '')) : (pc.overUnder ?? null)

    // Spread/handicap both sides
    const spreadLine     = spread.away?.close?.line ?? (pc.spread != null ? `${pc.spread > 0 ? '+' : ''}${pc.spread}` : null)
    const spreadOdds     = spread.away?.close?.odds ?? null
    const spreadOddsOpen = spread.away?.open?.odds  ?? null
    const spreadHomeLine = spread.home?.close?.line ?? null
    const spreadHomeOdds = spread.home?.close?.odds ?? null

    // DraftKings deep-link URLs (extract preurl to bypass tracking placeholders)
    const dkHomeBetUrl       = dkCleanUrl(ml.home?.close?.link?.href)
    const dkDrawBetUrl       = dkCleanUrl(ml.draw?.close?.link?.href)
    const dkAwayBetUrl       = dkCleanUrl(ml.away?.close?.link?.href)
    const dkOverBetUrl       = dkCleanUrl(total.over?.close?.link?.href)
    const dkUnderBetUrl      = dkCleanUrl(total.under?.close?.link?.href)
    const dkHomeSpreadBetUrl = dkCleanUrl(spread.home?.close?.link?.href)
    const dkAwaySpreadBetUrl = dkCleanUrl(spread.away?.close?.link?.href)

    if (homeMLStr === null && awayMLStr === null && drawMLStr === null) return null

    const pcts = normalizePcts(
      mlToImplied(parseML(homeMLStr)),
      mlToImplied(parseML(drawMLStr)),
      mlToImplied(parseML(awayMLStr))
    )
    return {
      homeMoneyline: homeMLStr,
      awayMoneyline: awayMLStr,
      drawMoneyline: drawMLStr,
      homeMoneylineOpen: homeMLOpen,
      awayMoneylineOpen: awayMLOpen,
      drawMoneylineOpen: drawMLOpen,
      ...pcts,
      overUnder,
      overOdds,
      underOdds,
      overOddsOpen,
      underOddsOpen,
      spreadLine,
      spreadOdds,
      spreadOddsOpen,
      spreadHomeLine,
      spreadHomeOdds,
      dkHomeBetUrl,
      dkDrawBetUrl,
      dkAwayBetUrl,
      dkOverBetUrl,
      dkUnderBetUrl,
      dkHomeSpreadBetUrl,
      dkAwaySpreadBetUrl,
      provider: 'DraftKings',
    }
  } catch (e) {
    return null
  }
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function buildMatch(event) {
  const comp = event.competitions?.[0]
  if (!comp) return null
  const competitors = comp.competitors ?? []
  const home = competitors.find(c => c.homeAway === 'home') ?? competitors[0]
  const away = competitors.find(c => c.homeAway === 'away') ?? competitors[1]
  if (!home || !away) return null

  const homeTeam = parseTeam(home)
  const awayTeam = parseTeam(away)
  const status   = mapStatus(comp)
  const oddsData = parseOdds(comp.odds)
  const noteMatch = (comp.altGameNote ?? '').match(/Group ([A-L])/i)
  const group = noteMatch ? `Group ${noteMatch[1]}` : (comp.groups?.abbreviation ?? event.season?.slug?.replace(/-/g, ' ') ?? '')
  const espnLinks = event.links ?? []
  const espnUrl = espnLinks.find(l => l.rel?.includes?.('summary') && l.rel?.includes?.('desktop'))?.href
    ?? `https://www.espn.com/soccer/match/_/gameId/${event.id}`

  return {
    id:          event.id,
    date:        comp.date ?? event.date,
    name:        event.name,
    group,
    venue:       comp.venue?.displayName ?? event.venue?.fullName ?? '',
    statusState: status.state,
    statusDetail: status.detail,
    home:        homeTeam,
    away:        awayTeam,
    odds:        oddsData,
    espnUrl,
  }
}

function computeStandings(matches) {
  const groups = {}
  for (const m of matches) {
    if (!m.group || m.statusState !== 'post') continue
    if (!/^Group [A-L]$/i.test(m.group)) continue
    if (!groups[m.group]) groups[m.group] = {}
    const grp = groups[m.group]
    const hg = m.home.score ?? 0
    const ag = m.away.score ?? 0
    for (const [team, gf, ga] of [[m.home, hg, ag], [m.away, ag, hg]]) {
      if (!grp[team.id]) grp[team.id] = {
        id: team.id, name: team.name, abbr: team.abbr,
        color: team.color, altColor: team.altColor,
        isoCode: team.isoCode, flagUrl: team.flagUrl,
        played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, gd: 0, pts: 0,
      }
      const entry = grp[team.id]
      entry.played++
      entry.gf += gf
      entry.ga += ga
      entry.gd = entry.gf - entry.ga
      if (gf > ga) { entry.won++;  entry.pts += 3 }
      else if (gf === ga) { entry.drawn++; entry.pts += 1 }
      else { entry.lost++ }
    }
  }
  // Convert to sorted array per group
  const result = {}
  for (const [gName, teams] of Object.entries(groups)) {
    result[gName] = Object.values(teams).sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
    )
  }
  return result
}

async function scrape() {
  console.log(`[${new Date().toISOString()}] Fetching WC2026 data from ESPN...`)
  try {
    const events = await fetchAllEvents()
    const matches = events.map(buildMatch).filter(Boolean)
    matches.sort((a, b) => new Date(a.date) - new Date(b.date))

    // Enrich upcoming matches (next 7 days) with per-event odds
    const now = Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    const upcoming = matches.filter(m =>
      (m.statusState === 'pre' || m.statusState === 'in') &&
      new Date(m.date).getTime() - now < sevenDays
    )
    console.log(`Enriching odds for ${upcoming.length} upcoming matches...`)
    for (const m of upcoming) {
      const enriched = await enrichOddsFromSummary(m.id)
      if (enriched) m.odds = enriched
      await delay(150) // be polite to ESPN
    }

    const standings = computeStandings(matches)
    const payload = { updated: new Date().toISOString(), matches }
    const standingsPayload = { updated: new Date().toISOString(), standings }
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2))
    fs.writeFileSync(STANDINGS_FILE, JSON.stringify(standingsPayload, null, 2))
    const withOdds = matches.filter(m => m.odds?.homeMoneyline != null).length
    const liveCount = matches.filter(m => m.statusState === 'in').length
    console.log(`[${new Date().toISOString()}] Done. ${matches.length} matches, ${withOdds} with odds, ${liveCount} live.`)
    return liveCount > 0
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Scrape failed:`, err.message)
    return false
  }
}

const runOnce = process.argv.includes('--once')
if (runOnce) {
  scrape()
} else {
  // Dynamic interval: 1 minute while live, 5 minutes otherwise
  let timer
  async function runLoop() {
    const isLive = await scrape()
    const nextMs = isLive ? LIVE_REFRESH_MS : REFRESH_MS
    console.log(`Next refresh in ${nextMs / 1000}s${isLive ? ' (live match active)' : ''}`)
    timer = setTimeout(runLoop, nextMs)
  }
  runLoop()
}
