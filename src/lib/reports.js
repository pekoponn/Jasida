import { supabase } from './supabaseClient';
import { withResolvedAvatar } from './profileAvatar.js';

export async function findSimilarReports({ lat, lng, damageType, embedding, radiusMeters = 50 }) {
  const { data, error } = await supabase.rpc('find_similar_reports', {
    new_lat: lat,
    new_lng: lng,
    new_damage_type: damageType,
    new_embedding: embedding,
    radius_meters: radiusMeters
  });
  if (error) throw error;
  return data ?? [];
}

export async function uploadReportImage(file, reportId) {
  const path = `${reportId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('report-images').upload(path, file);
  if (error) throw error;

  const { error: updateError } = await supabase
    .from('reports')
    .update({ image_path: path })
    .eq('id', reportId);
  if (updateError) throw updateError;

  return path;
}

export async function createReport({
  damageType,
  confidence,
  hazardScore,
  severity,
  lat,
  lng,
  embedding,
  capturedAt,
  note
}) {
  const { data, error } = await supabase
    .from('reports')
    .insert({
      damage_type: damageType,
      confidence,
      hazard_score: hazardScore,
      severity,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      embedding,
      captured_at: capturedAt,
      note: note || null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supportReport(reportId, file) {
  const { error } = await supabase.rpc('support_report', { p_report_id: reportId });
  if (error) throw error;

  if (file) {
    try {
      await addReportPhoto(reportId, file);
    } catch (err) {
      // Dukungan tetap tercatat walau upload foto tambahan gagal
      console.warn('[support-photo]', err.message);
    }
  }
}

export async function addReportPhoto(reportId, file, photoType = 'support') {
  const { data: { user } } = await supabase.auth.getUser();
  const path = `${reportId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from('report-images').upload(path, file);
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase
    .from('report_photos')
    .insert({ report_id: reportId, image_path: path, user_id: user?.id ?? null, photo_type: photoType });
  if (insertError) throw insertError;

  return path;
}

export async function resolveReport(reportId, file) {
  if (!file) throw new Error('Foto bukti perbaikan wajib diunggah.');
  await addReportPhoto(reportId, file, 'resolution');
  return updateReportStatus(reportId, 'resolved');
}

export async function getReportPhotos(reportId) {
  const { data, error } = await supabase
    .from('report_photos')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, url: reportImageUrl(p.image_path) }));
}

export function reportImageUrl(path) {
  if (!path) return null;
  return supabase.storage.from('report-images').getPublicUrl(path).data.publicUrl;
}

export async function getMySupports(reportIds) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !reportIds.length) return [];
  const { data, error } = await supabase
    .from('report_supports')
    .select('report_id')
    .eq('user_id', user.id)
    .in('report_id', reportIds);
  if (error) throw error;
  return data.map((d) => d.report_id);
}

export async function listOpenReports() {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listReportsFeed() {
  const { data: reports, error } = await supabase
    .from('reports_with_coords')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  if (!reports.length) return [];

  const userIds = [...new Set(reports.map((r) => r.user_id).filter(Boolean))];
  let profilesById = {};
  if (userIds.length) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    if (profileError) throw profileError;
    profilesById = Object.fromEntries(profiles.map((p) => [p.id, withResolvedAvatar(p)]));
  }

  return reports.map((r) => ({
    ...r,
    profile: profilesById[r.user_id] ?? null,
    imageUrl: r.image_path
      ? supabase.storage.from('report-images').getPublicUrl(r.image_path).data.publicUrl
      : null
  }));
}

export async function listMyReports() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('reports_with_coords')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r) => ({
    ...r,
    imageUrl: r.image_path
      ? supabase.storage.from('report-images').getPublicUrl(r.image_path).data.publicUrl
      : null
  }));
}

export async function listSupporters(reportId) {
  const { data: supports, error } = await supabase
    .from('report_supports')
    .select('user_id')
    .eq('report_id', reportId);
  if (error) throw error;
  if (!supports.length) return [];

  const userIds = [...new Set(supports.map((s) => s.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds);
  if (profileError) throw profileError;

  return (profiles ?? []).map(withResolvedAvatar);
}

export async function listComments(reportId) {
  const { data: comments, error } = await supabase
    .from('comments')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  if (!comments.length) return [];

  const userIds = [...new Set(comments.map((c) => c.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds);
  if (profileError) throw profileError;
  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, withResolvedAvatar(p)]));

  return comments.map((c) => ({ ...c, profile: profilesById[c.user_id] ?? null }));
}

export async function addComment(reportId, content) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Harus masuk dulu untuk berkomentar.');

  const { data, error } = await supabase
    .from('comments')
    .insert({ report_id: reportId, user_id: user.id, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchAllReportsForAdmin({ statusFilter } = {}) {
  let query = supabase
    .from('reports_with_coords')
    .select('*')
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: reports, error } = await query;
  if (error) throw error;
  if (!reports.length) return [];

  const userIds = [...new Set(reports.map((r) => r.user_id).filter(Boolean))];
  let profilesById = {};
  if (userIds.length) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    if (profileError) throw profileError;
    profilesById = Object.fromEntries(profiles.map((p) => [p.id, withResolvedAvatar(p)]));
  }

  return reports.map((r) => ({
    ...r,
    profile: profilesById[r.user_id] ?? null,
    imageUrl: r.image_path
      ? supabase.storage.from('report-images').getPublicUrl(r.image_path).data.publicUrl
      : null
  }));
}

/** Update status laporan (open / in_progress / resolved). Butuh policy admin di reports (sudah dibuat di LANGKAH 1 SQL). */
export async function updateReportStatus(reportId, status) {
  const { data, error } = await supabase
    .from('reports')
    .update({ status })
    .eq('id', reportId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
