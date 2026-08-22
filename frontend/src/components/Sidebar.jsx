import { NavLink } from 'react-router-dom'
import Icon from './Icon'

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/new', label: 'New Analysis', icon: 'scan' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

function Item({ to, label, icon, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-3 pl-3 pr-3 h-10 rounded-[10px]',
          'text-[13px] font-medium transition-all duration-150',
          isActive
            ? 'bg-white/[0.07] text-white'
            : 'text-ink-400 hover:text-white hover:bg-white/[0.04]',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={[
              'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-200',
              isActive ? 'h-5 bg-accent' : 'h-0 bg-transparent',
            ].join(' ')}
          />
          <Icon
            name={icon}
            size={17}
            className={isActive ? 'text-accent' : 'text-ink-600 group-hover:text-ink-400'}
          />
          {label}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }) {
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
        <div className="h-[68px] flex items-center gap-3 px-5 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-[10px] bg-accent flex items-center justify-center
                          text-white text-[12px] font-bold shrink-0
                          shadow-[0_0_0_1px_rgba(59,130,246,0.35),0_6px_16px_-6px_rgba(59,130,246,0.8)]">
            KA
          </div>
          <div className="leading-tight">
            <div className="text-white text-[14px] font-bold tracking-[-0.01em]">Knee Analysis</div>
            <div className="text-ink-600 text-[11px]">Clinical Decision Support</div>
          </div>
        </div>

        <nav className="px-3 pt-5 pb-3 flex-1">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.13em] text-ink-700">
            Workspace
          </p>
          <div className="space-y-1">
            {NAV.map((n) => (
              <Item key={n.to} {...n} onClick={onClose} />
            ))}
          </div>
        </nav>

        <div className="p-3">
          <div className="rounded-[10px] bg-white/[0.04] ring-1 ring-white/[0.05] p-3.5">
            <div className="flex items-center gap-2 text-ink-300">
              <Icon name="shield" size={14} className="text-ok" />
              <span className="text-[11px] font-semibold">Research use</span>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-ink-600">
              Decision support only. Final diagnosis remains with the clinician.
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
