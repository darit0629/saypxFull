import { LogOut, PackageX } from 'lucide-react';
import { useCustomerAuth } from '../CustomerAuthContext';

export default function PortalDashboard() {
  const { customer, logout } = useCustomerAuth();

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

        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <PackageX size={32} className="mx-auto mb-3 text-text-muted" />
          <p className="text-sm font-medium mb-1">No Active Package Yet</p>
          <p className="text-sm text-text-muted">
            Package plans and purchasing will be available here soon — check back shortly.
          </p>
        </div>
      </main>
    </div>
  );
}
