import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly instead of silently — easy to miss a missing .env during a hackathon.
  console.error(
    '[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diset. ' +
    'Salin .env.example ke .env dan isi dengan kredensial project Supabase kamu.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
