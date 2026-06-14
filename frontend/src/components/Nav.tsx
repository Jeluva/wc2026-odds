import { NavLink, useLocation } from 'react-router-dom'
import { useT } from '../i18n/LangContext'

export function Nav() {
  const { t, lang, toggle } = useT()
  const location = useLocation()

  const tabs = [
    { to: '/', label: t.nav.home },
    { to: '/groups', label: t.nav.groups },
    { to: '/standings', label: t.nav.standings },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06]"
      style={{ background: 'rgba(10,22,40,0.92)', backdropFilter: 'blur(16px)' }}>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
            style={{ background: 'linear-gradient(135deg, #f5a623, #e8890a)' }}>
            ⚽
          </div>
          <div className="hidden sm:block">
            <span className="font-black text-chalk text-sm tracking-tight">WC 2026</span>
            <span className="ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-md bg-grass/20 text-grass">
              LIVE
            </span>
          </div>
        </NavLink>

        <nav className="flex items-center gap-1">
          {tabs.map(tab => {
            const active = tab.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.to)
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  active
                    ? 'text-pitch font-bold'
                    : 'text-fog hover:text-chalk hover:bg-white/5'
                }`}
                style={active ? { background: 'linear-gradient(135deg, #f5a623, #ffd97d)' } : {}}
              >
                {tab.label}
              </NavLink>
            )
          })}
        </nav>

        <button
          onClick={toggle}
          className="text-xs font-bold px-3 py-1.5 rounded-full border border-white/10 text-fog hover:text-chalk hover:border-white/20 transition-all"
        >
          {lang === 'en' ? 'ES' : 'EN'}
        </button>
      </div>
    </header>
  )
}
