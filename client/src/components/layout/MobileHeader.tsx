import { NavLink, useLocation } from 'react-router-dom';
import { SearchOverlay, NotificationsBell, ProfileMenu } from './HeaderMenus';

const MODES = [
  { key: 'bill', label: 'Bill', to: '/' },
  { key: 'mail', label: 'Mail', to: '/mail' },
  { key: 'website', label: 'Website', to: '/website' },
] as const;

export default function MobileHeader() {
  const pathname = useLocation().pathname;
  const isMailMode = pathname.startsWith('/mail');
  const isWebsiteMode = pathname.startsWith('/website');
  const activeIndex = isMailMode ? 1 : isWebsiteMode ? 2 : 0;
  const modeLabel = MODES[activeIndex].label;

  return (
    <header className="md:hidden sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="text-sm font-bold shrink-0">
          SAYPX <span className="text-brand">{modeLabel === 'Bill' ? 'Billing' : modeLabel}</span>
        </div>
        <div className="flex items-center gap-3 text-text-muted">
          <SearchOverlay />
          <NotificationsBell />
          <ProfileMenu />
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="relative flex w-full rounded-full bg-[#171921] p-1">
          <div
            className="absolute inset-y-1 left-1 rounded-full gradient-brand shadow-md transition-transform duration-200 ease-out"
            style={{
              width: 'calc(33.333% - 5.33px)',
              transform: `translateX(calc(${activeIndex} * (100% + 8px)))`,
            }}
          />
          {MODES.map((m) => (
            <NavLink
              key={m.key}
              to={m.to}
              className={`relative z-10 flex-1 rounded-full py-2 text-center text-sm font-semibold transition-colors ${
                MODES[activeIndex].key === m.key ? 'text-white' : 'text-text-muted'
              }`}
            >
              {m.label}
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  );
}
