import { AnalysisShell, ImplantTable, ModuleHeader, QualityCard } from '../components/AnalysisShell'
import { Card, Disclaimer, Tile } from '../components/ui'
import Icon, { IconChip } from '../components/Icon'
import Viewer from '../components/Viewer'
import { ConfidenceBars } from '../components/Charts'

/** Module 2 — femur/tibia measurements and patient-specific implant sizing. */
export default function ImplantSizing() {
  return (
    <AnalysisShell>
      {(result) => {
        const bones = result.bone_measurements
        const primary = result.implant.primary
        const candidates = [primary, ...result.implant.alternatives]
        return (
          <>
      {/* ═══════════════════════════════════════════════════════
          MODULE 2 — Femur/tibia measurements + implant sizing
          ═══════════════════════════════════════════════════════ */}
      <div>
        <ModuleHeader
          n={2}
          tone="bg-accent"
          title="Femur / Tibia Measurements & Implant Sizing"
          subtitle="Extracted femoral and tibial anatomy, matched against the implant catalogue to rank patient-specific sizes."
        />

        {/* Step 1 — the anatomy the matcher consumes */}
        <Card
          eyebrow="Step 1 · Extracted Anatomy"
          title="Femoral & Tibial Measurements"
          icon="ruler"
          tone="amber"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              ['Femoral ML', bones.femoral_ml_mm, 'mm', 'Medio-lateral width'],
              ['Femoral AP', bones.femoral_ap_mm, 'mm', 'Antero-posterior depth'],
              ['Tibial ML', bones.tibial_ml_mm, 'mm', 'Medio-lateral width'],
              ['Tibial AP', bones.tibial_ap_mm, 'mm', 'Antero-posterior depth'],
              ['Tibial Slope', bones.tibial_slope_deg, '°', 'Posterior slope angle'],
            ].map(([k, v, u, desc]) => (
              <div
                key={k}
                className="rounded-[10px] bg-page px-3 py-3 transition-colors duration-150 hover:bg-surface"
                style={{ border: '2px solid #2D2016' }}
              >
                <div className="eyebrow text-[9px]">{k}</div>
                <div className="mt-1.5 text-[20px] font-display font-bold text-navy leading-none tnum">
                  {v}<span className="text-[11px] font-semibold text-muted ml-1">{u}</span>
                  {result.uncertainty && (
                    <span className="text-[11px] font-semibold text-muted ml-1.5">
                      ±{u === '°' ? result.uncertainty.slope_deg : result.uncertainty.bone_mm}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 text-[10px] text-muted font-display leading-tight">{desc}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-muted font-display">
            Aspect ratios — femur {bones.aspect_ratio_femur} · tibia {bones.aspect_ratio_tibia}.
            These four linear dimensions are what the matcher compares against each catalogued implant size.
          </p>
        </Card>

        {/* Step 2 — what the matcher returned */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 mb-6">
          <Tile
            label="Recommended Implant"
            icon="implant"
            tone="blue"
            footer={
              <div className="flex items-center justify-between gap-2">
                <span className="card-sub truncate font-display">{primary.system}</span>
                <span className="pill-pos shrink-0">{primary.confidence_pct}% match</span>
              </div>
            }
          >
            <div className="text-[22px] font-display font-bold text-accent tracking-[-0.02em] leading-tight">
              {primary.manufacturer.split(' ')[0]}
              <span className="text-navy ml-2">{primary.size}</span>
            </div>
            <p className="mt-2 text-[12px] text-muted font-display">{primary.type}</p>
          </Tile>

          <Tile
            label="Fit Deviation"
            icon="ruler"
            tone="amber"
            footer={
              <p className="card-sub font-display">
                Largest single-dimension gap between patient anatomy and the recommended size.
              </p>
            }
          >
            <div className="metric">
              {primary.max_abs_delta_mm}
              <span className="text-[15px] font-semibold text-muted ml-1.5 tracking-normal">mm</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ['Femoral ML', primary.deltas_mm.femoral_ml],
                ['Femoral AP', primary.deltas_mm.femoral_ap],
                ['Tibial ML', primary.deltas_mm.tibial_ml],
                ['Tibial AP', primary.deltas_mm.tibial_ap],
              ].map(([k, d]) => (
                <div key={k} className="flex items-center justify-between gap-2 text-[11px] font-display">
                  <span className="text-muted">{k}</span>
                  <span className={d < 0 ? 'pill-neg' : 'pill-pos'}>
                    {d > 0 ? '+' : ''}{d} mm
                  </span>
                </div>
              ))}
            </div>
          </Tile>
        </div>

        <Card eyebrow="Step 2 · Ranked Matches" title="Implant Size Matching" icon="implant" tone="blue">
          <ImplantTable implant={result.implant} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 items-start">
            <div className="rounded-[12px] p-4" style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}>
              <p className="eyebrow mb-4">Match confidence</p>
              <ConfidenceBars candidates={candidates} />
            </div>
            <div className="space-y-3">
              {[
                ['ruler', result.implant.slope_note],
                ['layers', result.implant.method],
              ].map(([icon, text]) => (
                <div
                  key={text}
                  className="flex items-start gap-3 rounded-[12px] bg-page p-3.5"
                  style={{ border: '2px solid #2D2016' }}
                >
                  <IconChip name={icon} size="sm" />
                  <p className="text-[12px] text-muted leading-relaxed font-display">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
      <Viewer result={result} />

      {result.quality && (
        <QualityCard quality={result.quality} uncertainty={result.uncertainty} />
      )}

      <Disclaimer />
          </>
        )
      }}
    </AnalysisShell>
  )
}
