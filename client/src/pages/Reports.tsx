import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { api, formatMoney } from '../lib/api';

interface ReportData {
  totalRevenue: number;
  netProfit: number;
  totalDue: number;
  totalReceived: number;
  totalClients: number;
  totalBills: number;
  trend: { month: string; revenue: number; expenses: number }[];
  statusBreakdown: { name: string; value: number }[];
  topClients: { name: string; revenue: number }[];
}

const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const PIE_COLORS = ['#4caf50', '#ffc107', '#9ea3af', '#f44336'];

export default function Reports() {
  const [period, setPeriod] = useState('monthly');
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    api.get<ReportData>(`/api/reports?period=${period}`).then(setData);
  }, [period]);

  if (!data) return <div className="text-sm text-text-muted">Loading…</div>;

  const cards = [
    { label: 'Total Revenue', value: formatMoney(data.totalRevenue) },
    { label: 'Net Profit', value: formatMoney(data.netProfit) },
    { label: 'Total Due', value: formatMoney(data.totalDue) },
    { label: 'Received', value: formatMoney(data.totalReceived) },
    { label: 'Total Clients', value: String(data.totalClients) },
    { label: 'Total Bills', value: String(data.totalBills) },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Reports</h1>

      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              period === p.value ? 'bg-brand text-white' : 'border border-border text-text-muted'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-text-muted">{c.label}</p>
            <p className="text-lg font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium mb-4">Revenue vs Expenses (last 6 months)</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#454850" opacity={0.3} />
              <XAxis dataKey="month" stroke="#9ea3af" fontSize={12} />
              <YAxis stroke="#9ea3af" fontSize={12} />
              <Tooltip
                contentStyle={{ background: '#15171e', border: '1px solid #454850', borderRadius: 8 }}
                formatter={(v) => formatMoney(Number(v ?? 0))}
              />
              <Bar dataKey="revenue" fill="#ff5722" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#454850" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-medium mb-4">Invoice Status</p>
          {data.statusBreakdown.length === 0 ? (
            <p className="text-sm text-text-muted">No invoices in this period.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.statusBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={75}
                  >
                    {data.statusBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#15171e', border: '1px solid #454850', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-medium mb-4">Top Clients</p>
          {data.topClients.length === 0 ? (
            <p className="text-sm text-text-muted">No data in this period.</p>
          ) : (
            <div className="space-y-2.5">
              {data.topClients.map((c) => (
                <div key={c.name} className="flex justify-between text-sm">
                  <span className="text-text-muted">{c.name}</span>
                  <span className="font-medium">{formatMoney(c.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
