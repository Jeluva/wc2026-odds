import { createContext, useContext, useState, type ReactNode } from 'react'
import { en, type Translations } from './en'
import { es, teamNames } from './es'

type Lang = 'en' | 'es'

interface LangCtx {
  lang: Lang
  t: Translations
  toggle: () => void
  tn: (name: string) => string
  tg: (group: string) => string
}

const identity = (s: string) => s
const LangContext = createContext<LangCtx>({ lang: 'en', t: en, toggle: () => {}, tn: identity, tg: identity })

export function LangProvider({ children }: { children: ReactNode }) {
  const stored = (localStorage.getItem('lang') as Lang) || 'en'
  const [lang, setLang] = useState<Lang>(stored)

  const toggle = () => {
    const next: Lang = lang === 'en' ? 'es' : 'en'
    setLang(next)
    localStorage.setItem('lang', next)
  }

  const tn = lang === 'es'
    ? (name: string) => teamNames[name] ?? name
    : (name: string) => name

  const tg = lang === 'es'
    ? (group: string) => group.replace(/^Group /, 'Grupo ')
    : (group: string) => group

  return (
    <LangContext.Provider value={{ lang, t: lang === 'en' ? en : es, toggle, tn, tg }}>
      {children}
    </LangContext.Provider>
  )
}

export const useT = () => useContext(LangContext)
