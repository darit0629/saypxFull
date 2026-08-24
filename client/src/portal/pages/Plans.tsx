import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { customerApi } from '../lib/customerApi';
import { useCustomerAuth } from '../CustomerAuthContext';
import { formatPaise, type PhotoBookPlan } from '../../lib/api';

export default function PortalPlans() {
  const { customer } = useCustomerAuth();
  const [plans, setPlans] = useState<PhotoBookPlan[] | null>(null);

  useEffect(() => {
    customerApi.get<PhotoBookPlan[]>('/api/customer/plans').then(setPlans);
  }, []);

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
                    disabled
                    title="Online checkout is coming soon — contact SAYPX to get this package activated for now."
                    className="mt-auto block rounded-lg border border-border py-2.5 text-center text-sm font-semibold text-text-muted cursor-not-allowed"
                  >
                    Checkout Coming Soon
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
