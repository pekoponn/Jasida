import { supabase } from './supabaseClient';

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