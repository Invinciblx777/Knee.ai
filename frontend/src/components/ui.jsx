import { Link } from 'react-router-dom'

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
          <h2 className="card-title">{title}</h2>
          {action}
        </div>
      )}
      <div className="card-pad">{children}</div>
    </section>
  )
}

const SEVERITY = {
  Normal: 'bg-ok/10 text-ok border-ok/30',
  'Mild OA': 'bg-accent/10 text-accent border-accent/30',
  'Moderate OA': 'bg-warn/10 text-warn border-warn/30',
  'Severe OA': 'bg-danger/10 text-danger border-danger/30',
}

export function SeverityBadge({ value, size = 'md' }) {
  const cls = SEVERITY[value] || 'bg-surface text-muted border-line'
  const dims = size === 'lg' ? 'text-[15px] px-3.5 py-1.5' : 'text-[12px] px-2.5 py-1'
  return (
    <span className={`inline-flex items-center rounded-card border font-semibold ${cls} ${dims}`}>
      {value}
    </span>
  )
}

export function Stat({ label, value, unit, hint, tone = 'default' }) {
  const tones = {
    default: 'text-navy',
    good: 'text-ok',
    bad: 'text-danger',
    accent: 'text-accent',
  }
  return (
    <div className="card card-pad">
      <div className="card-title">{label}</div>
      <div className={`mt-2 text-[26px] font-semibold leading-none ${tones[tone]}`}>
        {value}
        {unit && <span className="text-[13px] font-medium text-muted ml-1">{unit}</span>}
      </div>
      {hint && <p className="mt-2 text-[12px] text-muted leading-snug">{hint}</p>}
    </div>
  )
}

export function Empty({ title, body, cta }) {
  return (
    <div className="card card-pad text-center py-14">
      <h3 className="text-[15px] font-semibold text-navy">{title}</h3>
      <p className="mt-1.5 text-[13px] text-muted max-w-md mx-auto">{body}</p>
      {cta && (
        <Link to={cta.to} className="btn-primary mt-5">
          {cta.label}
        </Link>
      )}
    </div>
  )
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-2.5 text-[13px] text-muted">
      <span className="w-4 h-4 rounded-full border-2 border-line border-t-accent animate-spin" />
      {label}
    </div>
  )
}

export function ErrorNote({ children }) {
  if (!children) return null
  return (
    <div className="rounded-card border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-[13px] text-danger">
      {children}
    </div>
  )
}

export function Disclaimer() {
  return (
    <p className="text-[11px] text-muted leading-relaxed border-t border-line pt-4">
      This tool is intended for research and decision support only. Final diagnosis remains with the
      clinician. All measurements shown are produced by a simulated segmentation pipeline seeded
      deterministically from the image hash.
    </p>
  )
}

const MODE_STYLE = {
  model_inference: 'bg-ok/10 text-ok border-ok/30',
  demo: 'bg-warn/10 text-warn border-warn/40',
}

export function ModeBadge({ mode, label, size = 'md' }) {
  const cls = MODE_STYLE[mode] || 'bg-surface text-muted border-line'
  const dims = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-[12px] px-2.5 py-1'
  const dot = mode === 'model_inference' ? 'bg-ok' : 'bg-warn'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${cls} ${dims}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label || (mode === 'model_inference' ? 'Model Inference' : 'Demo Mode')}
    </span>
  )
}

export function DemoBanner({ text }) {
  if (!text) return null
  return (
    <div
      role="status"
      className="w-full rounded-card border border-amber-300 bg-amber-100 px-4 py-3.5
                 flex items-start gap-3 text-[13px] leading-relaxed text-amber-950"
    >
      <span aria-hidden="true" className="text-[16px] leading-none mt-px">⚠️</span>
      <p className="font-medium">{text}</p>
    </div>
  )
}
