"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = Record<string, string | number>;

export function DualLineChart({ data, aKey, bKey, aName, bName }: { data: Point[]; aKey: string; bKey: string; aName: string; bName: string }) {
  if (!data.length) return <p className="text-sm text-muted">Not enough data to chart yet.</p>;
  return (
    <div className="h-64" role="img" aria-label={`${aName} versus ${bName} chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={aKey} name={aName} stroke="var(--chart-revenue)" strokeWidth={2} />
          <Line type="monotone" dataKey={bKey} name={bName} stroke="var(--chart-expenses)" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleBarChart({ data, dataKey, name, color }: { data: Point[]; dataKey: string; name: string; color: string }) {
  if (!data.length) return <p className="text-sm text-muted">Not enough data to chart yet.</p>;
  return (
    <div className="h-64" role="img" aria-label={`${name} chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
