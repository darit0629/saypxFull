import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface LockInfo {
  hasCredential: boolean;
  credentials: { id: number; deviceLabel: string | null; createdAt: number }[];
  lockEnabled: boolean;
  lockTimeoutMinutes: number;
}

interface AuthContextValue {
  authenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  locked: boolean;
  lockInfo: LockInfo | null;
  refreshLockInfo: () => Promise<LockInfo | undefined>;
  unlock: () => void;
  lockNow: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEFAULT_LOCK_INFO: LockInfo = { hasCredential: false, credentials: [], lockEnabled: false, lockTimeoutMinutes: 5 };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [lockInfo, setLockInfo] = useState<LockInfo | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => setAuthenticated(r.ok))
      .finally(() => setLoading(false));
  }, []);

  async function refreshLockInfo() {
    const res = await fetch('/api/webauthn/status');
    if (!res.ok) return;
    const data: LockInfo = await res.json();
    setLockInfo(data);
    return data;
  }

  // On every fresh authenticated session, require an unlock if lock is configured —
  // the session cookie stays valid underneath; this is a UI gate, not a re-login.
  useEffect(() => {
    if (!authenticated) return;
    fetch('/api/webauthn/status')
      .then((r) => (r.ok ? r.json() : DEFAULT_LOCK_INFO))
      .then((data: LockInfo) => {
        setLockInfo(data);
        if (data.lockEnabled && data.hasCredential) setLocked(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  // Auto-lock after N minutes of inactivity.
  useEffect(() => {
    if (!authenticated || !lockInfo?.lockEnabled || !lockInfo.hasCredential || locked) {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      return;
    }

    function reset() {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(
        () => setLocked(true),
        (lockInfo?.lockTimeoutMinutes || 5) * 60 * 1000
      );
    }

    const events = ['pointerdown', 'keydown', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [authenticated, lockInfo, locked]);

  async function login(username: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      setAuthenticated(true);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    return data.error || 'Login failed';
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthenticated(false);
    setLocked(false);
  }

  function unlock() {
    setLocked(false);
  }

  function lockNow() {
    if (lockInfo?.hasCredential) setLocked(true);
  }

  return (
    <AuthContext.Provider
      value={{ authenticated, loading, login, logout, locked, lockInfo, refreshLockInfo, unlock, lockNow }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
