import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { api, formatDate, type CreditTransaction, type CreditTransactionType } from '../../lib/api';
import PhotoBookSubNav from '../../components/website/PhotoBookSubNav';

const TYPE_LABELS: Record<CreditTransactionType, string> = {
  PACKAGE_PURCHASE: 'Package Purchase',
  ALBUM_CREATED: 'Album Created',
  ALBUM_DELETED: 'Album Deleted',
  CREDIT_REFUND: 'Credit Refund',
  ADMIN_ADJUSTMENT: 'Admin Adjustment',
  PACKAGE_EXPIRY: 'Package Expiry',
  PACKAGE_RENEWAL: 'Package Renewal',
};

const ACTOR_STYLES: Record<CreditTransaction['actorType'], string> = {
  CUSTOMER: 'bg-white/10 text-text-muted',
  ADMIN: 'bg-amber-500/15 text-amber-400',
  SYSTEM: 'bg-sky-500/15 text-sky-400',
};

export default function Credits() {
  const [rows, setRows] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [actorType, setActorType] = useState('');

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (actorType) params.set('actorType', actorType);
    const qs = params.toString();
    api
      .get<CreditTransaction[]>(`/api/photobook/credits${qs ? `?${qs}` : ''}`)
      .then(setRows)
      .finally(() => setLoading(false));
  }

  useEffect(load, [type, actorType]);

  return (
    <div className="space-y-5">
      <PhotoBookSubNav />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Credits</h1>
          <p className="text-sm text-text-muted mt-1">Every credit ledger entry across all customers - also the audit log of manual admin adjustments.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={actorType} onChange={(e) => setActorType(e.target.value)} className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm">
            <option value="">All actors</option>
            <option value="CUSTOMER">Customer</option>
            <option value="ADMIN">Admin</option>
            <option value="SYSTEM">System</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm">
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Wallet size={32} className="mx-auto mb-3 text-text-muted" />
          <p className="text-sm font-medium mb-1">No Ledger Entries</p>
          <p className="text-sm text-text-muted">Credit activity appears here as customers buy, use, and renew packages.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted text-xs uppercase">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Balance After</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.customer?.businessName || r.customer?.name || r.customer?.email || '—'}</p>
                    {r.package?.plan && <p className="text-xs text-text-muted">{r.package.plan.name}</p>}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{TYPE_LABELS[r.type]}</td>
                  <td className={`px-4 py-3 font-medium ${r.amount > 0 ? 'text-emerald-400' : r.amount < 0 ? 'text-danger' : 'text-text-muted'}`}>
                    {r.amount > 0 ? '+' : ''}{r.amount}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{r.balanceAfter}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${ACTOR_STYLES[r.actorType]}`}>
                      {r.actorType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted max-w-[220px] truncate" title={r.note || ''}>{r.note || '—'}</td>
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
