import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserRound, Plus, X, Package } from 'lucide-react';
import { api, formatDate, type PhotoBookCustomer } from '../../lib/api';

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<PhotoBookCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<PhotoBookCustomer[]>('/api/photobook/customers')
      .then(setCustomers)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleStatus(c: PhotoBookCustomer) {
    const next = c.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    await api.patch(`/api/photobook/customers/${c.id}`, { status: next });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Customers</h1>
          <p className="text-sm text-text-muted mt-1">Photographers and businesses who purchase Digital Photo Book packages.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/website/plans"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-text-muted hover:bg-white/5 whitespace-nowrap"
          >
            <Package size={16} /> Plans
          </Link>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg gradient-brand px-3.5 py-2 text-sm font-semibold whitespace-nowrap"
          >
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : customers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <UserRound size={32} className="mx-auto mb-3 text-text-muted" />
          <p className="text-sm font-medium mb-1">No Customers Yet</p>
          <p className="text-sm text-text-muted mb-4">Add a customer to get started with Digital Photo Book packages.</p>
          <button onClick={() => setCreateOpen(true)} className="rounded-lg gradient-brand px-4 py-2 text-sm font-semibold">
            Add Customer
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted text-xs uppercase">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/website/customers/${c.id}`)}
                  className="border-b border-border last:border-0 cursor-pointer hover:bg-white/5"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.businessName || c.name || '—'}</p>
                    {c.businessName && c.name && <p className="text-xs text-text-muted">{c.name}</p>}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{c.email}</td>
                  <td className="px-4 py-3 text-text-muted">{c.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                        c.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-text-muted'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStatus(c);
                      }}
                      className="text-xs text-brand hover:underline"
                    >
                      {c.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <CreateCustomerDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateCustomerDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/photobook/customers', { email, password, name, phone, businessName });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-bg-secondary p-5 sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">Add Customer</p>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Email</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Password</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Business Name</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Contact Name</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Phone</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={saving || !email.trim() || password.length < 8}
            className="w-full rounded-lg gradient-brand py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}
