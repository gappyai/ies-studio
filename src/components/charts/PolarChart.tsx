import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';

interface PolarChartProps {
  data: number[][];
  verticalAngles: number[];
  horizontalAngles: number[];
}

export function PolarChart({ data, verticalAngles }: PolarChartProps) {
  // Use first horizontal plane for polar plot
  const chartData = verticalAngles.map((angle, index) => ({
    angle: angle,
    intensity: data[0]?.[index] || 0,
  }));

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Polar Plot</h3>
      <ResponsiveContainer width="100%" height={400}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="angle" tick={{ fill: '#6b7280', fontSize: 12 }} />
          <PolarRadiusAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
          <Radar
            name="Intensity"
            dataKey="intensity"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.6}
          />
        </RadarChart>
      </ResponsiveContainer>
      <p className="text-sm text-gray-600 mt-2 text-center">
        Candela distribution (cd) vs Vertical Angle (°)
      </p>
    </div>
  );
}