/**
 * auth.js
 * Sessão, perfil autenticado, proteção de rotas e redirecionamentos.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

let bhPerfilCache = null;

async function bhGetSession() {
  const client = bhExigirSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

async function bhGetAuthUser() {
  const client = bhExigirSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user;
}

async function bhGetPerfil(force = false) {
  const session = await bhGetSession();
  if (!session?.user) { bhPerfilCache = null; return null; }
  if (bhPerfilCache?.id === session.user.id && !force) return bhPerfilCache;

  if (!window.bhBackendApi?.accountProfile) throw new Error("O serviço de contas está temporariamente indisponível.");
  const data = await window.bhBackendApi.accountProfile();
  bhPerfilCache = data ? { ...data, authUser: session.user } : null;
  return bhPerfilCache;
}

async function bhAguardarPerfil(tentativas = 5) {
  for (let i = 0; i < tentativas; i += 1) {
    try {
      const perfil = await bhGetPerfil(true);
      if (perfil) return perfil;
    } catch (erro) {
      // Retry only a transient service failure, never an authorization denial.
      if (![502, 503, 504].includes(erro.status) || i === tentativas - 1) throw erro;
    }
    if (i < tentativas - 1) await new Promise(resolve => setTimeout(resolve, 350));
  }
  return null;
}

async function bhLogin(email, senha, captchaToken = undefined) {
  const client = bhExigirSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password: senha,
    options: captchaToken ? { captchaToken } : undefined
  });
  if (error) throw error;
  bhPerfilCache = null;
  const perfil = await bhAguardarPerfil();
  return { session: data.session, user: data.user, perfil };
}

async function bhRegistrar({ nome, email, telefone, senha, tipo, next = null, captchaToken = undefined, marketing = false, versaoLegal = "2026-09-11" }) {
  const client = bhExigirSupabase();
  const destinoContinuacao = window.bhContinuation?.safeNext?.(next);
  const confirmacao = new URL(bhAbsoluteUrl("html/login.html"));
  confirmacao.searchParams.set("confirmado", "1");
  if (destinoContinuacao) confirmacao.searchParams.set("next", destinoContinuacao);
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password: senha,
    options: {
      emailRedirectTo: confirmacao.href,
      ...(captchaToken ? { captchaToken } : {}),
      data: {
        nome: nome.trim(),
        telefone: telefone.trim(),
        tipo: tipo === "barbeiro" ? "barbeiro" : "cliente",
        aceite_termos_versao: versaoLegal,
        aceite_privacidade_versao: versaoLegal,
        aceite_em: new Date().toISOString(),
        marketing_aceito: Boolean(marketing)
      }
    }
  });
  if (error) throw error;
  bhPerfilCache = null;
  let perfil = null;
  if (data.session) {
    try { perfil = await bhAguardarPerfil(); }
    catch (cause) {
      const erro = new Error("Sua conta foi criada, mas não foi possível abrir seu perfil. Tente entrar novamente em instantes; não repita o cadastro.", { cause });
      erro.code = "ACCOUNT_PROFILE_PENDING";
      throw erro;
    }
  }
  if (data.session && !perfil) {
    throw new Error("Sua conta foi criada, mas não foi possível carregar seu perfil. Entre novamente em instantes; não é necessário repetir o cadastro.");
  }
  return {
    session: data.session,
    user: data.user,
    perfil,
    precisaConfirmarEmail: !data.session
  };
}


async function bhSolicitarRecuperacaoSenha(email, captchaToken = undefined) {
  const client = bhExigirSupabase();
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: bhAbsoluteUrl("html/redefinir-senha.html"),
    ...(captchaToken ? { captchaToken } : {})
  });
  if (error) throw error;
}

async function bhAtualizarSenha(novaSenha) {
  const client = bhExigirSupabase();
  const { data, error } = await client.auth.updateUser({ password: novaSenha });
  if (error) throw error;
  return data.user;
}

async function bhLogout() {
  const client = bhExigirSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
  bhPerfilCache = null;
  window.bhViewState?.clearAll?.();
  window.bhOperationDraft?.clearAll?.();
  window.bhContinuation?.clear?.();
}

function bhDestinoPerfil(perfil, next = null) {
  const destinoSeguro = window.bhContinuation?.safeNext?.(next);
  if (destinoSeguro) return destinoSeguro;
  if (!perfil) return bhUrl("html/login.html");
  if (perfil.tipo === "admin") return bhUrl("html/admin.html");
  if (perfil.tipo === "barbeiro") {
    return perfil.onboarding_concluido
      ? bhUrl("html/painel.html")
      : bhUrl("html/cadastro-barbearia.html");
  }
  return bhUrl("html/cliente.html");
}

async function bhRequireAuth(tiposPermitidos = null) {
  try {
    const perfil = await bhGetPerfil(true);
    if (!perfil) {
      const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
      location.href = `${bhUrl("html/login.html")}?next=${next}`;
      return null;
    }
    if (perfil.ativo !== true || (perfil.estado_conta && perfil.estado_conta !== "ativa") ||
        (tiposPermitidos && !tiposPermitidos.includes(perfil.tipo))) {
      location.replace(bhUrl("404.html"));
      return null;
    }
    return perfil;
  } catch (erro) {
    if (erro.code === "ACCOUNT_INACTIVE") {
      bhPerfilCache = null;
      location.replace(bhUrl("404.html"));
      return null;
    }
    mostrarToast("erro", "Falha de autenticação", bhErroMensagem(erro));
    return null;
  }
}

async function bhAtualizarPerfil(dados) {
  const perfil = await bhGetPerfil();
  if (!perfil) throw new Error("Sessão não encontrada.");
  const client = bhExigirSupabase();
  const permitido = {
    nome: dados.nome,
    telefone: dados.telefone,
    avatar_url: dados.avatar_url,
    acessibilidade: dados.acessibilidade
  };
  Object.keys(permitido).forEach(chave => permitido[chave] === undefined && delete permitido[chave]);
  const { data, error } = await client
    .from("perfis")
    .update(permitido)
    .eq("id", perfil.id)
    .select()
    .single();
  if (error) throw error;
  bhPerfilCache = { ...data, authUser: perfil.authUser };
  return bhPerfilCache;
}

async function bhAtualizarEmail(email) {
  const client = bhExigirSupabase();
  const { data, error } = await client.auth.updateUser({ email: email.trim() });
  if (error) throw error;
  // Auth owns the confirmed email. Never publish a pending email as confirmed.
  bhPerfilCache = null;
  return data.user;
}

if (bhSupabasePronto()) {
  supabaseClient.auth.onAuthStateChange((evento, session) => {
    if (!session || bhPerfilCache?.id !== session.user.id || evento === "USER_UPDATED") bhPerfilCache = null;
    // INITIAL_SESSION without a user is normal on public booking pages.
    if (evento === "SIGNED_OUT") {
      window.bhViewState?.clearAll?.();
      window.bhOperationDraft?.clearAll?.();
      window.bhContinuation?.clear?.();
    }
  });
}
