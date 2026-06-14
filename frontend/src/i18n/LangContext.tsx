import { createContext, useContext, useState, type ReactNode } from 'react'
import { en, type Translations } from './en'
import { es } from './es'

type Lang = 'en' | 'es'

interface LangCtx {
  lang: Lang
  t: Translations
  toggle: () => void
}

const LangContext = createContext<LangCtx>({ lang: 'en', t: en, toggle: () => {} })

export function LangProvider({ children }: { children: ReactNode }) {
  const stored = (localStorage.getItem('lang') as Lang) || 'en'
  const [lang, setLang] = useState<Lang>(stored)

  const toggle = () => {
    const next: Lang = lang === 'en' ? 'es' : 'en'
    setLang(next)
    localStorage.setItem('lang', next)
  }

  return (
    <LangContext.Provider value={{ lang, t: lang === 'en' ? en : es, toggle }}>
      {children}
    </LangContext.Provider>
  )
}

export const useT = () => useContext(LangContext)
