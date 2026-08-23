import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, User, Settings, Lock, LogOut, X } from 'lucide-react';
import { api, formatMoney, type Invoice, type Client } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const { lockInfo, lockNow, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <button aria-label="Profile" onClick={() => setOpen(true)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
        <User size={15} />
      </button>
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div
            className="absolute right-4 top-14 w-48 rounded-xl border border-border bg-bg-secondary p-1.5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setOpen(false); navigate('/settings'); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-white/5"
            >
              <Settings size={15} /> Settings
            </button>
            {lockInfo?.hasCredential && lockInfo.lockEnabled && (
              <button
                onClick={() => { setOpen(false); lockNow(); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-white/5"
              >
                <Lock size={15} /> Lock Now
              </button>
            )}
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-white/5"
            >
              <LogOut size={15} /> Log Out
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();

  function loadIfNeeded() {
    if (loaded) return;
    api.get<Invoice[]>('/api/invoices').then((rows) => {
      const now = Date.now();
      const soon = now + 7 * 24 * 60 * 60 * 1000;
      const flagged = rows.filter(
        (inv) => inv.display_status === 'overdue' || (inv.display_status !== 'paid' && inv.due_date && inv.due_date <= soon)
      );
      setInvoices(flagged);
      setLoaded(true);
    });
  }

  return (
    <>
      <button
        aria-label="Notifications"
        onClick={() => { setOpen(true); loadIfNeeded(); }}
        className="relative"
      >
        <Bell size={19} />
        {invoices.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand text-[8px] font-bold text-white">
            {invoices.length > 9 ? '9+' : invoices.length}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div
            className="absolute right-4 top-14 w-72 max-h-96 overflow-y-auto rounded-xl border border-border bg-bg-secondary p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-xs font-semibold text-text-muted">Due &amp; Overdue</span>
              <button onClick={() => setOpen(false)} className="text-text-muted"><X size={14} /></button>
            </div>
            {invoices.length === 0 ? (
              <p className="px-2 py-3 text-xs text-text-muted">Nothing due soon. You're all caught up.</p>
            ) : (
              invoices.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => { setOpen(false); navigate(`/bills/${inv.id}`); }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-white/5"
                >
                  <span>
                    <span className="block font-medium">{inv.client_name}</span>
                    <span className={inv.display_status === 'overdue' ? 'text-danger' : 'text-text-muted'}>
                      {inv.invoice_number} · {inv.display_status === 'overdue' ? 'Overdue' : 'Due soon'}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium">{formatMoney(inv.due_amount)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    Promise.all([api.get<Client[]>('/api/clients'), api.get<Invoice[]>('/api/invoices')]).then(
      ([c, i]) => {
        setClients(c);
        setInvoices(i);
      }
    );
  }, [open]);

  const q = query.trim().toLowerCase();
  const matchedClients = q ? clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 5) : [];
  const matchedInvoices = q
    ? invoices
        .filter((i) => i.invoice_number.toLowerCase().includes(q) || i.client_name.toLowerCase().includes(q))
        .slice(0, 5)
    : [];

  return (
    <>
      <button aria-label="Search" onClick={() => setOpen(true)}>
        <Search size={19} />
      </button>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-start justify-center pt-20 px-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-secondary p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-[#171921] px-3 py-2">
              <Search size={15} className="text-text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clients or invoices…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <button onClick={() => setOpen(false)} className="text-text-muted"><X size={15} /></button>
            </div>

            {q && (
              <div className="mt-2 max-h-80 overflow-y-auto space-y-1">
                {matchedClients.length === 0 && matchedInvoices.length === 0 && (
                  <p className="px-2 py-3 text-xs text-text-muted">No matches for "{query}"</p>
                )}
                {matchedClients.map((c) => (
                  <button
                    key={`c${c.id}`}
                    onClick={() => { setOpen(false); setQuery(''); navigate(`/crm/${c.id}`); }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-white/5"
                  >
                    <span>{c.name}</span>
                    <span className="text-text-muted">Client</span>
                  </button>
                ))}
                {matchedInvoices.map((i) => (
                  <button
                    key={`i${i.id}`}
                    onClick={() => { setOpen(false); setQuery(''); navigate(`/bills/${i.id}`); }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-white/5"
                  >
                    <span>{i.invoice_number} · {i.client_name}</span>
                    <span className="text-text-muted">Invoice</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
