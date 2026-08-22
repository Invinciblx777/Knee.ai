import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/new', label: 'New Analysis' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
]

function Item({ to, label, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        [
          'block px-3 py-2 rounded-card text-[14px] font-medium transition-colors',
          isActive ? 'bg-accent/10 text-accent' : 'text-slate-300 hover:bg-white/5 hover:text-white',
        ].join(' ')
      }
    >
      {label}
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-navy/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-60 bg-navy flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        ].join(' ')}
      >
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-white/10">
          <div className="w-7 h-7 rounded bg-accent flex items-center justify-center text-white text-[12px] font-bold">
            KA
          </div>
          <div className="leading-tight">
            <div className="text-white text-[13px] font-semibold">Knee Analysis</div>
            <div className="text-slate-400 text-[10px]">Clinical Decision Support</div>
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          {NAV.map((n) => (
            <Item key={n.to} {...n} onClick={onClose} />
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <p className="text-[10px] leading-relaxed text-slate-400">
            Research and decision support only. Final diagnosis remains with the clinician.
          </p>
        </div>
      </aside>
    </>
  )
}
