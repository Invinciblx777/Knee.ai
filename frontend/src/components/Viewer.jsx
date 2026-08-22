import { useState } from 'react'
import { imageUrl, variantKey } from '../lib/api'

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

  const flip = (k) => setToggles((t) => ({ ...t, [k]: !t[k] }))

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
        <h2 className="card-title">Visualization</h2>
        <div className="flex flex-wrap items-center gap-2">
          {STRUCTURES.map((s) => {
            const on = toggles[s.key]
            return (
              <button
                key={s.key}
                onClick={() => flip(s.key)}
                aria-pressed={on}
                className={[
                  'inline-flex items-center gap-2 h-8 px-3 rounded-card border text-[12px] font-medium transition-colors',
                  on ? 'border-line bg-surface text-navy' : 'border-line bg-white text-muted',
                ].join(' ')}
              >
                <span
                  className="w-2.5 h-2.5 rounded-[3px] border"
                  style={{
                    backgroundColor: on ? s.color : 'transparent',
                    borderColor: s.color,
                  }}
                />
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="card-pad grid grid-cols-1 md:grid-cols-2 gap-5">
        <figure>
          <div className="rounded-card border border-line overflow-hidden bg-navy/[0.02] flex items-center justify-center">
            <img src={original} alt="Original upload" className="w-full h-auto" />
          </div>
          <figcaption className="mt-2 text-[12px] text-muted text-center">Original</figcaption>
        </figure>
        <figure>
          <div className="rounded-card border border-line overflow-hidden bg-navy/[0.02] flex items-center justify-center">
            <img src={annotated} alt="Annotated segmentation" className="w-full h-auto" />
          </div>
          <figcaption className="mt-2 text-[12px] text-muted text-center">
            Simulated segmentation with measurement callouts
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
