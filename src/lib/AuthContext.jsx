import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { withResolvedAvatar } from './profileAvatar.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      console.warn('[profile] gagal ambil profil:', error.message);
      return null;
    }
    return withResolvedAvatar(data);
  }

  async function refreshProfile() {
    if (!user) return;
    const data = await fetchProfile(user.id);
    setProfile(data);
  }

  useEffect(() => {
    let active = true; // guard biar tidak setState setelah unmount

    // Alur awal: ambil session DULU, lalu tunggu profile-nya juga selesai,
    // baru loading di-set false. Ini kunci fix-nya — sebelumnya loading
    // langsung false begitu session ada, padahal profile belum tentu ready.
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      const sessionUser = session?.user ?? null;
      if (!active) return;
      setUser(sessionUser);

      if (sessionUser) {
        const data = await fetchProfile(sessionUser.id);
        if (active) setProfile(data);
      } else {
        setProfile(null);
      }

      if (active) setLoading(false);
    }

    init();

    // Untuk perubahan auth SETELAH initial load (login/logout di tab yang sama,
    // token refresh, dll) — user & profile di-update bareng juga di sini.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (sessionUser) {
        const data = await fetchProfile(sessionUser.id);
        if (active) setProfile(data);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signUp({ email, password, username }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
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
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}
