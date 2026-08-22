import { useState } from 'react'
import { imageUrl, variantKey } from '../lib/api'
import Icon, { IconChip } from './Icon'

const STRUCTURES = [
  { key: 'femur', label: 'Femur', color: '#3B82F6' },
  { key: 'meniscus', label: 'Meniscus', color: '#10B981' },
  { key: 'tibia', label: 'Tibia', color: '#EF4444' },
]

export default function Viewer({ result }) {
  const [toggles, setToggles] = useState({ femur: true, meniscus: true, tibia: true })

  const variants = result.images.variants
  const original = imageUrl(variants.none)
  const annotated = imageUrl(variants[variantKey(toggles)])
  const activeCount = STRUCTURES.filter((s) => toggles[s.key]).length

  const flip = (k) => setToggles((t) => ({ ...t, [k]: !t[k] }))

  return (
    <section className="card">
      <div className="card-head">
        <div className="flex items-center gap-3">
          <IconChip name="scan" tone="navy" />
          <div>
            <p className="eyebrow mb-0.5">Imaging</p>
            <h2 className="card-title">Visualization</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-[11px] text-muted">
            {activeCount} of 3 overlays
          </span>
          <div className="inline-flex items-center gap-1 p-1 rounded-[10px] bg-page ring-1 ring-line">
            {STRUCTURES.map((s) => {
              const on = toggles[s.key]
              return (
                <button
                  key={s.key}
                  onClick={() => flip(s.key)}
                  aria-pressed={on}
                  className={on ? 'segment-on' : 'segment-off'}
                >
                  <span
                    className="w-2 h-2 rounded-full transition-all duration-150"
                    style={{
                      backgroundColor: on ? s.color : 'transparent',
                      boxShadow: on ? `0 0 0 3px ${s.color}22` : `inset 0 0 0 1.5px #CBD5E1`,
                    }}
                  />
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="card-pad grid grid-cols-1 md:grid-cols-2 gap-4">
        <figure className="group">
          <div className="stage relative">
            <img src={original} alt="Original upload" className="w-full h-auto" />
            <span className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/55 backdrop-blur-sm
                             text-[10px] font-semibold uppercase tracking-wider text-white/80">
              Source
            </span>
          </div>
          <figcaption className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted">
            <Icon name="file" size={12} className="text-ink-300" />
            Original
          </figcaption>
        </figure>

        <figure className="group">
          <div className="stage relative">
            <img src={annotated} alt="Annotated segmentation" className="w-full h-auto" />
            <span className="absolute top-3 left-3 px-2 py-1 rounded-md bg-accent/85 backdrop-blur-sm
                             text-[10px] font-semibold uppercase tracking-wider text-white">
              Segmented
            </span>
          </div>
          <figcaption className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted">
            <Icon name="layers" size={12} className="text-ink-300" />
            Segmentation with measurement callouts
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
