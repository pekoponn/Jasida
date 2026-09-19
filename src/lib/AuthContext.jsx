import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { withResolvedAvatar } from './profileAvatar.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [profileError, setProfileError] = useState(null);

  async function fetchProfile(userId) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) {
      throw error;
    }
    return withResolvedAvatar(data);
  }

  async function refreshProfile() {
    if (!user) return;
    try {
      const data = await fetchProfile(user.id);
      setProfile(data);
      setProfileError(null);
    } catch (err) {
      setProfileError(err.message);
    }
  }

  useEffect(() => {
    let active = true;
    let revision = 0;
    let timer;
    async function applySession(session) {
      const current = ++revision;
      const sessionUser = session?.user ?? null;
      if (!active) return;
      setLoading(true);
      setUser(sessionUser);
      setProfile(null);
      setProfileError(null);
      try {
        const data = sessionUser ? await fetchProfile(sessionUser.id) : null;
        if (active && current === revision) setProfile(data);
      } catch (err) {
        if (active && current === revision) setProfileError(err.message);
      } finally {
        if (active && current === revision) setLoading(false);
      }
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (_event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (_event === 'SIGNED_OUT') setPasswordRecovery(false);
      // Leave the auth callback before querying PostgREST (the auth lock is held here).
      revision += 1;
      setLoading(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        void applySession(session);
      }, 0);
    });

    return () => {
      active = false;
      revision += 1;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  async function signUp({ email, password, username }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) throw error;
    return data;
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileError,
        isAdmin,
        passwordRecovery,
        finishPasswordRecovery: () => setPasswordRecovery(false),
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}
