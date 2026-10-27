import { validItems, totalItems } from '../ai/materialEstimate.js';
import { supabase } from './supabaseClient';
import { withResolvedAvatar } from './profileAvatar.js';
import { prepareUploadPhoto } from './imageUpload.js';
import { distanceMeters, validateReportLocation } from './reportLocation.js';

async function heldReportIds() {
  const { data, error } = await supabase
    .from('reports')
    .select('id')
    .eq('location_status', 'pending');
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

function excludeIds(query, ids) {
  return ids.length ? query.not('id', 'in', `(${ids.join(',')})`) : query;
}

export async function findSimilarReports({ lat, lng, damageType, embedding, radiusMeters = 50 }) {
  if (!embedding) {
    if (validateReportLocation({ lat, lng }, true))
      throw new Error('Lokasi pemeriksaan tidak valid.');
    if (!damageType) return [];
    const latDelta = radiusMeters / 111000;
    const lngDelta = Math.min(180, latDelta / Math.max(0.00001, Math.cos((lat * Math.PI) / 180)));
    const { data, error } = await supabase
      .from('reports_with_coords')
      .select('*')
      .in('status', ['open', 'accepted', 'in_progress'])
      .eq('damage_type', damageType)
      .gte('lat', lat - latDelta)
      .lte('lat', lat + latDelta)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? [])
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
      .filter((r) => Math.min(Math.abs(r.lng - lng), 360 - Math.abs(r.lng - lng)) <= lngDelta)
      .map((r) => ({
        ...r,
        distance_m: distanceMeters({ lat, lng }, r),
        similarity: null,
        match_basis: 'location',
      }))
      .filter((r) => r.distance_m <= radiusMeters);
  }
  const { data, error } = await supabase.rpc('find_similar_reports', {
    new_lat: lat,
    new_lng: lng,
    new_damage_type: damageType,
    new_embedding: embedding,
    radius_meters: radiusMeters,
  });
  if (error) throw error;
  return data ?? [];
}

export async function uploadReportImage(file, reportId) {
  const photo = await prepareUploadPhoto(file);
  const path = `${reportId}/${crypto.randomUUID()}-${photo.name}`;
  const { error } = await supabase.storage
    .from('report-images')
    .upload(path, photo, { contentType: 'image/webp' });
  if (error) throw error;

  const { error: updateError } = await supabase
    .from('reports')
    .update({ image_path: path })
    .eq('id', reportId);
  if (updateError) throw updateError;

  return path;
}

// Keep successful steps in memory so retries resume the same report and photos.
export async function uploadReportEvidence(photos, reportId, progress, primary = true) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw authError || new Error('Masuk kembali untuk mengirim foto.');
  for (let index = 0; index < photos.length; index++) {
    const item = photos[index];
    const photo = await prepareUploadPhoto(item.file);
    const key = `${reportId}/${item.id}`;
    let entry = progress.get(key);
    if (!entry) {
      entry = { path: `${reportId}/${item.id}-${photo.name}`, uploaded: false, linked: false };
      progress.set(key, entry);
    }
    if (!entry.uploaded) {
      const { error } = await supabase.storage
        .from('report-images')
        .upload(entry.path, photo, { contentType: 'image/webp' });
      // A lost response can leave a completed object. The UUID path belongs to this draft.
      if (error && String(error.statusCode) !== '409') throw error;
      entry.uploaded = true;
    }
    if (!entry.linked) {
      if (primary && index === 0) {
        const { error } = await supabase
          .from('reports')
          .update({ image_path: entry.path })
          .eq('id', reportId)
          .select('id')
          .single();
        if (error) throw error;
      } else {
        const { data: existing, error: readError } = await supabase
          .from('report_photos')
          .select('id')
          .eq('report_id', reportId)
          .eq('image_path', entry.path);
        if (readError) throw readError;
        if (!existing?.length) {
          const { error } = await supabase.from('report_photos').insert({
            report_id: reportId,
            image_path: entry.path,
            user_id: user.id,
            photo_type: item.photoType ?? 'support',
          });
          if (error) throw error;
        }
      }
      entry.linked = true;
    }
  }
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
  note,
  bboxAreaPct,
  address,
  locationSource,
  roadDistanceM,
  locationFlags,
  locationStatus,
}) {
  const { data, error } = await supabase
    .from('reports')
    .insert({
      location_source: locationSource ?? null,
      road_distance_m: roadDistanceM ?? null,
      location_flags: locationFlags ?? [],
      location_status: locationStatus ?? 'trusted',
      damage_type: damageType,
      confidence,
      hazard_score: hazardScore,
      severity,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      embedding,
      captured_at: capturedAt,
      note: note || null,
      bbox_area_pct: bboxAreaPct ?? null,
      address: address || null, // ⬅️ BARU
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Data historis biaya nyata (bukan estimasi) per jenis kerusakan — dipakai untuk "belajar". */
export async function getCostHistory(damageType) {
  const { data, error } = await supabase
    .from('reports')
    .select('bbox_area_pct, actual_cost')
    .eq('damage_type', damageType)
    .eq('status', 'resolved')
    .not('actual_cost', 'is', null);
  if (error) throw error;
  return data ?? [];
}

export async function completeReportWithActuals(
  reportId,
  {
    file,
    files,
    actualMaterials,
    actualMaterialsJson,
    actualCost,
    actualCostVerified,
    actualCostEvidence,
  }
) {
  if (
    !validItems(actualMaterialsJson) ||
    totalItems(actualMaterialsJson) !== actualCost ||
    !actualCostVerified ||
    !actualCostEvidence?.trim()
  )
    throw new Error('Isi realisasi valid dan referensi bukti independen.');
  const proofFiles = (files?.length ? files : [file]).filter(Boolean).slice(0, 5);
  if (!proofFiles.length) throw new Error('Foto bukti perbaikan wajib diunggah.');
  for (const proof of proofFiles) {
    await addReportPhoto(reportId, proof, 'resolution');
  }

  const updatePayload = {
    status: 'resolved',
    actual_materials: actualMaterials,
    actual_materials_json: actualMaterialsJson,
    actual_cost: actualCost,
    actual_cost_verified: actualCostVerified,
    actual_cost_evidence: actualCostEvidence,
  };

  const { data, error } = await supabase
    .from('reports')
    .update(updatePayload)
    .eq('id', reportId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function supportReport(reportId) {
  const { error } = await supabase.rpc('support_report', { p_report_id: reportId });
  if (error) throw error;
}

export async function addReporter(reportId) {
  const { error } = await supabase.rpc('add_reporter', { p_report_id: reportId });
  if (error) throw error;
}

export async function addReportPhoto(reportId, file, photoType = 'support') {
  const photo = await prepareUploadPhoto(file);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = `${reportId}/${crypto.randomUUID()}-${photo.name}`;
  const { error: uploadError } = await supabase.storage
    .from('report-images')
    .upload(path, photo, { contentType: 'image/webp' });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from('report_photos').insert({
    report_id: reportId,
    image_path: path,
    user_id: user?.id ?? null,
    photo_type: photoType,
  });
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const held = await heldReportIds();
  const { data, error } = await excludeIds(
    supabase
      .from('reports_with_coords')
      .select('*')
      .in('status', ['open', 'accepted', 'in_progress']),
    held
  ).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listReportsFeed() {
  const held = await heldReportIds();
  const { data: reports, error } = await excludeIds(
    supabase.from('reports_with_coords').select('*').neq('status', 'pending_duplicate_review'),
    held
  )
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  if (!reports.length) return [];

  const { data: details, error: detailsError } = await supabase
    .from('reports')
    .select('id, rejection_reason')
    .in(
      'id',
      reports.map((r) => r.id)
    );
  if (detailsError) throw detailsError;
  const detailsById = Object.fromEntries((details ?? []).map((r) => [r.id, r]));

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
    ...detailsById[r.id],
    profile: profilesById[r.user_id] ?? null,
    imageUrl: r.image_path
      ? supabase.storage.from('report-images').getPublicUrl(r.image_path).data.publicUrl
      : null,
  }));
}

export async function listMyReports() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('reports_with_coords')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data.length) return [];

  const { data: details, error: detailsError } = await supabase
    .from('reports')
    .select('id, started_at, resolved_at, accepted_at, rejected_at')
    .in(
      'id',
      data.map((r) => r.id)
    );
  if (detailsError) throw detailsError;
  const detailsById = Object.fromEntries(details.map((r) => [r.id, r]));

  return data.map((r) => ({
    ...r,
    ...detailsById[r.id],
    imageUrl: r.image_path
      ? supabase.storage.from('report-images').getPublicUrl(r.image_path).data.publicUrl
      : null,
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Harus masuk dulu untuk berkomentar.');

  const { data, error } = await supabase
    .from('comments')
    .insert({ report_id: reportId, user_id: user.id, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getReportCountsByUser() {
  const { data, error } = await supabase.from('reports').select('user_id');
  if (error) throw error;
  const counts = {};
  (data ?? []).forEach((r) => {
    if (!r.user_id) return;
    counts[r.user_id] = (counts[r.user_id] ?? 0) + 1;
  });
  return counts;
}

export async function fetchAllReportsForAdmin({ statusFilter } = {}) {
  const held = await heldReportIds();
  let query = excludeIds(supabase.from('reports_with_coords').select('*'), held).order(
    'created_at',
    { ascending: false }
  );

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  } else {
    query = query.neq('status', 'pending_duplicate_review');
  }

  const { data: reports, error } = await query;
  if (error) throw error;
  if (!reports.length) return [];
  const { data: details, error: detailsError } = await supabase
    .from('reports')
    .select('*')
    .in(
      'id',
      reports.map((r) => r.id)
    );
  if (detailsError) throw detailsError;
  const detailsById = Object.fromEntries((details ?? []).map((r) => [r.id, r]));

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
    ...detailsById[r.id],
    profile: profilesById[r.user_id] ?? null,
    imageUrl: r.image_path
      ? supabase.storage.from('report-images').getPublicUrl(r.image_path).data.publicUrl
      : null,
  }));
}

export async function rejectReport(reportId, reason) {
  const { data, error } = await supabase
    .from('reports')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', reportId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function acceptReport(reportId) {
  const { data, error } = await supabase
    .from('reports')
    .update({ status: 'accepted' })
    .eq('id', reportId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function startProgress(
  reportId,
  { estimatedDate, materials, materialsJson, cost, details }
) {
  if (
    !validItems(materialsJson) ||
    totalItems(materialsJson) !== cost ||
    !details?.field_verified ||
    !estimatedDate
  )
    throw new Error('Estimasi dan verifikasi lapangan wajib lengkap.');
  const { data, error } = await supabase
    .from('reports')
    .update({
      status: 'in_progress',
      estimated_completion_date: estimatedDate,
      estimated_materials: materials,
      estimated_materials_json: materialsJson,
      estimated_cost: cost,
      estimate_details: details,
    })
    .eq('id', reportId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

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

export async function createDisputedReport({
  damageType,
  confidence,
  hazardScore,
  severity,
  lat,
  lng,
  embedding,
  capturedAt,
  note,
  bboxAreaPct,
  address,
  candidateId,
  similarity,
  distanceM,
  locationSource,
  roadDistanceM,
  locationFlags,
  locationStatus,
}) {
  const { data, error } = await supabase.rpc('create_disputed_report', {
    p_damage_type: damageType,
    p_confidence: confidence,
    p_hazard_score: hazardScore,
    p_severity: severity,
    p_lat: lat,
    p_lng: lng,
    p_embedding: embedding,
    p_captured_at: capturedAt,
    p_note: note || null,
    p_bbox_area_pct: bboxAreaPct ?? null,
    p_address: address || null,
    p_candidate_id: candidateId,
    p_similarity: similarity ?? null,
    p_distance_m: distanceM ?? null,
  });
  if (error) throw error;

  const newId = data?.id ?? (typeof data === 'string' ? data : null);
  if (newId && locationSource) {
    const { error: metaError } = await supabase.rpc('set_report_location_meta', {
      p_report_id: newId,
      p_source: locationSource,
      p_road_distance_m: roadDistanceM ?? null,
      p_flags: locationFlags ?? [],
    });
    if (metaError) console.warn('[disputed-location-meta]', metaError.message);
  }
  return data;
}

export async function fetchPendingDuplicateReviews() {
  const { data: reports, error } = await supabase
    .from('reports')
    .select('*')
    .eq('status', 'pending_duplicate_review')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!reports.length) return [];

  const candidateIds = [...new Set(reports.map((r) => r.duplicate_candidate_id).filter(Boolean))];
  let candidatesById = {};
  if (candidateIds.length) {
    const { data: candidates, error: candidateError } = await supabase
      .from('reports')
      .select('*')
      .in('id', candidateIds);
    if (candidateError) throw candidateError;
    candidatesById = Object.fromEntries(candidates.map((c) => [c.id, c]));
  }

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
      : null,
    candidate: candidatesById[r.duplicate_candidate_id]
      ? {
          ...candidatesById[r.duplicate_candidate_id],
          imageUrl: candidatesById[r.duplicate_candidate_id].image_path
            ? supabase.storage
                .from('report-images')
                .getPublicUrl(candidatesById[r.duplicate_candidate_id].image_path).data.publicUrl
            : null,
        }
      : null,
  }));
}

export async function resolveDuplicateReview(reportId, aiCorrect) {
  const { error } = await supabase.rpc('admin_resolve_duplicate_review', {
    p_report_id: reportId,
    p_ai_correct: aiCorrect,
  });
  if (error) throw error;
}

export async function fetchLocationReviews() {
  const { data: rows, error } = await supabase
    .from('reports')
    .select('*')
    .in('location_status', ['pending', 'auto_ok'])
    .neq('status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);

  const { data: coords, error: coordError } = await supabase
    .from('reports_with_coords')
    .select('id, lat, lng')
    .in('id', ids);
  if (coordError) throw coordError;
  const coordsById = Object.fromEntries((coords ?? []).map((c) => [c.id, c]));

  const { data: contextRows, error: contextError } = await supabase
    .from('report_photos')
    .select('*')
    .in('report_id', ids)
    .eq('photo_type', 'context');
  if (contextError) throw contextError;
  const contextByReport = {};
  (contextRows ?? []).forEach((p) => {
    if (!contextByReport[p.report_id]) {
      contextByReport[p.report_id] = { ...p, url: reportImageUrl(p.image_path) };
    }
  });

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  let profilesById = {};
  if (userIds.length) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    if (profileError) throw profileError;
    profilesById = Object.fromEntries(profiles.map((p) => [p.id, withResolvedAvatar(p)]));
  }

  return rows
    .map((r) => ({
      ...r,
      lat: coordsById[r.id]?.lat ?? null,
      lng: coordsById[r.id]?.lng ?? null,
      profile: profilesById[r.user_id] ?? null,
      contextPhoto: contextByReport[r.id] ?? null,
      imageUrl: reportImageUrl(r.image_path),
    }))
    .sort(
      (a, b) =>
        (a.location_status === 'pending' ? 0 : 1) - (b.location_status === 'pending' ? 0 : 1)
    );
}

export async function reviewLocation(reportId, decision, reason) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const base = {
    location_reviewed_by: user?.id ?? null,
    location_reviewed_at: new Date().toISOString(),
  };
  const patch =
    decision === 'verify'
      ? { ...base, location_status: 'verified' }
      : {
          ...base,
          location_status: 'rejected',
          status: 'rejected',
          rejection_reason: reason,
        };
  const { error } = await supabase.from('reports').update(patch).eq('id', reportId);
  if (error) throw error;
}

export async function countPendingReviews() {
  const [dup, loc] = await Promise.all([
    supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_duplicate_review'),
    supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('location_status', 'pending')
      .neq('status', 'rejected'),
  ]);
  return { duplicate: dup.count ?? 0, location: loc.count ?? 0 };
}
