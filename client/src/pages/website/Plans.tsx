import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Package, Plus, X } from 'lucide-react';
import { api, formatPaise, type PhotoBookPlan } from '../../lib/api';

export default function Plans() {
  const [plans, setPlans] = useState<PhotoBookPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogPlan, setDialogPlan] = useState<PhotoBookPlan | 'new' | null>(null);

  function load() {
    setLoading(true);
    api
      .get<PhotoBookPlan[]>('/api/photobook/plans')
      .then(setPlans)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleActive(plan: PhotoBookPlan) {
    await api.patch(`/api/photobook/plans/${plan.id}`, { isActive: !plan.isActive });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Link to="/website/customers" className="flex items-center gap-1 text-xs text-text-muted hover:text-text mb-1">
            <ArrowLeft size={12} /> Customers
          </Link>
          <h1 className="text-xl font-semibold">Plans</h1>
          <p className="text-sm text-text-muted mt-1">Album packages customers can purchase.</p>
        </div>
        <button
          onClick={() => setDialogPlan('new')}
          className="flex items-center gap-1.5 rounded-lg gradient-brand px-3.5 py-2 text-sm font-semibold whitespace-nowrap"
        >
          <Plus size={16} /> New Plan
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Package size={32} className="mx-auto mb-3 text-text-muted" />
          <p className="text-sm font-medium mb-1">No Plans Yet</p>
          <p className="text-sm text-text-muted mb-4">Create a plan to start offering Digital Photo Book packages.</p>
          <button onClick={() => setDialogPlan('new')} className="rounded-lg gradient-brand px-4 py-2 text-sm font-semibold">
            New Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => setDialogPlan(p)}
              className="rounded-xl border border-border bg-card p-4 text-left hover:border-brand/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="font-medium">{p.name}</p>
                <span
                  className={`shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                    p.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-text-muted'
                  }`}
                >
                  {p.isActive ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-2xl font-semibold mb-1">
                {formatPaise(p.finalPricePaise)}
                {p.discountPaise > 0 && (
                  <span className="ml-2 text-sm font-normal text-text-muted line-through">{formatPaise(p.basePricePaise)}</span>
                )}
              </p>
              <p className="text-xs text-text-muted">
                {p.credits} albums · {p.durationDays} days
              </p>
            </button>
          ))}
        </div>
      )}

      {dialogPlan && (
        <PlanDialog
          plan={dialogPlan === 'new' ? null : dialogPlan}
          onClose={() => setDialogPlan(null)}
          onSaved={() => {
            setDialogPlan(null);
            load();
          }}
          onToggleActive={dialogPlan !== 'new' ? () => toggleActive(dialogPlan) : undefined}
        />
      )}
    </div>
  );
}

function PlanDialog({
  plan,
  onClose,
  onSaved,
  onToggleActive,
}: {
  plan: PhotoBookPlan | null;
  onClose: () => void;
  onSaved: () => void;
  onToggleActive?: () => void;
}) {
  const [name, setName] = useState(plan?.name || '');
  const [credits, setCredits] = useState(String(plan?.credits ?? ''));
  const [durationDays, setDurationDays] = useState(String(plan?.durationDays ?? '365'));
  const [basePrice, setBasePrice] = useState(String(plan ? plan.basePricePaise / 100 : ''));
  const [discount, setDiscount] = useState(String(plan ? plan.discountPaise / 100 : '0'));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const finalPrice = Math.max(0, (Number(basePrice) || 0) - (Number(discount) || 0));

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name,
        credits: parseInt(credits, 10),
        durationDays: parseInt(durationDays, 10),
        basePricePaise: Math.round(Number(basePrice) * 100),
        discountPaise: Math.round(Number(discount || 0) * 100),
      };
      if (plan) await api.patch(`/api/photobook/plans/${plan.id}`, body);
      else await api.post('/api/photobook/plans', body);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save plan');
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
          <p className="text-sm font-semibold">{plan ? 'Edit Plan' : 'New Plan'}</p>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Plan Name</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Starter — 50 Albums"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Album Credits</label>
              <input
                type="number"
                className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Duration (days)</label>
              <input
                type="number"
                className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Base Price (₹)</label>
              <input
                type="number"
                className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Discount (₹)</label>
              <input
                type="number"
                className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-text-muted">
            Customer pays: <span className="font-semibold text-text">₹{finalPrice.toLocaleString('en-IN')}</span>
          </p>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !credits || !durationDays || !basePrice}
            className="w-full rounded-lg gradient-brand py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Saving…' : plan ? 'Save Changes' : 'Create Plan'}
          </button>

          {onToggleActive && (
            <button
              onClick={onToggleActive}
              className="w-full rounded-lg border border-border py-2 text-xs text-text-muted hover:bg-white/5"
            >
              {plan?.isActive ? 'Disable Plan' : 'Enable Plan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
