import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Calendar, Boxes, Tag, Lock, Zap, Infinity as InfinityIcon, Smartphone, ShieldCheck } from 'lucide-react';
import { customerApi } from '../lib/customerApi';
import { useCustomerAuth } from '../CustomerAuthContext';
import { openRazorpayCheckout } from '../lib/razorpayCheckout';
import { formatPaise, formatDuration, type PhotoBookPlan } from '../../lib/api';
import PortalHeader from '../components/PortalHeader';

interface CreateOrderResponse {
  orderId: number;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  planName: string;
}

export default function CustomPlanBuilder() {
  const { planId } = useParams<{ planId: string }>();
  const { customer } = useCustomerAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PhotoBookPlan | null | undefined>(undefined); // undefined = loading, null = not found
  const [credits, setCredits] = useState(50);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    customerApi.get<PhotoBookPlan[]>('/api/customer/plans').then((plans) => {
      const found = plans.find((p) => String(p.id) === planId && p.planType === 'CUSTOM') || null;
      setPlan(found);
      if (found) {
        setCredits(found.minCredits || 50);
        setSelectedDuration(found.customDurationOptions[0]?.durationDays ?? found.durationDays);
      }
    });
  }, [planId]);

  const durations = useMemo(
    () => (plan ? (plan.customDurationOptions.length > 0 ? plan.customDurationOptions : [{ durationDays: plan.durationDays, discountPercent: 0 }]) : []),
    [plan]
  );
  const activeDuration = durations.find((d) => d.durationDays === selectedDuration) || durations[0];

  const pricePerAlbum = plan?.pricePerCreditPaise || 0;
  const basePaise = credits * pricePerAlbum;
  const discountPaise = activeDuration ? Math.round((basePaise * activeDuration.discountPercent) / 100) : 0;
  const finalPaise = basePaise - discountPaise;

  const min = plan?.minCredits || 1;
  const max = plan?.maxCredits ?? null;
  const belowMin = credits < min;
  const aboveMax = max !== null && credits > max;

  function step(delta: number) {
    setCredits((c) => {
      const next = c + delta;
      if (next < min) return min;
      if (max !== null && next > max) return max;
      return next;
    });
  }

  async function handleBuy() {
    if (!plan || !activeDuration) return;
    setBuying(true);
    setError(null);
    try {
      const order = await customerApi.post<CreateOrderResponse>('/api/customer/orders', {
        planId: plan.id,
        credits,
        durationDays: activeDuration.durationDays,
      });
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
            setBuying(false);
          }
        },
        modal: { ondismiss: () => setBuying(false) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start checkout');
      setBuying(false);
    }
  }

  if (plan === undefined) {
    return (
      <div className="relative z-10 min-h-screen">
        <PortalHeader />
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-text-muted">Loading…</p>
        </div>
      </div>
    );
  }
  if (plan === null) {
    return (
      <div className="relative z-10 min-h-screen">
        <PortalHeader />
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
          <p className="text-sm text-text-muted mb-4">This custom plan isn't available right now.</p>
          <Link to="/album/plans" className="text-sm text-brand hover:underline">
            Back to Plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen">
      <PortalHeader />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link to="/album/plans" className="flex items-center gap-1 text-xs text-text-muted hover:text-text mb-6">
          <ArrowLeft size={12} /> Back to Plans
        </Link>

        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand mb-4">
            <Boxes size={12} /> Build Your Own Plan
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Create a Plan That{' '}
            <span className="bg-gradient-to-r from-brand to-pink-500 bg-clip-text text-transparent">Fits Your Business</span>
          </h1>
          <p className="text-sm text-text-muted max-w-lg mx-auto">
            Choose the number of albums and validity that works best for you. More time, bigger savings.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-5 text-xs text-text-muted">
            <span className="flex items-center gap-1.5"><Tag size={13} className="text-brand" /> No Hidden Fees</span>
            <span className="flex items-center gap-1.5"><Zap size={13} className="text-brand" /> Instant Activation</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-brand" /> Secure & Reliable</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-300">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
                  <Boxes size={16} />
                </span>
                <div>
                  <p className="text-sm font-semibold">How many albums do you need?</p>
                  <p className="text-[11px] text-text-muted">Choose the total number of digital albums.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <button
                  onClick={() => step(-1)}
                  aria-label="Decrease"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-white/5"
                >
                  <Minus size={16} />
                </button>
                <input
                  type="number"
                  value={credits}
                  onChange={(e) => setCredits(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-center text-3xl font-bold bg-transparent outline-none"
                />
                <button
                  onClick={() => step(1)}
                  aria-label="Increase"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-white/5"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-text-muted mt-2">
                <span>Minimum {min} albums</span>
                <span>{max !== null ? `Maximum ${max.toLocaleString('en-IN')} albums` : 'No maximum'}</span>
              </div>
              {belowMin && <p className="text-xs text-danger mt-2">Minimum {min} albums for this plan.</p>}
              {aboveMax && <p className="text-xs text-danger mt-2">Maximum {max} albums for this plan.</p>}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
                  <Calendar size={16} />
                </span>
                <div>
                  <p className="text-sm font-semibold">For how long do you need it?</p>
                  <p className="text-[11px] text-text-muted">Select the validity period for your plan.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
                {durations.map((d) => (
                  <button
                    key={d.durationDays}
                    onClick={() => setSelectedDuration(d.durationDays)}
                    className={`rounded-lg border py-2.5 text-center text-xs font-semibold ${
                      d.durationDays === activeDuration?.durationDays
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border text-text-muted hover:bg-white/5'
                    }`}
                  >
                    {formatDuration(d.durationDays)}
                  </button>
                ))}
              </div>
              {durations.length > 1 && (
                <div className="flex items-start gap-2 rounded-lg bg-brand/10 p-3 mt-4 text-xs">
                  <Tag size={14} className="text-brand shrink-0 mt-0.5" />
                  <p>
                    <span className="font-semibold text-brand">The longer the validity, the more you save!</span>{' '}
                    <span className="text-text-muted">Choose a longer duration and get bigger discounts.</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-semibold mb-3">Your Custom Plan</p>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Albums</span>
                  <span className="font-semibold">{credits.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Validity</span>
                  <span className="font-semibold">{activeDuration ? formatDuration(activeDuration.durationDays) : '—'}</span>
                </div>
              </div>
              <div className="border-t border-border pt-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-text-muted">
                  <span>Base Price ({formatPaise(pricePerAlbum)} × {credits})</span>
                  <span>{formatPaise(basePaise)}</span>
                </div>
                <div className="flex items-center justify-between text-text-muted">
                  <span>Duration Discount ({activeDuration?.discountPercent ?? 0}%)</span>
                  <span>− {formatPaise(discountPaise)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border mt-3 pt-3">
                <span className="text-sm font-semibold">Total Amount</span>
                <span className="text-lg font-bold">{formatPaise(finalPaise)}</span>
              </div>
            </div>

            {discountPaise > 0 && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-400 font-semibold">You Save</span>
                  <span className="text-emerald-400 font-bold">{formatPaise(discountPaise)}</span>
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">
                  By choosing {activeDuration ? formatDuration(activeDuration.durationDays) : 'this'} plan
                </p>
              </div>
            )}

            {customer ? (
              <button
                onClick={handleBuy}
                disabled={buying || belowMin || aboveMax}
                className="w-full flex items-center justify-center gap-2 rounded-lg gradient-brand py-3 text-sm font-semibold disabled:opacity-60"
              >
                {buying ? 'Opening Checkout…' : 'Continue to Payment'}
              </button>
            ) : (
              <Link
                to="/album/signup"
                className="w-full flex items-center justify-center gap-2 rounded-lg gradient-brand py-3 text-sm font-semibold"
              >
                Sign Up to Get Started
              </Link>
            )}
            <p className="flex items-center justify-center gap-1 text-[11px] text-text-muted">
              <Lock size={11} /> Secure payments powered by Razorpay
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 text-xs text-text-muted">
          <span className="flex items-center gap-2">
            <Zap size={14} className="text-brand" /> Instant activation - get started right after payment
          </span>
          <span className="flex items-center gap-2">
            <InfinityIcon size={14} className="text-brand" /> Your albums stay accessible for the plan's full validity
          </span>
          <span className="flex items-center gap-2">
            <Smartphone size={14} className="text-brand" /> Works on web, mobile & tablet
          </span>
        </div>
      </div>
    </div>
  );
}
