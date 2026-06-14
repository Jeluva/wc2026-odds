import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { ScrapedMatch } from '../types'
import { useDominantColor } from '../hooks/useDominantColor'

// ─── Local types ─────────────────────────────────────────────────────────────

type Tab = 'odds' | 'form' | 'analysis' | 'chatbot'

interface FormGame {
  result: 'W' | 'D' | 'L'
  goalsFor: number
  goalsAgainst: number
  opponentName: string
  opponentLogo: string
  competition: string
  date: string
}

interface TeamFormData {
  teamId: string
  games: FormGame[]
}

interface DetailData {
  homeForm: TeamFormData | null
  awayForm: TeamFormData | null
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function mlToImplied(ml: string | null | undefined): number | null {
  if (!ml) return null
  const n = parseInt(ml, 10)
  if (isNaN(n)) return null
  if (n > 0) return 100 / (n + 100)
  return Math.abs(n) / (Math.abs(n) + 100)
}

// Percentage shown when we have a pair of outcomes (O/U, spread)
function normalizedPctPair(ml1: string | null, ml2: string | null): [number, number] | null {
  const p1 = mlToImplied(ml1)
  const p2 = mlToImplied(ml2)
  if (!p1 || !p2) return null
  const t = p1 + p2
  return [+(p1 / t * 100).toFixed(1), +(p2 / t * 100).toFixed(1)]
}

// Odds-line movement — 'in' = team became more likely, 'out' = less likely
type Movement = 'in' | 'out' | null
function oddsMovement(open: string | null | undefined, close: string | null | undefined): Movement {
  if (!open || !close) return null
  const o = parseInt(open, 10)
  const c = parseInt(close, 10)
  if (isNaN(o) || isNaN(c)) return null
  if (c > o + 4) return 'out'  // drifted: team less likely now
  if (c < o - 4) return 'in'  // shortened: team more likely now
  return null
}

function poisson(λ: number, k: number): number {
  let p = Math.exp(-λ)
  for (let i = 1; i <= k; i++) p *= λ / i
  return p
}

function topScorelines(λH: number, λA: number): Array<{ h: number; a: number; pct: number }> {
  const lines = []
  for (let h = 0; h <= 5; h++)
    for (let a = 0; a <= 5; a++)
      lines.push({ h, a, pct: poisson(λH, h) * poisson(λA, a) * 100 })
  return lines.sort((x, y) => y.pct - x.pct).slice(0, 8)
}

function formAvgGoals(games: FormGame[]) {
  if (!games.length) return { scored: 0, conceded: 0 }
  return {
    scored: games.reduce((s, g) => s + g.goalsFor, 0) / games.length,
    conceded: games.reduce((s, g) => s + g.goalsAgainst, 0) / games.length,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProbBar({ homePct, drawPct, awayPct, homeLabel, awayLabel }: {
  homePct: number; drawPct: number; awayPct: number
  homeLabel: string; awayLabel: string
}) {
  return (
    <div>
      <div className="flex rounded-xl overflow-hidden h-9 text-[11px] font-black">
        <div className="flex items-center justify-center text-pitch"
          style={{ width: `${homePct}%`, background: 'linear-gradient(90deg, #22c55e, #16a34a)' }}>
          {homePct >= 16 && `${homePct}%`}
        </div>
        <div className="flex items-center justify-center text-chalk/70"
          style={{ width: `${drawPct}%`, background: 'rgba(255,255,255,0.1)' }}>
          {drawPct >= 13 && `${drawPct}%`}
        </div>
        <div className="flex items-center justify-center text-pitch"
          style={{ width: `${awayPct}%`, background: 'linear-gradient(90deg, #f5a623, #e8890a)' }}>
          {awayPct >= 16 && `${awayPct}%`}
        </div>
      </div>
      <div className="flex justify-between text-[10px] mt-1 px-0.5">
        <span className="text-green-400 font-bold">{homeLabel} {homePct}%</span>
        <span className="text-fog">Draw {drawPct}%</span>
        <span className="text-amber-400 font-bold">{awayLabel} {awayPct}%</span>
      </div>
    </div>
  )
}

// Movement badge — ▲ if more likely now, ▼ if less likely
function MovementBadge({ dir }: { dir: Movement }) {
  if (!dir) return null
  return dir === 'in'
    ? <span className="text-[9px] font-black text-green-400 leading-none" title="More likely than at open">▲</span>
    : <span className="text-[9px] font-black text-red-400 leading-none" title="Less likely than at open">▼</span>
}

interface MarketRowProps {
  label: string
  pct: number           // 0-100 to display
  barColor?: string
  openML?: string | null
  closeML?: string | null
  note?: string
}

function MarketRow({ label, pct, barColor, openML, closeML, note }: MarketRowProps) {
  const dir = oddsMovement(openML, closeML)
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="min-w-[110px] max-w-[140px]">
        <span className="text-xs text-chalk/80 leading-tight">{label}</span>
        {note && <span className="block text-[10px] text-fog/50 mt-0.5">{note}</span>}
      </div>
      <div className="flex-1 h-2 rounded-full bg-white/[0.07] overflow-hidden">
        <div className="h-full rounded-full"
          style={{ width: `${Math.min(pct, 100)}%`, background: barColor || 'rgba(245,166,35,0.6)' }} />
      </div>
      <div className="flex items-center gap-1 min-w-[58px] justify-end">
        <span className="text-sm font-black text-gold">{pct.toFixed(0)}%</span>
        <MovementBadge dir={dir} />
      </div>
    </div>
  )
}

function MarketSection({ title, desc, children }: {
  title: string; desc?: string; children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] overflow-hidden"
      style={{ background: 'rgba(18,28,50,0.7)' }}>
      <div className="px-4 py-2.5 border-b border-white/[0.06]">
        <span className="text-[10px] font-black text-fog uppercase tracking-widest">{title}</span>
        {desc && <span className="ml-2 text-[10px] text-fog/40">{desc}</span>}
      </div>
      <div className="px-4">{children}</div>
    </div>
  )
}

function ResultPill({ result }: { result: 'W' | 'D' | 'L' }) {
  const styles = {
    W: 'w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-pitch bg-green-500 flex-shrink-0',
    D: 'w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-chalk bg-white/20 flex-shrink-0',
    L: 'w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-white bg-red-500 flex-shrink-0',
  }
  return <span className={styles[result]}>{result}</span>
}

function FormGameRow({ game }: { game: FormGame }) {
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-white/[0.04] last:border-0">
      <ResultPill result={game.result} />
      <span className="text-xs font-black text-chalk min-w-[32px]">{game.goalsFor}–{game.goalsAgainst}</span>
      <img src={game.opponentLogo} alt={game.opponentName}
        className="w-4 h-4 object-contain flex-shrink-0"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      <span className="text-[11px] text-chalk/70 truncate flex-1 min-w-0">{game.opponentName}</span>
      <span className="text-[10px] text-fog/40 hidden sm:block truncate max-w-[100px]">{game.competition}</span>
    </div>
  )
}

function FormPanel({ teamName, teamColor, flagUrl, form }: {
  teamName: string; teamColor: string; flagUrl: string; form: TeamFormData | null
}) {
  const dominantColor = useDominantColor(flagUrl, teamColor)
  if (!form) return (
    <div className="flex-1 min-w-0 rounded-xl border border-white/[0.06] p-6 text-center"
      style={{ background: 'rgba(18,28,50,0.7)' }}>
      <p className="text-xs text-fog">No form data available</p>
    </div>
  )
  const { scored, conceded } = formAvgGoals(form.games)
  const cleanSheets = form.games.filter(g => g.goalsAgainst === 0).length
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-white/[0.06] overflow-hidden"
      style={{ background: 'rgba(18,28,50,0.7)' }}>
      <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2"
        style={{ background: `${dominantColor}22` }}>
        <img src={flagUrl} alt={teamName}
          className="w-5 h-auto rounded-sm flex-shrink-0"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        <span className="text-xs font-black text-chalk truncate flex-1">{teamName}</span>
        <div className="flex gap-1">
          {form.games.map((g, i) => <ResultPill key={i} result={g.result} />)}
        </div>
      </div>
      <div className="px-3">
        {form.games.map((g, i) => <FormGameRow key={i} game={g} />)}
      </div>
      <div className="px-3 py-2.5 border-t border-white/[0.04] grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-sm font-black text-green-400">{scored.toFixed(1)}</p>
          <p className="text-[10px] text-fog">Avg scored</p>
        </div>
        <div>
          <p className="text-sm font-black text-red-400">{conceded.toFixed(1)}</p>
          <p className="text-[10px] text-fog">Avg conceded</p>
        </div>
        <div>
          <p className="text-sm font-black text-chalk">{cleanSheets}/5</p>
          <p className="text-[10px] text-fog">Clean sheets</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  match: ScrapedMatch
  onClose: () => void
}

export function MatchDetailModal({ match, onClose }: Props) {
  const { home, away, odds } = match
  const homeColor = useDominantColor(home.flagUrl, home.color)
  const awayColor = useDominantColor(away.flagUrl, away.color)
  const [tab, setTab] = useState<Tab>('odds')
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Lazy-load form data when FORM or ANALYSIS tab opened
  useEffect(() => {
    if ((tab !== 'form' && tab !== 'analysis') || detail !== null || loadingDetail) return
    setLoadingDetail(true)
    fetch(`/espn-api/apis/site/v2/sports/soccer/fifa.world/summary?event=${match.id}`)
      .then(r => r.json())
      .then((data: any) => {
        const lfg: any[] = data.lastFiveGames ?? []
        const parseGames = (teamId: string, events: any[]): FormGame[] =>
          events.map(e => {
            const isHome = e.homeTeamId === teamId
            return {
              result: e.gameResult as 'W' | 'D' | 'L',
              goalsFor:  parseInt(isHome ? e.homeTeamScore : e.awayTeamScore, 10) || 0,
              goalsAgainst: parseInt(isHome ? e.awayTeamScore : e.homeTeamScore, 10) || 0,
              opponentName: e.opponent?.displayName ?? '',
              opponentLogo: e.opponentLogo ?? e.opponent?.logo ?? '',
              competition:  e.competitionName ?? '',
              date: e.gameDate ?? '',
            }
          })
        const homeEntry = lfg.find(g => g.team?.id === home.id) ?? lfg[0] ?? null
        const awayEntry = lfg.find(g => g.team?.id === away.id) ?? lfg[1] ?? null
        setDetail({
          homeForm: homeEntry ? { teamId: home.id, games: parseGames(home.id, homeEntry.events ?? []) } : null,
          awayForm: awayEntry ? { teamId: away.id, games: parseGames(away.id, awayEntry.events ?? []) } : null,
        })
      })
      .catch(() => setDetail({ homeForm: null, awayForm: null }))
      .finally(() => setLoadingDetail(false))
  }, [tab, match.id, home.id, away.id, detail, loadingDetail])

  const dateStr = new Date(match.date).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  // Derived percentages
  const dcPcts = odds ? {
    oneX:  +(odds.homeWinPct + odds.drawPct).toFixed(1),
    xTwo:  +(odds.drawPct  + odds.awayWinPct).toFixed(1),
    oneTwo: +(odds.homeWinPct + odds.awayWinPct).toFixed(1),
  } : null

  const dnbTotal = odds ? odds.homeWinPct + odds.awayWinPct : 0
  const dnbPcts = odds && dnbTotal > 0 ? {
    home: +(odds.homeWinPct / dnbTotal * 100).toFixed(1),
    away: +(odds.awayWinPct / dnbTotal * 100).toFixed(1),
  } : null

  const ouPcts = odds ? normalizedPctPair(odds.overOdds, odds.underOdds) : null
  const spreadPcts = odds ? normalizedPctPair(odds.spreadHomeOdds, odds.spreadOdds) : null

  // Analysis stats
  const homeAvg = detail?.homeForm ? formAvgGoals(detail.homeForm.games) : null
  const awayAvg = detail?.awayForm ? formAvgGoals(detail.awayForm.games) : null
  const λH = homeAvg?.scored ?? (odds ? odds.homeWinPct / 40 : 1.2)
  const λA = awayAvg?.scored ?? (odds ? odds.awayWinPct / 40 : 1.2)
  const bttsPct = homeAvg && awayAvg
    ? Math.round((1 - poisson(λH, 0)) * (1 - poisson(λA, 0)) * 100)
    : null
  const scorelines = topScorelines(λH, λA)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'odds', label: 'Odds' },
    { id: 'form', label: 'Form & Stats' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'chatbot', label: '🤖 Chatbot' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden fade-in"
        style={{
          background: '#0b1829',
          border: '1px solid rgba(255,255,255,0.08)',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
        }}>

        {/* ── Header ── */}
        <div className="relative h-36 overflow-hidden flex-shrink-0">
          <div className="absolute inset-0"
            style={{ background: `linear-gradient(105deg, ${homeColor}dd 0%, ${homeColor}55 45%, ${awayColor}55 55%, ${awayColor}dd 100%)` }} />
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.25)' }} />
          <div className="absolute inset-0 flex items-center justify-between px-6 sm:px-10">
            <div className="text-center">
              <img src={home.flagUrl} alt={home.name}
                className="w-14 sm:w-16 h-auto rounded shadow-2xl mx-auto mb-2"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <p className="text-chalk font-black text-sm drop-shadow">{home.name}</p>
              {match.statusState !== 'pre' && (
                <p className="text-2xl font-black text-chalk mt-1 drop-shadow">{home.score}</p>
              )}
            </div>
            <div className="text-center px-4">
              {match.statusState === 'in' ? (
                <span className="text-[11px] font-black text-live bg-live/20 px-3 py-1 rounded-full pulse-live">
                  {match.statusDetail}
                </span>
              ) : match.statusState === 'post' ? (
                <span className="text-xs text-fog bg-white/10 px-3 py-1 rounded-full">FT</span>
              ) : (
                <span className="text-2xl font-black text-chalk/40">vs</span>
              )}
              {match.group && <p className="text-[10px] text-fog/70 mt-1.5">{match.group}</p>}
            </div>
            <div className="text-center">
              <img src={away.flagUrl} alt={away.name}
                className="w-14 sm:w-16 h-auto rounded shadow-2xl mx-auto mb-2"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <p className="text-chalk font-black text-sm drop-shadow">{away.name}</p>
              {match.statusState !== 'pre' && (
                <p className="text-2xl font-black text-chalk mt-1 drop-shadow">{away.score}</p>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-chalk hover:bg-black/70 transition-colors text-sm">
            ✕
          </button>
        </div>

        {/* ── Date / venue ── */}
        <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.06] flex flex-wrap gap-2 text-[11px] text-fog"
          style={{ background: 'rgba(255,255,255,0.02)' }}>
          <span>{dateStr}</span>
          {match.venue && <span>· {match.venue}</span>}
          {odds && <span className="ml-auto text-fog/40">via {odds.provider}</span>}
        </div>

        {/* ── Tabs ── */}
        <div className="flex-shrink-0 flex gap-0.5 px-4 pt-3 pb-0 border-b border-white/[0.06]">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-xs font-black rounded-t-lg transition-colors ${
                tab === t.id
                  ? 'text-gold border-b-2 border-gold -mb-px bg-gold/5'
                  : 'text-fog hover:text-chalk'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto modal-scroll">

          {/* ════ ODDS TAB ════ */}
          {tab === 'odds' && (
            <div className="px-4 py-4 space-y-3">
              {odds ? (
                <>
                  {/* Summary probability bar */}
                  <ProbBar
                    homePct={odds.homeWinPct} drawPct={odds.drawPct} awayPct={odds.awayWinPct}
                    homeLabel={home.abbr} awayLabel={away.abbr}
                  />

                  {/* Match Result 1X2 */}
                  <MarketSection title="Match Result" desc="Which team wins, or draw?">
                    <MarketRow label={`${home.name}`} pct={odds.homeWinPct}
                      barColor="#22c55e"
                      openML={odds.homeMoneylineOpen} closeML={odds.homeMoneyline} />
                    <MarketRow label="Draw" pct={odds.drawPct}
                      barColor="rgba(255,255,255,0.35)"
                      openML={odds.drawMoneylineOpen} closeML={odds.drawMoneyline} />
                    <MarketRow label={`${away.name}`} pct={odds.awayWinPct}
                      barColor="#f5a623"
                      openML={odds.awayMoneylineOpen} closeML={odds.awayMoneyline} />
                  </MarketSection>

                  {/* Double Chance */}
                  {dcPcts && (
                    <MarketSection title="Double Chance" desc="Bet on 2 outcomes at once — safer, lower return">
                      <MarketRow label={`${home.abbr} or Draw`} pct={dcPcts.oneX}
                        barColor="#22c55e" note="1X" />
                      <MarketRow label={`Draw or ${away.abbr}`} pct={dcPcts.xTwo}
                        barColor="#f5a623" note="X2" />
                      <MarketRow label={`${home.abbr} or ${away.abbr}`} pct={dcPcts.oneTwo}
                        barColor="rgba(245,166,35,0.5)" note="12 · No draw" />
                    </MarketSection>
                  )}

                  {/* Draw No Bet */}
                  {dnbPcts && (
                    <MarketSection title="Draw No Bet" desc="Draw = stake refunded. Who wins?">
                      <MarketRow label={home.name} pct={dnbPcts.home} barColor="#22c55e" />
                      <MarketRow label={away.name} pct={dnbPcts.away} barColor="#f5a623" />
                    </MarketSection>
                  )}

                  {/* Over/Under */}
                  {ouPcts && odds.overUnder != null && (
                    <MarketSection title={`Over / Under ${odds.overUnder} Goals`} desc="Total goals in the match">
                      <MarketRow label={`Over ${odds.overUnder} goals`} pct={ouPcts[0]}
                        barColor="#22c55e"
                        openML={odds.overOddsOpen} closeML={odds.overOdds} />
                      <MarketRow label={`Under ${odds.overUnder} goals`} pct={ouPcts[1]}
                        barColor="rgba(255,255,255,0.35)"
                        openML={odds.underOddsOpen} closeML={odds.underOdds} />
                    </MarketSection>
                  )}

                  {/* Handicap */}
                  {spreadPcts && (odds.spreadHomeLine || odds.spreadLine) && (
                    <MarketSection title="Handicap" desc="Virtual goal advantage/disadvantage applied at kick-off">
                      {odds.spreadHomeLine && (
                        <MarketRow
                          label={`${home.name} ${odds.spreadHomeLine}`}
                          pct={spreadPcts[0]} barColor="#22c55e" />
                      )}
                      {odds.spreadLine && (
                        <MarketRow
                          label={`${away.name} ${odds.spreadLine}`}
                          pct={spreadPcts[1]} barColor="#f5a623"
                          openML={odds.spreadOddsOpen} closeML={odds.spreadOdds} />
                      )}
                    </MarketSection>
                  )}

                  {/* Movement key — only if there are open lines */}
                  {odds.homeMoneylineOpen && (
                    <p className="text-[10px] text-fog/35 text-center">
                      <span className="text-green-400/70">▲</span> more likely than at open ·{' '}
                      <span className="text-red-400/70">▼</span> less likely than at open
                    </p>
                  )}
                </>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-fog">Odds not yet available for this match.</p>
                  <p className="text-[11px] text-fog/50 mt-1">Check back closer to kick-off.</p>
                </div>
              )}

              {/* ESPN links */}
              <div className="grid grid-cols-2 gap-3 pt-1 pb-2">
                <a href={match.espnUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-chalk hover:opacity-80 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #cc0c00, #e01a14)' }}>
                  📊 ESPN Match Center
                </a>
                <a href={`https://www.espn.com/soccer/odds/_/gameId/${match.id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-chalk hover:opacity-80 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #1a5c2a, #22c55e)' }}>
                  💰 ESPN Full Odds
                </a>
              </div>
            </div>
          )}

          {/* ════ FORM TAB ════ */}
          {tab === 'form' && (
            <div className="px-4 py-4">
              {loadingDetail ? (
                <div className="py-12 text-center text-fog text-sm">Loading form data…</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <FormPanel teamName={home.name} teamColor={home.color} flagUrl={home.flagUrl} form={detail?.homeForm ?? null} />
                    <FormPanel teamName={away.name} teamColor={away.color} flagUrl={away.flagUrl} form={detail?.awayForm ?? null} />
                  </div>
                  <div className="rounded-xl border border-white/[0.06] p-4"
                    style={{ background: 'rgba(18,28,50,0.7)' }}>
                    <p className="text-[10px] font-black text-fog uppercase tracking-widest mb-2">Head to Head</p>
                    <p className="text-xs text-fog/50 text-center py-2">No recent meetings on record</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ ANALYSIS TAB ════ */}
          {tab === 'analysis' && (
            <div className="px-4 py-4 space-y-3">

              {/* Avg goals */}
              <MarketSection title="Avg Goals Scored · Last 5 Games">
                <div className="flex py-4">
                  <div className="flex-1 text-center border-r border-white/[0.06]">
                    <p className="text-2xl font-black text-green-400">{λH.toFixed(2)}</p>
                    <p className="text-[10px] text-fog mt-1">{home.abbr} per game</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-black text-amber-400">{λA.toFixed(2)}</p>
                    <p className="text-[10px] text-fog mt-1">{away.abbr} per game</p>
                  </div>
                </div>
                {!detail?.homeForm && (
                  <p className="text-[10px] text-fog/35 text-center pb-2">
                    Estimated from win probabilities · Load Form tab for real data
                  </p>
                )}
              </MarketSection>

              {/* BTTS */}
              {bttsPct !== null && (
                <MarketSection title="Both Teams to Score · Estimated">
                  <div className="flex gap-3 py-3">
                    <div className="flex-1 rounded-lg py-3 text-center border border-green-500/20"
                      style={{ background: 'rgba(34,197,94,0.08)' }}>
                      <p className="text-xl font-black text-green-400">{bttsPct}%</p>
                      <p className="text-[10px] text-fog mt-0.5">Yes — both score</p>
                    </div>
                    <div className="flex-1 rounded-lg py-3 text-center border border-white/10"
                      style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-xl font-black text-chalk/60">{100 - bttsPct}%</p>
                      <p className="text-[10px] text-fog mt-0.5">No — at least one clean sheet</p>
                    </div>
                  </div>
                </MarketSection>
              )}

              {/* Scoreline probabilities */}
              <MarketSection title="Most Likely Scorelines · Poisson Model">
                <div className="grid grid-cols-4 gap-1.5 py-3">
                  {scorelines.map((s, i) => (
                    <div key={i} className="rounded-lg py-2.5 text-center border border-white/[0.05]"
                      style={{ background: i === 0 ? 'rgba(245,166,35,0.12)' : 'rgba(255,255,255,0.03)' }}>
                      <p className={`text-sm font-black ${i === 0 ? 'text-gold' : 'text-chalk'}`}>{s.h}–{s.a}</p>
                      <p className="text-[10px] text-fog">{s.pct.toFixed(1)}%</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-fog/35 text-center pb-2">
                  {home.abbr} λ={λH.toFixed(2)} · {away.abbr} λ={λA.toFixed(2)}
                </p>
              </MarketSection>

              {/* O/U probability from odds */}
              {ouPcts && odds?.overUnder != null && (
                <MarketSection title={`Over/Under ${odds.overUnder} · Implied Probability`}>
                  <div className="py-2">
                    <div className="flex rounded-lg overflow-hidden h-8 text-[10px] font-black">
                      <div className="flex items-center justify-center text-pitch"
                        style={{ width: `${ouPcts[0]}%`, background: 'rgba(34,197,94,0.5)' }}>
                        Over {ouPcts[0]}%
                      </div>
                      <div className="flex items-center justify-center text-chalk"
                        style={{ width: `${ouPcts[1]}%`, background: 'rgba(255,255,255,0.08)' }}>
                        Under {ouPcts[1]}%
                      </div>
                    </div>
                  </div>
                </MarketSection>
              )}

              {/* CTAs */}
              <div className="space-y-2 pt-1 pb-2">
                <a href={match.espnUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-chalk hover:opacity-80 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #cc0c00, #e01a14)' }}>
                  📰 Expert Preview &amp; Analysis on ESPN
                </a>
                <a href={`https://www.espn.com/soccer/odds/_/gameId/${match.id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-chalk hover:opacity-80 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #f5a623, #e8890a)' }}>
                  💰 Full Odds &amp; Prop Bets on ESPN
                </a>
              </div>
            </div>
          )}
          {/* ════ CHATBOT TAB ════ */}
          {tab === 'chatbot' && (
            <div className="px-4 py-8 flex flex-col items-center justify-center gap-4 min-h-[320px]">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.2)' }}>
                🤖
              </div>
              <div className="text-center">
                <p className="text-chalk font-black text-lg">AI Match Assistant</p>
                <p className="text-fog text-sm mt-1">Coming Soon</p>
              </div>
              <p className="text-fog/50 text-xs text-center max-w-[260px] leading-relaxed">
                Ask anything about this match — odds analysis, team form, historical data, and betting insights powered by AI.
              </p>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full text-[11px] text-gold/60 border border-gold/20"
                style={{ background: 'rgba(245,166,35,0.05)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-gold/40" />
                In development
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 px-4 py-2 border-t border-white/[0.06] text-center"
          style={{ background: 'rgba(0,0,0,0.3)' }}>
          <p className="text-[10px] text-fog/35">
            Percentages = implied probability from DraftKings odds · Not betting advice · 18+
          </p>
        </div>
      </div>
    </div>
  )
}
