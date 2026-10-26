import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AuthError, getUser, handleAuthCallback, logout, onAuthChange, type User } from '@netlify/identity';

// Pending action from an emailed link that the login page must finish (set a new password / accept an invite).
export type PendingCallback = { type: 'recovery' } | { type: 'invite'; token: string } | null;

type AuthState = {
  user: User | null;
  ready: boolean;
  pending: PendingCallback;
  notice: string;
  clearPending: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<PendingCallback>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthChange((_event, next) => { if (active) setUser(next); });
    (async () => {
      // Process confirmation, recovery and invite links (#..._token=) before reading the session.
      try {
        const result = await handleAuthCallback();
        if (result?.type === 'recovery') setPending({ type: 'recovery' });
        if (result?.type === 'invite' && result.token) setPending({ type: 'invite', token: result.token });
        if (result?.type === 'confirmation') setNotice('Email confirmed. You are now signed in.');
      } catch (error) {
        if (error instanceof AuthError) setNotice(error.message);
      }
      const current = await getUser();
      if (active) { setUser(current); setReady(true); }
    })();
    return () => { active = false; unsubscribe(); };
  }, []);

  const signOut = async () => {
    try { await logout(); } finally { setUser(null); }
  };

  return <AuthContext.Provider value={{ user, ready, pending, notice, clearPending: () => setPending(null), signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

export const displayName = (user: User | null) => user?.name?.trim() || user?.email?.split('@')[0] || 'Staff';
