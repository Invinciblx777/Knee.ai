import { NavLink } from 'react-router-dom'
import { useLanguage } from '../lib/LanguageContext'
import Icon from './Icon'

const NAV = [
  { to: '/', key: 'navDashboard', icon: 'dashboard', end: true },
  { to: '/new', key: 'navNewAnalysis', icon: 'scan' },
  { to: '/oa', key: 'navOa', icon: 'ruler' },
  { to: '/implant', key: 'navImplant', icon: 'implant' },
  { to: '/history', key: 'navHistory', icon: 'history' },
  { to: '/research', key: 'navResearch', icon: 'layers' },
  { to: '/settings', key: 'navSettings', icon: 'settings' },
  { to: '/about', key: 'navAbout', icon: 'file' },
]

function Item({ to, label, icon, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-3 pl-3 pr-3 h-11 rounded-[10px]',
          'text-[14px] font-display font-medium transition-all duration-150',
          isActive
            ? 'bg-accent text-white shadow-[2px_2px_0_#1A130D]'
            : 'text-ink-400 hover:text-white hover:bg-white/[0.06]',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            name={icon}
            size={18}
            className={isActive ? 'text-white' : 'text-ink-600 group-hover:text-ink-400'}
          />
          {label}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }) {
  const { t } = useLanguage()

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-navy/50 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-[228px] bg-navy flex flex-col',
          'transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        ].join(' ')}
      >
        {/* Brand — clean serif, no logo box */}
        <div className="h-[68px] flex items-center px-5 border-b border-white/[0.08]">
          <div className="leading-tight">
            <div className="text-white text-[20px] font-serif font-semibold tracking-[-0.02em]">
              Knee<span className="text-accent">.AI</span>
            </div>
            <div className="text-ink-600 text-[10px] font-display tracking-widest uppercase">
              {t('tagline')}
            </div>
          </div>
        </div>

        <nav className="px-3 pt-5 pb-3 flex-1">
          <p className="px-3 pb-2 text-[10px] font-display font-bold uppercase tracking-[0.15em] text-ink-700">
            Menu
          </p>
          <div className="space-y-1.5">
            {NAV.map((n) => (
              <Item key={n.to} to={n.to} icon={n.icon} end={n.end} label={t(n.key)} onClick={onClose} />
            ))}
          </div>
        </nav>

        <div className="p-3">
          <div className="rounded-[10px] bg-white/[0.04] ring-1 ring-white/[0.06] p-3.5">
            <div className="flex items-center gap-2 text-ink-300">
              <Icon name="shield" size={14} className="text-ok" />
              <span className="text-[11px] font-display font-semibold">{t('clinicalTool')}</span>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-ink-600">
              {t('clinicalToolDesc')}
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
