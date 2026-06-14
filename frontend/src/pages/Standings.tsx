import { useState, useEffect } from 'react'
import type { StandingsPayload, ScrapedStandingEntry, ScrapedMatch } from '../types'
import { MatchDetailModal } from '../components/MatchDetailModal'
import { useLiveMatches } from '../hooks/useLiveMatches'
import { useT } from '../i18n/LangContext'

function GroupTable({ groupName, teams }: { groupName: string; teams: ScrapedStandingEntry[] }) {
  const { t } = useT()
  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.06] fade-in"
      style={{ background: 'rgba(22,32,53,0.7)', backdropFilter: 'blur(12px)' }}>
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="font-black text-chalk text-sm">{groupName}</h3>
        <span className="text-[10px] text-fog uppercase tracking-widest">Standings</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left px-3 py-2 text-[10px] font-bold text-fog uppercase tracking-wider">
              {t.standings.played === 'P' ? 'Team' : 'Equipo'}
            </th>
            {[t.standings.played, t.standings.won, t.standings.drawn, t.standings.lost,
              t.standings.gf, t.standings.ga, t.standings.gd, t.standings.pts
            ].map((col, i) => (
              <th key={i} className="px-2 py-2 text-[10px] font-bold text-fog uppercase tracking-wider text-center">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((team, i) => (
            <tr key={team.id}
              className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  {/* Qualifier indicator */}
                  <span className="w-1 h-5 rounded-full flex-shrink-0"
                    style={{
                      background: i < 2
                        ? 'linear-gradient(to bottom, #f5a623, #22c55e)'
                        : 'rgba(255,255,255,0.05)'
                    }} />
                  <img src={team.flagUrl} alt={team.name}
                    className="w-5 h-auto rounded-sm flex-shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  <span className={`text-sm font-semibold ${i < 2 ? 'text-chalk' : 'text-chalk/80'}`}>
                    {team.name}
                  </span>
                </div>
              </td>
              {[team.played, team.won, team.drawn, team.lost,
                team.gf, team.ga,
                team.gd > 0 ? `+${team.gd}` : team.gd
              ].map((v, j) => (
                <td key={j} className="px-2 py-3 text-xs text-center text-chalk/70">{v}</td>
              ))}
              <td className="px-2 py-3 text-sm font-black text-center text-gold">{team.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 border-t border-white/[0.04]">
        <span className="text-[10px] text-fog">
          <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
            style={{ background: 'linear-gradient(135deg, #f5a623, #22c55e)' }} />
          {t.standings.qualify}
        </span>
      </div>
    </div>
  )
}

function RecentMatchRow({ match, onClick }: { match: ScrapedMatch; onClick: () => void }) {
  const isLive = match.statusState === 'in'
  return (
    <button onClick={onClick}
      className="w-full text-left flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/[0.03] transition-colors group">
      <div className="flex-1 flex items-center justify-end gap-2">
        <span className="text-xs font-semibold text-chalk/80 hidden sm:block">{match.home.name}</span>
        <img src={match.home.flagUrl} alt={match.home.name}
          className="w-5 h-auto rounded-sm"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      </div>
      <div className="flex flex-col items-center min-w-[60px] text-center">
        {match.statusState === 'post' ? (
          <>
            <span className="text-sm font-black text-chalk">{match.home.score} – {match.away.score}</span>
            <span className="text-[10px] text-fog bg-white/10 px-1.5 rounded-full">FT</span>
          </>
        ) : isLive ? (
          <>
            <span className="text-sm font-black text-chalk">{match.home.score} – {match.away.score}</span>
            <span className="text-[10px] text-live font-bold pulse-live">{match.statusDetail}</span>
          </>
        ) : (
          <span className="text-[10px] text-gold font-bold">
            {new Date(match.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
      <div className="flex-1 flex items-center gap-2">
        <img src={match.away.flagUrl} alt={match.away.name}
          className="w-5 h-auto rounded-sm"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        <span className="text-xs font-semibold text-chalk/80 hidden sm:block">{match.away.name}</span>
      </div>
    </button>
  )
}

export function Standings() {
  const { t } = useT()
  const { matches } = useLiveMatches()
  const [standings, setStandings] = useState<Record<string, ScrapedStandingEntry[]>>({})
  const [selected, setSelected] = useState<ScrapedMatch | null>(null)
  const [activeGroup, setActiveGroup] = useState('Group A')

  useEffect(() => {
    fetch('/data/standings.json')
      .then(r => r.json())
      .then((s: StandingsPayload) => {
        setStandings(s.standings ?? {})
        const firstGroup = Object.keys(s.standings ?? {})[0]
        if (firstGroup) setActiveGroup(firstGroup)
      })
      .catch(() => {})
  }, [])

  const groupNames = Object.keys(standings).filter(g => /^Group [A-L]$/i.test(g)).sort()
  const currentTeams = standings[activeGroup] ?? []
  const groupMatches = matches.filter(m => m.group === activeGroup && /^Group [A-L]$/i.test(m.group))
  const finishedGroupMatches = groupMatches.filter(m => m.statusState === 'post').slice(-6)
  const upcomingGroupMatches = groupMatches.filter(m => m.statusState === 'pre').slice(0, 6)

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6 fade-in">
        <h1 className="text-3xl font-black text-chalk">{t.standings.heading}</h1>
        <p className="text-fog mt-1 text-sm">{t.standings.desc}</p>
      </div>

      {groupNames.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] p-12 text-center"
          style={{ background: 'rgba(22,32,53,0.5)' }}>
          <p className="text-fog">{t.standings.noData}</p>
        </div>
      ) : (
        <>
          {/* Group selector tabs */}
          <div className="flex gap-1.5 flex-wrap mb-6">
            {groupNames.map(g => (
              <button key={g}
                onClick={() => setActiveGroup(g)}
                className={`px-3 h-10 rounded-xl text-xs font-black border transition-all ${
                  activeGroup === g
                    ? 'text-pitch border-gold/50'
                    : 'text-fog border-white/10 hover:text-chalk hover:border-white/20'
                }`}
                style={activeGroup === g
                  ? { background: 'linear-gradient(135deg, #f5a623, #ffd97d)' }
                  : { background: 'rgba(22,32,53,0.6)' }
                }>
                {g}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Group table */}
            <div className="lg:col-span-3">
              {currentTeams.length > 0 ? (
                <GroupTable groupName={activeGroup} teams={currentTeams} />
              ) : (
                <div className="rounded-2xl border border-white/[0.06] p-8 text-center"
                  style={{ background: 'rgba(22,32,53,0.5)' }}>
                  <p className="text-fog text-sm">{t.standings.noData}</p>
                </div>
              )}
            </div>

            {/* Matches column */}
            <div className="lg:col-span-2 space-y-4">
              {finishedGroupMatches.length > 0 && (
                <div className="rounded-2xl border border-white/[0.06] p-4"
                  style={{ background: 'rgba(22,32,53,0.7)', backdropFilter: 'blur(12px)' }}>
                  <h3 className="text-[10px] font-bold text-fog uppercase tracking-widest mb-2">{t.groups.results}</h3>
                  {finishedGroupMatches.map(m => (
                    <RecentMatchRow key={m.id} match={m} onClick={() => setSelected(m)} />
                  ))}
                </div>
              )}
              {upcomingGroupMatches.length > 0 && (
                <div className="rounded-2xl border border-white/[0.06] p-4"
                  style={{ background: 'rgba(22,32,53,0.7)', backdropFilter: 'blur(12px)' }}>
                  <h3 className="text-[10px] font-bold text-fog uppercase tracking-widest mb-2">{t.groups.upcoming}</h3>
                  {upcomingGroupMatches.map(m => (
                    <RecentMatchRow key={m.id} match={m} onClick={() => setSelected(m)} />
                  ))}
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
        </>
      )}

      {selected && <MatchDetailModal match={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}
