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
          'group relative flex items-center gap-3 pl-3.5 pr-3 h-11 rounded-[10px]',
          'text-[13px] font-display font-bold transition-all duration-150',
          isActive ? 'bg-accent text-white' : 'bg-surface text-navy hover:bg-page',
        ].join(' ')
      }
      style={({ isActive }) => ({
        border: '2px solid #2D2016',
        boxShadow: isActive ? '1px 1px 0 #2D2016' : '3px 3px 0 #2D2016',
        transform: isActive ? 'translate(2px, 2px)' : 'none',
      })}
    >
      {({ isActive }) => (
        <>
          <Icon name={icon} size={17} className={isActive ? 'text-white' : 'text-navy/70 group-hover:text-navy'} />
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
          'fixed inset-y-0 left-0 z-40 w-[228px] bg-page flex flex-col',
          'transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        ].join(' ')}
      >
        {/* Brand — its own 3D toon box, same style as the measurement/implant cards */}
        <div className="p-3 pb-1">
          <div
            className="rounded-[12px] bg-surface px-4 py-3.5"
            style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}
          >
            <div className="text-navy text-[19px] font-serif font-bold tracking-[-0.02em] leading-tight">
              Knee<span className="text-accent">.AI</span>
            </div>
            <div className="text-muted text-[9px] font-display font-semibold tracking-widest uppercase mt-0.5">
              {t('tagline')}
            </div>
          </div>
        </div>

        <nav className="px-3 pt-4 pb-3 flex-1 overflow-y-auto">
          <p className="px-1 pb-2 text-[10px] font-display font-bold uppercase tracking-[0.15em] text-muted">
            Menu
          </p>
          <div className="space-y-2">
            {NAV.map((n) => (
              <Item key={n.to} to={n.to} icon={n.icon} end={n.end} label={t(n.key)} onClick={onClose} />
            ))}
          </div>
        </nav>

        <div className="p-3">
          <div
            className="rounded-[12px] bg-surface p-3.5"
            style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}
          >
            <div className="flex items-center gap-2 text-navy">
              <Icon name="shield" size={14} className="text-ok" />
              <span className="text-[11px] font-display font-bold">{t('clinicalTool')}</span>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted font-display">
              {t('clinicalToolDesc')}
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
