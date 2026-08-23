import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paperclip } from 'lucide-react';
import { api, formatMoney, formatDate, type DashboardData, type MailListItem } from '../lib/api';

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-success/15 text-success',
  partial: 'bg-warning/15 text-warning',
  unpaid: 'bg-white/10 text-text-muted',
  overdue: 'bg-danger/15 text-danger',
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentMail, setRecentMail] = useState<MailListItem[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<DashboardData>('/api/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
    // Mail is a separate subsystem — if it's unconfigured or unreachable,
    // the Bill dashboard must still render fine, so this fails silently.
    api
      .get<{ messages: MailListItem[] }>('/api/mail/messages?folder=inbox&pageSize=5')
      .then((res) => setRecentMail(res.messages))
      .catch(() => setRecentMail(null));
  }, []);

  if (error) {
    return <div className="text-sm text-red-300">Unable to load dashboard: {error}</div>;
  }
  if (!data) {
    return <div className="text-sm text-text-muted">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-text-muted mt-1">Monthly overview of your billing.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl gradient-brand p-5">
          <p className="text-xs uppercase tracking-wide text-white/80">Total Revenue</p>
          <p className="text-2xl font-bold mt-2">{formatMoney(data.totalRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Total Expenses</p>
          <p className="text-2xl font-bold mt-2">{formatMoney(data.totalExpenses)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Net Profit</p>
          <p className="text-2xl font-bold mt-2">{formatMoney(data.netProfit)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Invoices', value: data.invoiceCounts.total },
          { label: 'Paid', value: data.invoiceCounts.paid },
          { label: 'Due', value: data.invoiceCounts.due },
          { label: 'Overdue', value: data.invoiceCounts.overdue },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-lg font-bold">{value}</p>
            <p className="text-xs text-text-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Recent Transactions</p>
          <button
            onClick={() => navigate('/bills')}
            className="text-xs text-brand hover:underline"
          >
            View All
          </button>
        </div>

        {data.recentTransactions.length === 0 ? (
          <p className="text-sm text-text-muted">No invoices yet. Create your first one to get started.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.recentTransactions.map((tx) => (
              <button
                key={tx.id}
                onClick={() => navigate(`/bills/${tx.id}`)}
                className="w-full flex items-center justify-between py-3 text-left hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{tx.invoiceNumber}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {tx.clientName} · {formatDate(tx.date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatMoney(tx.amount)}</p>
                  <span
                    className={`inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLES[tx.status]}`}
                  >
                    {tx.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {recentMail !== null && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Recent Mail</p>
            <button onClick={() => navigate('/mail')} className="text-xs text-brand hover:underline">
              View All
            </button>
          </div>

          {recentMail.length === 0 ? (
            <p className="text-sm text-text-muted">No mail yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {recentMail.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/mail/inbox/${m.id}`)}
                  className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${m.is_read ? 'text-text' : 'font-semibold text-text'}`}>
                      {m.from_name || m.from_address}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5 truncate">{m.subject}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {m.has_attachments && <Paperclip size={12} className="text-text-muted" />}
                    <span className="text-[11px] text-text-muted">{formatDate(m.date_ts)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
