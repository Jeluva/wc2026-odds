import { useState, useEffect, useMemo } from 'react'
import type { ScrapedMatch, StandingsPayload, ScrapedStandingEntry } from '../types'
import { MatchDetailModal } from '../components/MatchDetailModal'
import { Flag } from '../components/Flag'
import { useLiveMatches } from '../hooks/useLiveMatches'
import { useT } from '../i18n/LangContext'

function StandingsTable({ teams }: { teams: ScrapedStandingEntry[] }) {
  const { t, tn } = useT()
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-white/[0.06]">
          <th className="text-left px-4 py-2 text-[10px] font-bold text-fog uppercase tracking-wider w-full">
            {t.table.team}
          </th>
          {[t.groups.played, t.groups.won, t.groups.drawn, t.groups.lost,
            t.groups.gf, t.groups.ga, t.groups.gd, t.groups.pts].map(col => (
            <th key={col} className="px-2 py-2 text-[10px] font-bold text-fog uppercase tracking-wider text-center whitespace-nowrap">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {teams.map((team, i) => (
          <tr key={team.id}
            className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="w-1 h-6 rounded-full flex-shrink-0"
                  style={{
                    background: i < 2
                      ? 'linear-gradient(to bottom, #f5a623, #22c55e)'
                      : 'rgba(255,255,255,0.05)'
                  }} />
                <Flag url={team.flagUrl} name={team.name}
                  className="w-5 h-auto rounded-sm flex-shrink-0" />
                <span className={`text-sm font-semibold ${i < 2 ? 'text-chalk' : 'text-chalk/80'}`}>
                  {tn(team.name)}
                </span>
              </div>
            </td>
            {[team.played, team.won, team.drawn, team.lost,
              team.gf, team.ga,
              team.gd > 0 ? `+${team.gd}` : team.gd,
            ].map((v, j) => (
              <td key={j} className="px-2 py-3 text-xs text-center text-chalk/70">{v}</td>
            ))}
            <td className="px-2 py-3 text-sm font-black text-center text-gold">{team.pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Groups() {
  const { t, lang, tn, tg } = useT()
  const { matches } = useLiveMatches()
  const [standings, setStandings] = useState<Record<string, ScrapedStandingEntry[]>>({})
  const [active, setActive] = useState('Group A')
  const [selected, setSelected] = useState<ScrapedMatch | null>(null)

  useEffect(() => {
    fetch('/data/standings.json')
      .then(r => r.json())
      .then((s: StandingsPayload) => {
        const st = s.standings ?? {}
        setStandings(st)
        const firstGroup = Object.keys(st).sort()[0]
        if (firstGroup) setActive(firstGroup)
      })
      .catch(() => {})
  }, [])

  const groupNames = useMemo(() => {
    const isGroupStage = (g: string) => /^Group [A-L]$/i.test(g)
    const fromMatches = [...new Set(matches.map(m => m.group).filter(isGroupStage))].sort()
    const fromStandings = Object.keys(standings).filter(isGroupStage).sort()
    return [...new Set([...fromStandings, ...fromMatches])].sort()
  }, [matches, standings])

  const groupLetters = useMemo(() =>
    groupNames.map(g => g.replace('Group ', '')),
    [groupNames]
  )

  const currentTeams = standings[active] ?? []
  const groupMatches = matches.filter(m => m.group === active && /^Group [A-L]$/i.test(m.group))
  const finished = groupMatches.filter(m => m.statusState === 'post')
  const upcoming = groupMatches.filter(m => m.statusState !== 'post')

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6 fade-in">
        <h1 className="text-3xl font-black text-chalk">{t.groups.heading}</h1>
        <p className="text-fog mt-1 text-sm">{t.groups.desc}</p>
      </div>

      {/* Group tabs */}
      <div className="flex gap-1.5 flex-wrap mb-6">
        {groupLetters.map((letter, i) => {
          const g = groupNames[i]
          return (
            <button key={g}
              onClick={() => setActive(g)}
              className={`w-10 h-10 rounded-xl text-sm font-black border transition-all ${
                active === g
                  ? 'text-pitch border-gold/50'
                  : 'text-fog border-white/10 hover:text-chalk hover:border-white/20'
              }`}
              style={active === g
                ? { background: 'linear-gradient(135deg, #f5a623, #ffd97d)' }
                : { background: 'rgba(22,32,53,0.6)' }}>
              {letter}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 fade-in">
        {/* Standings */}
        <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-white/[0.06]"
          style={{ background: 'rgba(22,32,53,0.7)', backdropFilter: 'blur(12px)' }}>
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-black text-chalk text-sm">{tg(active)}</h2>
            <span className="text-[10px] text-fog uppercase tracking-widest">{t.table.standings}</span>
          </div>

          {currentTeams.length > 0 ? (
            <>
              <StandingsTable teams={currentTeams} />
              <div className="px-4 py-2 border-t border-white/[0.04]">
                <span className="text-[10px] text-fog">
                  <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                    style={{ background: 'linear-gradient(135deg, #f5a623, #22c55e)' }} />
                  {t.standings.qualify}
                </span>
              </div>
            </>
          ) : (
            <div className="p-6 text-center">
              <p className="text-fog text-sm">{t.groups.noMatches}</p>
            </div>
          )}
        </div>

        {/* Matches */}
        <div className="lg:col-span-2 space-y-4">
          {finished.length > 0 && (
            <div className="rounded-2xl border border-white/[0.06] p-4"
              style={{ background: 'rgba(22,32,53,0.7)', backdropFilter: 'blur(12px)' }}>
              <h3 className="text-[10px] font-bold text-fog uppercase tracking-widest mb-3">
                {t.groups.results}
              </h3>
              <div className="space-y-1">
                {finished.map(m => (
                  <button key={m.id} onClick={() => setSelected(m)}
                    className="w-full flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                    <div className="flex-1 flex items-center justify-end gap-2">
                      <span className="text-xs text-chalk/80 text-xs text-chalk/80"><span className="sm:hidden">{m.home.abbr}</span><span className="hidden sm:inline">{tn(m.home.name)}</span></span>
                      <Flag url={m.home.flagUrl} name={m.home.name}
                        className="w-5 h-auto rounded-sm" />
                    </div>
                    <div className="text-center min-w-[56px]">
                      <p className="text-sm font-black text-chalk">{m.home.score} – {m.away.score}</p>
                      <span className="text-[10px] text-fog">{t.status.finished}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <Flag url={m.away.flagUrl} name={m.away.name}
                        className="w-5 h-auto rounded-sm" />
                      <span className="text-xs text-chalk/80 text-xs text-chalk/80"><span className="sm:hidden">{m.away.abbr}</span><span className="hidden sm:inline">{tn(m.away.name)}</span></span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="rounded-2xl border border-white/[0.06] p-4"
              style={{ background: 'rgba(22,32,53,0.7)', backdropFilter: 'blur(12px)' }}>
              <h3 className="text-[10px] font-bold text-fog uppercase tracking-widest mb-3">
                {t.groups.upcoming}
              </h3>
              <div className="space-y-1">
                {upcoming.map(m => (
                  <button key={m.id} onClick={() => setSelected(m)}
                    className="w-full flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                    <div className="flex-1 flex items-center justify-end gap-2">
                      <span className="text-xs text-chalk/80 text-xs text-chalk/80"><span className="sm:hidden">{m.home.abbr}</span><span className="hidden sm:inline">{tn(m.home.name)}</span></span>
                      <Flag url={m.home.flagUrl} name={m.home.name}
                        className="w-5 h-auto rounded-sm" />
                    </div>
                    <div className="text-center min-w-[56px]">
                      {m.statusState === 'in' ? (
                        <>
                          <p className="text-sm font-black text-chalk">{m.home.score} – {m.away.score}</p>
                          <span className="text-[10px] text-live font-bold pulse-live">{m.statusDetail}</span>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] text-gold font-bold">
                            {new Date(m.date).toLocaleDateString(lang === 'es' ? 'es' : 'en', { month: 'short', day: 'numeric' })}
                          </p>
                          {m.odds?.homeMoneyline && (
                            <p className="text-[10px] text-fog" title={`${m.home.abbr} ${m.odds.homeWinPct}% – ${t.home.drawPct} ${m.odds.drawPct}% – ${m.away.abbr} ${m.odds.awayWinPct}%`}>
                              <span className="text-green-400/70">{m.odds.homeWinPct}</span>–<span className="text-fog/60">{m.odds.drawPct}</span>–<span className="text-amber-400/70">{m.odds.awayWinPct}</span>
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <Flag url={m.away.flagUrl} name={m.away.name}
                        className="w-5 h-auto rounded-sm" />
                      <span className="text-xs text-chalk/80 text-xs text-chalk/80"><span className="sm:hidden">{m.away.abbr}</span><span className="hidden sm:inline">{tn(m.away.name)}</span></span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {groupMatches.length === 0 && (
            <div className="rounded-2xl border border-white/[0.06] p-6 text-center"
              style={{ background: 'rgba(22,32,53,0.5)' }}>
              <p className="text-fog text-sm">{t.groups.noMatches}</p>
            </div>
          )}
        </div>
      </div>

      {selected && <MatchDetailModal match={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}
