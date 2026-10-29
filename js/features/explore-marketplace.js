/* Presentation layer over the existing paginated marketplace API. */
document.addEventListener('DOMContentLoaded',()=>{
 const city=document.querySelector('#marketplace-city');
 const apply=()=>{bhMarketplaceState.cidade=city.value.trim();bhMarketplaceState.busca=document.querySelector('#pesquisa').value.trim();update();bhMarketplaceCarregar({reset:true});};
 document.querySelector('#marketplace-search-submit')?.addEventListener('click',apply);
 [city,document.querySelector('#pesquisa')].forEach(input=>input?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();apply();}}));
 const scrollResults=()=>document.querySelector('#tituloResultadosMarketplace')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 document.querySelectorAll('[data-explore-service]').forEach(button=>button.addEventListener('click',()=>{
  bhMarketplaceState.servico=button.dataset.exploreService;bhMarketplaceState.tipo=button.dataset.exploreKind||'todos';
  update();bhMarketplaceCarregar({reset:true});scrollResults();
 }));
 document.querySelector('#marketplace-local-city')?.addEventListener('click',()=>{city.focus();city.scrollIntoView({block:'center'});});
 document.querySelector('#marketplace-local-location')?.addEventListener('click',()=>document.querySelector('[data-near-me]')?.click());
 const update=()=>{
  if(document.activeElement!==city)city.value=bhMarketplaceState.cidade;
  document.querySelectorAll('.marketplace-category-grid button').forEach(button=>button.setAttribute('aria-pressed',String(Boolean(bhMarketplaceState.servico||bhMarketplaceState.tipo!=='todos')&&button.dataset.exploreService===bhMarketplaceState.servico&&button.dataset.exploreKind===bhMarketplaceState.tipo)));
  const filters=[['cidade',bhMarketplaceState.cidade],['servico',bhMarketplaceState.servico],['status',bhMarketplaceState.status!=='todos'?bhMarketplaceState.status:''],['agenda',bhMarketplaceState.agenda!=='todos'?'Agenda: '+bhMarketplaceState.agenda:''],['tipo',bhMarketplaceState.tipo!=='todos'?bhMarketplaceState.tipo:''],['avaliacaoMin',bhMarketplaceState.avaliacaoMin?'Nota mínima: '+bhMarketplaceState.avaliacaoMin:''],['precoMin',bhMarketplaceState.precoMin!==null?'A partir de R$ '+bhMarketplaceState.precoMin:''],['precoMax',bhMarketplaceState.precoMax!==null?'Até R$ '+bhMarketplaceState.precoMax:'']];
  const container=document.querySelector('#marketplace-active-filters');container.replaceChildren();
  for(const [key,label] of filters){if(!label)continue;const button=document.createElement('button');button.type='button';button.textContent=label+' ×';button.setAttribute('aria-label','Remover filtro '+label);button.addEventListener('click',()=>{bhMarketplaceState[key]=['tipo','status','agenda'].includes(key)?'todos':['precoMin','precoMax','avaliacaoMin'].includes(key)?null:'';update();bhMarketplaceCarregar({reset:true});});container.append(button);}
 };
 new MutationObserver(update).observe(document.querySelector('#resumoPortal'),{childList:true});update();
});
