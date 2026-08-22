import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { health } from '../lib/api'
import Icon from './Icon'

const CRUMBS = {
  '/': 'Dashboard',
  '/new': 'New Analysis',
  '/history': 'History',
  '/settings': 'Settings',
}

export default function Topbar({ onMenu }) {
  const [api, setApi] = useState('checking')
  const { pathname } = useLocation()

  useEffect(() => {
    health().then(() => setApi('online')).catch(() => setApi('offline'))
  }, [])

  const crumb = CRUMBS[pathname] || (pathname.startsWith('/results') ? 'Analysis Result' : 'Overview')
  const online = api === 'online'
  const dot = online ? 'bg-ok' : api === 'offline' ? 'bg-danger' : 'bg-ink-400'

  return (
    <header
      className="h-[68px] border-b border-line flex items-center justify-between
                 px-5 sm:px-6 lg:px-8 bg-surface/85 backdrop-blur-md sticky top-0 z-20"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenu}
          className="lg:hidden w-9 h-9 -ml-1 rounded-[10px] border border-line flex items-center
                     justify-center transition-colors duration-150 hover:bg-page"
          aria-label="Open navigation"
        >
          <span className="block w-4 h-[1.5px] bg-navy relative before:absolute before:-top-[5px] before:left-0 before:w-4 before:h-[1.5px] before:bg-navy after:absolute after:top-[5px] after:left-0 after:w-4 after:h-[1.5px] after:bg-navy" />
        </button>

        <nav className="flex items-center gap-2 min-w-0" aria-label="Breadcrumb">
          <span className="text-[13px] font-semibold text-navy whitespace-nowrap">KneeAI</span>
          <Icon name="chevron" size={13} className="text-ink-300 shrink-0" />
          <span className="text-[13px] text-muted truncate">{crumb}</span>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden sm:inline-flex items-center gap-2 h-8 px-3 rounded-full
                         border border-line bg-surface text-[12px] font-medium text-muted">
          <span className="relative flex w-2 h-2">
            {online && (
              <span className="absolute inline-flex w-2 h-2 rounded-full bg-ok animate-pulse-dot" />
            )}
            <span className={`relative inline-flex w-2 h-2 rounded-full ${dot}`} />
          </span>
          API {online ? 'Online' : api === 'offline' ? 'Offline' : 'Checking'}
        </span>
      </div>
    </header>
  )
}
