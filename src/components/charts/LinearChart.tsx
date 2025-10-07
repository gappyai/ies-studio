import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LinearChartProps {
  data: number[][];
  verticalAngles: number[];
  horizontalAngles: number[];
}

export function LinearChart({ data, verticalAngles, horizontalAngles }: LinearChartProps) {
  // Create chart data with multiple horizontal planes
  const chartData = verticalAngles.map((angle, index) => {
    const dataPoint: any = { angle };
    horizontalAngles.forEach((hAngle, hIndex) => {
      dataPoint[`${hAngle}°`] = data[hIndex]?.[index] || 0;
    });
    return dataPoint;
  });

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Linear Plot</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="angle" 
            label={{ value: 'Vertical Angle (°)', position: 'insideBottom', offset: -5 }}
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis 
            label={{ value: 'Intensity (cd)', angle: -90, position: 'insideLeft' }}
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <Tooltip />
          <Legend />
          {horizontalAngles.slice(0, 5).map((hAngle, index) => (
            <Line
              key={hAngle}
              type="monotone"
              dataKey={`${hAngle}°`}
              stroke={colors[index % colors.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-sm text-gray-600 mt-2 text-center">
        Intensity distribution across vertical angles for different horizontal planes
      </p>
    </div>
  );
}