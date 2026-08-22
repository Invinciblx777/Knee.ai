import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../lib/LanguageContext'
import Icon from './Icon'

export default function LanguageSwitcher() {
  const { language, setLanguage, languages, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = languages.find((l) => l.code === language) || languages[0]

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onEsc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full
                   bg-surface text-[12px] font-display font-medium text-muted
                   hover:bg-page transition-colors duration-150"
        style={{ border: '2px solid #2D2016' }}
        aria-label={t('language')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Icon name="globe" size={13} />
        <span className="text-navy font-semibold">{current.native}</span>
        <Icon name="chevron" size={11} className={`text-ink-300 transition-transform duration-150 rotate-90 ${open ? '-scale-y-100' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-44 rounded-[12px] bg-surface overflow-hidden
                     animate-fade-up"
          style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}
        >
          {languages.map((l) => (
            <button
              key={l.code}
              role="option"
              aria-selected={l.code === language}
              onClick={() => { setLanguage(l.code); setOpen(false) }}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left
                          text-[13px] font-display transition-colors duration-150
                          ${l.code === language ? 'bg-accent-light text-accent font-semibold' : 'text-navy hover:bg-page'}`}
            >
              <span>{l.native}</span>
              <span className="text-[10px] text-muted">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
