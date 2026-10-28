// Browser module test with stubbed Supabase only; no production requests.
(async () => {
  const { supabase } = await import('/src/lib/supabaseClient.js');
  const { createReport } = await import('/src/lib/reports.js');
  const originalFrom = supabase.from;
  const originalGetUser = supabase.auth.getUser;
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  let writes = 0;
  let saved;
  try {
    supabase.from = () => ({
      insert: (payload) => {
        writes++;
        saved = payload;
        return {
          select: () => ({
            single: async () => ({ data: { id: 'fixture', ...payload }, error: null }),
          }),
        };
      },
    });
    supabase.auth.getUser = async () => ({ data: { user: null }, error: null });
    let denied = false;
    try {
      await createReport({ damageType: 'pothole' });
    } catch {
      denied = true;
    }
    assert(denied && writes === 0, 'Anonymous report reached INSERT');
    supabase.auth.getUser = async () => ({
      data: { user: null },
      error: new Error('Session rejected'),
    });
    denied = false;
    try {
      await createReport({ damageType: 'pothole' });
    } catch (e) {
      denied = e.message === 'Session rejected';
    }
    assert(denied && writes === 0, 'Auth failure reached INSERT');
    supabase.auth.getUser = async () => ({
      data: { user: { id: 'authenticated-user' } },
      error: null,
    });
    await createReport({
      damageType: 'pothole',
      userId: 'forged-user',
      user_id: 'forged-user',
      actual_cost: 100,
      status: 'resolved',
    });
    assert(
      saved.user_id === 'authenticated-user',
      'Owner was not taken from authenticated identity'
    );
    assert(
      !('actual_cost' in saved) && !('status' in saved),
      'Unaccepted fields leaked into INSERT'
    );
    return { passed: true };
  } finally {
    supabase.from = originalFrom;
    supabase.auth.getUser = originalGetUser;
  }
})();
