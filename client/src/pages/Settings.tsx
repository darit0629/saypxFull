import { useEffect, useState } from 'react';
import { ShieldCheck, Fingerprint, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { registerPasskey, browserSupportsWebAuthn } from '../lib/webauthnClient';

interface BusinessProfile {
  business_name: string | null;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  gstin: string | null;
  pan: string | null;
  bank_details: string | null;
  upi_id: string | null;
  currency: string;
}

const EMPTY: BusinessProfile = {
  business_name: '',
  owner_name: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  gstin: '',
  pan: '',
  bank_details: '',
  upi_id: '',
  currency: 'INR',
};

export default function Settings() {
  const { logout, lockInfo, refreshLockInfo, lockNow } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);

  useEffect(() => {
    api.get<BusinessProfile>('/api/business').then((p) => setProfile({ ...EMPTY, ...p }));
    refreshLockInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRegisterPasskey() {
    setRegistering(true);
    setSecurityError(null);
    const res = await registerPasskey();
    setRegistering(false);
    if (res.ok) refreshLockInfo();
    else setSecurityError(res.error || 'Could not register passkey');
  }

  async function handleToggleLock(enabled: boolean) {
    await api.put('/api/webauthn/settings', {
      lockEnabled: enabled,
      lockTimeoutMinutes: lockInfo?.lockTimeoutMinutes ?? 5,
    });
    refreshLockInfo();
  }

  async function handleTimeoutChange(minutes: number) {
    await api.put('/api/webauthn/settings', { lockEnabled: lockInfo?.lockEnabled ?? false, lockTimeoutMinutes: minutes });
    refreshLockInfo();
  }

  async function handleRemoveCredential(id: number) {
    await api.delete(`/api/webauthn/credentials/${id}`);
    refreshLockInfo();
  }

  function set<K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/api/business', {
        businessName: profile.business_name,
        ownerName: profile.owner_name,
        phone: profile.phone,
        email: profile.email,
        website: profile.website,
        address: profile.address,
        gstin: profile.gstin,
        pan: profile.pan,
        bankDetails: profile.bank_details,
        upiId: profile.upi_id,
        currency: profile.currency,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const FIELDS: { key: keyof BusinessProfile; label: string }[] = [
    { key: 'business_name', label: 'Business Name' },
    { key: 'owner_name', label: 'Owner Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'website', label: 'Website' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'pan', label: 'PAN' },
    { key: 'upi_id', label: 'UPI ID' },
  ];

  return (
    <div className="space-y-5 max-w-xl">
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium mb-4">Business Profile</p>
        <p className="text-xs text-text-muted mb-4">
          Shown on generated invoice PDFs.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-text-muted mb-1">{label}</label>
              <input
                className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                value={profile[key] || ''}
                onChange={(e) => set(key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <label className="block text-xs text-text-muted mb-1">Address</label>
          <textarea
            className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
            rows={2}
            value={profile.address || ''}
            onChange={(e) => set('address', e.target.value)}
          />
        </div>
        <div className="mt-3">
          <label className="block text-xs text-text-muted mb-1">Bank Details</label>
          <textarea
            className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
            rows={2}
            value={profile.bank_details || ''}
            onChange={(e) => set('bank_details', e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg gradient-brand px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-xs text-success">Saved</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium mb-1 flex items-center gap-2">
          <ShieldCheck size={16} className="text-brand" /> App Lock
        </p>
        <p className="text-xs text-text-muted mb-4">
          Require a passkey (fingerprint, face, or device PIN) to open the app after it's been idle.
        </p>

        {securityError && (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-300">
            {securityError}
          </div>
        )}

        {!browserSupportsWebAuthn() ? (
          <p className="text-xs text-text-muted">This browser doesn't support passkeys.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <button
                onClick={handleRegisterPasskey}
                disabled={registering}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm hover:border-brand disabled:opacity-60"
              >
                <Fingerprint size={15} />
                {registering ? 'Waiting for device…' : 'Register a Passkey'}
              </button>
            </div>

            {lockInfo && lockInfo.credentials.length > 0 && (
              <div className="space-y-1.5">
                {lockInfo.credentials.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                    <span className="text-text-muted">
                      Passkey added {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleRemoveCredential(c.id)}
                      aria-label="Remove passkey"
                      className="text-text-muted hover:text-danger"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Lock the app when idle</p>
                <p className="text-xs text-text-muted">Requires at least one registered passkey</p>
              </div>
              <button
                role="switch"
                aria-checked={!!lockInfo?.lockEnabled}
                onClick={() => handleToggleLock(!lockInfo?.lockEnabled)}
                disabled={!lockInfo?.hasCredential}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-30 ${
                  lockInfo?.lockEnabled ? 'bg-brand' : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    lockInfo?.lockEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {lockInfo?.lockEnabled && (
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Auto-lock after</label>
                <select
                  value={lockInfo.lockTimeoutMinutes}
                  onChange={(e) => handleTimeoutChange(Number(e.target.value))}
                  className="rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                >
                  <option value={1}>1 minute</option>
                  <option value={5}>5 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                </select>
              </div>
            )}

            {lockInfo?.lockEnabled && lockInfo.hasCredential && (
              <button onClick={lockNow} className="text-xs text-text-muted hover:text-text underline">
                Lock now
              </button>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium mb-3">Account</p>
        <button
          onClick={() => logout()}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:text-red-300 hover:border-danger/50"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}
