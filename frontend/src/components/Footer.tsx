import { useState, useEffect } from 'react'
import { useT } from '../i18n/LangContext'

export function Footer() {
  const { t, lang } = useT()
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    fetch('/data/matches.json')
      .then(r => r.json())
      .then(d => {
        if (d.updated) {
          const locale = lang === 'es' ? 'es' : 'en-US'
          setUpdatedAt(new Date(d.updated).toLocaleString(locale))
        }
      })
      .catch(() => {})
  }, [lang])

  return (
    <footer className="border-t border-white/[0.06] mt-16 py-8"
      style={{ background: 'rgba(10,22,40,0.6)' }}>
      <div className="max-w-6xl mx-auto px-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-xl">⚽</span>
          <span className="font-black text-chalk text-sm">WC 2026 Odds</span>
        </div>
        <p className="text-xs text-fog">{t.footer.disclaimer}</p>
        <p className="text-xs text-fog">
          {t.footer.sources}:{' '}
          <a href="https://www.espn.com/soccer/worldcup/" target="_blank" rel="noopener noreferrer"
            className="text-gold hover:underline">ESPN</a>
          {' · '}
          <a href="https://www.draftkings.com" target="_blank" rel="noopener noreferrer"
            className="text-gold hover:underline">DraftKings</a>
          {' · '}
          <a href="https://flagcdn.com" target="_blank" rel="noopener noreferrer"
            className="text-gold hover:underline">flagcdn.com</a>
        </p>
        <p className="text-[10px] text-fog/40 mt-2">{t.footer.responsible}</p>
        {updatedAt && (
          <p className="text-xs text-fog/50 mt-1">
            {t.footer.updated}: {updatedAt}
          </p>
        )}
      </div>
    </footer>
  )
}
