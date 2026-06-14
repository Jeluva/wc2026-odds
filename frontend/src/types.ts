// ESPN-scraped data types
export interface ScrapedTeam {
  id: string
  name: string
  abbr: string
  color: string      // hex with #, e.g. "#fee000"
  altColor: string   // hex with #
  isoCode: string    // ISO 3166-1 alpha-2 for flagcdn.com
  flagUrl: string    // https://flagcdn.com/w80/{iso}.png
  score: number | null
  winner: boolean
}

export interface MatchOdds {
  // Moneyline close (current)
  homeMoneyline: string | null
  awayMoneyline: string | null
  drawMoneyline: string | null
  // Moneyline open (for movement)
  homeMoneylineOpen: string | null
  awayMoneylineOpen: string | null
  drawMoneylineOpen: string | null
  // Win probabilities (normalized %)
  homeWinPct: number
  drawPct: number
  awayWinPct: number
  // Over/Under
  overUnder: number | null
  overOdds: string | null
  underOdds: string | null
  overOddsOpen: string | null
  underOddsOpen: string | null
  // Spread/Handicap (both sides)
  spreadHomeLine: string | null
  spreadHomeOdds: string | null
  spreadLine: string | null      // away side line
  spreadOdds: string | null      // away side close
  spreadOddsOpen: string | null  // away side open
  // DraftKings deep-link bet URLs
  dkHomeBetUrl: string | null
  dkDrawBetUrl: string | null
  dkAwayBetUrl: string | null
  dkOverBetUrl: string | null
  dkUnderBetUrl: string | null
  dkHomeSpreadBetUrl: string | null
  dkAwaySpreadBetUrl: string | null
  provider: string
}

export interface ScrapedMatch {
  id: string
  date: string          // ISO string, e.g. "2026-06-14T01:00Z"
  name: string          // e.g. "Scotland at Haiti"
  group: string         // e.g. "Group C"
  venue: string
  statusState: 'pre' | 'in' | 'post'
  statusDetail: string  // "FT", "74'", ""
  home: ScrapedTeam
  away: ScrapedTeam
  odds: MatchOdds | null
  espnUrl: string
}

export interface ScrapedStandingEntry {
  id: string
  name: string
  abbr: string
  color: string
  altColor: string
  isoCode: string
  flagUrl: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  pts: number
}

export interface MatchesPayload {
  updated: string
  matches: ScrapedMatch[]
}

export interface StandingsPayload {
  updated: string
  standings: Record<string, ScrapedStandingEntry[]>
}
