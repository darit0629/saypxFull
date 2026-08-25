import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/website/customers', label: 'Customers' },
  { to: '/website/plans', label: 'Plans' },
  { to: '/website/orders', label: 'Orders' },
  { to: '/website/payments', label: 'Payments' },
  { to: '/website/credits', label: 'Credits' },
  { to: '/website/renewals-settings', label: 'Settings' },
];

export default function PhotoBookSubNav() {
  const { pathname } = useLocation();
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.to);
        return (
          <Link
            key={t.to}
            to={t.to}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
              active ? 'gradient-brand' : 'text-text-muted hover:bg-white/5'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
