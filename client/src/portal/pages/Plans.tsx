import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { customerApi } from '../lib/customerApi';
import { useCustomerAuth } from '../CustomerAuthContext';
import { openRazorpayCheckout } from '../lib/razorpayCheckout';
import { formatPaise, formatDuration, type PhotoBookPlan } from '../../lib/api';

interface CreateOrderResponse {
  orderId: number;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  planName: string;
}

export default function PortalPlans() {
  const { customer } = useCustomerAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PhotoBookPlan[] | null>(null);
  const [buyingPlanId, setBuyingPlanId] = useState<number | null>(null);
  const [customCredits, setCustomCredits] = useState<Record<number, string>>({});
  const [selectedDuration, setSelectedDuration] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    customerApi.get<PhotoBookPlan[]>('/api/customer/plans').then((data) => {
      setPlans(data);
      const defaultCredits: Record<number, string> = {};
      const defaultDuration: Record<number, number> = {};
      data.forEach((p) => {
        if (p.planType === 'CUSTOM') {
          if (p.minCredits) defaultCredits[p.id] = String(p.minCredits);
          defaultDuration[p.id] = p.customDurationOptions[0]?.durationDays ?? p.durationDays;
        } else {
          defaultDuration[p.id] = p.durationDays;
        }
      });
      setCustomCredits(defaultCredits);
      setSelectedDuration(defaultDuration);
    });
  }, []);

  async function handleBuy(plan: PhotoBookPlan) {
    setBuyingPlanId(plan.id);
    setError(null);
    try {
      const body: { planId: number; credits?: number; durationDays?: number } = { planId: plan.id };
      if (plan.planType === 'CUSTOM') {
        const credits = parseInt(customCredits[plan.id] || '', 10);
        if (!Number.isInteger(credits) || credits < (plan.minCredits || 1)) {
          setError(`Choose at least ${plan.minCredits} albums`);
          setBuyingPlanId(null);
          return;
        }
        if (plan.maxCredits && credits > plan.maxCredits) {
          setError(`Choose at most ${plan.maxCredits} albums`);
          setBuyingPlanId(null);
          return;
        }
        body.credits = credits;
        body.durationDays = selectedDuration[plan.id] ?? plan.durationDays;
      } else {
        body.durationDays = selectedDuration[plan.id] ?? plan.durationDays;
      }
      const order = await customerApi.post<CreateOrderResponse>('/api/customer/orders', body);
      await openRazorpayCheckout({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'SAYPX Digital Photo Books',
        description: order.planName,
        order_id: order.razorpayOrderId,
        prefill: { email: customer?.email, name: customer?.name || undefined },
        theme: { color: '#ff5a1f' },
        handler: async (response) => {
          try {
            await customerApi.post(`/api/customer/orders/${order.orderId}/verify`, response);
            navigate('/album/dashboard', { replace: true });
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Payment verification failed');
            setBuyingPlanId(null);
          }
        },
        modal: { ondismiss: () => setBuyingPlanId(null) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start checkout');
      setBuyingPlanId(null);
    }
  }

  return (
    <div className="relative z-10 min-h-screen px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          to={customer ? '/album/dashboard' : '/album'}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text mb-4"
        >
          <ArrowLeft size={12} /> Back
        </Link>
        <h1 className="text-2xl font-semibold mb-1">Choose Your Package</h1>
        <p className="text-sm text-text-muted mb-8">Digital Photo Book album credits, valid for your chosen duration.</p>

        {error && (
          <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-300">{error}</div>
        )}

        {plans === null ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : plans.length === 0 ? (
          <p className="text-sm text-text-muted">No packages available right now — check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {plans.map((p) =>
              p.planType === 'CUSTOM' ? (
                <CustomPlanCard
                  key={p.id}
                  plan={p}
                  credits={customCredits[p.id] ?? String(p.minCredits ?? '')}
                  onCreditsChange={(v) => setCustomCredits((c) => ({ ...c, [p.id]: v }))}
                  selectedDuration={selectedDuration[p.id] ?? p.durationDays}
                  onDurationChange={(d) => setSelectedDuration((s) => ({ ...s, [p.id]: d }))}
                  loggedIn={!!customer}
                  buying={buyingPlanId === p.id}
                  onBuy={() => handleBuy(p)}
                />
              ) : (
                <FixedPlanCard
                  key={p.id}
                  plan={p}
                  selectedDuration={selectedDuration[p.id] ?? p.durationDays}
                  onDurationChange={(d) => setSelectedDuration((s) => ({ ...s, [p.id]: d }))}
                  loggedIn={!!customer}
                  buying={buyingPlanId === p.id}
                  onBuy={() => handleBuy(p)}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FixedPlanCard({
  plan,
  selectedDuration,
  onDurationChange,
  loggedIn,
  buying,
  onBuy,
}: {
  plan: PhotoBookPlan;
  selectedDuration: number;
  onDurationChange: (d: number) => void;
  loggedIn: boolean;
  buying: boolean;
  onBuy: () => void;
}) {
  const tiers = useMemo(
    () => [
      { durationDays: plan.durationDays, basePricePaise: plan.basePricePaise, discountPaise: plan.discountPaise, finalPricePaise: plan.finalPricePaise },
      ...plan.durationOptions,
    ],
    [plan]
  );
  const active = tiers.find((t) => t.durationDays === selectedDuration) || tiers[0];

  return (
    <div className={`rounded-2xl border bg-card p-6 flex flex-col ${plan.isFeatured ? 'border-brand' : 'border-border'}`}>
      {plan.isFeatured && (
        <span className="self-start mb-2 rounded-full gradient-brand px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          Most Popular · Best Value
        </span>
      )}
      <p className="text-lg font-semibold mb-1">{plan.name}</p>
      <p className="text-sm text-text-muted mb-4">
        <span className="font-semibold text-text">{plan.credits.toLocaleString('en-IN')}</span> Digital Albums
      </p>

      {plan.features.length > 0 && (
        <ul className="space-y-1.5 mb-4">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-text-muted">
              <Check size={13} className="mt-0.5 shrink-0 text-brand" /> {f}
            </li>
          ))}
        </ul>
      )}

      {tiers.length > 1 ? (
        <>
          <p className="text-[10px] text-text-muted uppercase mb-1.5">Choose Your Validity</p>
          <div className="space-y-1.5 mb-3">
            {tiers.map((t) => {
              const isActive = t.durationDays === active.durationDays;
              return (
                <button
                  key={t.durationDays}
                  onClick={() => onDurationChange(t.durationDays)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                    isActive ? 'border-brand bg-brand/10' : 'border-border hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${isActive ? 'border-brand bg-brand' : 'border-border'}`}
                    />
                    {formatDuration(t.durationDays)}
                  </span>
                  <span className="font-semibold">
                    {formatPaise(t.finalPricePaise)}
                    {t.discountPaise > 0 && (
                      <span className="ml-1.5 text-[11px] font-normal text-text-muted line-through">{formatPaise(t.basePricePaise)}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg bg-white/5 p-3 mb-2 text-xs space-y-0.5">
            <p>
              You receive: <span className="font-semibold text-text">{plan.credits.toLocaleString('en-IN')} Album Credits</span>
            </p>
            <p>
              Package validity: <span className="font-semibold text-text">{formatDuration(active.durationDays)}</span>
            </p>
            {active.discountPaise > 0 && (
              <>
                <p>
                  Original Price: <span className="text-text line-through">{formatPaise(active.basePricePaise)}</span>
                </p>
                <p>
                  Discount: <span className="font-semibold text-emerald-400">{formatPaise(active.discountPaise)}</span>
                </p>
              </>
            )}
            <p>
              You Pay: <span className="font-semibold text-text">{formatPaise(active.finalPricePaise)}</span>
            </p>
          </div>
          <p className="text-[10px] text-text-muted mb-4">
            Longer plans give you more time at a better price. Your album credits remain the same.
          </p>
        </>
      ) : (
        <div className="mb-4">
          <span className="text-3xl font-bold">{formatPaise(active.finalPricePaise)}</span>
          {active.discountPaise > 0 && (
            <span className="ml-2 text-sm text-text-muted line-through">{formatPaise(active.basePricePaise)}</span>
          )}
          <p className="text-xs text-text-muted mt-1">Valid for {formatDuration(active.durationDays)}</p>
        </div>
      )}

      {loggedIn ? (
        <button
          onClick={onBuy}
          disabled={buying}
          className="mt-auto block rounded-lg gradient-brand py-2.5 text-center text-sm font-semibold disabled:opacity-60"
        >
          {buying ? 'Opening Checkout…' : 'Buy Package'}
        </button>
      ) : (
        <Link to="/album/signup" className="mt-auto block rounded-lg gradient-brand py-2.5 text-center text-sm font-semibold">
          Sign Up to Get Started
        </Link>
      )}
    </div>
  );
}

function CustomPlanCard({
  plan,
  credits,
  onCreditsChange,
  selectedDuration,
  onDurationChange,
  loggedIn,
  buying,
  onBuy,
}: {
  plan: PhotoBookPlan;
  credits: string;
  onCreditsChange: (v: string) => void;
  selectedDuration: number;
  onDurationChange: (d: number) => void;
  loggedIn: boolean;
  buying: boolean;
  onBuy: () => void;
}) {
  const min = plan.minCredits || 1;
  const max = plan.maxCredits;
  const pricePerAlbum = plan.pricePerCreditPaise || 0;
  const durations = plan.customDurationOptions.length > 0 ? plan.customDurationOptions : [{ durationDays: plan.durationDays, discountPercent: 0 }];
  const activeDuration = durations.find((d) => d.durationDays === selectedDuration) || durations[0];

  const parsedCredits = parseInt(credits, 10);
  const quantity = Number.isInteger(parsedCredits) && parsedCredits > 0 ? parsedCredits : min;
  const basePaise = useMemo(() => quantity * pricePerAlbum, [quantity, pricePerAlbum]);
  const discountPaise = useMemo(() => Math.round((basePaise * activeDuration.discountPercent) / 100), [basePaise, activeDuration]);
  const finalPaise = basePaise - discountPaise;

  const belowMin = Number.isInteger(parsedCredits) && parsedCredits < min;
  const aboveMax = Number.isInteger(parsedCredits) && !!max && parsedCredits > max;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 flex flex-col">
      <p className="text-lg font-semibold mb-1">Build Your Own Plan</p>
      <p className="text-sm text-text-muted mb-4">
        <span className="font-semibold text-text">{formatPaise(pricePerAlbum)}</span> per album
        {plan.name && plan.name !== 'Build Your Own Plan' ? ` · ${plan.name}` : ''}
      </p>

      {plan.features.length > 0 && (
        <ul className="space-y-1.5 mb-4">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-text-muted">
              <Check size={13} className="mt-0.5 shrink-0 text-brand" /> {f}
            </li>
          ))}
        </ul>
      )}

      <label className="block text-[10px] text-text-muted uppercase mb-1">How many albums do you need?</label>
      <input
        type="number"
        min={min}
        max={max ?? undefined}
        value={credits}
        onChange={(e) => onCreditsChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm mb-1"
      />
      <p className="text-[10px] text-text-muted mb-3">
        {min}{max ? ` – ${max}` : '+'} albums
      </p>
      {belowMin && <p className="text-xs text-danger mb-2">Minimum {min} albums for this plan.</p>}
      {aboveMax && <p className="text-xs text-danger mb-2">Maximum {max} albums for this plan.</p>}

      {durations.length > 1 ? (
        <>
          <label className="block text-[10px] text-text-muted uppercase mb-1.5">How long do you need them?</label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {durations.map((d) => (
              <button
                key={d.durationDays}
                onClick={() => onDurationChange(d.durationDays)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                  d.durationDays === activeDuration.durationDays
                    ? 'border-brand bg-brand/15 text-brand'
                    : 'border-border text-text-muted hover:bg-white/5'
                }`}
              >
                {formatDuration(d.durationDays)}
                {d.discountPercent > 0 ? ` · ${d.discountPercent}% off` : ''}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-text-muted mb-3">Valid for {formatDuration(activeDuration.durationDays)}</p>
      )}

      <div className="rounded-lg bg-white/5 p-3 mb-2 text-xs space-y-0.5">
        <p>
          {quantity.toLocaleString('en-IN')} Albums × {formatPaise(pricePerAlbum)} ={' '}
          <span className="font-semibold text-text">{formatPaise(basePaise)}</span>
        </p>
        {activeDuration.discountPercent > 0 && (
          <p>
            Duration Discount: <span className="font-semibold text-emerald-400">{activeDuration.discountPercent}% (−{formatPaise(discountPaise)})</span>
          </p>
        )}
        <p className="pt-1 border-t border-border/60 mt-1">
          You Pay: <span className="font-semibold text-text">{formatPaise(finalPaise)}</span>
        </p>
      </div>
      <p className="text-[10px] text-text-muted mb-4">
        You get exactly {quantity.toLocaleString('en-IN')} album credits, whichever duration you pick.
      </p>

      {loggedIn ? (
        <button
          onClick={onBuy}
          disabled={buying || belowMin || aboveMax}
          className="mt-auto block rounded-lg gradient-brand py-2.5 text-center text-sm font-semibold disabled:opacity-60"
        >
          {buying ? 'Opening Checkout…' : 'Continue to Payment'}
        </button>
      ) : (
        <Link to="/album/signup" className="mt-auto block rounded-lg gradient-brand py-2.5 text-center text-sm font-semibold">
          Sign Up to Get Started
        </Link>
      )}
    </div>
  );
}
