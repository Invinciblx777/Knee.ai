import { Link } from 'react-router-dom'
import Icon, { IconChip } from './Icon'

export function Card({ title, eyebrow, icon, tone = 'slate', action, children, className = '', bodyClass = 'card-pad' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          <div className="flex items-center gap-3 min-w-0">
            {icon && <IconChip name={icon} tone={tone} />}
            <div className="min-w-0">
              {eyebrow && <p className="eyebrow mb-0.5">{eyebrow}</p>}
              <h2 className="card-title truncate">{title}</h2>
            </div>
          </div>
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

const SEVERITY = {
  Normal: { cls: 'bg-ok-light text-ok ring-ok/20', dot: 'bg-ok' },
  'Mild OA': { cls: 'bg-accent-light text-accent ring-accent/20', dot: 'bg-accent' },
  'Moderate OA': { cls: 'bg-warn-light text-warn ring-warn/25', dot: 'bg-warn' },
  'Severe OA': { cls: 'bg-danger-light text-danger ring-danger/20', dot: 'bg-danger' },
}

export function SeverityBadge({ value, size = 'md' }) {
  const s = SEVERITY[value] || { cls: 'bg-page text-muted ring-line', dot: 'bg-ink-400' }
  const dims = size === 'lg' ? 'text-[15px] px-3.5 py-2' : 'text-[12px] px-2.5 py-1'
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full ring-1 font-semibold ${s.cls} ${dims}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {value}
    </span>
  )
}

const MODE_STYLE = {
  model_inference: 'bg-ok-light text-ok ring-ok/25',
  demo: 'bg-warn-light text-warn ring-warn/30',
}

export function ModeBadge({ mode, label, size = 'md' }) {
  const cls = MODE_STYLE[mode] || 'bg-page text-muted ring-line'
  const dims = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-[12px] px-2.5 py-1'
  const isModel = mode === 'model_inference'
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full ring-1 font-semibold ${cls} ${dims}`}>
      <Icon name={isModel ? 'sparkle' : 'alert'} size={size === 'sm' ? 11 : 12} />
      {label || (isModel ? 'Model Inference' : 'Demo Mode')}
    </span>
  )
}

/** Metric tile: eyebrow + icon chip, then whatever value the caller renders. */
export function Tile({ label, icon, tone = 'slate', children, footer, className = '' }) {
  return (
    <div className={`card card-hover card-pad flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow pt-1">{label}</p>
        <IconChip name={icon} tone={tone} size="sm" />
      </div>
      <div className="mt-4 flex-1">{children}</div>
      {footer && <div className="mt-3.5 pt-3.5 border-t border-line">{footer}</div>}
    </div>
  )
}

export function Stat({ label, value, unit, hint, tone = 'default', icon = 'activity' }) {
  const tones = {
    default: 'text-navy',
    good: 'text-ok',
    bad: 'text-danger',
    accent: 'text-accent',
    amber: 'text-warn',
  }
  return (
    <Tile label={label} icon={icon} tone={tone === 'default' ? 'slate' : tone === 'good' ? 'green' : tone === 'bad' ? 'red' : tone === 'amber' ? 'amber' : 'blue'}>
      <div className={`metric ${tones[tone]}`}>
        {value}
        {unit && <span className="text-[15px] font-semibold text-muted ml-1.5 tracking-normal">{unit}</span>}
      </div>
      {hint && <p className="mt-3 card-sub">{hint}</p>}
    </Tile>
  )
}

/**
 * Radial gauge for the KL grade — an 0–4 scale reads better as a filled arc
 * than as a bare number.
 */
export function Gauge({ value, max = 4, color = '#F59E0B', size = 92, label }) {
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(value / max, 1))

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-bold text-navy leading-none tnum">{value}</span>
        {label && <span className="text-[10px] text-muted mt-1">{label}</span>}
      </div>
    </div>
  )
}

/** Patient value against a reference, drawn as two stacked tracks. */
export function CompareBar({ value, reference, max, color = '#3B82F6' }) {
  const pct = (v) => `${Math.max(0, Math.min(v / max, 1)) * 100}%`
  return (
    <div className="w-[104px] space-y-1">
      <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: pct(value), backgroundColor: color }} />
      </div>
      <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
        <div className="h-full rounded-full bg-ink-300" style={{ width: pct(reference) }} />
      </div>
    </div>
  )
}

export function Empty({ title, body, cta, icon = 'scan' }) {
  return (
    <div className="card card-pad text-center py-16">
      <IconChip name={icon} tone="blue" className="mx-auto" />
      <h3 className="mt-4 text-[15px] font-bold text-navy">{title}</h3>
      <p className="mt-1.5 text-[13px] text-muted max-w-md mx-auto">{body}</p>
      {cta && (
        <Link to={cta.to} className="btn-primary mt-5">
          <Icon name="scan" size={15} />
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
    <div className="rounded-[10px] ring-1 ring-danger/25 bg-danger-light px-4 py-3
                    flex items-start gap-2.5 text-[13px] text-danger">
      <Icon name="alert" size={15} className="mt-px shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export function DemoBanner({ text }) {
  if (!text) return null
  return (
    <div
      role="status"
      className="w-full rounded-card ring-1 ring-warn/30 bg-warn-light px-5 py-4
                 flex items-start gap-3.5 animate-fade-up"
    >
      <span className="w-9 h-9 rounded-[10px] bg-warn/15 text-warn flex items-center justify-center shrink-0">
        <Icon name="alert" size={17} />
      </span>
      <div>
        <p className="text-[13px] font-bold text-amber-900">Demo Mode</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-amber-900/80">
          {text.replace(/^Demo Mode\s*—\s*/, '')}
        </p>
      </div>
    </div>
  )
}

export function Disclaimer() {
  return (
    <div className="flex items-start gap-2.5 border-t border-line pt-6">
      <Icon name="shield" size={15} className="text-ink-300 mt-px shrink-0" />
      <p className="text-[12px] text-muted leading-relaxed">
        This tool is intended for research and decision support only. Final diagnosis remains with the
        clinician. All measurements shown are produced by a simulated segmentation pipeline seeded
        deterministically from the image hash.
      </p>
    </div>
  )
}
