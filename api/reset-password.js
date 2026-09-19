import { createClient } from '@supabase/supabase-js';
import { createResetPasswordHandler } from '../server/reset-password.js';

export default createResetPasswordHandler({
  env: process.env,
  createAdmin: () => createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  ).auth.admin
});
