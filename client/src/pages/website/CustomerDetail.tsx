import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import {
  api,
  formatDate,
  formatPaise,
  formatDuration,
  type PhotoBookCustomer,
  type PhotoBookPackage,
  type PhotoBookPlan,
} from '../../lib/api';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-400',
  EXPIRING_SOON: 'bg-amber-500/15 text-amber-400',
  EXPIRED: 'bg-white/10 text-text-muted',
  PENDING: 'bg-sky-500/15 text-sky-400',
  SUSPENDED: 'bg-red-500/15 text-red-400',
  CANCELLED: 'bg-white/10 text-text-muted',
};

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<PhotoBookCustomer | null>(null);
  const [packages, setPackages] = useState<PhotoBookPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      api.get<PhotoBookCustomer>(`/api/photobook/customers/${id}`),
      api.get<PhotoBookPackage[]>(`/api/photobook/packages?customerId=${id}`),
    ])
      .then(([c, p]) => {
        setCustomer(c);
        setPackages(p);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  if (loading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!customer) return <p className="text-sm text-text-muted">Customer not found.</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Link to="/website/customers" className="flex items-center gap-1 text-xs text-text-muted hover:text-text mb-1">
            <ArrowLeft size={12} /> Customers
          </Link>
          <h1 className="text-xl font-semibold">{customer.businessName || customer.name || customer.email}</h1>
          <p className="text-sm text-text-muted mt-1">{customer.email}</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-lg gradient-brand px-3.5 py-2 text-sm font-semibold whitespace-nowrap"
        >
          <Plus size={16} /> Create Package
        </button>
      </div>

      {packages.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="text-sm font-medium mb-1">No Packages Yet</p>
          <p className="text-sm text-text-muted mb-4">Create a package to grant this customer album credits.</p>
          <button onClick={() => setCreateOpen(true)} className="rounded-lg gradient-brand px-4 py-2 text-sm font-semibold">
            Create Package
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} onChanged={load} />
          ))}
        </div>
      )}

      {createOpen && (
        <CreatePackageDialog
          customerId={customer.id}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function PackageCard({ pkg, onChanged }: { pkg: PhotoBookPackage; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [showExpiry, setShowExpiry] = useState(false);
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [showRemoveCredits, setShowRemoveCredits] = useState(false);
  const displayStatus = pkg.adminOverrideStatus === 'SUSPENDED' || pkg.adminOverrideStatus === 'CANCELLED'
    ? pkg.adminOverrideStatus
    : pkg.computedStatus;

  async function runAction(action: string, body?: Record<string, unknown>) {
    setBusy(true);
    try {
      await api.post(`/api/photobook/packages/${pkg.id}/${action}`, body || {});
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <p className="font-medium">{pkg.plan?.name || 'Unknown Plan'}</p>
          <p className="text-xs text-text-muted">
            {pkg.creditsUsed} / {pkg.creditsTotal} used · {pkg.creditsRemaining} remaining
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLES[displayStatus] || ''}`}>
            {displayStatus.replace('_', ' ')}
          </span>
          {pkg.adminOverrideStatus && (
            <span className="text-[10px] text-text-muted">(computed: {pkg.computedStatus})</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs text-text-muted mb-3">
        <p>Started: {formatDate(pkg.startsAt)}</p>
        <p>Expires: {formatDate(pkg.expiresAt)}</p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {pkg.adminOverrideStatus ? (
          <button disabled={busy} onClick={() => runAction('reactivate')} className="rounded-lg border border-border px-2.5 py-1.5 hover:bg-white/5">
            Reactivate
          </button>
        ) : (
          <button disabled={busy} onClick={() => runAction('suspend')} className="rounded-lg border border-border px-2.5 py-1.5 hover:bg-white/5">
            Suspend
          </button>
        )}
        <button disabled={busy} onClick={() => runAction('cancel')} className="rounded-lg border border-border px-2.5 py-1.5 hover:bg-white/5">
          Cancel
        </button>
        <button disabled={busy} onClick={() => setShowExtend(true)} className="rounded-lg border border-border px-2.5 py-1.5 hover:bg-white/5">
          Extend
        </button>
        <button disabled={busy} onClick={() => setShowExpiry(true)} className="rounded-lg border border-border px-2.5 py-1.5 hover:bg-white/5">
          Change Expiry
        </button>
        <button disabled={busy} onClick={() => setShowAddCredits(true)} className="rounded-lg border border-border px-2.5 py-1.5 hover:bg-white/5">
          Add Credits
        </button>
        <button disabled={busy} onClick={() => setShowRemoveCredits(true)} className="rounded-lg border border-border px-2.5 py-1.5 hover:bg-white/5">
          Remove Credits
        </button>
      </div>

      {showExtend && (
        <NumberPrompt
          label="Extend by how many days?"
          onCancel={() => setShowExtend(false)}
          onSubmit={(n) => {
            setShowExtend(false);
            runAction('extend', { days: n });
          }}
        />
      )}
      {showExpiry && (
        <DatePrompt
          label="New expiry date"
          onCancel={() => setShowExpiry(false)}
          onSubmit={(ts) => {
            setShowExpiry(false);
            runAction('change-expiry', { expiresAt: ts });
          }}
        />
      )}
      {showAddCredits && (
        <NumberPrompt
          label="Add how many credits?"
          onCancel={() => setShowAddCredits(false)}
          onSubmit={(n) => {
            setShowAddCredits(false);
            runAction('add-credits', { amount: n });
          }}
        />
      )}
      {showRemoveCredits && (
        <NumberPrompt
          label="Remove how many credits?"
          onCancel={() => setShowRemoveCredits(false)}
          onSubmit={(n) => {
            setShowRemoveCredits(false);
            runAction('remove-credits', { amount: n });
          }}
        />
      )}
    </div>
  );
}

function NumberPrompt({ label, onCancel, onSubmit }: { label: string; onCancel: () => void; onSubmit: (n: number) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-border p-2.5">
      <label className="text-xs text-text-muted flex-1">{label}</label>
      <input
        type="number"
        autoFocus
        className="w-20 rounded-lg border border-border bg-[#171921] px-2 py-1 text-sm outline-none focus:border-brand"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        onClick={() => value && onSubmit(parseInt(value, 10))}
        className="rounded-lg gradient-brand px-2.5 py-1 text-xs font-semibold"
      >
        Confirm
      </button>
      <button onClick={onCancel} className="text-text-muted">
        <X size={16} />
      </button>
    </div>
  );
}

function DatePrompt({ label, onCancel, onSubmit }: { label: string; onCancel: () => void; onSubmit: (ts: number) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-border p-2.5">
      <label className="text-xs text-text-muted flex-1">{label}</label>
      <input
        type="date"
        autoFocus
        className="rounded-lg border border-border bg-[#171921] px-2 py-1 text-sm outline-none focus:border-brand"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        onClick={() => value && onSubmit(new Date(value).getTime())}
        className="rounded-lg gradient-brand px-2.5 py-1 text-xs font-semibold"
      >
        Confirm
      </button>
      <button onClick={onCancel} className="text-text-muted">
        <X size={16} />
      </button>
    </div>
  );
}

function CreatePackageDialog({
  customerId,
  onClose,
  onCreated,
}: {
  customerId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [plans, setPlans] = useState<PhotoBookPlan[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<PhotoBookPlan[]>('/api/photobook/plans').then((rows) => {
      const active = rows.filter((p) => p.isActive);
      setPlans(active);
      if (active[0]) setPlanId(active[0].id);
    });
  }, []);

  async function handleSubmit() {
    if (!planId) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/photobook/packages', { customerId, planId });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create package');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-bg-secondary p-5 sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">Create Package</p>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        {plans.length === 0 ? (
          <p className="text-sm text-text-muted">No active plans available. Create a plan first.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {plans.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlanId(p.id)}
                  className={`w-full rounded-lg border p-3 text-left ${
                    planId === p.id ? 'border-brand bg-brand/5' : 'border-border'
                  }`}
                >
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-text-muted">
                    {p.credits} albums · {formatDuration(p.durationDays)} · {formatPaise(p.finalPricePaise)}
                  </p>
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={saving || !planId}
              className="w-full rounded-lg gradient-brand py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? 'Creating…' : 'Create Package'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
