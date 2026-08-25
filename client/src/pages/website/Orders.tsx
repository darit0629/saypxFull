import { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { api, formatDate, formatPaise, type PhotoBookOrder } from '../../lib/api';
import PhotoBookSubNav from '../../components/website/PhotoBookSubNav';

const STATUS_STYLES: Record<PhotoBookOrder['status'], string> = {
  CREATED: 'bg-white/10 text-text-muted',
  PAID: 'bg-emerald-500/15 text-emerald-400',
  FAILED: 'bg-danger/15 text-danger',
  CANCELLED: 'bg-white/10 text-text-muted',
};

export default function Orders() {
  const [orders, setOrders] = useState<PhotoBookOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  function load() {
    setLoading(true);
    const qs = status ? `?status=${status}` : '';
    api
      .get<PhotoBookOrder[]>(`/api/photobook/orders${qs}`)
      .then(setOrders)
      .finally(() => setLoading(false));
  }

  useEffect(load, [status]);

  return (
    <div className="space-y-5">
      <PhotoBookSubNav />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Orders</h1>
          <p className="text-sm text-text-muted mt-1">Every Razorpay order created by customers, paid or not.</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="CREATED">Created</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <ShoppingCart size={32} className="mx-auto mb-3 text-text-muted" />
          <p className="text-sm font-medium mb-1">No Orders Yet</p>
          <p className="text-sm text-text-muted">Orders appear here once a customer starts checkout.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted text-xs uppercase">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Razorpay Order</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.customer?.businessName || o.customer?.name || o.customer?.email || '—'}</p>
                    {o.customer?.email && <p className="text-xs text-text-muted">{o.customer.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{o.plan?.name || '—'}</td>
                  <td className="px-4 py-3">{formatPaise(o.amountPaise)}</td>
                  <td className="px-4 py-3 text-text-muted font-mono text-xs">{o.razorpayOrderId}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLES[o.status]}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
