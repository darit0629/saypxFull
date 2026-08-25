import { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { api, formatDate, formatPaise, type PhotoBookPayment } from '../../lib/api';
import PhotoBookSubNav from '../../components/website/PhotoBookSubNav';

const STATUS_STYLES: Record<PhotoBookPayment['status'], string> = {
  CAPTURED: 'bg-emerald-500/15 text-emerald-400',
  FAILED: 'bg-danger/15 text-danger',
};

export default function Payments() {
  const [payments, setPayments] = useState<PhotoBookPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  function load() {
    setLoading(true);
    const qs = status ? `?status=${status}` : '';
    api
      .get<PhotoBookPayment[]>(`/api/photobook/payments${qs}`)
      .then(setPayments)
      .finally(() => setLoading(false));
  }

  useEffect(load, [status]);

  return (
    <div className="space-y-5">
      <PhotoBookSubNav />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Payments</h1>
          <p className="text-sm text-text-muted mt-1">Captured/failed payments, for reconciliation against the Razorpay dashboard.</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="CAPTURED">Captured</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : payments.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Receipt size={32} className="mx-auto mb-3 text-text-muted" />
          <p className="text-sm font-medium mb-1">No Payments Yet</p>
          <p className="text-sm text-text-muted">Payments appear here once Razorpay confirms a charge.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted text-xs uppercase">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Razorpay Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.order?.customer?.businessName || p.order?.customer?.name || p.order?.customer?.email || '—'}</p>
                    {p.order?.customer?.email && <p className="text-xs text-text-muted">{p.order.customer.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{p.order?.plan?.name || '—'}</td>
                  <td className="px-4 py-3">{p.order ? formatPaise(p.order.amountPaise) : '—'}</td>
                  <td className="px-4 py-3 text-text-muted font-mono text-xs">{p.razorpayPaymentId}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{formatDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
