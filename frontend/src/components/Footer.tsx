import { useT } from '../i18n/LangContext'

export function Footer() {
  const { t } = useT()
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
        <p className="text-xs text-fog/50">
          {t.footer.updated}: {new Date().toLocaleString()}
        </p>
      </div>
    </footer>
  )
}
