import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Wallet, Palette, BarChart3, Settings, HelpCircle, LogOut, ChevronRight, Mail, Image } from 'lucide-react';
import { useAuth } from '../lib/auth';
import HelpModal from '../components/HelpModal';

const ITEMS = [
  { to: '/mail', label: 'Mail', icon: Mail },
  { to: '/website', label: 'Website Portfolio', icon: Image },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/templates', label: 'Templates', icon: Palette },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function More() {
  const { logout } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="space-y-5">
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      <h1 className="text-xl font-semibold">More</h1>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {ITEMS.map(({ to, label, icon: Icon }, i) => (
          <NavLink
            key={to}
            to={to}
            className={`flex items-center gap-3 px-4 py-3.5 text-sm hover:bg-white/5 ${
              i > 0 ? 'border-t border-border' : ''
            }`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
              <Icon size={16} />
            </span>
            <span className="flex-1">{label}</span>
            <ChevronRight size={16} className="text-text-muted" />
          </NavLink>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setHelpOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-sm hover:bg-white/5"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
            <HelpCircle size={16} />
          </span>
          <span className="flex-1 text-left">Help &amp; Tips</span>
          <ChevronRight size={16} className="text-text-muted" />
        </button>
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-sm hover:bg-white/5 border-t border-border text-red-300"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger/15 text-red-300">
            <LogOut size={16} />
          </span>
          <span className="flex-1 text-left">Log Out</span>
        </button>
      </div>
    </div>
  );
}
