import { createContext, useContext, useEffect, useState } from 'react'
import { DEFAULT_LANGUAGE, DICTIONARIES, LANGUAGES } from './i18n'

const STORAGE_KEY = 'knee-ai-language'

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key) => key,
})

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return DICTIONARIES[v] ? v : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStored)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = (code) => {
    if (!DICTIONARIES[code]) return
    setLanguageState(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // private-browsing or storage disabled — language just won't persist
    }
  }

  const dict = DICTIONARIES[language] || DICTIONARIES[DEFAULT_LANGUAGE]
  const t = (key) => dict[key] ?? DICTIONARIES[DEFAULT_LANGUAGE][key] ?? key

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
