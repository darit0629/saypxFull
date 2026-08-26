import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Sparkles, X as XIcon, QrCode, Cloud, Music, ShieldCheck, Tag, ArrowRight, Boxes } from 'lucide-react';
import { customerApi } from '../lib/customerApi';
import { useCustomerAuth } from '../CustomerAuthContext';
import { openRazorpayCheckout } from '../lib/razorpayCheckout';
import { formatPaise, formatDuration, type PhotoBookPlan } from '../../lib/api';
import { getPlanIcon, getPlanColor } from '../../lib/planTheme';
import PortalHeader from '../components/PortalHeader';

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
  const [selectedDuration, setSelectedDuration] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    customerApi.get<PhotoBookPlan[]>('/api/customer/plans').then((data) => {
      setPlans(data);
      const defaultDuration: Record<number, number> = {};
      data.forEach((p) => {
        if (p.planType === 'FIXED') defaultDuration[p.id] = p.durationDays;
      });
      setSelectedDuration(defaultDuration);
    });
  }, []);

  async function handleBuy(plan: PhotoBookPlan) {
    setBuyingPlanId(plan.id);
    setError(null);
    try {
      const body = { planId: plan.id, durationDays: selectedDuration[plan.id] ?? plan.durationDays };
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

  const fixedPlans = plans?.filter((p) => p.planType === 'FIXED') || [];
  const customPlan = plans?.find((p) => p.planType === 'CUSTOM');

  return (
    <div className="relative z-10 min-h-screen">
      <PortalHeader />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand mb-4">
            <Sparkles size={12} /> Simple Pricing · No Hidden Costs
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Choose the Perfect Plan
            <br />
            For Your <span className="text-brand">Photography</span> Business
          </h1>
          <p className="text-sm text-text-muted max-w-lg mx-auto">Digital albums for every photographer - from first album to thousands.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-5 text-xs text-text-muted">
            <span className="flex items-center gap-1.5"><XIcon size={13} className="text-brand" /> No App for Clients</span>
            <span className="flex items-center gap-1.5"><QrCode size={13} className="text-brand" /> QR Code Sharing</span>
            <span className="flex items-center gap-1.5"><Cloud size={13} className="text-brand" /> Cloud Storage</span>
            <span className="flex items-center gap-1.5"><Music size={13} className="text-brand" /> Audio Support</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-brand" /> Secure & Reliable</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-300 max-w-md mx-auto">{error}</div>
        )}

        {plans === null ? (
          <p className="text-sm text-text-muted text-center">Loading…</p>
        ) : fixedPlans.length === 0 && !customPlan ? (
          <p className="text-sm text-text-muted text-center">No packages available right now — check back soon.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {fixedPlans.map((p) => (
                <FixedPlanCard
                  key={p.id}
                  plan={p}
                  selectedDuration={selectedDuration[p.id] ?? p.durationDays}
                  onDurationChange={(d) => setSelectedDuration((s) => ({ ...s, [p.id]: d }))}
                  loggedIn={!!customer}
                  buying={buyingPlanId === p.id}
                  onBuy={() => handleBuy(p)}
                />
              ))}
            </div>

            {customPlan && (
              <Link
                to={`/album/custom/${customPlan.id}`}
                className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand/5 p-5 hover:bg-brand/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <Boxes size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Don't fit a plan above? Build your own.</p>
                    <p className="text-xs text-text-muted">
                      Pick your own album count and validity - {formatPaise(customPlan.pricePerCreditPaise || 0)} per album.
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1 rounded-lg gradient-brand px-4 py-2 text-sm font-semibold whitespace-nowrap">
                  Build Your Plan <ArrowRight size={14} />
                </span>
              </Link>
            )}

            {fixedPlans.some((p) => p.durationOptions.length > 0) && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <Tag size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">More Validity, Bigger Savings!</p>
                    <p className="text-xs text-text-muted">Choose a longer duration on any plan above and save more.</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 text-xs text-text-muted text-center">
          <span className="flex flex-col items-center gap-1.5"><ShieldCheck size={16} className="text-brand" /> Secure Payments</span>
          <span className="flex flex-col items-center gap-1.5"><Sparkles size={16} className="text-brand" /> Instant Activation</span>
          <span className="flex flex-col items-center gap-1.5"><Cloud size={16} className="text-brand" /> Data Protection</span>
          <span className="flex flex-col items-center gap-1.5"><QrCode size={16} className="text-brand" /> Dedicated Support</span>
        </div>
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
  const Icon = getPlanIcon(plan.icon);
  const color = getPlanColor(plan.themeColor);

  return (
    <div
      className={`relative rounded-2xl border bg-card p-5 flex flex-col ${
        plan.isFeatured ? 'border-brand shadow-[0_0_30px_-8px_rgba(255,87,34,0.5)]' : 'border-border'
      }`}
    >
      {plan.isFeatured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-brand px-3 py-1 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
          Most Popular
        </span>
      )}

      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${color.bg} mb-3`}>
        <Icon size={20} className={color.text} />
      </span>
      <p className="text-lg font-semibold">{plan.name}</p>
      <p className="text-xs text-text-muted mb-3">{plan.tagline || ' '}</p>

      <div className="mb-1">
        <span className="text-3xl font-bold">{formatPaise(active.finalPricePaise)}</span>
      </div>
      <p className="text-xs text-text-muted mb-3">{tiers.length > 1 ? formatDuration(active.durationDays) : `per ${formatDuration(active.durationDays)}`}</p>

      <span className={`inline-block self-start rounded-full ${color.bg} ${color.text} px-2.5 py-1 text-[11px] font-semibold mb-4`}>
        {plan.credits.toLocaleString('en-IN')} Album Credits
      </span>

      {plan.features.length > 0 && (
        <ul className="space-y-2 mb-4 flex-1">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-text-muted">
              <Check size={13} className={`mt-0.5 shrink-0 ${color.check}`} /> {f}
            </li>
          ))}
        </ul>
      )}

      {tiers.length > 1 && (
        <div className="mb-4">
          <p className="text-[10px] text-text-muted uppercase mb-1.5">Validity</p>
          <div className="flex flex-wrap gap-1.5">
            {tiers.map((t) => (
              <button
                key={t.durationDays}
                onClick={() => onDurationChange(t.durationDays)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                  t.durationDays === active.durationDays ? `${color.border} ${color.bg} ${color.text}` : 'border-border text-text-muted hover:bg-white/5'
                }`}
              >
                {formatDuration(t.durationDays)}
              </button>
            ))}
          </div>
          {active.discountPaise > 0 && (
            <p className="text-[11px] text-emerald-400 mt-1.5">Save {formatPaise(active.discountPaise)} vs. base price</p>
          )}
        </div>
      )}

      {loggedIn ? (
        <button
          onClick={onBuy}
          disabled={buying}
          className={`mt-auto block rounded-lg py-2.5 text-center text-sm font-semibold disabled:opacity-60 ${
            plan.isFeatured ? 'gradient-brand' : `border ${color.buttonOutline}`
          }`}
        >
          {buying ? 'Opening Checkout…' : 'Choose Plan'}
        </button>
      ) : (
        <Link
          to="/album/signup"
          className={`mt-auto block rounded-lg py-2.5 text-center text-sm font-semibold ${
            plan.isFeatured ? 'gradient-brand' : `border ${color.buttonOutline}`
          }`}
        >
          Get Started
        </Link>
      )}
    </div>
  );
}
