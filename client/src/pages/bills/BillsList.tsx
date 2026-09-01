import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api, formatMoney, formatDate, type Invoice } from '../../lib/api';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Due' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
];

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-success/15 text-success',
  partial: 'bg-warning/15 text-warning',
  unpaid: 'bg-white/10 text-text-muted',
  overdue: 'bg-danger/15 text-danger',
};

type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest';

export default function BillsList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api
      .get<Invoice[]>('/api/invoices')
      .then(setInvoices)
      .finally(() => setLoading(false));
  }, []);

  let filtered = invoices.filter((inv) => {
    if (filter !== 'all' && inv.display_status !== filter) return false;
    const q = search.trim().toLowerCase();
    if (q && !inv.invoice_number.toLowerCase().includes(q) && !inv.client_name.toLowerCase().includes(q))
      return false;
    return true;
  });

  filtered = filtered.slice().sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return a.invoice_date - b.invoice_date;
      case 'highest':
        return b.total_amount - a.total_amount;
      case 'lowest':
        return a.total_amount - b.total_amount;
      default:
        return b.invoice_date - a.invoice_date;
    }
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bills</h1>
          <p className="text-sm text-text-muted mt-1">{invoices.length} invoices</p>
        </div>
        <button
          onClick={() => navigate('/bills/new')}
          className="flex items-center gap-1.5 rounded-lg gradient-brand px-3.5 py-2 text-sm font-semibold"
        >
          <Plus size={16} /> New
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2.5 text-sm outline-none focus:border-brand"
          placeholder="Search invoice # or client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === f.value ? 'bg-brand text-white' : 'border border-border text-text-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="ml-auto shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs outline-none"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="highest">Highest Amount</option>
          <option value="lowest">Lowest Amount</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-text-muted">
            {invoices.length === 0 ? 'No invoices yet. Create your first one.' : 'No matches found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((inv) => (
            <button
              key={inv.id}
              onClick={() => navigate(`/bills/${inv.id}`)}
              className="w-full flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left hover:border-brand/50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium">{inv.invoice_number}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {inv.client_name} · {formatDate(inv.invoice_date)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">
                  {formatMoney(inv.total_amount)}
                  {inv.due_amount > 0 && (
                    <span className="ml-1.5 text-xs font-medium text-warning">· Due {formatMoney(inv.due_amount)}</span>
                  )}
                </p>
                <span
                  className={`inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLES[inv.display_status]}`}
                >
                  {inv.display_status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
