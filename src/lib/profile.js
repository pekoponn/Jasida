import { supabase } from './supabaseClient';

export async function listAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, role, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateUserRole(userId, role) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile({ userId, username, fullName }) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ username, full_name: fullName })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAvatarUrl(userId, avatarUrl) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
