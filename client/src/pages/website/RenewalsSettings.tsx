import { useEffect, useState } from 'react';
import { api, formatDate, type PhotoBookSettings } from '../../lib/api';
import PhotoBookSubNav from '../../components/website/PhotoBookSubNav';

export default function RenewalsSettings() {
  const [settings, setSettings] = useState<PhotoBookSettings | null>(null);
  const [days, setDays] = useState('7');
  const [topupPrice, setTopupPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<PhotoBookSettings>('/api/photobook/settings')
      .then((s) => {
        setSettings(s);
        setDays(String(s.expiringSoonDays));
        setTopupPrice(s.topupPricePerCreditPaise ? String(s.topupPricePerCreditPaise / 100) : '');
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSave() {
    const parsedDays = Number(days);
    if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      setError('Enter a whole number of days between 1 and 365');
      return;
    }
    const topupRupees = topupPrice.trim() === '' ? null : Number(topupPrice);
    if (topupRupees !== null && (!Number.isFinite(topupRupees) || topupRupees < 0)) {
      setError('Top-up price must be a non-negative number, or blank to disable top-ups');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const s = await api.put<PhotoBookSettings>('/api/photobook/settings', {
        expiringSoonDays: parsedDays,
        topupPricePerCreditPaise: topupRupees === null ? null : Math.round(topupRupees * 100),
      });
      setSettings(s);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <PhotoBookSubNav />

      <div>
        <h1 className="text-xl font-semibold">Renewals</h1>
        <p className="text-sm text-text-muted mt-1">Renewal timing and credit top-up pricing.</p>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-6">
          <div>
            <label className="block text-[10px] text-text-muted uppercase mb-1.5">Expiring Soon Threshold (days)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-28 rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
            />
            <p className="text-xs text-text-muted mt-2">
              A package is marked EXPIRING_SOON once fewer than this many days remain before it expires. Saving immediately
              re-checks every package against the new threshold.
            </p>
          </div>

          <div>
            <label className="block text-[10px] text-text-muted uppercase mb-1.5">Credit Top-Up Price (₹ per credit)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={topupPrice}
              onChange={(e) => setTopupPrice(e.target.value)}
              placeholder="Leave blank to disable top-ups"
              className="w-40 rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
            />
            <p className="text-xs text-text-muted mt-2">
              Lets a customer with an active package buy extra credits without buying a whole new plan cycle. A top-up never
              extends the package's expiry - it just adds credits usable until the package's existing expiry date. Leave
              blank to hide the top-up option entirely.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg gradient-brand px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && <span className="text-xs text-emerald-400">Saved</span>}
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          {settings && <p className="text-xs text-text-muted">Last updated {formatDate(settings.updatedAt)}</p>}
        </div>
      )}
    </div>
  );
}
