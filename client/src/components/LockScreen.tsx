import { useState, type FormEvent } from 'react';
import { Fingerprint, Lock } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { unlockWithPasskey, browserSupportsWebAuthn } from '../lib/webauthnClient';

export default function LockScreen() {
  const { login, unlock } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usePassword, setUsePassword] = useState(!browserSupportsWebAuthn());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function handlePasskey() {
    setBusy(true);
    setError(null);
    const res = await unlockWithPasskey();
    setBusy(false);
    if (res.ok) unlock();
    else setError(res.error || 'Could not verify passkey');
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await login(username, password);
    setBusy(false);
    if (err) setError(err);
    else unlock();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-secondary p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full gradient-brand">
          <Lock size={24} />
        </div>
        <h1 className="text-xl font-semibold mb-1">SAYPX Billing is locked</h1>
        <p className="text-sm text-text-muted mb-6">Verify it's you to continue</p>

        {error && (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-300 text-left">
            {error}
          </div>
        )}

        {!usePassword ? (
          <div className="space-y-3">
            <button
              onClick={handlePasskey}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-lg gradient-brand py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              <Fingerprint size={18} />
              {busy ? 'Waiting for passkey…' : 'Unlock with Passkey'}
            </button>
            <button
              onClick={() => setUsePassword(true)}
              className="w-full text-xs text-text-muted hover:text-text"
            >
              Use password instead
            </button>
          </div>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-3 text-left">
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Username</label>
              <input
                className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2.5 text-sm outline-none focus:border-brand"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Password</label>
              <input
                type="password"
                className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2.5 text-sm outline-none focus:border-brand"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg gradient-brand py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? 'Verifying…' : 'Unlock'}
            </button>
            {browserSupportsWebAuthn() && (
              <button
                type="button"
                onClick={() => setUsePassword(false)}
                className="w-full text-xs text-text-muted hover:text-text"
              >
                Use passkey instead
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
