import { useState } from 'react'
import { imageUrl, variantKey } from '../lib/api'
import Icon, { IconChip } from './Icon'

const STRUCTURES = [
  { key: 'femur', label: 'Femur', color: '#E8772E' },
  { key: 'meniscus', label: 'Meniscus', color: '#2D9F6F' },
  { key: 'tibia', label: 'Tibia', color: '#E85D75' },
]

export default function Viewer({ result }) {
  const [toggles, setToggles] = useState({ femur: true, meniscus: true, tibia: true })

  // Prefer inline base64 data URLs (always available on fresh analysis),
  // fall back to file-based variants for historical records.
  const dataVariants = result.images.variants_data || {}
  const fileVariants = result.images.variants
  const getVariant = (key) => dataVariants[key] || fileVariants[key]

  const original = imageUrl(getVariant('none'))
  const annotated = imageUrl(getVariant(variantKey(toggles)))
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
          <span className="hidden sm:block text-[11px] text-muted font-display">
            {activeCount} of 3 overlays
          </span>
          <div
            className="inline-flex items-center gap-1 p-1 rounded-[10px] bg-page"
            style={{ border: '2px solid #2D2016' }}
          >
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
                    className="w-2.5 h-2.5 rounded-full transition-all duration-150"
                    style={{
                      backgroundColor: on ? s.color : 'transparent',
                      border: on ? `2px solid ${s.color}` : '2px solid #D5C9B5',
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
            <span
              className="absolute top-3 left-3 px-2.5 py-1 rounded-[8px] bg-navy text-[10px]
                         font-display font-bold uppercase tracking-wider text-white"
            >
              Source
            </span>
          </div>
          <figcaption className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted font-display">
            <Icon name="file" size={12} className="text-ink-300" />
            Original
          </figcaption>
        </figure>

        <figure className="group">
          <div className="stage relative">
            <img src={annotated} alt="Annotated segmentation" className="w-full h-auto" />
            <span
              className="absolute top-3 left-3 px-2.5 py-1 rounded-[8px] bg-accent text-[10px]
                         font-display font-bold uppercase tracking-wider text-white"
            >
              Segmented
            </span>
          </div>
          <figcaption className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted font-display">
            <Icon name="layers" size={12} className="text-ink-300" />
            Segmentation with measurement callouts
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
