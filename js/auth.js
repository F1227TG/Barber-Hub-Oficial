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
  if (bhPerfilCache && !force) return bhPerfilCache;
  const session = await bhGetSession();
  if (!session?.user) return null;

  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("perfis")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  bhPerfilCache = data ? { ...data, authUser: session.user } : null;
  return bhPerfilCache;
}

async function bhAguardarPerfil(tentativas = 5) {
  for (let i = 0; i < tentativas; i += 1) {
    const perfil = await bhGetPerfil(true);
    if (perfil) return perfil;
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  return null;
}

async function bhLogin(email, senha) {
  const client = bhExigirSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password: senha
  });
  if (error) throw error;
  bhPerfilCache = null;
  const perfil = await bhAguardarPerfil();
  return { session: data.session, user: data.user, perfil };
}

async function bhRegistrar({ nome, email, telefone, senha, tipo }) {
  const client = bhExigirSupabase();
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password: senha,
    options: {
      emailRedirectTo: bhAbsoluteUrl("html/login.html?confirmado=1"),
      data: {
        nome: nome.trim(),
        telefone: telefone.trim(),
        tipo: tipo === "barbeiro" ? "barbeiro" : "cliente"
      }
    }
  });
  if (error) throw error;
  bhPerfilCache = null;
  const perfil = data.session ? await bhAguardarPerfil() : null;
  return {
    session: data.session,
    user: data.user,
    perfil,
    precisaConfirmarEmail: !data.session
  };
}


async function bhSolicitarRecuperacaoSenha(email) {
  const client = bhExigirSupabase();
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: bhAbsoluteUrl("html/redefinir-senha.html")
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
}

function bhDestinoPerfil(perfil, next = null) {
  if (next && (next.startsWith("./") || next.startsWith("../") || next.startsWith("html/") || next.startsWith("/"))) {
    return next;
  }
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
    const perfil = await bhGetPerfil();
    if (!perfil) {
      const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
      location.href = `${bhUrl("html/login.html")}?next=${next}`;
      return null;
    }
    if (tiposPermitidos && !tiposPermitidos.includes(perfil.tipo)) {
      mostrarToast("erro", "Acesso restrito", "Sua conta não possui acesso a esta área.");
      setTimeout(() => { location.href = bhDestinoPerfil(perfil); }, 700);
      return null;
    }
    return perfil;
  } catch (erro) {
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
  if (data.user) {
    await client.from("perfis").update({ email: email.trim() }).eq("id", data.user.id);
  }
  bhPerfilCache = null;
  return data.user;
}

if (bhSupabasePronto()) {
  supabaseClient.auth.onAuthStateChange((_evento, session) => {
    if (!session) bhPerfilCache = null;
  });
}
