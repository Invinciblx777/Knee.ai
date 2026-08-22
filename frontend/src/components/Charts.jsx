import {
  Bar, BarChart, CartesianGrid, Cell, Legend, PolarAngleAxis, PolarGrid,
  PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis,
} from 'recharts'

const AXIS = { fontSize: 11, fill: '#8B7D6B', fontFamily: 'Space Grotesk, sans-serif' }
const GRID = '#E8DCC8'

const TOOLTIP = {
  contentStyle: {
    borderRadius: 10, border: '2px solid #2D2016', fontSize: 12,
    boxShadow: '3px 3px 0 #2D2016', color: '#1A130D',
    fontFamily: 'Space Grotesk, sans-serif',
    backgroundColor: '#FFFCF7',
  },
  cursor: { fill: '#FFF5E4' },
}

const LEGEND = { fontSize: 11, paddingTop: 10, color: '#8B7D6B', fontFamily: 'Space Grotesk, sans-serif' }

export function ThicknessComparison({ rows }) {
  const data = rows.map((r) => ({
    name: r.label,
    Patient: r.patient,
    'Male mean': r.population_male,
    'Female mean': r.population_female,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 4 }} barGap={4}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: '#E8DCC8' }} />
        <YAxis
          tick={AXIS} tickLine={false} axisLine={false} domain={[0, 7]}
          label={{ value: 'mm', angle: -90, position: 'insideLeft', offset: 22, style: AXIS }}
        />
        <Tooltip {...TOOLTIP} formatter={(v) => `${v} mm`} />
        <Legend wrapperStyle={LEGEND} iconType="circle" iconSize={7} />
        <Bar dataKey="Patient" fill="#E8772E" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
        <Bar dataKey="Male mean" fill="#B0A28E" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
        <Bar dataKey="Female mean" fill="#D5C9B5" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ThicknessRadar({ rows, sex }) {
  const isFemale = sex === 'Female'
  const data = rows.map((r) => ({
    axis: r.label,
    Patient: r.patient,
    Population: isFemale ? r.population_female : r.population_male,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#E8DCC8" />
        <PolarAngleAxis dataKey="axis" tick={AXIS} />
        <PolarRadiusAxis domain={[0, 7]} tick={AXIS} axisLine={false} />
        <Tooltip {...TOOLTIP} cursor={false} formatter={(v) => `${v} mm`} />
        <Legend wrapperStyle={LEGEND} iconType="circle" iconSize={7} />
        <Radar
          name="Patient" dataKey="Patient" stroke="#E8772E" strokeWidth={2}
          fill="#E8772E" fillOpacity={0.15} isAnimationActive={false}
        />
        <Radar
          name={`${isFemale ? 'Female' : 'Male'} population mean`}
          dataKey="Population" stroke="#D5C9B5" strokeWidth={2} strokeDasharray="4 3"
          fill="#D5C9B5" fillOpacity={0.08} isAnimationActive={false}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

/**
 * Match confidence reads as a ranked list, not a plotted chart: label left,
 * percentage right, one full-width track per candidate and no axes.
 */
export function ConfidenceBars({ candidates }) {
  return (
    <div className="space-y-4">
      {candidates.map((c, i) => (
        <div key={`${c.system_id}-${c.size}`}>
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <span className="text-[13px] text-body font-display">
              <span className="font-semibold text-navy">{c.manufacturer.split(' ')[0]}</span>{' '}
              {c.size}
            </span>
            <span className={`text-[13px] font-display font-bold ${i === 0 ? 'text-accent' : 'text-muted'}`}>
              {c.confidence_pct}%
            </span>
          </div>
          <div
            className="h-3 w-full rounded-full bg-ink-100 overflow-hidden"
            style={{ border: '1px solid #2D2016' }}
          >
            <div
              className={`h-full rounded-full transition-all duration-150 ${i === 0 ? 'bg-accent' : 'bg-ink-300'}`}
              style={{ width: `${c.confidence_pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Research mode: cohort-level charts ───────────────────────────────────────

const SEVERITY_FILL = {
  'Normal': '#2D9F6F', 'Mild OA': '#E8772E', 'Moderate OA': '#D4A017', 'Severe OA': '#E85D75',
}

/** Distribution of mean meniscus thickness across the cohort. */
export function ThicknessHistogram({ bins }) {
  const data = bins.map((b) => ({ name: b.range, Studies: b.count }))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: '#E8DCC8' }}
          label={{ value: 'mean thickness (mm)', position: 'insideBottom', offset: -2, style: AXIS }}
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...TOOLTIP} formatter={(v) => `${v} studies`} />
        <Bar dataKey="Studies" fill="#E8772E" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Group means with n labelled, used for OA class, sex, and age band. */
export function GroupMeans({ groups, height = 240 }) {
  const data = groups
    .filter((g) => g.n > 0)
    .map((g) => ({ name: `${g.label} (n=${g.n})`, key: g.label, Mean: g.mean }))
  if (!data.length) return <EmptyChart label="No group has any study yet." />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: '#E8DCC8' }} />
        <YAxis
          tick={AXIS} tickLine={false} axisLine={false}
          label={{ value: 'mm', angle: -90, position: 'insideLeft', offset: 22, style: AXIS }}
        />
        <Tooltip {...TOOLTIP} formatter={(v) => `${v} mm`} />
        <Bar dataKey="Mean" radius={[4, 4, 0, 0]} maxBarSize={54} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.key} fill={SEVERITY_FILL[d.key] || '#E8772E'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Age against thickness, one point per study, coloured by OA class. */
export function CohortScatter({ points }) {
  const withAge = points.filter((p) => p.age != null && p.mean_thickness_mm != null)
  if (!withAge.length) return <EmptyChart label="No study has both an age and a thickness." />
  const byClass = {}
  withAge.forEach((p) => {
    const k = p.classification || 'Unclassified'
    ;(byClass[k] = byClass[k] || []).push({ x: p.age, y: p.mean_thickness_mm, label: p.label })
  })
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 8, right: 12, left: -18, bottom: 8 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis
          type="number" dataKey="x" name="Age" domain={['dataMin - 4', 'dataMax + 4']}
          tick={AXIS} tickLine={false} axisLine={{ stroke: '#E8DCC8' }}
          label={{ value: 'age (years)', position: 'insideBottom', offset: -4, style: AXIS }}
        />
        <YAxis
          type="number" dataKey="y" name="Thickness" domain={['dataMin - 0.4', 'dataMax + 0.4']}
          tick={AXIS} tickLine={false} axisLine={false}
          label={{ value: 'mm', angle: -90, position: 'insideLeft', offset: 22, style: AXIS }}
        />
        <Tooltip
          {...TOOLTIP} cursor={{ strokeDasharray: '3 3' }}
          formatter={(v, n) => (n === 'Thickness' ? `${v} mm` : v)}
        />
        <Legend wrapperStyle={LEGEND} iconType="circle" iconSize={7} />
        {Object.entries(byClass).map(([cls, pts]) => (
          <Scatter
            key={cls} name={cls} data={pts}
            fill={SEVERITY_FILL[cls] || '#8B7D6B'} isAnimationActive={false}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}

/** Count distribution for implant sizes / systems. */
export function CountBars({ items, color = '#3B82F6' }) {
  if (!items?.length) return <EmptyChart label="Nothing to plot." />
  const data = items.map((i) => ({ name: i.label, Studies: i.count }))
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={128} />
        <Tooltip {...TOOLTIP} formatter={(v) => `${v} studies`} />
        <Bar dataKey="Studies" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function EmptyChart({ label }) {
  return (
    <div className="h-[180px] flex items-center justify-center text-[12px] text-muted font-display">
      {label}
    </div>
  )
}
