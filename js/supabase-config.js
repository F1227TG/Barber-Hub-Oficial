/*
  BARBER HUB — CONFIGURAÇÃO DO SUPABASE
  Cole somente a Project URL e a chave pública anon/publishable.
  Nunca use service_role ou secret key no navegador.
*/
const SUPABASE_URL = "https://dhkqnfqrfqrpumrjjrcy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoa3FuZnFyZnFycHVtcmpqcmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NjI0MzEsImV4cCI6MjA5OTMzODQzMX0.rF13C80O6ePH9RKSON089-T7IhhwndRWN05EZQ1k_ho";

/*
 * Cloudflare Turnstile. Em produção, security.js carrega a site key pública de
 * /api/v1/public-config, alimentada por BARBER_HUB_TURNSTILE_SITE_KEY no Vercel.
 * Este fallback existe apenas para desenvolvimento estático. A secret key NUNCA
 * deve estar no repositório; ela fica no painel Auth do Supabase/Cloudflare.
 */
const BH_TURNSTILE_SITE_KEY_FALLBACK = "";
