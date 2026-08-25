import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { customerApi } from '../lib/customerApi';
import { useCustomerAuth } from '../CustomerAuthContext';
import { openRazorpayCheckout } from '../lib/razorpayCheckout';
import { formatPaise, type PhotoBookPlan } from '../../lib/api';

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    customerApi.get<PhotoBookPlan[]>('/api/customer/plans').then(setPlans);
  }, []);

  async function handleBuy(plan: PhotoBookPlan) {
    setBuyingPlanId(plan.id);
    setError(null);
    try {
      const order = await customerApi.post<CreateOrderResponse>('/api/customer/orders', { planId: plan.id });
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
            navigate('/portal/dashboard', { replace: true });
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
    <div className="min-h-screen bg-bg px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          to={customer ? '/portal/dashboard' : '/portal'}
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
            {plans.map((p) => (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-6 flex flex-col">
                <p className="text-lg font-semibold mb-1">{p.name}</p>
                <div className="mb-1">
                  <span className="text-3xl font-bold">{formatPaise(p.finalPricePaise)}</span>
                  {p.discountPaise > 0 && (
                    <span className="ml-2 text-sm text-text-muted line-through">{formatPaise(p.basePricePaise)}</span>
                  )}
                </div>
                <p className="text-xs text-text-muted mb-4">
                  {p.credits} albums · {p.durationDays} days
                </p>
                {p.features.length > 0 && (
                  <ul className="space-y-1.5 mb-5 flex-1">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-text-muted">
                        <Check size={13} className="mt-0.5 shrink-0 text-brand" /> {f}
                      </li>
                    ))}
                  </ul>
                )}
                {customer ? (
                  <button
                    onClick={() => handleBuy(p)}
                    disabled={buyingPlanId === p.id}
                    className="mt-auto block rounded-lg gradient-brand py-2.5 text-center text-sm font-semibold disabled:opacity-60"
                  >
                    {buyingPlanId === p.id ? 'Opening Checkout…' : 'Buy Package'}
                  </button>
                ) : (
                  <Link
                    to="/portal/signup"
                    className="mt-auto block rounded-lg gradient-brand py-2.5 text-center text-sm font-semibold"
                  >
                    Sign Up to Get Started
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
