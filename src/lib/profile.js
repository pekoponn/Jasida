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

export async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop();
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  // Tambah timestamp supaya browser tidak pakai cache foto lama
  const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}