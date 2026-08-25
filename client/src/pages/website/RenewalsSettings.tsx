import { useEffect, useState } from 'react';
import { api, formatDate, type PhotoBookSettings } from '../../lib/api';
import PhotoBookSubNav from '../../components/website/PhotoBookSubNav';

export default function RenewalsSettings() {
  const [settings, setSettings] = useState<PhotoBookSettings | null>(null);
  const [days, setDays] = useState('7');
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
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSave() {
    const parsed = Number(days);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
      setError('Enter a whole number between 1 and 365');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const s = await api.put<PhotoBookSettings>('/api/photobook/settings', { expiringSoonDays: parsed });
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
        <p className="text-sm text-text-muted mt-1">Controls when a package is flagged "expiring soon" ahead of its actual expiry.</p>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <label className="block text-[10px] text-text-muted uppercase mb-1.5">Expiring Soon Threshold (days)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-28 rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg gradient-brand px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {saved && <span className="text-xs text-emerald-400">Saved</span>}
            </div>
            <p className="text-xs text-text-muted mt-2">
              A package is marked EXPIRING_SOON once fewer than this many days remain before it expires. Saving immediately
              re-checks every package against the new threshold.
            </p>
            {error && <p className="text-xs text-danger mt-2">{error}</p>}
          </div>
          {settings && <p className="text-xs text-text-muted">Last updated {formatDate(settings.updatedAt)}</p>}
        </div>
      )}
    </div>
  );
}
