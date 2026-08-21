/*
  BARBER HUB — CONFIGURAÇÃO DO SUPABASE
  Cole somente a Project URL e a chave pública anon/publishable.
  Nunca use service_role ou secret key no navegador.
*/
const SUPABASE_URL = "https://dhkqnfqrfqrpumrjjrcy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_idNGCP5OcCJQOL3rzkRVLw_nw-d3FJm";

// Alias temporário para módulos legados. O valor continua sendo uma chave
// pública própria para navegador; nunca substitua por sb_secret/service_role.
const SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY;

/*
 * Cloudflare Turnstile. Em produção, security.js carrega a site key pública de
 * /api/v1/public-config, alimentada por BARBER_HUB_TURNSTILE_SITE_KEY no Vercel.
 * Este fallback existe apenas para desenvolvimento estático. A secret key NUNCA
 * deve estar no repositório; ela fica no painel Auth do Supabase/Cloudflare.
 */
const BH_TURNSTILE_SITE_KEY_FALLBACK = "";
