import { useState, useMemo } from 'react'
import type { ScrapedMatch } from '../types'
import { MatchDetailModal } from '../components/MatchDetailModal'
import { useLiveMatches } from '../hooks/useLiveMatches'
import { useT } from '../i18n/LangContext'
import { useDominantColor } from '../hooks/useDominantColor'

function formatKickoff(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((d.getTime() - now.setHours(0,0,0,0)) / 86400000)
  const timeStr = new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 0) return `TODAY · ${timeStr}`
  if (diffDays === 1) return `TOMORROW · ${timeStr}`
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase() + ` · ${timeStr}`
}

function ProbBar({ homePct, drawPct, awayPct }: { homePct: number; drawPct: number; awayPct: number }) {
  return (
    <div className="flex rounded-full overflow-hidden h-1.5 mt-2">
      <div style={{ width: `${homePct}%`, background: '#22c55e' }} />
      <div style={{ width: `${drawPct}%`, background: 'rgba(255,255,255,0.15)' }} />
      <div style={{ width: `${awayPct}%`, background: '#f5a623' }} />
    </div>
  )
}

function HeroMatch({ match, onClick }: { match: ScrapedMatch; onClick: () => void }) {
  const { t } = useT()
  const { home, away, odds } = match
  const isLive = match.statusState === 'in'
  const label = isLive ? t.home.liveNow : t.home.upNext
  // Live state, clock and score are already overlaid onto `match` by useLiveMatches.
  const clock = isLive ? match.statusDetail : null
  const homeColor = useDominantColor(home.flagUrl, home.color)
  const awayColor = useDominantColor(away.flagUrl, away.color)

  return (
    <button onClick={onClick} className="w-full text-left rounded-3xl overflow-hidden mb-6 fade-in group"
      style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
      {/* Gradient from home flag dominant color → away flag dominant color */}
      <div className="relative overflow-hidden" style={{
        background: `linear-gradient(135deg, ${homeColor}44 0%, #0a1628 45%, #0a1628 55%, ${awayColor}44 100%)`
      }}>
        <div className="absolute inset-0 grass-stripe opacity-20 pointer-events-none" />
        {/* Glow orbs using flag dominant colors */}
        <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${homeColor}30 0%, transparent 70%)` }} />
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${awayColor}30 0%, transparent 70%)` }} />

        <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-10">
          {/* Status badge */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-live pulse-live' : 'bg-grass'}`} />
              <span className={`text-xs font-bold tracking-widest ${isLive ? 'text-live' : 'text-grass'}`}>
                {label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-fog">
              {match.group && <span className="border border-white/10 rounded-full px-2 py-0.5">{match.group}</span>}
              {match.venue && <span className="hidden sm:block">📍 {match.venue}</span>}
            </div>
          </div>

          {/* Teams + Score / Time */}
          <div className="grid grid-cols-3 items-center gap-4">
            {/* Home */}
            <div className="text-center">
              <img src={home.flagUrl} alt={home.name}
                className="w-16 h-auto sm:w-24 rounded-md shadow-2xl mx-auto mb-3 drop-shadow-lg"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <p className="text-chalk font-black text-base sm:text-xl tracking-tight leading-tight">{home.name}</p>
              {odds && (
                <p className="text-fog text-xs mt-1 font-semibold">{odds.homeWinPct}% {t.home.winPct}</p>
              )}
            </div>

            {/* Center */}
            <div className="text-center">
              {match.statusState === 'post' ? (
                <div>
                  <div className="text-4xl font-black text-chalk">{home.score} – {away.score}</div>
                  <span className="text-[10px] text-fog bg-white/10 px-2 py-0.5 rounded-full">FT</span>
                </div>
              ) : match.statusState === 'in' ? (
                <div>
                  <div className="text-4xl font-black text-chalk">{home.score} – {away.score}</div>
                  <span className="text-xs text-live font-bold pulse-live">{clock}</span>
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-black text-fog/40 mb-1">VS</div>
                  <div className="text-xs text-gold font-bold">{formatKickoff(match.date)}</div>
                </div>
              )}
              {odds && match.statusState !== 'post' && (
                <div className="mt-2">
                  <p className="text-[10px] text-fog">{odds.drawPct}% {t.home.drawPct}</p>
                </div>
              )}
            </div>

            {/* Away */}
            <div className="text-center">
              <img src={away.flagUrl} alt={away.name}
                className="w-16 h-auto sm:w-24 rounded-md shadow-2xl mx-auto mb-3 drop-shadow-lg"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <p className="text-chalk font-black text-base sm:text-xl tracking-tight leading-tight">{away.name}</p>
              {odds && (
                <p className="text-fog text-xs mt-1 font-semibold">{odds.awayWinPct}% {t.home.winPct}</p>
              )}
            </div>
          </div>

          {/* Probability bar */}
          {odds && match.statusState !== 'post' && (
            <div className="mt-6">
              <ProbBar homePct={odds.homeWinPct} drawPct={odds.drawPct} awayPct={odds.awayWinPct} />
              <div className="flex justify-between text-[10px] text-fog/60 mt-1">
                <span>{home.name}</span>
                <span>{t.home.oddsFrom}</span>
                <span>{away.name}</span>
              </div>
            </div>
          )}

          {/* Click hint */}
          <div className="mt-4 text-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] text-gold font-semibold tracking-wider">
              {t.home.clickForOdds} →
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

function MatchRow({ match, onClick }: { match: ScrapedMatch; onClick: () => void }) {
  const { t } = useT()
  const { home, away, odds } = match
  const isLive = match.statusState === 'in'
  // Live state, clock and score are already overlaid onto `match` by useLiveMatches.
  const clock = isLive ? match.statusDetail : null
  const homeColor = useDominantColor(home.flagUrl, home.color)
  const awayColor = useDominantColor(away.flagUrl, away.color)

  return (
    <button onClick={onClick}
      className="w-full text-left rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.01] group fade-in"
      style={{
        background: 'rgba(22,32,53,0.7)',
        border: `1px solid ${isLive ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
        backdropFilter: 'blur(12px)',
      }}>
      {/* Flag dominant color accent line */}
      <div className="h-px w-full" style={{
        background: `linear-gradient(90deg, ${homeColor}, transparent 40%, transparent 60%, ${awayColor})`
      }} />

      <div className="px-4 py-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* Home */}
          <div className="flex items-center gap-2">
            <img src={home.flagUrl} alt={home.name}
              className="w-7 h-auto rounded-sm flex-shrink-0"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <div>
              <p className="text-sm font-bold text-chalk leading-tight">{home.name}</p>
              {odds && match.statusState !== 'post' && (
                <p className="text-[10px] text-fog">{odds.homeWinPct}% {t.home.winPct}</p>
              )}
            </div>
          </div>

          {/* Center: score / time / status */}
          <div className="text-center min-w-[80px]">
            {match.statusState === 'post' ? (
              <div>
                <p className="text-base font-black text-chalk">{home.score} – {away.score}</p>
                <span className="text-[10px] text-fog">FT</span>
              </div>
            ) : match.statusState === 'in' ? (
              <div>
                <p className="text-base font-black text-chalk">{home.score} – {away.score}</p>
                <span className="text-[10px] text-live font-bold pulse-live">{clock}</span>
              </div>
            ) : (
              <div>
                <p className="text-[10px] text-gold font-bold leading-tight">{formatKickoff(match.date)}</p>
                {odds?.drawPct && (
                  <p className="text-[10px] text-fog mt-0.5">{t.home.drawPct} {odds.drawPct}%</p>
                )}
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex items-center gap-2 justify-end">
            <div className="text-right">
              <p className="text-sm font-bold text-chalk leading-tight">{away.name}</p>
              {odds && match.statusState !== 'post' && (
                <p className="text-[10px] text-fog">{odds.awayWinPct}% {t.home.winPct}</p>
              )}
            </div>
            <img src={away.flagUrl} alt={away.name}
              className="w-7 h-auto rounded-sm flex-shrink-0"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
        </div>

        {/* Prob bar for scheduled matches with odds */}
        {odds && match.statusState === 'pre' && (
          <ProbBar homePct={odds.homeWinPct} drawPct={odds.drawPct} awayPct={odds.awayWinPct} />
        )}
      </div>
    </button>
  )
}

export function Home() {
  const { t } = useT()
  const { matches } = useLiveMatches()
  const [selected, setSelected] = useState<ScrapedMatch | null>(null)

  const liveMatch = useMemo(() =>
    matches.find(m => m.statusState === 'in'),
    [matches]
  )

  const upcomingMatches = useMemo(() => {
    const now = Date.now()
    return matches
      .filter(m => m.statusState === 'pre' && new Date(m.date).getTime() > now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [matches])

  const heroMatch = liveMatch ?? upcomingMatches[0]
  const listMatches = useMemo(() =>
    liveMatch ? upcomingMatches : upcomingMatches.slice(1),
    [liveMatch, upcomingMatches]
  )

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {heroMatch && (
        <HeroMatch
          match={heroMatch}
          onClick={() => setSelected(heroMatch)} />
      )}

      {/* Upcoming list */}
      {listMatches.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-fog uppercase tracking-widest mb-4">
            {t.home.upcomingMatches}
          </h2>
          <div className="space-y-2">
            {listMatches.map(m => (
              <MatchRow key={m.id} match={m} onClick={() => setSelected(m)} />
            ))}
          </div>
        </section>
      )}

      {matches.length > 0 && listMatches.length === 0 && !heroMatch && (
        <p className="text-center text-fog py-12">{t.home.noUpcoming}</p>
      )}

      {selected && (
        <MatchDetailModal match={selected} onClose={() => setSelected(null)} />
      )}
    </main>
  )
}
