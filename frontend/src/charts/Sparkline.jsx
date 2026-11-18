import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

export default function Sparkline({ data, color = '#4f46e5', height = 26, width = 72 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.map((v) => ({ v }))}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
