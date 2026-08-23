import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api, formatMoney, type Client } from '../../lib/api';
import ClientDialog from '../../components/ClientDialog';

export default function ClientList() {
  const location = useLocation();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(location.pathname === '/crm/new');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  function load() {
    setLoading(true);
    api
      .get<Client[]>('/api/clients')
      .then(setClients)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Navigating to /crm/new while ClientList is already mounted (e.g. from the
  // mobile nav's Create sheet) doesn't remount the component, so the dialogOpen
  // useState initializer above only fires on the very first mount - this catches
  // the route change on subsequent navigations too.
  useEffect(() => {
    if (location.pathname === '/crm/new') setDialogOpen(true);
  }, [location.pathname]);

  const filtered = clients.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.phone || '').includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">CRM</h1>
          <p className="text-sm text-text-muted mt-1">{clients.length} clients</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 rounded-lg gradient-brand px-3.5 py-2 text-sm font-semibold"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2.5 text-sm outline-none focus:border-brand"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-text-muted">
            {clients.length === 0 ? 'No clients yet. Add your first client.' : 'No matches found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((client) => (
            <button
              key={client.id}
              onClick={() => navigate(`/crm/${client.id}`)}
              className="text-left rounded-xl border border-border bg-card p-4 hover:border-brand/50 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand font-semibold">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{client.name}</p>
                  <p className="text-xs text-text-muted truncate">{client.phone || 'No phone'}</p>
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <div>
                  <p className="text-text-muted">Revenue</p>
                  <p className="font-semibold mt-0.5">{formatMoney(client.total_revenue || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-text-muted">Due</p>
                  <p className={`font-semibold mt-0.5 ${(client.total_due || 0) > 0 ? 'text-warning' : ''}`}>
                    {formatMoney(client.total_due || 0)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <ClientDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          if (location.pathname === '/crm/new') navigate('/crm', { replace: true });
        }}
        onSaved={() => {
          load();
          if (location.pathname === '/crm/new') navigate('/crm', { replace: true });
        }}
      />
    </div>
  );
}
