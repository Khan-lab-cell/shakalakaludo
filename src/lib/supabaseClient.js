import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key || url.includes('your-project-ref')) {
  // Soft warning — UI shows a helpful setup screen anyway.
  console.warn(
    '[ludo-royal] Supabase env not set. Copy .env.example to .env and fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(url || 'http://localhost', key || 'anon', {
  realtime: { params: { eventsPerSecond: 20 } },
  auth: { persistSession: false, autoRefreshToken: false },
});

export const isSupabaseConfigured = () =>
  Boolean(url && key && !url.includes('your-project-ref') && !key.includes('your-anon-key'));
