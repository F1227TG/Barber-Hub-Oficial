/* global supabase, SUPABASE_URL, SUPABASE_ANON_KEY */

const bhConfigValida =
  typeof SUPABASE_URL === "string" &&
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("COLE_AQUI") &&
  typeof SUPABASE_ANON_KEY === "string" &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes("COLE_AQUI");

window.supabaseClient = null;

if (typeof supabase !== "undefined" && bhConfigValida) {
  window.supabaseClient = supabase.createClient(
    SUPABASE_URL.trim().replace(/\/$/, ""),
    SUPABASE_ANON_KEY.trim(),
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
  console.info("Barber Hub: Supabase inicializado.");
} else {
  console.warn("Barber Hub: configure js/supabase-config.js antes de usar o banco.");
}

function bhSupabasePronto() {
  return Boolean(window.supabaseClient);
}

function bhExigirSupabase() {
  if (!window.supabaseClient) {
    throw new Error("Supabase ainda não configurado. Preencha js/supabase-config.js.");
  }
  return window.supabaseClient;
}
