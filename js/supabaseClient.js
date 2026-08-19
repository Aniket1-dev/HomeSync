// ============================================================
// HomeSync AI — Supabase client configuration
// The anon key is safe for browser use when RLS is correctly configured.
// Never put a service_role key in frontend code.
// ============================================================
const SUPABASE_URL = "https://xbqmrmxneizmjuafunvq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhicW1ybXhuZWl6bWp1YWZ1bnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MjAyMjksImV4cCI6MjEwMTQ5NjIyOX0.fd7GyIZzAxzJnz8kGXvNfA9gIAuQ5nHigRvQUcXc7Ts";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient;
