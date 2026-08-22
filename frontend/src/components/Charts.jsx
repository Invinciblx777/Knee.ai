import {
  Bar, BarChart, CartesianGrid, Legend, PolarAngleAxis, PolarGrid,
  PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

const AXIS = { fontSize: 11, fill: '#64748B' }
const GRID = '#F1F5F9'

const TOOLTIP = {
  contentStyle: {
    borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)', color: '#1E293B',
  },
  cursor: { fill: '#F8FAFC' },
}

const LEGEND = { fontSize: 11, paddingTop: 10, color: '#64748B' }

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
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
        <YAxis
          tick={AXIS} tickLine={false} axisLine={false} domain={[0, 7]}
          label={{ value: 'mm', angle: -90, position: 'insideLeft', offset: 22, style: AXIS }}
        />
        <Tooltip {...TOOLTIP} formatter={(v) => `${v} mm`} />
        <Legend wrapperStyle={LEGEND} iconType="circle" iconSize={7} />
        <Bar dataKey="Patient" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
        <Bar dataKey="Male mean" fill="#94A3B8" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
        <Bar dataKey="Female mean" fill="#CBD5E1" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
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
        <PolarGrid stroke="#E2E8F0" />
        <PolarAngleAxis dataKey="axis" tick={AXIS} />
        <PolarRadiusAxis domain={[0, 7]} tick={AXIS} axisLine={false} />
        <Tooltip {...TOOLTIP} cursor={false} formatter={(v) => `${v} mm`} />
        <Legend wrapperStyle={LEGEND} iconType="circle" iconSize={7} />
        <Radar
          name="Patient" dataKey="Patient" stroke="#3B82F6" strokeWidth={2}
          fill="#3B82F6" fillOpacity={0.1} isAnimationActive={false}
        />
        <Radar
          name={`${isFemale ? 'Female' : 'Male'} population mean`}
          dataKey="Population" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="4 3"
          fill="#CBD5E1" fillOpacity={0.08} isAnimationActive={false}
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
            <span className="text-[13px] text-body">
              <span className="font-medium text-navy">{c.manufacturer.split(' ')[0]}</span>{' '}
              {c.size}
            </span>
            <span className={`text-[13px] font-bold ${i === 0 ? 'text-accent' : 'text-muted'}`}>
              {c.confidence_pct}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-line overflow-hidden">
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
