import { useState, useEffect, useMemo } from 'react'
import type { ScrapedMatch, MatchesPayload } from '../types'

export interface LiveOverlay {
  state: 'pre' | 'in' | 'post'
  clock: string
  statusDetail: string
  homeScore: number | null
  awayScore: number | null
}

interface LiveMatches {
  /** Cached matches with the real-time ESPN state/score overlaid on top. */
  matches: ScrapedMatch[]
  /** Per-event live overlay, keyed by match id (clock, score, state). */
  liveOverlay: Record<string, LiveOverlay>
  /** False until the first matches.json fetch resolves (success or failure). */
  loading: boolean
  /** True if the initial matches.json fetch failed. */
  error: boolean
}

const MATCHES_POLL_MS = 30_000
const LIVE_POLL_MS = 30_000

/**
 * Single source of truth for live match data across pages.
 *
 * The scraper only rewrites matches.json every ~15 min, so a match that has
 * kicked off or finished would otherwise stay stale until the next scrape (or a
 * server restart). To bridge that gap we poll the ESPN scoreboard every 30 s
 * whenever the cached data shows a live match, and overlay the *real* state and
 * score onto the cached records. The poll trigger stays bound to the cached
 * state so it keeps refreshing until the scraper catches up — no flicker.
 */
export function useLiveMatches(): LiveMatches {
  const [matches, setMatches] = useState<ScrapedMatch[]>([])
  const [liveOverlay, setLiveOverlay] = useState<Record<string, LiveOverlay>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Poll cached JSON so scraper updates appear within 30 s.
  useEffect(() => {
    const load = () =>
      fetch('/data/matches.json')
        .then(r => r.json())
        .then((d: MatchesPayload) => { setMatches(d.matches ?? []); setError(false) })
        .catch(() => setError(true))
        .finally(() => setLoading(false))
    load()
    const id = setInterval(load, MATCHES_POLL_MS)
    return () => clearInterval(id)
  }, [])

  // Trigger live polling off the *cached* state so it persists across the
  // in → post transition until the scraper rewrites the file.
  const liveMatchId = useMemo(
    () => matches.find(m => m.statusState === 'in')?.id ?? null,
    [matches]
  )

  useEffect(() => {
    if (!liveMatchId) { setLiveOverlay({}); return }
    const fetchLive = async () => {
      try {
        const today     = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10).replace(/-/g, '')
        const r = await fetch(`/espn-api/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${yesterday}-${today}&limit=50`)
        const data = await r.json()
        const overlay: Record<string, LiveOverlay> = {}
        for (const event of data.events ?? []) {
          const comp = event.competitions?.[0]
          if (!comp) continue
          // Capture every event's real-time state — including post — so a
          // finished match stops showing as live before the scraper catches up.
          const state = (comp.status?.type?.state ?? 'pre') as LiveOverlay['state']
          const h = comp.competitors?.find((c: any) => c.homeAway === 'home')
          const a = comp.competitors?.find((c: any) => c.homeAway === 'away')
          overlay[event.id] = {
            state,
            clock: comp.status?.displayClock ?? comp.status?.type?.shortDetail ?? 'LIVE',
            statusDetail: comp.status?.type?.shortDetail ?? '',
            homeScore: h?.score != null ? parseInt(h.score, 10) : null,
            awayScore: a?.score != null ? parseInt(a.score, 10) : null,
          }
        }
        setLiveOverlay(overlay)
      } catch { /* silently ignore — fall back to cached data */ }
    }
    fetchLive()
    const id = setInterval(fetchLive, LIVE_POLL_MS)
    return () => clearInterval(id)
  }, [liveMatchId])

  // Overlay the real-time ESPN state/score onto the cached matches so kick-offs
  // and finishes reflect within 30 s without waiting for the scraper.
  const effectiveMatches = useMemo(() =>
    matches.map(m => {
      const ov = liveOverlay[m.id]
      if (!ov) return m
      return {
        ...m,
        statusState: ov.state ?? m.statusState,
        // While live, surface the ticking ESPN clock; otherwise keep the label.
        statusDetail: ov.state === 'in'
          ? (ov.clock || ov.statusDetail || m.statusDetail)
          : (ov.statusDetail || m.statusDetail),
        home: { ...m.home, score: ov.homeScore ?? m.home.score },
        away: { ...m.away, score: ov.awayScore ?? m.away.score },
      }
    }),
    [matches, liveOverlay]
  )

  return { matches: effectiveMatches, liveOverlay, loading, error }
}
