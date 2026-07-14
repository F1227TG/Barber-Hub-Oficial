function marcarMenuAtivo(nome) {
  document.querySelectorAll(".menu a").forEach(link => {
    link.classList.toggle("ativo", link.dataset.page === nome);
  });
}

function validarCampo(campo, mensagem = "Campo obrigatório.") {
  const box = campo?.closest(".campo");
  if (!campo || !box) return false;
  let erro = box.querySelector(".erro-msg");
  if (!erro) {
    erro = document.createElement("small");
    erro.className = "erro-msg";
    box.appendChild(erro);
  }
  const valido = Boolean(String(campo.value || "").trim());
  box.classList.toggle("erro", !valido);
  box.classList.toggle("sucesso", valido);
  erro.textContent = valido ? "" : mensagem;
  return valido;
}

function bhAplicarPreferencias() {
  const tema = localStorage.getItem("bh_tema") || "escuro";
  const fonte = localStorage.getItem("bh_fonte") || "normal";
  const contraste = localStorage.getItem("bh_contraste") === "alto";
  const reduzir = localStorage.getItem("bh_movimento") === "reduzido";

  document.body.classList.toggle("claro", tema === "claro");
  document.documentElement.dataset.fonte = fonte;
  document.body.classList.toggle("alto-contraste", contraste);
  document.body.classList.toggle("reduzir-movimento", reduzir);
}

function bhCriarDrawer(perfil) {
  if (document.getElementById("appDrawer")) return;
  const drawer = document.createElement("div");
  drawer.innerHTML = `
    <div class="drawer-overlay" id="drawerOverlay"></div>
    <aside class="app-drawer" id="appDrawer" aria-hidden="true">
      <div class="drawer-head">
        <a class="logo" href="${bhUrl("index.html")}">
          <img src="${bhUrl("img/logomarcaTRANSPARENTE.png")}" alt="Barber Hub">
          <span>Barber Hub<small>Menu e acessibilidade</small></span>
        </a>
        <button class="icon-btn" id="fecharDrawer" aria-label="Fechar menu"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="drawer-user">
        <div class="drawer-avatar">${escapeHTML(perfil?.nome?.slice(0, 1)?.toUpperCase() || "B")}</div>
        <div>
          <strong>${escapeHTML(perfil?.nome || "Visitante")}</strong>
          <span>${perfil ? escapeHTML(perfil.tipo) : "Entre para acessar sua conta"}</span>
        </div>
      </div>
      <nav class="drawer-links">
        <a href="${bhUrl("index.html")}"><i class="bi bi-house-door"></i> Início</a>
        <a href="${bhUrl("html/portal.html")}"><i class="bi bi-shop"></i> Explorar estabelecimentos</a>
        <a href="${bhUrl("html/agendamento.html")}"><i class="bi bi-calendar2-check"></i> Agendar horário</a>
        ${perfil ? `<a href="${bhUrl("html/conta.html")}"><i class="bi bi-person-gear"></i> Minha conta</a>` : `<a href="${bhUrl("html/login.html")}"><i class="bi bi-box-arrow-in-right"></i> Entrar</a>`}
        ${perfil ? `<a href="${perfil.tipo === "barbeiro" ? bhUrl("html/painel.html#agenda") : bhUrl("html/cliente.html#historico")}"><i class="bi bi-clock-history"></i> Histórico</a>` : ""}
        ${perfil?.tipo === "barbeiro" ? `<a href="${bhUrl("html/painel.html")}"><i class="bi bi-speedometer2"></i> Painel da barbearia</a>` : ""}
        ${perfil?.tipo === "admin" ? `<a href="${bhUrl("html/admin.html")}"><i class="bi bi-shield-lock"></i> Administração</a>` : ""}
        <a href="${bhUrl("html/contato.html")}"><i class="bi bi-headset"></i> Suporte e tickets</a>
        <a href="${bhUrl("html/beauty-hub.html")}"><i class="bi bi-stars"></i> Beauty Hub — futuro</a>
      </nav>
      <div class="drawer-section">
        <h3>Acessibilidade</h3>
        <div class="a11y-grid">
          <button data-a11y="fonte-menor"><i class="bi bi-dash-lg"></i> Fonte</button>
          <button data-a11y="fonte-maior"><i class="bi bi-plus-lg"></i> Fonte</button>
          <button data-a11y="contraste"><i class="bi bi-circle-half"></i> Contraste</button>
          <button data-a11y="movimento"><i class="bi bi-person-wheelchair"></i> Movimento</button>
        </div>
      </div>
      ${perfil ? `<button class="btn btn-danger full" id="drawerLogout"><i class="bi bi-box-arrow-right"></i> Sair da conta</button>` : `<a class="btn btn-primary full" href="${bhUrl("html/cadastro.html")}">Criar conta</a>`}
    </aside>
  `;
  document.body.appendChild(drawer);
}

function bhAbrirDrawer() {
  const drawer = document.getElementById("appDrawer");
  const overlay = document.getElementById("drawerOverlay");
  drawer?.classList.add("aberto");
  overlay?.classList.add("ativo");
  drawer?.setAttribute("aria-hidden", "false");
  document.body.classList.add("drawer-open");
}

function bhFecharDrawer() {
  const drawer = document.getElementById("appDrawer");
  const overlay = document.getElementById("drawerOverlay");
  drawer?.classList.remove("aberto");
  overlay?.classList.remove("ativo");
  drawer?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("drawer-open");
}

function bhConfigurarAcessibilidade() {
  document.querySelectorAll("[data-a11y]").forEach(botao => {
    botao.addEventListener("click", () => {
      const acao = botao.dataset.a11y;
      const atual = document.documentElement.dataset.fonte || "normal";
      if (acao === "fonte-maior") {
        const proximo = atual === "normal" ? "grande" : "muito-grande";
        localStorage.setItem("bh_fonte", proximo);
      }
      if (acao === "fonte-menor") {
        const proximo = atual === "muito-grande" ? "grande" : "normal";
        localStorage.setItem("bh_fonte", proximo);
      }
      if (acao === "contraste") {
        localStorage.setItem("bh_contraste", document.body.classList.contains("alto-contraste") ? "normal" : "alto");
      }
      if (acao === "movimento") {
        localStorage.setItem("bh_movimento", document.body.classList.contains("reduzir-movimento") ? "normal" : "reduzido");
      }
      bhAplicarPreferencias();
    });
  });
}

async function bhInicializarInterface() {
  bhAplicarPreferencias();
  let perfil = null;
  if (bhSupabasePronto()) {
    try { perfil = await bhGetPerfil(); } catch (erro) { console.warn(erro); }
  }

  bhCriarDrawer(perfil);
  bhConfigurarAcessibilidade();

  const btnTema = document.getElementById("btnTema");
  btnTema?.addEventListener("click", () => {
    const claro = !document.body.classList.contains("claro");
    localStorage.setItem("bh_tema", claro ? "claro" : "escuro");
    bhAplicarPreferencias();
  });

  const btnMenu = document.getElementById("btnMenu");
  btnMenu?.addEventListener("click", bhAbrirDrawer);
  document.getElementById("fecharDrawer")?.addEventListener("click", bhFecharDrawer);
  document.getElementById("drawerOverlay")?.addEventListener("click", bhFecharDrawer);
  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") bhFecharDrawer();
  });

  document.querySelectorAll("[data-user-name]").forEach(elemento => {
    elemento.textContent = perfil?.nome?.split(" ")[0] || "Entrar";
  });
  document.querySelectorAll("[data-auth-link]").forEach(link => {
    link.href = perfil ? bhUrl("html/conta.html") : bhUrl("html/login.html");
  });

  document.getElementById("drawerLogout")?.addEventListener("click", async () => {
    try {
      await bhLogout();
      mostrarToast("sucesso", "Sessão encerrada", "Você saiu da sua conta.");
      setTimeout(() => { location.href = bhUrl("index.html"); }, 500);
    } catch (erro) {
      mostrarToast("erro", "Não foi possível sair", bhErroMensagem(erro));
    }
  });
}

document.addEventListener("DOMContentLoaded", bhInicializarInterface);



function bhCriarProgressGlobal(){
  if(document.querySelector('.global-progress')) return;
  const barra=document.createElement('div'); barra.className='global-progress'; document.body.appendChild(barra);
  let pendentes=0, timer;
  const iniciar=()=>{pendentes++;clearTimeout(timer);barra.classList.add('ativo');barra.style.width='68%'};
  const terminar=()=>{pendentes=Math.max(0,pendentes-1);if(!pendentes){barra.style.width='100%';timer=setTimeout(()=>{barra.classList.remove('ativo');barra.style.width='0'},260)}};
  if(!window.__bhFetchWrapped){
    const original=window.fetch.bind(window);
    window.fetch=async(...args)=>{iniciar();try{return await original(...args)}finally{terminar()}};
    window.__bhFetchWrapped=true;
  }
}

function bhConfigurarConexao(){
  let aviso=document.querySelector('.connection-banner');
  if(!aviso){aviso=document.createElement('div');aviso.className='connection-banner';document.body.appendChild(aviso)}
  let onlineTimer;
  const atualizar=()=>{
    clearTimeout(onlineTimer);
    if(navigator.onLine){
      aviso.className='connection-banner online ativo';aviso.innerHTML='<i class="bi bi-wifi"></i> Conexão restaurada';
      onlineTimer=setTimeout(()=>aviso.classList.remove('ativo'),2200);
    }else{
      aviso.className='connection-banner ativo';aviso.innerHTML='<i class="bi bi-wifi-off"></i> Você está offline. Alterações precisam de internet.';
    }
  };
  addEventListener('online',atualizar);addEventListener('offline',atualizar);if(!navigator.onLine) atualizar();
}

function bhMelhorarFormularios(){
  document.querySelectorAll('form').forEach(form=>{
    form.setAttribute('novalidate','');
    form.querySelectorAll('input,select,textarea').forEach(campo=>{
      if(!campo.id) campo.id=`campo-${Math.random().toString(36).slice(2,9)}`;
      const label=campo.closest('.campo')?.querySelector('label'); if(label&&!label.htmlFor) label.htmlFor=campo.id;
      const validar=()=>{
        const box=campo.closest('.campo'); if(!box||campo.disabled||campo.type==='hidden') return true;
        let msg=''; const valor=String(campo.value||'').trim();
        if(campo.required&&!valor) msg='Este campo é obrigatório.';
        else if(campo.type==='email'&&valor&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) msg='Digite um e-mail válido.';
        else if(campo.minLength>0&&valor.length<campo.minLength) msg=`Use pelo menos ${campo.minLength} caracteres.`;
        else if(campo.type==='tel'&&valor&&valor.replace(/\D/g,'').length<10) msg='Digite um telefone com DDD.';
        let erro=box.querySelector('.erro-msg');
        if(msg&&!erro){erro=document.createElement('small');erro.className='erro-msg';box.appendChild(erro)}
        if(erro) erro.textContent=msg;
        box.classList.toggle('erro',Boolean(msg));box.classList.toggle('sucesso',!msg&&Boolean(valor));campo.setAttribute('aria-invalid',String(Boolean(msg)));
        return !msg;
      };
      campo.addEventListener('blur',validar);campo.addEventListener('input',()=>{if(campo.closest('.campo')?.classList.contains('erro')) validar()});
      if(campo.maxLength>0&&['TEXTAREA','INPUT'].includes(campo.tagName)&&!['password','date','time','file'].includes(campo.type)){
        const box=campo.closest('.campo'); if(box&&!box.querySelector('.field-counter')){const c=document.createElement('span');c.className='field-counter';const upd=()=>c.textContent=`${campo.value.length}/${campo.maxLength}`;campo.addEventListener('input',upd);upd();box.appendChild(c)}
      }
    });
    form.addEventListener('submit',e=>{
      const campos=[...form.querySelectorAll('input,select,textarea')];const invalidos=campos.filter(c=>{if(c.disabled||c.type==='hidden')return false;c.dispatchEvent(new Event('blur'));return c.closest('.campo')?.classList.contains('erro')});
      if(invalidos.length){e.preventDefault();e.stopImmediatePropagation();invalidos[0].focus();invalidos[0].scrollIntoView({behavior:'smooth',block:'center'});mostrarToast('erro','Revise o formulário',`Corrija ${invalidos.length} campo(s) destacado(s) antes de continuar.`)}
    },true);
  });
}

function bhAnimarConteudo(){
  const itens=document.querySelectorAll('.feature,.card,.form-card,.kpi,.recommend-card,.simple-item,.section-top');
  if(document.body.classList.contains('reduzir-movimento')) return;
  itens.forEach((el,i)=>{el.classList.add('reveal-ready');el.style.transitionDelay=`${Math.min(i%6,5)*55}ms`});
  const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('reveal-in');obs.unobserve(e.target)}}),{threshold:.08});itens.forEach(el=>obs.observe(el));
}

function bhAdicionarIdentidadePagina(){
  const mapa={index:'HUB',portal:'EXPLORAR',barbearia:'PERFIL',agendamento:'AGENDA',painel:'GESTÃO',cliente:'CONTA',admin:'ADMIN',contato:'SUPORTE',login:'ENTRAR',cadastro:'CRIAR',servicos:'RECURSOS','beauty-hub':'BEAUTY'};
  const nome=(location.pathname.split('/').pop()||'index.html').replace('.html','');
  const hero=document.querySelector('.page-hero,.hero,.auth-wrap,.onboarding-page');
  if(hero&&mapa[nome]&&!hero.querySelector('.page-identity')){const el=document.createElement('span');el.className='page-identity';el.textContent=mapa[nome];hero.appendChild(el)}
}

function bhAdicionarRodapeLegal(){
  const copy=document.querySelector('.footer .copy'); if(!copy||document.querySelector('.footer-legal')) return;
  const links=document.createElement('div');links.className='footer-legal';links.innerHTML=`<a href="${bhUrl('html/privacidade.html')}">Política de privacidade</a><a href="${bhUrl('html/termos.html')}">Termos de uso</a><a href="${bhUrl('html/contato.html')}">Acessibilidade e suporte</a>`;copy.appendChild(links);
}

function bhCriarDockMobile(perfil){
  if(document.querySelector('.mobile-dock'))return;
  const dock=document.createElement('nav');dock.className='mobile-dock';dock.setAttribute('aria-label','Navegação rápida');
  const home=bhUrl('index.html'),portal=bhUrl('html/portal.html'),agenda=bhUrl('html/agendamento.html');
  const conta=perfil?.tipo==='barbeiro'?bhUrl('html/painel.html'):perfil?bhUrl('html/cliente.html'):bhUrl('html/login.html');
  dock.innerHTML=`<a href="${home}"><i class="bi bi-house-door"></i><span>Início</span></a><a href="${portal}"><i class="bi bi-shop"></i><span>Explorar</span></a><a href="${agenda}"><i class="bi bi-calendar2-check"></i><span>Agendar</span></a><a href="${conta}"><i class="bi bi-person-circle"></i><span>${perfil?.tipo==='barbeiro'?'Painel':'Conta'}</span></a>`;
  document.body.appendChild(dock);
  [...dock.querySelectorAll('a')].forEach(a=>{if(new URL(a.href).pathname===location.pathname)a.classList.add('ativo')});
}

function bhPrepararPWA(){
  if('serviceWorker' in navigator&&location.protocol.startsWith('http')) navigator.serviceWorker.register(bhUrl('service-worker.js')).catch(console.warn);
  let deferred;
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;const sec=document.querySelector('.drawer-section');if(sec&&!document.getElementById('instalarApp')){const b=document.createElement('button');b.id='instalarApp';b.className='btn btn-outline full install-app-btn';b.innerHTML='<i class="bi bi-phone"></i> Instalar Barber Hub';b.onclick=async()=>{await deferred.prompt();deferred=null;b.remove()};sec.appendChild(b)}});
}

function bhAplicarSEO(){
  const titulo=document.title,desc=document.querySelector('meta[name="description"]')?.content||'Barber Hub — gestão e agendamento para barbearias.';
  const tags=[['property','og:title',titulo],['property','og:description',desc],['property','og:type','website'],['property','og:url',location.href],['name','twitter:card','summary_large_image'],['name','theme-color','#0b0b0b']];
  tags.forEach(([tipo,nome,valor])=>{if(!document.head.querySelector(`meta[${tipo}="${nome}"]`)){const m=document.createElement('meta');m.setAttribute(tipo,nome);m.content=valor;document.head.appendChild(m)}});
  if(!document.head.querySelector('link[rel="canonical"]')){const l=document.createElement('link');l.rel='canonical';l.href=location.href.split('?')[0].split('#')[0];document.head.appendChild(l)}
}

async function bhIniciarExperiencia(){
  const main=document.querySelector('main');const alvoMain=main?.id||'conteudo-principal';if(main&&!main.id)main.id=alvoMain;const skip=document.createElement('a');skip.className='skip-link';skip.href=`#${alvoMain}`;skip.textContent='Pular para o conteúdo';document.body.prepend(skip);
  bhCriarProgressGlobal();bhConfigurarConexao();bhMelhorarFormularios();bhAnimarConteudo();bhAdicionarIdentidadePagina();bhAdicionarRodapeLegal();bhPrepararPWA();bhAplicarSEO();
  let perfil=null;try{if(bhSupabasePronto())perfil=await bhGetPerfil()}catch(_){ } bhCriarDockMobile(perfil);
}
document.addEventListener('DOMContentLoaded',bhIniciarExperiencia);
