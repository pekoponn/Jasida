// Run against the dev server. All database calls below are stubbed; no live writes.
(async () => {
  const { supabase } = await import('/src/lib/supabaseClient.js');
  const { fetchAllReportsForAdmin, startProgress } = await import('/src/lib/reports.js');
  const { default: avatarUrl } = await import('/src/assets/avatars/avatar-1.png?import');
  const originalFrom = supabase.from;
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const materials = [{ name: 'Test material', quantity: 2 }];
  let rejectDetails = false;
  let written;
  try {
    supabase.from = (table) => {
      if (table === 'reports_with_coords') return { select: () => ({ order: () => ({
        neq(column, value) { assert(column === 'status' && value === 'pending_duplicate_review', 'Unexpected status filter'); return this; },
        data: [{ id: 'test-report', user_id: 'test-user', lat: -7.45, lng: 112.7, status: 'open' }], error: null
      }) }) };
      if (table === 'profiles') return { select: () => ({ in: async () => ({
        data: [{ id: 'test-user', username: 'Test', avatar_url: '/assets/avatar-1-oldhash.png' }], error: null
      }) }) };
      if (table === 'reports') return {
        select: () => ({ in: async () => ({
          data: [{ id: 'test-report', bbox_area_pct: 12, address: 'Test road', estimated_materials_json: materials }],
          error: rejectDetails ? new Error('Simulated details failure') : null
        }) }),
        update: (patch) => {
          written = patch;
          return { eq: () => ({ select: () => ({ single: async () => ({ data: patch, error: null }) }) }) };
        }
      };
      throw new Error(`Unexpected table: ${table}`);
    };
    const [report] = await fetchAllReportsForAdmin();
    assert(report.lat === -7.45 && report.lng === 112.7, 'Coordinates lost');
    assert(report.bbox_area_pct === 12 && report.address === 'Test road', 'New admin fields lost');
    assert(report.estimated_materials_json === materials, 'Saved material details lost');
    assert(report.profile.avatar_url === avatarUrl, 'Avatar URL unresolved');
    await startProgress('test-report', { estimatedDate: '2026-10-01', materials: 'Test', materialsJson: materials, cost: 10 });
    assert(written.status === 'in_progress' && written.estimated_materials_json === materials, 'Scheduling lost material details');
    rejectDetails = true;
    let failed = false;
    try { await fetchAllReportsForAdmin(); } catch { failed = true; }
    assert(failed, 'Details failure silently returned incomplete admin data');
    return { passed: true, checks: ['coordinates', 'admin fields', 'material details', 'avatar', 'scheduling', 'read failure'] };
  } finally {
    supabase.from = originalFrom;
  }
})()
