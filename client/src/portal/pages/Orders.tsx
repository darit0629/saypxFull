import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Receipt } from 'lucide-react';
import { customerApi } from '../lib/customerApi';
import { formatDate } from '../../lib/api';

interface CustomerOrder {
  id: number;
  plan: { id: number; name: string; credits: number; durationDays: number } | null;
  amountPaise: number;
  status: 'CREATED' | 'PAID' | 'FAILED' | 'CANCELLED';
  createdAt: number;
}

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-emerald-500/15 text-emerald-400',
  CREATED: 'bg-amber-500/15 text-amber-400',
  FAILED: 'bg-red-500/15 text-red-400',
  CANCELLED: 'bg-white/10 text-text-muted',
};

export default function PortalOrders() {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);

  useEffect(() => {
    customerApi.get<CustomerOrder[]>('/api/customer/orders').then(setOrders);
  }, []);

  return (
    <div className="relative z-10 min-h-screen px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <Link to="/portal/dashboard" className="flex items-center gap-1 text-xs text-text-muted hover:text-text mb-4">
          <ArrowLeft size={12} /> Dashboard
        </Link>
        <h1 className="text-xl font-semibold mb-1">Order History</h1>
        <p className="text-sm text-text-muted mb-6">Your Digital Photo Book package purchases.</p>

        {orders === null ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Receipt size={28} className="mx-auto mb-2 text-text-muted" />
            <p className="text-sm text-text-muted">No orders yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{o.plan?.name || 'Unknown plan'}</p>
                  <p className="text-xs text-text-muted">{formatDate(o.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">₹{(o.amountPaise / 100).toLocaleString('en-IN')}</p>
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLES[o.status]}`}>
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
