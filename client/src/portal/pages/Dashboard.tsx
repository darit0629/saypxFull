import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, PackageX } from 'lucide-react';
import { customerApi } from '../lib/customerApi';
import { useCustomerAuth } from '../CustomerAuthContext';
import { formatDate, formatPaise, type CustomerPackageView } from '../../lib/api';

const STATUS_LABEL: Record<string, { label: string; dot: string }> = {
  ACTIVE: { label: 'Active', dot: '🟢' },
  EXPIRING_SOON: { label: 'Expiring Soon', dot: '🟠' },
  EXPIRED: { label: 'Expired', dot: '🔴' },
  PENDING: { label: 'Pending', dot: '⚪' },
  SUSPENDED: { label: 'Suspended', dot: '🔴' },
  CANCELLED: { label: 'Cancelled', dot: '🔴' },
};

function daysUntil(ts: number | null) {
  if (!ts) return null;
  return Math.ceil((ts - Date.now()) / (24 * 60 * 60 * 1000));
}

export default function PortalDashboard() {
  const { customer, logout } = useCustomerAuth();
  const [packages, setPackages] = useState<CustomerPackageView[] | null>(null);

  useEffect(() => {
    customerApi.get<CustomerPackageView[]>('/api/customer/packages/current').then(setPackages);
  }, []);

  const activePackage = packages?.find((p) => p.status === 'ACTIVE' || p.status === 'EXPIRING_SOON' || p.status === 'PENDING');

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <p className="text-lg font-semibold bg-gradient-to-r from-brand to-orange-300 bg-clip-text text-transparent">
            SAYPX Digital Photo Books
          </p>
          <p className="text-xs text-text-muted">{customer?.businessName || customer?.email}</p>
        </div>
        <button
          onClick={() => logout()}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-white/5"
        >
          <LogOut size={14} /> Log Out
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-xl font-semibold mb-1">Welcome, {customer?.name || customer?.businessName || 'there'}</h1>
        <p className="text-sm text-text-muted mb-8">Here's an overview of your Digital Photo Book package.</p>

        {packages === null ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : !activePackage ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <PackageX size={32} className="mx-auto mb-3 text-text-muted" />
            <p className="text-sm font-medium mb-1">No Active Package Yet</p>
            <p className="text-sm text-text-muted mb-4">Choose a package to start creating digital photo books.</p>
            <Link to="/portal/plans" className="inline-block rounded-lg gradient-brand px-4 py-2 text-sm font-semibold">
              View Plans
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-wide text-text-muted">Digital Photo Book Package</p>
              <span className="text-sm">
                {STATUS_LABEL[activePackage.status]?.dot} {STATUS_LABEL[activePackage.status]?.label}
              </span>
            </div>

            <p className="text-2xl font-semibold mb-1">{activePackage.plan?.name}</p>

            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                <span>{activePackage.creditsUsed} Used</span>
                <span>{activePackage.creditsRemaining} Remaining</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full gradient-brand"
                  style={{ width: `${Math.min(100, (activePackage.creditsUsed / Math.max(1, activePackage.creditsTotal)) * 100)}%` }}
                />
              </div>
            </div>

            {activePackage.expiresAt && (
              <div className="text-sm text-text-muted">
                {daysUntil(activePackage.expiresAt) !== null && daysUntil(activePackage.expiresAt)! >= 0 ? (
                  <p>Expires in {daysUntil(activePackage.expiresAt)} days</p>
                ) : (
                  <p>Expired</p>
                )}
                <p>Expires: {formatDate(activePackage.expiresAt)}</p>
              </div>
            )}

            {activePackage.plan && (
              <p className="mt-3 text-xs text-text-muted">Purchased at {formatPaise(activePackage.plan.finalPricePaise)}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
