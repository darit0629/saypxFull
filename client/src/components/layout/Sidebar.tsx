import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Receipt,
  Wallet,
  Palette,
  BarChart3,
  Settings,
  HelpCircle,
  LogOut,
  Inbox,
  Send,
  FileEdit,
  Trash2,
  Image,
  BookImage,
  Globe,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import HelpModal from '../HelpModal';
import { WEBSITE_BASE } from '../../lib/config';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  external?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/crm', label: 'CRM', icon: Users },
  { to: '/bills', label: 'Bills', icon: Receipt },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/templates', label: 'Templates', icon: Palette },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const MAIL_NAV_ITEMS: NavItem[] = [
  { to: '/mail', label: 'Inbox', icon: Inbox, end: true },
  { to: '/mail/sent', label: 'Sent', icon: Send },
  { to: '/mail/drafts', label: 'Drafts', icon: FileEdit },
  { to: '/mail/trash', label: 'Trash', icon: Trash2 },
];

const WEBSITE_NAV_ITEMS: NavItem[] = [
  { to: '/website', label: 'Portfolio', icon: Image, end: true },
  { to: '/website/photo-books', label: 'Photo Books', icon: BookImage },
  { to: WEBSITE_BASE, label: 'Visit Website', icon: Globe, external: true },
];

const MODES = [
  { key: 'bill', label: 'Bill', to: '/' },
  { key: 'mail', label: 'Mail', to: '/mail' },
  { key: 'website', label: 'Website', to: '/website' },
] as const;

export default function Sidebar() {
  const { logout } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const pathname = useLocation().pathname;
  const isMailMode = pathname.startsWith('/mail');
  const isWebsiteMode = pathname.startsWith('/website');
  const activeIndex = isMailMode ? 1 : isWebsiteMode ? 2 : 0;
  const items = isMailMode ? MAIL_NAV_ITEMS : isWebsiteMode ? WEBSITE_NAV_ITEMS : NAV_ITEMS;

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r border-border bg-bg-secondary/80 backdrop-blur-sm">
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      <div className="px-5 py-6">
        <div className="text-lg font-bold">
          SAYPX <span className="text-brand">BILLING</span>
        </div>
      </div>

      <div className="relative mx-3 mb-2 flex rounded-full bg-[#171921] p-1">
        <div
          className="absolute inset-y-1 left-1 rounded-full gradient-brand transition-transform duration-200 ease-out"
          style={{
            width: 'calc(33.333% - 5.33px)',
            transform: `translateX(calc(${activeIndex} * (100% + 8px)))`,
          }}
        />
        {MODES.map((m) => (
          <NavLink
            key={m.key}
            to={m.to}
            className={`relative z-10 flex-1 rounded-full py-1.5 text-center text-xs font-semibold transition-colors ${
              MODES[activeIndex].key === m.key ? 'text-white' : 'text-text-muted hover:text-text'
            }`}
          >
            {m.label}
          </NavLink>
        ))}
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {items.map(({ to, label, icon: Icon, end, external }) =>
          external ? (
            <a
              key={to}
              href={to}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-muted hover:bg-white/5 hover:text-text transition-colors"
            >
              <Icon size={18} />
              {label}
            </a>
          ) : (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-brand/15 text-brand'
                    : 'text-text-muted hover:bg-white/5 hover:text-text'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          )
        )}
      </nav>

      <div className="px-3 py-4 border-t border-border space-y-1">
        <button
          onClick={() => setHelpOpen(true)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-muted hover:bg-white/5 hover:text-text transition-colors"
        >
          <HelpCircle size={18} />
          Help
        </button>
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-muted hover:bg-white/5 hover:text-red-300 transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
