import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { health } from '../lib/api'
import { useLanguage } from '../lib/LanguageContext'
import Icon from './Icon'
import LanguageSwitcher from './LanguageSwitcher'

const CRUMB_KEYS = {
  '/': 'crumbOverview',
  '/new': 'navNewAnalysis',
  '/oa': 'crumbOa',
  '/implant': 'crumbImplant',
  '/history': 'navHistory',
  '/research': 'crumbResearch',
  '/settings': 'navSettings',
  '/about': 'crumbAbout',
}

export default function Topbar({ onMenu }) {
  const [api, setApi] = useState('checking')
  const { pathname } = useLocation()
  const { t } = useLanguage()

  useEffect(() => {
    health().then(() => setApi('online')).catch(() => setApi('offline'))
  }, [])

  const crumbKey = CRUMB_KEYS[pathname] || (pathname.startsWith('/oa') ? 'crumbOa'
    : pathname.startsWith('/implant') ? 'crumbImplant'
    : pathname.startsWith('/results') ? 'crumbAnalysisResult' : 'crumbOverview')
  const online = api === 'online'
  const dot = online ? 'bg-ok' : api === 'offline' ? 'bg-danger' : 'bg-ink-400'
  const apiLabel = online ? t('apiOnline') : api === 'offline' ? t('apiOffline') : t('apiChecking')

  return (
    <header
      className="h-[68px] flex items-center justify-between
                 px-5 sm:px-6 lg:px-8 bg-surface/85 backdrop-blur-md sticky top-0 z-20"
      style={{ borderBottom: '2px solid #2D2016' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenu}
          className="lg:hidden w-9 h-9 -ml-1 rounded-[10px] flex items-center
                     justify-center transition-colors duration-150 hover:bg-page"
          style={{ border: '2px solid #2D2016' }}
          aria-label="Open navigation"
        >
          <span className="block w-4 h-[2px] bg-navy relative before:absolute before:-top-[5px] before:left-0 before:w-4 before:h-[2px] before:bg-navy after:absolute after:top-[5px] after:left-0 after:w-4 after:h-[2px] after:bg-navy" />
        </button>

        <nav className="flex items-center gap-2 min-w-0" aria-label="Breadcrumb">
          <span className="text-[14px] font-serif font-semibold text-navy whitespace-nowrap">
            Knee<span className="text-accent">.AI</span>
          </span>
          <Icon name="chevron" size={13} className="text-ink-300 shrink-0" />
          <span className="text-[13px] font-display text-muted truncate">{t(crumbKey)}</span>
        </nav>
      </div>

      <div className="flex items-center gap-2.5">
        <LanguageSwitcher />

        <span
          className="hidden sm:inline-flex items-center gap-2 h-8 px-3 rounded-full
                     bg-surface text-[12px] font-display font-medium text-muted"
          style={{ border: '2px solid #2D2016' }}
        >
          <span className="relative flex w-2 h-2">
            {online && (
              <span className="absolute inline-flex w-2 h-2 rounded-full bg-ok animate-pulse-dot" />
            )}
            <span className={`relative inline-flex w-2 h-2 rounded-full ${dot}`} />
          </span>
          {apiLabel}
        </span>
      </div>
    </header>
  )
}
