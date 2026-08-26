import { useEffect, useState } from 'react';
import { Package, Plus, X, Lock } from 'lucide-react';
import { api, formatPaise, formatDuration, monthsToDays, daysToMonths, type PhotoBookPlan, type PlanType } from '../../lib/api';
import PhotoBookSubNav from '../../components/website/PhotoBookSubNav';

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
      <PhotoBookSubNav />

      <div className="flex items-center justify-between gap-2">
        <div>
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
              {p.planType === 'CUSTOM' ? (
                <>
                  <p className="text-2xl font-semibold mb-1">
                    {formatPaise(Math.max(0, (p.pricePerCreditPaise || 0) - (p.discountPerCreditPaise || 0)))}
                    <span className="text-sm font-normal text-text-muted"> / credit</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    Min {p.minCredits} credits · {formatDuration(p.durationDays)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-text-muted mb-1.5">{p.credits} Album Credits · every duration below</p>
                  <div className="space-y-0.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-text-muted">{formatDuration(p.durationDays)}</span>
                      <span className="font-semibold">
                        {formatPaise(p.finalPricePaise)}
                        {p.discountPaise > 0 && (
                          <span className="ml-1.5 text-[11px] font-normal text-text-muted line-through">{formatPaise(p.basePricePaise)}</span>
                        )}
                      </span>
                    </div>
                    {p.durationOptions.map((o) => (
                      <div key={o.durationDays} className="flex items-baseline justify-between text-sm">
                        <span className="text-text-muted">{formatDuration(o.durationDays)}</span>
                        <span className="font-semibold">
                          {formatPaise(o.finalPricePaise)}
                          {o.discountPaise > 0 && (
                            <span className="ml-1.5 text-[11px] font-normal text-text-muted line-through">{formatPaise(o.basePricePaise)}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
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

type Tier = { months: string; basePrice: string; discount: string };

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
  const [planType, setPlanType] = useState<PlanType>(plan?.planType || 'FIXED');
  const [durationMonths, setDurationMonths] = useState(String(plan ? daysToMonths(plan.durationDays) : '12'));

  // FIXED
  const [credits, setCredits] = useState(String(plan?.credits ?? ''));
  const [basePrice, setBasePrice] = useState(String(plan && plan.planType !== 'CUSTOM' ? plan.basePricePaise / 100 : ''));
  const [discount, setDiscount] = useState(String(plan && plan.planType !== 'CUSTOM' ? plan.discountPaise / 100 : '0'));
  const [tiers, setTiers] = useState<Tier[]>(
    (plan?.durationOptions || []).map((o) => ({
      months: String(daysToMonths(o.durationDays)),
      basePrice: String(o.basePricePaise / 100),
      discount: String(o.discountPaise / 100),
    }))
  );

  // Auto-generator for longer duration tiers - a convenience that fills in
  // `tiers` above (still hand-editable afterward), not a separate concept
  // the backend knows about.
  const [autoUpToYears, setAutoUpToYears] = useState('3');
  const [autoDiscountMode, setAutoDiscountMode] = useState<'PERCENT' | 'FLAT'>('PERCENT');
  const [autoDiscountPerYear, setAutoDiscountPerYear] = useState('5');

  // CUSTOM
  const [minCredits, setMinCredits] = useState(String(plan?.minCredits ?? ''));
  const [pricePerCredit, setPricePerCredit] = useState(String(plan?.pricePerCreditPaise ? plan.pricePerCreditPaise / 100 : ''));
  const [discountPerCredit, setDiscountPerCredit] = useState(String(plan?.discountPerCreditPaise ? plan.discountPerCreditPaise / 100 : '0'));

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isCustom = planType === 'CUSTOM';
  const finalPrice = Math.max(0, (Number(basePrice) || 0) - (Number(discount) || 0));
  const effectivePerCredit = Math.max(0, (Number(pricePerCredit) || 0) - (Number(discountPerCredit) || 0));

  // More time period -> more discount: each generated tier's discount scales
  // with how many years out it is. Base price scales linearly with duration
  // from the plan's own base price/duration, then the escalating discount
  // (money or %, admin's choice) is subtracted on top.
  function handleAutoGenerate() {
    const baseMonths = Number(durationMonths) || 0;
    const baseP = Number(basePrice) || 0;
    const upToYears = parseInt(autoUpToYears, 10);
    const perYear = Number(autoDiscountPerYear) || 0;
    if (baseMonths <= 0 || baseP <= 0 || !Number.isInteger(upToYears) || upToYears <= 0) {
      setError('Fill in duration, base price, and "up to N years" first');
      return;
    }
    setError(null);
    const generated: Tier[] = [];
    for (let year = 1; year <= upToYears; year++) {
      const months = year * 12;
      if (months <= baseMonths) continue; // never generate a tier shorter than/equal to the base
      const tierBase = Math.round(baseP * (months / baseMonths));
      const tierDiscount =
        autoDiscountMode === 'PERCENT' ? Math.round((tierBase * (perYear * year)) / 100) : Math.round(perYear * year);
      generated.push({ months: String(months), basePrice: String(tierBase), discount: String(Math.min(tierDiscount, tierBase)) });
    }
    setTiers(generated);
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name,
        planType,
        durationDays: monthsToDays(Number(durationMonths) || 0),
      };
      if (isCustom) {
        body.minCredits = parseInt(minCredits, 10);
        body.pricePerCreditPaise = Math.round(Number(pricePerCredit) * 100);
        body.discountPerCreditPaise = Math.round(Number(discountPerCredit || 0) * 100);
      } else {
        body.credits = parseInt(credits, 10);
        body.basePricePaise = Math.round(Number(basePrice) * 100);
        body.discountPaise = Math.round(Number(discount || 0) * 100);
        body.durationOptions = tiers.map((t) => ({
          durationDays: monthsToDays(Number(t.months) || 0),
          // Always the base plan's own credits - the server re-enforces this
          // regardless of what's sent, but sending it correctly here too
          // keeps the payload self-documenting rather than relying solely
          // on server-side normalization.
          credits: parseInt(credits, 10),
          basePricePaise: Math.round(Number(t.basePrice) * 100),
          discountPaise: Math.round(Number(t.discount || 0) * 100),
        }));
      }
      if (plan) await api.patch(`/api/photobook/plans/${plan.id}`, body);
      else await api.post('/api/photobook/plans', body);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = isCustom
    ? name.trim() && durationMonths && minCredits && pricePerCredit
    : name.trim() && durationMonths && credits && basePrice;

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

          <div>
            <label className="block text-[10px] text-text-muted mb-1">Plan Type</label>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setPlanType('FIXED')}
                className={`flex-1 py-2 text-xs font-semibold ${planType === 'FIXED' ? 'gradient-brand' : 'text-text-muted hover:bg-white/5'}`}
              >
                Fixed
              </button>
              <button
                type="button"
                onClick={() => setPlanType('CUSTOM')}
                className={`flex-1 py-2 text-xs font-semibold ${planType === 'CUSTOM' ? 'gradient-brand' : 'text-text-muted hover:bg-white/5'}`}
              >
                Custom
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-1">
              {isCustom
                ? 'Customer chooses how many credits to buy (at least the minimum) and pays per credit.'
                : 'A fixed number of credits for a fixed price.'}
            </p>
          </div>

          {isCustom ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Minimum Credits</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                    value={minCredits}
                    onChange={(e) => setMinCredits(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Duration (months)</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                  />
                  <p className="text-[10px] text-text-muted mt-1">{formatDuration(monthsToDays(Number(durationMonths) || 0))}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Price per Credit (₹)</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                    value={pricePerCredit}
                    onChange={(e) => setPricePerCredit(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Discount per Credit (₹)</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                    value={discountPerCredit}
                    onChange={(e) => setDiscountPerCredit(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-text-muted">
                Customer pays: <span className="font-semibold text-text">₹{effectivePerCredit.toLocaleString('en-IN')}</span> per
                credit, minimum {minCredits || 0} credits (₹{(effectivePerCredit * (Number(minCredits) || 0)).toLocaleString('en-IN')})
              </p>
            </>
          ) : (
            <>
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
                  <label className="block text-[10px] text-text-muted mb-1">Duration (months)</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                  />
                  <p className="text-[10px] text-text-muted mt-1">{formatDuration(monthsToDays(Number(durationMonths) || 0))}</p>
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

              <div className="rounded-lg border border-border p-3 space-y-2.5">
                <p className="text-[10px] text-text-muted uppercase">Auto-Generate Longer Durations</p>
                <p className="text-[11px] text-text-muted">
                  Fills in yearly tiers beyond the base duration above (e.g. enter 6 months above → generates 1, 2, 3 years),
                  each with a bigger discount the longer it runs and the same {credits || 0} Album Credits as the base plan.
                  Still hand-editable below afterward - these are just starting numbers, not a fixed formula.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-text-muted mb-1">Up to (years)</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-xs outline-none focus:border-brand"
                      value={autoUpToYears}
                      onChange={(e) => setAutoUpToYears(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-muted mb-1">Discount / year</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-xs outline-none focus:border-brand"
                      value={autoDiscountPerYear}
                      onChange={(e) => setAutoDiscountPerYear(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-muted mb-1">Unit</label>
                    <div className="flex rounded-lg border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setAutoDiscountMode('PERCENT')}
                        className={`flex-1 py-1.5 text-xs font-semibold ${autoDiscountMode === 'PERCENT' ? 'gradient-brand' : 'text-text-muted hover:bg-white/5'}`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutoDiscountMode('FLAT')}
                        className={`flex-1 py-1.5 text-xs font-semibold ${autoDiscountMode === 'FLAT' ? 'gradient-brand' : 'text-text-muted hover:bg-white/5'}`}
                      >
                        ₹
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAutoGenerate}
                  className="w-full rounded-lg border border-brand/40 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10"
                >
                  Generate Tiers
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] text-text-muted uppercase">Extra Duration Options</label>
                  <button
                    type="button"
                    onClick={() => setTiers((t) => [...t, { months: '', basePrice, discount: '0' }])}
                    className="text-[11px] text-brand hover:underline"
                  >
                    + Add Duration
                  </button>
                </div>
                <p className="text-[11px] text-text-muted mb-2">
                  Every duration grants the same <span className="font-semibold text-text">{credits || 0} Album Credits</span> as
                  above - a longer duration only changes validity and price, never how many credits the customer gets.
                </p>
                {tiers.length === 0 ? (
                  <p className="text-[11px] text-text-muted">
                    None yet - customer only sees the {formatDuration(monthsToDays(Number(durationMonths) || 0))} duration above.
                    Generate some above, or add one manually, to let them choose a longer commitment for a bigger discount.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {tiers.map((t, i) => {
                      const tierFinal = Math.max(0, (Number(t.basePrice) || 0) - (Number(t.discount) || 0));
                      return (
                        <div key={i} className="rounded-lg border border-border p-2 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-20 shrink-0">
                              <input
                                type="number"
                                placeholder="Months"
                                className="w-full rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-xs outline-none focus:border-brand"
                                value={t.months}
                                onChange={(e) => setTiers((ts) => ts.map((x, j) => (j === i ? { ...x, months: e.target.value } : x)))}
                              />
                              <p className="text-[9px] text-text-muted mt-0.5 truncate">{formatDuration(monthsToDays(Number(t.months) || 0))}</p>
                            </div>
                            <input
                              type="number"
                              placeholder="Base ₹"
                              className="w-20 rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-xs outline-none focus:border-brand"
                              value={t.basePrice}
                              onChange={(e) => setTiers((ts) => ts.map((x, j) => (j === i ? { ...x, basePrice: e.target.value } : x)))}
                            />
                            <input
                              type="number"
                              placeholder="Discount ₹"
                              className="w-20 rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-xs outline-none focus:border-brand"
                              value={t.discount}
                              onChange={(e) => setTiers((ts) => ts.map((x, j) => (j === i ? { ...x, discount: e.target.value } : x)))}
                            />
                            <span className="flex-1 text-right text-[11px] text-text-muted">₹{tierFinal.toLocaleString('en-IN')}</span>
                            <button
                              type="button"
                              onClick={() => setTiers((ts) => ts.filter((_, j) => j !== i))}
                              aria-label="Remove duration option"
                              className="text-text-muted hover:text-danger"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <p className="flex items-center gap-1 text-[10px] text-text-muted">
                            <Lock size={9} /> {credits || 0} Album Credits (locked - same as the base plan)
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
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
