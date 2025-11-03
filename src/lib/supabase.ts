import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tloxaotkqbwuvppvifje.supabase.co';  // Paste your Project URL
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsb3hhb3RrcWJ3dXZwcHZpZmplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNjM2NzgsImV4cCI6MjA3NzYzOTY3OH0.aNe2k_vWZSkJRkUvM2kTj2RMs78byBMjkdClALMHjow';  // Paste your anon key

let supabaseInstance: ReturnType<typeof createClient> | null = null;

try {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  });
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  // Create a minimal fallback client to prevent app crash
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseInstance!;