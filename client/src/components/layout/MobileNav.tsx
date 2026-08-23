import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Users,
  Plus,
  Receipt,
  MoreHorizontal,
  FileText,
  Wallet,
  X,
  Inbox,
  Send,
  FileEdit,
  Trash2,
  Image,
  Edit3,
  ImagePlus,
  BookImage,
  Globe,
} from 'lucide-react';
import { WEBSITE_BASE } from '../../lib/config';

const BILL_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/crm', label: 'CRM', icon: Users },
];
const BILL_RIGHT_ITEMS = [
  { to: '/bills', label: 'Bills', icon: Receipt },
  { to: '/more', label: 'More', icon: MoreHorizontal },
];

const MAIL_ITEMS = [
  { to: '/mail', label: 'Inbox', icon: Inbox, end: true },
  { to: '/mail/sent', label: 'Sent', icon: Send },
];
const MAIL_RIGHT_ITEMS = [
  { to: '/mail/drafts', label: 'Drafts', icon: FileEdit },
  { to: '/mail/trash', label: 'Trash', icon: Trash2 },
];

const WEBSITE_ITEMS = [
  { to: '/website', label: 'Portfolio', icon: Image, end: true },
  { to: '/website/photo-books', label: 'Photo Books', icon: BookImage },
];
const WEBSITE_RIGHT_ITEMS = [
  { to: WEBSITE_BASE, label: 'Visit Site', icon: Globe, external: true },
  { to: '/more', label: 'More', icon: MoreHorizontal },
];

export default function MobileNav() {
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const isMailMode = pathname.startsWith('/mail');
  const isWebsiteMode = pathname.startsWith('/website');

  const items = isMailMode ? MAIL_ITEMS : isWebsiteMode ? WEBSITE_ITEMS : BILL_ITEMS;
  const rightItems = isMailMode ? MAIL_RIGHT_ITEMS : isWebsiteMode ? WEBSITE_RIGHT_ITEMS : BILL_RIGHT_ITEMS;

  function go(path: string) {
    setCreateOpen(false);
    navigate(path);
  }

  function handleFabClick() {
    if (isMailMode) return go('/mail/compose');
    setCreateOpen(true);
  }

  const FabIcon = isMailMode ? Edit3 : isWebsiteMode ? ImagePlus : Plus;
  const fabLabel = isMailMode ? 'Compose' : isWebsiteMode ? 'Add' : 'Create';
  const createSheetItems = isWebsiteMode
    ? [
        { icon: BookImage, label: 'New Photo Book', path: '/website/photo-books/new' },
        { icon: ImagePlus, label: 'New Portfolio Media', path: '/website/add' },
      ]
    : [
        { icon: FileText, label: 'Invoice', path: '/bills/new' },
        { icon: Users, label: 'Client', path: '/crm/new' },
        { icon: Wallet, label: 'Expense', path: '/expenses/new' },
      ];

  return (
    <>
      {createOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="absolute bottom-24 left-4 right-4 rounded-2xl border border-border bg-bg-secondary p-3 shadow-2xl transition-all duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-sm font-semibold text-text-muted">Create New</span>
              <button onClick={() => setCreateOpen(false)} className="text-text-muted">
                <X size={18} />
              </button>
            </div>
            {createSheetItems.map(({ icon: Icon, label, path }) => (
              <button
                key={label}
                onClick={() => go(path)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-white/5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand">
                  <Icon size={18} />
                </span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-4 left-4 right-4 z-30">
        <div className="flex items-center justify-between rounded-full border border-white/10 bg-[#15171ecc] backdrop-blur-xl px-2 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[10px] transition-colors ${
                  isActive ? 'text-brand' : 'text-text-muted'
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}

          <button
            onClick={handleFabClick}
            className="mx-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full gradient-brand shadow-lg active:scale-95 transition-transform"
            aria-label={fabLabel}
          >
            <FabIcon size={22} />
          </button>

          {rightItems.map(({ to, label, icon: Icon, external }) =>
            external ? (
              <a
                key={to}
                href={to}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[10px] text-text-muted transition-colors"
              >
                <Icon size={20} />
                {label}
              </a>
            ) : (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[10px] transition-colors ${
                    isActive ? 'text-brand' : 'text-text-muted'
                  }`
                }
              >
                <Icon size={20} />
                {label}
              </NavLink>
            )
          )}
        </div>
      </nav>
    </>
  );
}
