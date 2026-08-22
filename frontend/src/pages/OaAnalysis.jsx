import { AnalysisShell, KL_COLOR, MeniscusTable, ModuleHeader, QualityCard } from '../components/AnalysisShell'
import { useLanguage } from '../lib/LanguageContext'
import { Card, Disclaimer, Gauge, SeverityBadge, Tile } from '../components/ui'
import Icon from '../components/Icon'
import Viewer from '../components/Viewer'
import { ThicknessComparison, ThicknessRadar } from '../components/Charts'

// English classification value -> its translation key. `value` fields stay
// the literal English strings the backend returns; only display goes through t().
const CLASS_KEY = { Normal: 'classNormal', 'Mild OA': 'classMild', 'Moderate OA': 'classModerate', 'Severe OA': 'classSevere' }

/** Module 1 — medial meniscus thickness and OA analysis. */
export default function OaAnalysis() {
  const { t } = useLanguage()
  return (
    <AnalysisShell>
      {(result) => {
        const a = result.meniscus.assessment
        const kl = result.meniscus.kl_grade
        return (
          <>
      {/* ═══════════════════════════════════════════════════════
          MODULE 1 — Medial meniscus thickness + OA analysis
          ═══════════════════════════════════════════════════════ */}
      <div>
        <ModuleHeader
          n={1}
          tone="bg-ok"
          title={t('module1Title')}
          subtitle={t('module1Subtitle')}
        />

        {/* metric row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Tile
            label={t('oaAssessmentLabel')}
            icon="activity"
            tone={a.classification === 'Normal' ? 'green' : a.classification === 'Severe OA' ? 'red' : 'amber'}
            footer={
              <p className="card-sub font-display">
                {a.age_escalated
                  ? `${t('escalatedFromPrefix')} ${t(CLASS_KEY[a.base_classification] || 'classNormal')} · ${t('ageGt60Suffix')}`
                  : a.sex_adjusted
                    ? t('sexAdjustedThresholds')
                    : `${t('ageBandPrefix')} ${a.age_band || '<40'} · ${t('standardThresholdsSuffix')}`}
              </p>
            }
          >
            <SeverityBadge value={a.classification} size="lg" />
            <div className="mt-5 flex gap-1.5">
              {['Normal', 'Mild OA', 'Moderate OA', 'Severe OA'].map((step, i) => {
                const active = ['Normal', 'Mild OA', 'Moderate OA', 'Severe OA'].indexOf(a.classification) >= i
                const colors = ['#2D9F6F', '#E8772E', '#D4A017', '#E85D75']
                return (
                  <span
                    key={step}
                    title={t(CLASS_KEY[step])}
                    className="h-2 flex-1 rounded-full transition-colors duration-200"
                    style={{
                      backgroundColor: active ? colors[i] : '#E8DCC8',
                      border: '1px solid #2D2016',
                    }}
                  />
                )
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted font-display">
              {t('severityScaleLabel')} · {t('classNormal')} → {t('classSevere')}
            </p>
          </Tile>

          <Tile
            label={t('klGradeLabel')}
            icon="layers"
            tone="amber"
            footer={<p className="card-sub font-display">{kl.description}</p>}
          >
            <div className="flex items-center gap-4">
              <Gauge value={kl.grade} max={4} color={KL_COLOR[kl.grade]} label={t('ofFour')} />
              <div className="space-y-1">
                {[0, 1, 2, 3, 4].map((g) => (
                  <div key={g} className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: g === kl.grade ? KL_COLOR[g] : '#E8DCC8' }}
                    />
                    <span className={`text-[11px] font-display ${g === kl.grade ? 'text-navy font-semibold' : 'text-ink-300'}`}>
                      KL{g}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Tile>

          <Tile
            label={t('meanMeniscusThicknessLabel')}
            icon="ruler"
            tone="blue"
            footer={
              <p className="card-sub font-display">
                {t('minimumWord')} {a.min_thickness_mm.toFixed(1)} mm {t('acrossThreeLocations')}
              </p>
            }
          >
            <div className="metric">
              {a.mean_thickness_mm.toFixed(2)}
              <span className="text-[15px] font-semibold text-muted ml-1.5 tracking-normal">mm</span>
              {result.uncertainty && (
                <span className="text-[13px] font-semibold text-muted ml-2 tracking-normal tnum">
                  ±{result.uncertainty.meniscus_mm}
                </span>
              )}
            </div>
            <div
              className="mt-4 h-2 rounded-full bg-ink-100 overflow-hidden"
              style={{ border: '1px solid #2D2016' }}
            >
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.min(a.mean_thickness_mm / 7, 1) * 100}%` }}
              />
            </div>
          </Tile>
        </div>

        {/* Meniscus detail card */}
        <Card
          eyebrow={t('meniscusAnalysisEyebrow')}
          title={t('meniscusThicknessCardTitle')}
          icon="ruler"
          tone="green"
          action={<SeverityBadge value={a.classification} />}
        >
          <MeniscusTable rows={result.meniscus.population_comparison} sex={result.patient.sex} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <div className="rounded-[12px] p-4" style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}>
              <p className="eyebrow mb-4">{t('patientVsPopulation')}</p>
              <ThicknessComparison rows={result.meniscus.population_comparison} />
            </div>
            <div className="rounded-[12px] p-4" style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}>
              <p className="eyebrow mb-4">{t('profileShape')}</p>
              <ThicknessRadar rows={result.meniscus.population_comparison} sex={result.patient.sex} />
            </div>
          </div>

          <ul className="mt-6 space-y-2.5">
            {a.rationale.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12px] text-muted leading-relaxed font-display">
                <Icon name="check" size={13} className="text-ok mt-[3px] shrink-0" />
                {r}
              </li>
            ))}
          </ul>
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
