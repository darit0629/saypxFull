import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, PackageX, BookImage, Plus, X, Trash2, Sparkles } from 'lucide-react';
import { customerApi } from '../lib/customerApi';
import { useCustomerAuth } from '../CustomerAuthContext';
import { openRazorpayCheckout } from '../lib/razorpayCheckout';
import { formatDate, formatPaise, formatDuration, type CustomerPackageView } from '../../lib/api';

interface CreateOrderResponse {
  orderId: number;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  planName: string;
}

interface CustomerAlbum {
  id: number;
  title: string;
  status: string;
  public_code: string;
}

const STATUS_LABEL: Record<string, { label: string; dot: string }> = {
  ACTIVE: { label: 'Active', dot: '🟢' },
  EXPIRING_SOON: { label: 'Expiring Soon', dot: '🟠' },
  EXPIRED: { label: 'Expired', dot: '🔴' },
  PENDING: { label: 'Pending', dot: '⚪' },
  SUSPENDED: { label: 'Suspended', dot: '🔴' },
  CANCELLED: { label: 'Cancelled', dot: '🔴' },
};

function daysUntil(ts: number | null) {
  if (!ts) return null;
  return Math.ceil((ts - Date.now()) / (24 * 60 * 60 * 1000));
}

export default function PortalDashboard() {
  const { customer, logout } = useCustomerAuth();
  const [packages, setPackages] = useState<CustomerPackageView[] | null>(null);
  const [albums, setAlbums] = useState<CustomerAlbum[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);

  function loadPackages() {
    customerApi.get<CustomerPackageView[]>('/api/customer/packages/current').then(setPackages);
  }
  function loadAlbums() {
    customerApi.get<CustomerAlbum[]>('/api/customer/albums').then(setAlbums);
  }

  useEffect(() => {
    loadPackages();
    loadAlbums();
  }, []);

  async function handleDelete(id: number) {
    if (!confirm('Delete this album? This does not refund the album credit.')) return;
    await customerApi.delete(`/api/customer/albums/${id}`);
    loadAlbums();
    loadPackages();
  }

  const activePackage = packages?.find((p) => p.status === 'ACTIVE' || p.status === 'EXPIRING_SOON' || p.status === 'PENDING');

  return (
    <div className="relative z-10 min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <p className="text-lg font-semibold bg-gradient-to-r from-brand to-orange-300 bg-clip-text text-transparent">
            SAYPX Digital Photo Books
          </p>
          <p className="text-xs text-text-muted">{customer?.businessName || customer?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/portal/plans"
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-white/5"
          >
            Plans
          </Link>
          <Link
            to="/portal/orders"
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-white/5"
          >
            Orders
          </Link>
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-white/5"
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-xl font-semibold mb-1">Welcome, {customer?.name || customer?.businessName || 'there'}</h1>
        <p className="text-sm text-text-muted mb-8">Here's an overview of your Digital Photo Book package.</p>

        {packages === null ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : !activePackage ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <PackageX size={32} className="mx-auto mb-3 text-text-muted" />
            <p className="text-sm font-medium mb-1">No Active Package Yet</p>
            <p className="text-sm text-text-muted mb-4">Choose a package to start creating digital photo books.</p>
            <Link to="/portal/plans" className="inline-block rounded-lg gradient-brand px-4 py-2 text-sm font-semibold">
              View Plans
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-wide text-text-muted">Digital Photo Book Package</p>
              <span className="text-sm">
                {STATUS_LABEL[activePackage.status]?.dot} {STATUS_LABEL[activePackage.status]?.label}
              </span>
            </div>

            <p className="text-2xl font-semibold mb-1">{activePackage.plan?.name}</p>

            <div className="mb-4">
              <p className="text-[10px] text-text-muted uppercase mb-1">Album Credits</p>
              <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                <span>{activePackage.creditsUsed} Used</span>
                <span>{activePackage.creditsRemaining} Remaining</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full gradient-brand"
                  style={{ width: `${Math.min(100, (activePackage.creditsUsed / Math.max(1, activePackage.creditsTotal)) * 100)}%` }}
                />
              </div>
            </div>

            {activePackage.expiresAt && (
              <div className="text-sm text-text-muted">
                <p className="text-[10px] text-text-muted uppercase mb-1">Package Validity</p>
                {daysUntil(activePackage.expiresAt) !== null && daysUntil(activePackage.expiresAt)! >= 0 ? (
                  <p>Expires in {formatDuration(daysUntil(activePackage.expiresAt)!)}</p>
                ) : (
                  <p>Expired</p>
                )}
                <p>Expires: {formatDate(activePackage.expiresAt)}</p>
              </div>
            )}

            {activePackage.purchasedAmountPaise != null && (
              <p className="mt-3 text-xs text-text-muted">
                Purchased at {formatPaise(activePackage.purchasedAmountPaise)}
                {activePackage.purchasedDurationDays ? ` for ${formatDuration(activePackage.purchasedDurationDays)}` : ''}
              </p>
            )}

            {activePackage.topupPricePerCreditPaise && (activePackage.status === 'ACTIVE' || activePackage.status === 'EXPIRING_SOON') && (
              <button
                onClick={() => setTopUpOpen(true)}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand/40 py-2 text-sm font-semibold text-brand hover:bg-brand/10"
              >
                <Sparkles size={14} /> Top Up Credits
              </button>
            )}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your Albums</h2>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg gradient-brand px-3.5 py-2 text-sm font-semibold"
          >
            <Plus size={16} /> Create Album
          </button>
        </div>

        {albums === null ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : albums.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-border bg-card p-8 text-center">
            <BookImage size={28} className="mx-auto mb-2 text-text-muted" />
            <p className="text-sm text-text-muted">No albums yet.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {albums.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-text-muted">
                    {a.public_code} · {a.status}
                  </p>
                </div>
                <button onClick={() => handleDelete(a.id)} className="text-text-muted hover:text-danger" aria-label="Delete album">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {createOpen && (
        <CreateAlbumDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            loadAlbums();
            loadPackages();
          }}
        />
      )}

      {topUpOpen && activePackage && activePackage.topupPricePerCreditPaise && (
        <TopUpDialog
          packageId={activePackage.id}
          pricePerCreditPaise={activePackage.topupPricePerCreditPaise}
          customerEmail={customer?.email}
          customerName={customer?.name || undefined}
          onClose={() => setTopUpOpen(false)}
          onDone={() => {
            setTopUpOpen(false);
            loadPackages();
          }}
        />
      )}
    </div>
  );
}

function CreateAlbumDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      await customerApi.post('/api/customer/albums', { title, clientName });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create album');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-bg-secondary p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">Create Album</p>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Album Title</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="e.g. Sagar & Sangita Wedding"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Client Name (optional)</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-300">{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className="w-full rounded-lg gradient-brand py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create Album'}
          </button>
          <p className="text-center text-[11px] text-text-muted">Uses 1 album credit from your package.</p>
        </div>
      </div>
    </div>
  );
}

function TopUpDialog({
  packageId,
  pricePerCreditPaise,
  customerEmail,
  customerName,
  onClose,
  onDone,
}: {
  packageId: number;
  pricePerCreditPaise: number;
  customerEmail?: string;
  customerName?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [credits, setCredits] = useState('10');
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  const parsedCredits = parseInt(credits, 10);
  const quantity = Number.isInteger(parsedCredits) && parsedCredits > 0 ? parsedCredits : 0;
  const totalPaise = useMemo(() => quantity * pricePerCreditPaise, [quantity, pricePerCreditPaise]);

  async function handleBuy() {
    if (quantity <= 0) {
      setError('Enter a positive number of credits');
      return;
    }
    setBuying(true);
    setError(null);
    try {
      const order = await customerApi.post<CreateOrderResponse>('/api/customer/orders', {
        kind: 'TOPUP',
        packageId,
        credits: quantity,
      });
      await openRazorpayCheckout({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'SAYPX Digital Photo Books',
        description: order.planName,
        order_id: order.razorpayOrderId,
        prefill: { email: customerEmail, name: customerName },
        theme: { color: '#ff5a1f' },
        handler: async (response) => {
          try {
            await customerApi.post(`/api/customer/orders/${order.orderId}/verify`, response);
            onDone();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Payment verification failed');
            setBuying(false);
          }
        },
        modal: { ondismiss: () => setBuying(false) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start checkout');
      setBuying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-bg-secondary p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">Top Up Credits</p>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            Extra credits at {formatPaise(pricePerCreditPaise)} each, usable until your package's current expiry - this does
            not extend it.
          </p>
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Number of Credits</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              autoFocus
            />
          </div>

          <p className="text-sm text-text-muted">
            Total: <span className="font-semibold text-text">{formatPaise(totalPaise)}</span>
          </p>

          {error && (
            <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-300">{error}</div>
          )}

          <button
            onClick={handleBuy}
            disabled={buying || quantity <= 0}
            className="w-full rounded-lg gradient-brand py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {buying ? 'Opening Checkout…' : 'Buy Top-Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
