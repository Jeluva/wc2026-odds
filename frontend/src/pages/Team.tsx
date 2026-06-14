import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n/LangContext'

// Team detail page is no longer reachable from main navigation.
// Redirect visitors back to home.
export function Team() {
  const navigate = useNavigate()
  const { t } = useT()

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-center">
      <p className="text-fog mb-4">{t.team.backTo}</p>
      <button
        onClick={() => navigate('/')}
        className="text-sm font-semibold text-gold hover:underline"
      >
        ← Home
      </button>
    </main>
  )
}
