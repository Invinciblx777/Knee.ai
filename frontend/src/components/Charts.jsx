import {
  Bar, BarChart, CartesianGrid, Cell, Legend, PolarAngleAxis, PolarGrid,
  PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

const AXIS = { fontSize: 11, fill: '#64748B' }
const TOOLTIP = {
  contentStyle: {
    borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12,
    boxShadow: 'none', color: '#0F172A',
  },
}

export function ThicknessComparison({ rows, sex }) {
  const data = rows.map((r) => ({
    name: r.label,
    Patient: r.patient,
    'Male mean': r.population_male,
    'Female mean': r.population_female,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 4 }} barGap={4}>
        <CartesianGrid stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
        <YAxis
          tick={AXIS} tickLine={false} axisLine={false} domain={[0, 7]}
          label={{ value: 'mm', angle: -90, position: 'insideLeft', offset: 22, style: AXIS }}
        />
        <Tooltip {...TOOLTIP} formatter={(v) => `${v} mm`} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
        <Bar dataKey="Patient" fill="#3B82F6" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
        <Bar dataKey="Male mean" fill="#0F172A" fillOpacity={0.28} radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
        <Bar dataKey="Female mean" fill="#0F172A" fillOpacity={0.14} radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
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
        <Tooltip {...TOOLTIP} formatter={(v) => `${v} mm`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Radar name="Patient" dataKey="Patient" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.22} isAnimationActive={false} />
        <Radar
          name={`${isFemale ? 'Female' : 'Male'} population mean`}
          dataKey="Population" stroke="#0F172A" strokeDasharray="4 3"
          fill="#0F172A" fillOpacity={0.06} isAnimationActive={false}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

export function ConfidenceBars({ candidates }) {
  const data = candidates.map((c) => ({
    name: `${c.manufacturer.split(' ')[0]} ${c.size}`,
    confidence: c.confidence_pct,
  }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
        <CartesianGrid stroke="#E2E8F0" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} unit="%" />
        <YAxis type="category" dataKey="name" width={110} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip {...TOOLTIP} formatter={(v) => `${v}% match`} />
        <Bar dataKey="confidence" radius={[0, 3, 3, 0]} maxBarSize={22} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? '#3B82F6' : '#0F172A'} fillOpacity={i === 0 ? 1 : 0.25} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
