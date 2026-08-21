/* global supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY */

const BH_SUPABASE_PUBLIC_KEY =
  typeof SUPABASE_PUBLISHABLE_KEY === "string" && SUPABASE_PUBLISHABLE_KEY
    ? SUPABASE_PUBLISHABLE_KEY
    : typeof SUPABASE_ANON_KEY === "string"
      ? SUPABASE_ANON_KEY
      : "";

const bhConfigValida =
  typeof SUPABASE_URL === "string" &&
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("COLE_AQUI") &&
  BH_SUPABASE_PUBLIC_KEY.length > 20 &&
  !BH_SUPABASE_PUBLIC_KEY.includes("COLE_AQUI");

window.supabaseClient = null;

if (typeof supabase !== "undefined" && bhConfigValida) {
  window.supabaseClient = supabase.createClient(
    SUPABASE_URL.trim().replace(/\/$/, ""),
    BH_SUPABASE_PUBLIC_KEY.trim(),
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
