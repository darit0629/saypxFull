import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err = await login(username, password);
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-secondary p-8">
        <h1 className="text-2xl font-semibold mb-1 bg-gradient-to-r from-brand to-orange-300 bg-clip-text text-transparent">
          SAYPX Billing
        </h1>
        <p className="text-sm text-text-muted mb-6">Sign in to manage your invoices</p>

        {error && (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            disabled={submitting}
            className="w-full rounded-lg gradient-brand py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
