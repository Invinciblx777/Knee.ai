import { useEffect, useState } from 'react'
import { health } from '../lib/api'

export default function Topbar({ onMenu }) {
  const [api, setApi] = useState('checking')

  useEffect(() => {
    health().then(() => setApi('online')).catch(() => setApi('offline'))
  }, [])

  const dot =
    api === 'online' ? 'bg-ok' : api === 'offline' ? 'bg-danger' : 'bg-muted'

  return (
    <header className="h-14 border-b border-line flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-white sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          className="lg:hidden w-9 h-9 -ml-1 rounded-card border border-line flex items-center justify-center"
          aria-label="Open navigation"
        >
          <span className="block w-4 h-[2px] bg-navy relative before:absolute before:-top-[5px] before:left-0 before:w-4 before:h-[2px] before:bg-navy after:absolute after:top-[5px] after:left-0 after:w-4 after:h-[2px] after:bg-navy" />
        </button>
        <h1 className="text-[15px] font-semibold text-navy">
          AI-Assisted Knee Analysis Platform
        </h1>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        API {api}
      </div>
    </header>
  )
}
