import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Row = Record<string, string | number | null | undefined>;

type Props = {
  title?: string;
  data: Row[];
  xKey?: string;
  yKey: string;
  yLabel: string;
  color?: string;
};

export function DashboardEvolutionChart({
  title,
  data,
  xKey = 'data',
  yKey,
  yLabel,
  color = '#14b8a6',
}: Props) {
  const series = (data || []).filter((row) => row[yKey] != null);
  if (series.length === 0) {
    return (
      <p className="dashboard-chart-empty" style={{ marginTop: '1rem' }}>
        Sem série temporal no período.
      </p>
    );
  }

  return (
    <div className="dashboard-chart" style={{ marginTop: '1.25rem' }}>
      {title ? <h2 className="dashboard-chart__title">{title}</h2> : null}
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={40} />
            <Tooltip formatter={(v: number) => [v, yLabel]} labelFormatter={(l) => `Data: ${l}`} />
            <Line
              type="monotone"
              dataKey={yKey}
              name={yLabel}
              stroke={color}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
