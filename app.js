import {products, categories} from './catalogo.js?v=catalogo1';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => '<svg aria-hidden="true"><use href="#'+name+'"/></svg>';
const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
const normal = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const productById = id => products.find(p=>p.id===id);
const categoryName = id => categories.find(c=>c.id===id)?.name || '';
const contact = 'https://wa.me/558781715830';
const vip = 'https://chat.whatsapp.com/Ft5fXalQAasKvRkS8qPTkF?s=cl&p=i&ilr=4&amv=0';
const canonical = 'https://yotucroni95-droid.github.io/lojanossasenhoraconceicao/';
const main = $('#main'), cartDialog = $('#cart-dialog');
let toastTimer, revealObserver, heroTimer, heroPaused=false, heroIndex=0, selectedVariant=0, productQuantity=1, currentProduct=null, lastFocus;
let cart=[];
try {
  const saved=JSON.parse(localStorage.getItem('conceicao-orcamento-v1')||'[]');
  if(Array.isArray(saved)) cart=saved.filter(i=>i&&productById(i.id)?.variants.some(v=>v.id===i.variant)&&Number.isInteger(i.qty)&&i.qty>0&&i.qty<=99).slice(0,40);
} catch {}
function saveCart(){try{localStorage.setItem('conceicao-orcamento-v1',JSON.stringify(cart));}catch{}updateCartCount();}
function updateCartCount(){const total=cart.reduce((n,i)=>n+i.qty,0);$$('.cart-count').forEach(el=>el.textContent=total);$('.cart-trigger').setAttribute('aria-label','Abrir lista de orçamento, '+total+' itens');}
function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200);}
function closeMenu(){$('#mobile-nav').hidden=true;$('.menu-toggle').setAttribute('aria-expanded','false');$('.menu-toggle').setAttribute('aria-label','Abrir menu');}
function card(p, promotion=false){
 const v=p.variants[0], demo=promotion||p.demo;
 return '<article class="product-card reveal"><a class="product-cover" href="#/produto/'+p.id+'">'+
 '<img src="'+v.image+'" alt="'+esc(p.name)+'" loading="lazy" width="1536" height="1024">'+
 (demo?'<span class="card-badge demo">Demonstração</span>':p.tag?'<span class="card-badge">'+p.tag+'</span>':'')+
 '<span class="product-explore">Conhecer produto '+icon('arrow')+'</span></a><div class="product-meta"><span>'+categoryName(p.category)+'</span><small>'+p.ref+'</small></div>'+
 '<a class="product-title" href="#/produto/'+p.id+'">'+p.name+'</a>'+
 (promotion?'<div class="demo-price"><small>PREÇO FICTÍCIO · SEM VALIDADE COMERCIAL</small><div><s>'+money(p.promotion.oldPrice)+'</s><strong>'+money(p.promotion.price)+'</strong></div></div>':'<p class="consult-price">Valores e disponibilidade sob consulta</p>')+
 '<div class="product-card-foot"><div class="color-dots" aria-label="'+p.variants.length+' opção ou simulação de cor">'+p.variants.map(v=>'<span style="--swatch:'+v.color+'" title="'+esc(v.name+(v.demo?' — simulação':''))+'"></span>').join('')+'<small>'+p.variants.length+(p.variants.length===1?' acabamento':' opções')+'</small></div><a class="round-link" href="#/produto/'+p.id+'" aria-label="Ver '+esc(p.name)+'">'+icon('plus')+'</a></div></article>';
}
function categoryCard(c,n){return '<a class="category-tile" href="#/catalogo?categoria='+c.id+'"><img src="'+c.image+'" alt="" loading="lazy" width="640" height="800"><div><span>0'+(n+1)+'</span><h3>'+c.name+'</h3><p>'+c.note+'</p></div><span class="category-arrow">'+icon('diagonal')+'</span>'+(c.demo?'<small class="image-demo">Imagem ilustrativa</small>':'')+'</a>';}
function processBlock(){return '<section class="process section"><div class="section-heading"><div><p class="eyebrow">DO PRIMEIRO OLHAR À SUA CASA</p><h2>Escolha com calma.<br><em>A gente cuida da conversa.</em></h2></div><p>Uma experiência simples para encontrar<br>o que combina com você.</p></div><div class="process-grid"><article><span>01</span><h3>Explore os ambientes</h3><p>Encontre móveis e eletros organizados por categoria.</p></article><article><span>02</span><h3>Monte a sua lista</h3><p>Escolha o produto, o acabamento e a quantidade desejada.</p></article><article><span>03</span><h3>Converse com a loja</h3><p>Envie sua seleção pelo WhatsApp e confirme medidas, valores e disponibilidade.</p></article></div></section>';}
function home(){
 main.innerHTML='<section class="editorial-hero"><div class="hero-slides">'+
 [{img:'assets/jantar.jpg',title:'Para reunir.<br>Para viver.<br><em>Para ser seu.</em>',label:'ENCONTROS QUE VIRAM MEMÓRIAS',category:'jantar',product:'jantar-01',item:'Conjunto de jantar'},
 {img:'assets/sofa.jpg',title:'O melhor lugar<br>do mundo?<br><em>A sua casa.</em>',label:'CONFORTO EM CADA DETALHE',category:'estofados',product:'estofado-01',item:'Estofados para acolher'},
 {img:'assets/quarto.jpg',title:'Desacelere.<br>Seu descanso<br><em>começa aqui.</em>',label:'SEU REFÚGIO PARTICULAR',category:'quarto',product:'cama-01',item:'Camas e colchões'}].map((s,i)=>'<article class="hero-slide '+(i===0?'active':'')+'" aria-hidden="'+(i!==0)+'"><img src="'+s.img+'" alt="'+s.item+'" width="1536" height="1024" '+(i?'loading="lazy"':'fetchpriority="high"')+'><div class="hero-scrim"></div><div class="hero-copy"><p class="eyebrow">'+s.label+'</p><h1>'+s.title+'</h1><p>Móveis, eletros e escolhas que fazem<br>a casa ter a sua essência.</p><a class="button gold" href="#/catalogo?categoria='+s.category+'" '+(i?'tabindex="-1"':'')+'>Explore a coleção '+icon('arrow')+'</a></div><a class="hero-hotspot" href="#/produto/'+s.product+'" '+(i?'tabindex="-1"':'')+'><span>'+icon('plus')+'</span><div><small>UM NOVO OLHAR PARA O LAR</small><b>'+s.item+'</b></div></a></article>').join('')+
 '</div><div class="hero-bottom"><span>CONCEIÇÃO · MÓVEIS & ELETROS</span><div class="hero-controls"><button data-hero-prev class="icon-button" aria-label="Ambiente anterior">'+icon('arrow')+'</button><span id="slide-number" aria-live="polite">01 / 03</span><button data-hero-next class="icon-button" aria-label="Próximo ambiente">'+icon('arrow')+'</button><button data-hero-pause aria-label="Pausar apresentação" class="pause-button">Pausar</button></div></div></section>'+
 '<div class="service-ribbon"><span>'+icon('bag')+' Escolha. Combine. Inspire-se.</span><span>'+icon('whatsapp')+' Atendimento de perto, pelo WhatsApp.</span><a href="#/loja">'+icon('pin')+' Visite nossa loja em Lagoa do Ouro '+icon('diagonal')+'</a></div>'+
 '<section class="section collections"><div class="section-heading"><div><p class="eyebrow">CADA AMBIENTE, UMA POSSIBILIDADE</p><h2>Qual é o seu<br><em>próximo espaço?</em></h2></div><div class="section-side"><p>Da sala que recebe ao quarto que abraça.<br>Encontre a sua próxima boa escolha.</p><a class="text-link" href="#/catalogo">Conheça todos os produtos '+icon('arrow')+'</a></div></div><div class="category-track">'+categories.map(categoryCard).join('')+'</div><div class="track-hint">Explore os ambientes <span>DESLIZE PARA VER MAIS '+icon('arrow')+'</span></div></section>'+
 '<section class="section selection"><div class="section-heading"><div><p class="eyebrow">UM OLHAR ESPECIAL PARA O SEU LAR</p><h2>Peças que fazem<br><em>a diferença.</em></h2></div><a class="text-link" href="#/catalogo">Ver catálogo completo '+icon('arrow')+'</a></div><div class="product-grid home-grid">'+[products[0],products[1],products[2],products[6]].map(p=>card(p)).join('')+'</div></section>'+
 '<section class="room-story"><img src="assets/home-ia.jpg" alt="Home amadeirado ambientado em uma sala" loading="lazy" width="1536" height="1024"><div class="room-story-copy"><p class="eyebrow">A CASA É FEITA DE ESCOLHAS</p><h2>Encontre beleza<br>no seu<br> <em>dia a dia.</em></h2><p>Texturas, formas e acabamentos que conversam com o seu jeito de viver.</p><a href="#/catalogo?categoria=sala" class="button light">Descubra a sala de estar '+icon('arrow')+'</a></div><a href="#/produto/home-01" class="story-tag">'+icon('plus')+' Conheça este home</a></section>'+
 '<section class="section promotions-preview"><div class="section-heading"><div><p class="eyebrow">UMA ÁREA PARA BOAS OPORTUNIDADES</p><h2>Seleção<br><em>em destaque.</em></h2></div><div class="section-side"><span class="demo-label">VITRINE DEMONSTRATIVA</span><p>Exemplos de como as promoções serão apresentadas.<br>Os valores abaixo são fictícios, não são ofertas.</p><a class="text-link" href="#/promocoes">Explorar demonstração '+icon('arrow')+'</a></div></div><div class="promo-grid">'+products.filter(p=>p.promotion).map(p=>card(p,true)).join('')+'</div></section>'+
 processBlock()+
 '<section class="vip-banner"><div><p class="eyebrow">FIQUE POR DENTRO, EM PRIMEIRA MÃO</p><h2>Um lugar na nossa<br><em>lista de novidades.</em></h2><p>Entre no grupo VIP e acompanhe o que chega à loja.</p></div><a class="button gold" href="'+vip+'" target="_blank" rel="noopener">Entrar no grupo VIP '+icon('whatsapp')+'</a><span class="vip-monogram" aria-hidden="true">C</span></section>'+
 '<section class="store-teaser section"><img src="assets/logo.jpg" width="1254" height="1254" alt="Logo oficial Nossa Senhora da Conceição" loading="lazy"><div><p class="eyebrow">DE LAGOA DO OURO, PARA A SUA CASA</p><h2>Prazer,<br><em>Conceição.</em></h2><p>Na nossa loja, sua escolha começa com uma boa conversa. Conheça os detalhes de perto e descubra possibilidades para o seu lar.</p><a class="text-link" href="#/loja">Conheça a loja e venha nos visitar '+icon('arrow')+'</a></div></section>';
 heroIndex=0;heroPaused=matchMedia('(prefers-reduced-motion: reduce)').matches;setHeroPause();startHero();
}
function setHero(index){
 const slides=$$('.hero-slide');if(!slides.length)return;heroIndex=(index+slides.length)%slides.length;
 slides.forEach((el,i)=>{el.classList.toggle('active',i===heroIndex);el.setAttribute('aria-hidden',String(i!==heroIndex));$$('a',el).forEach(a=>a.tabIndex=i===heroIndex?0:-1);});
 $('#slide-number').textContent=String(heroIndex+1).padStart(2,'0')+' / 03';
}
function startHero(){clearInterval(heroTimer);if(!heroPaused)heroTimer=setInterval(()=>{if(!document.hidden&&!$('.editorial-hero')?.contains(document.activeElement))setHero(heroIndex+1);},7000);}
function setHeroPause(){const btn=$('[data-hero-pause]');if(btn){btn.textContent=heroPaused?'Reproduzir':'Pausar';btn.setAttribute('aria-label',heroPaused?'Reproduzir apresentação':'Pausar apresentação');}}
let catalogCategory='todos',catalogQuery='',catalogSort='destaques';
function catalog(params=new URLSearchParams(),promos=false){
 catalogCategory=categories.some(c=>c.id===params.get('categoria'))?params.get('categoria'):'todos';catalogQuery=params.get('busca')||'';catalogSort='destaques';
 main.innerHTML='<section class="catalog-heading"><div class="crumb"><a href="#/">Início</a><span>/</span><span>'+(promos?'Promoções':'Catálogo')+'</span></div><div class="catalog-title"><div><p class="eyebrow">'+(promos?'VITRINE EM DEMONSTRAÇÃO':'ESCOLHAS PARA TODOS OS AMBIENTES')+'</p><h1>'+(promos?'Boas escolhas.<br><em>Novas oportunidades.</em>':'Seu lar, <em>do seu jeito.</em>')+'</h1></div><p>'+(promos?'Esta é uma apresentação da área de promoções. Os preços são fictícios e não têm validade comercial.':'Explore os produtos, conheça os detalhes e monte sua lista para conversar com a loja.')+'</p></div></section>'+
 (promos?'<div class="promo-disclaimer">'+icon('pin')+' <span><strong>Exemplos, não ofertas vigentes.</strong> Produtos e condições promocionais serão publicados após confirmação da loja.</span></div>':'')+
 '<section class="catalog-layout section" data-promos="'+promos+'"><aside class="catalog-sidebar"><span class="eyebrow">NAVEGUE POR AMBIENTE</span><div class="category-filters"><button data-category="todos" aria-pressed="'+(catalogCategory==='todos')+'">Todos os produtos <span>'+ (promos?products.filter(p=>p.promotion).length:products.length)+'</span></button>'+categories.map(c=>'<button data-category="'+c.id+'" aria-pressed="'+(catalogCategory===c.id)+'">'+c.name+'<span>'+products.filter(p=>p.category===c.id&&(!promos||p.promotion)).length+'</span></button>').join('')+'</div><div class="sidebar-help"><p>Uma ajudinha<br>na escolha?</p><a href="'+contact+'">Fale com a equipe '+icon('diagonal')+'</a></div></aside>'+
 '<div class="catalog-results"><div class="catalog-toolbar"><label class="search-field">'+icon('search')+'<input id="catalog-search" type="search" placeholder="O que você procura?" aria-label="Buscar no catálogo" value="'+esc(catalogQuery)+'"></label><label class="sort-field"><span>Ordenar</span><select id="catalog-sort" aria-label="Ordenar produtos"><option value="destaques">Destaques</option><option value="az">Nome: A a Z</option><option value="za">Nome: Z a A</option></select></label></div><div class="results-heading"><h2 id="category-title"></h2><span id="result-count" role="status" aria-live="polite"></span></div><div class="product-grid" id="catalog-grid"></div><p class="catalog-note">Fotos ambientadas com IA a partir dos produtos enviados pela loja. Cores e modelos demonstrativos estão identificados. Consulte medidas, acabamentos e disponibilidade.</p></div></section>';
 renderResults();
 if(params.has('busca'))$('#catalog-search').focus({preventScroll:true});
}
function renderResults(){
 const promos=$('.catalog-layout').dataset.promos==='true';
 let list=products.filter(p=>(!promos||p.promotion)&&(catalogCategory==='todos'||p.category===catalogCategory)&&normal(p.name+' '+p.ref+' '+categoryName(p.category)+' '+p.description).includes(normal(catalogQuery)));
 if(catalogSort==='az')list.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 if(catalogSort==='za')list.sort((a,b)=>b.name.localeCompare(a.name,'pt-BR'));
 $('#category-title').textContent=catalogCategory==='todos'?'Todos os produtos':categoryName(catalogCategory);
 $('#result-count').textContent=list.length+' '+(list.length===1?'produto':'produtos');
 $('#catalog-grid').innerHTML=list.length?list.map(p=>card(p,promos)).join(''):'<div class="empty-state">'+icon('search')+'<h3>'+(catalogCategory==='complementos'&&!catalogQuery?'Novas peças em breve.':'Não encontramos essa combinação.')+'</h3><p>'+(catalogCategory==='complementos'&&!catalogQuery?'Estamos preparando as fotos de cristaleiras, mesas de centro e outros complementos. Consulte a equipe para conhecer as opções.':'Experimente outra palavra ou explore todos os ambientes.')+'</p><button class="button dark" data-clear-filters>Ver todos os produtos '+icon('arrow')+'</button><a class="text-link" href="'+contact+'">Pedir ajuda à loja '+icon('whatsapp')+'</a></div>';
 observeReveals();
}
function productPage(id,params){
 const p=productById(id);if(!p){notFound();return;}
 currentProduct=p;selectedVariant=Math.max(0,p.variants.findIndex(v=>v.id===params.get('cor')));productQuantity=1;
 const v=p.variants[selectedVariant];
 main.innerHTML='<div class="product-breadcrumb crumb"><a href="#/">Início</a><span>/</span><a href="#/catalogo?categoria='+p.category+'">'+categoryName(p.category)+'</a><span>/</span><span>'+p.name+'</span></div>'+
 '<section class="product-detail"><div class="product-gallery"><button class="main-product-photo" data-zoom aria-label="Ampliar foto de '+p.name+'"><img id="product-main-image" src="'+v.image+'" alt="'+p.name+' — '+v.name+'" width="1536" height="1024"><span>'+icon('plus')+' Ampliar foto</span></button><div class="photo-options">'+p.variants.map((item,i)=>'<button data-variant="'+i+'" class="photo-thumbnail '+(i===selectedVariant?'selected':'')+'" aria-label="Ver acabamento '+item.name+(item.demo?' demonstrativo':'')+'" aria-pressed="'+(i===selectedVariant)+'"><img src="'+item.image+'" alt="" width="120" height="80"></button>').join('')+'</div><p class="photo-note">Imagem ambientada com IA. Objetos decorativos não acompanham o produto.</p></div>'+
 '<div class="product-info"><p class="eyebrow">'+categoryName(p.category)+' <span>REF. '+p.ref+'</span></p><h1>'+p.name+'</h1><p class="product-description">'+p.description+'</p>'+
 (p.demo?'<p class="demo-notice">Modelo demonstrativo. Consulte os produtos reais disponíveis na loja.</p>':'')+
 '<div class="product-pricing"><b>Gostou? Vamos conversar.</b><span>Consulte valor, medidas e disponibilidade com a equipe.</span></div>'+
 '<fieldset class="variant-field"><legend>Acabamento <strong id="chosen-color">'+v.name+'</strong></legend><div class="swatches">'+p.variants.map((item,i)=>'<button type="button" data-variant="'+i+'" style="--swatch:'+item.color+'" class="swatch '+(i===selectedVariant?'selected':'')+'" aria-label="Selecionar '+item.name+(item.demo?' — simulação':'')+'" aria-pressed="'+(i===selectedVariant)+'"><span></span></button>').join('')+'</div><p id="variant-notice" class="variant-notice">'+(v.demo?'Simulação de cor com IA. Disponibilidade não confirmada.':'Acabamento da foto. Confirme disponibilidade com a loja.')+'</p></fieldset>'+
 '<div class="product-buy"><div class="quantity-control"><button data-quantity="-1" aria-label="Diminuir quantidade">'+icon('minus')+'</button><output id="product-quantity" aria-live="polite">1</output><button data-quantity="1" aria-label="Aumentar quantidade">'+icon('plus')+'</button></div><button class="button dark add-product" data-add-product>'+icon('bag')+' Adicionar à minha lista</button></div>'+
 '<p class="buy-note">'+icon('check')+' Você escolhe agora. A loja confirma os detalhes com você.</p>'+
 '<div class="product-accordions"><details open><summary>Sobre esta peça '+icon('plus')+'</summary><ul>'+p.details.map(d=>'<li>'+d+'</li>').join('')+'</ul></details><details><summary>Como funciona o orçamento '+icon('plus')+'</summary><p>Adicione os produtos à sua lista. Depois, envie a seleção pelo WhatsApp para consultar preços, condições e disponibilidade. A lista é um pedido de informações e não reserva estoque nem conclui uma compra.</p></details><details><summary>Entrega, montagem e pagamento '+icon('plus')+'</summary><p>Confirme com a equipe as condições para seu endereço, a necessidade de montagem e as formas de pagamento antes de fechar o pedido.</p></details></div><a class="text-link visit-product" href="#/loja">'+icon('pin')+' Prefere ver de perto? Visite a loja '+icon('arrow')+'</a></div></section>'+
 '<section class="section related"><div class="section-heading"><div><p class="eyebrow">CONTINUE A SUA ESCOLHA</p><h2>Outras possibilidades<br><em>para a sua casa.</em></h2></div><a class="text-link" href="#/catalogo">Voltar ao catálogo '+icon('arrow')+'</a></div><div class="product-grid home-grid">'+products.filter(x=>x.id!==p.id&&!x.demo).slice(0,4).map(x=>card(x)).join('')+'</div></section>';
 document.title=p.name+' | Nossa Senhora da Conceição';
}
function chooseVariant(index){
 const v=currentProduct?.variants[index];if(!v)return;selectedVariant=index;
 const img=$('#product-main-image');img.src=v.image;img.alt=currentProduct.name+' — '+v.name;
 $('#chosen-color').textContent=v.name;$('#variant-notice').textContent=v.demo?'Simulação de cor com IA. Disponibilidade não confirmada.':'Acabamento da foto. Confirme disponibilidade com a loja.';
 $$('[data-variant]').forEach(b=>{const chosen=Number(b.dataset.variant)===index;b.classList.toggle('selected',chosen);b.setAttribute('aria-pressed',String(chosen));});
 history.replaceState(null,'','#/produto/'+currentProduct.id+'?cor='+v.id);
}
function storePage(){
 main.innerHTML='<section class="store-page section"><div class="crumb"><a href="#/">Início</a><span>/</span><span>Nossa loja</span></div><div class="store-intro"><div><p class="eyebrow">NOSSA SENHORA DA CONCEIÇÃO</p><h1>De perto,<br><em>é ainda melhor.</em></h1><p>Uma boa escolha tem conversa, cuidado e atenção aos detalhes. Visite nossa loja para conhecer móveis e eletros para cada canto da sua casa.</p><span class="signature">Paulo e Joanny <small>À FRENTE DA NOSSA LOJA</small></span></div><img src="assets/logo.jpg" alt="Logo oficial Nossa Senhora da Conceição" width="1254" height="1254"></div><div class="store-information"><article>'+icon('pin')+'<p class="eyebrow">ENCONTRE A GENTE</p><h2>Rua do Progresso,<br>Centro</h2><p>Lagoa do Ouro — Pernambuco</p><a class="button dark" href="https://share.google/IQlJpxaxf0zSdl4BJ" target="_blank" rel="noopener">Abrir localização '+icon('diagonal')+'</a></article><article>'+icon('clock')+'<p class="eyebrow">PORTAS ABERTAS PARA VOCÊ</p><h2>Segunda<br>a sábado</h2><p>Das 8h às 12h e das 14h às 17h.<br>Domingos: fechado.</p><a class="text-link" href="'+contact+'">Conversar com a loja '+icon('whatsapp')+'</a></article></div></section>'+
 '<section class="social-section section"><p class="eyebrow">NOS ENCONTRE TAMBÉM POR AQUI</p><h2>Inspiração que<br><em>acompanha você.</em></h2><div><a href="https://www.instagram.com/lojanossasra.daconceicao/" target="_blank" rel="noopener">'+icon('instagram')+'<span><small>NO INSTAGRAM</small>@lojanossasra.daconceicao</span>'+icon('diagonal')+'</a><a href="'+vip+'" target="_blank" rel="noopener">'+icon('whatsapp')+'<span><small>NO WHATSAPP</small>Entre no grupo VIP</span>'+icon('diagonal')+'</a></div></section>';
}
function notFound(){main.innerHTML='<section class="section empty-state"><h1>Vamos encontrar<br>uma nova inspiração?</h1><p>Este produto ou endereço não está no catálogo.</p><a class="button dark" href="#/catalogo">Explorar produtos '+icon('arrow')+'</a></section>';}
function observeReveals(){
 revealObserver?.disconnect();
 const els=$$('.reveal',main);
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){els.forEach(el=>el.classList.add('in-view'));return;}
 revealObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');revealObserver.unobserve(e.target);}}),{threshold:.07});
 els.forEach(el=>revealObserver.observe(el));
}
function route(){
 clearInterval(heroTimer);currentProduct=null;closeMenu();
 const raw=location.hash.slice(1)||'/';const [path,query='']=raw.split('?');const params=new URLSearchParams(query);
 if(path==='/catalogo'){catalog(params);document.title='Catálogo | Nossa Senhora da Conceição';}
 else if(path==='/promocoes'){catalog(params,true);document.title='Promoções demonstrativas | Nossa Senhora da Conceição';}
 else if(path.startsWith('/produto/'))productPage(path.split('/')[2],params);
 else if(path==='/loja'){storePage();document.title='Nossa loja | Nossa Senhora da Conceição';}
 else if(path==='/'||!path){home();document.title='Nossa Senhora da Conceição | Móveis para viver a casa';}
 else notFound();
 const nav=path==='/catalogo'||path.startsWith('/produto/')?'catalog':path==='/promocoes'?'promos':path==='/loja'?'store':'home';
 $$('[data-nav]').forEach(a=>{if(a.dataset.nav===nav)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 window.scrollTo({top:0,behavior:'instant'});if(!params.has('busca'))main.focus({preventScroll:true});observeReveals();
}
function addProduct(){
 const v=currentProduct.variants[selectedVariant];const existing=cart.find(i=>i.id===currentProduct.id&&i.variant===v.id);
 if(existing)existing.qty=Math.min(99,existing.qty+productQuantity);else cart.push({id:currentProduct.id,variant:v.id,qty:productQuantity});
 saveCart();toast(currentProduct.name+' adicionado à sua lista.');openCart();
}
function buildMessage(){
 let text='Olá! Gostei destes produtos no site da Nossa Senhora da Conceição e gostaria de mais informações:\n\n';
 cart.forEach((i,n)=>{const p=productById(i.id),v=p.variants.find(v=>v.id===i.variant);text+=(n+1)+'. '+p.name+' ('+p.ref+')\nAcabamento: '+v.name+'\nQuantidade: '+i.qty+'\n'+(p.demo||v.demo?'Observação: modelo/cor demonstrativo; confirmar opções reais.\n':'')+canonical+'#/produto/'+p.id+'?cor='+v.id+'\n\n';});
 const notes=$('#cart-notes')?.value.trim();if(notes)text+='Minha observação: '+notes+'\n\n';
 return text+'Podem confirmar valores, medidas, disponibilidade e condições?';
}
function openCart(){lastFocus=document.activeElement;renderCart();cartDialog.showModal();document.body.classList.add('dialog-open');}
function renderCart(){
 const priorNotes=$('#cart-notes')?.value||'';
 $('#cart-content').innerHTML=cart.length?'<p class="cart-intro">Sua seleção para consultar a loja.<br>Sem pagamento online, sem compromisso.</p><div class="cart-items">'+cart.map((item,index)=>{
 const p=productById(item.id),v=p.variants.find(v=>v.id===item.variant);
 return '<article class="cart-item"><img src="'+v.image+'" alt="'+esc(p.name)+'" width="144" height="120"><div><span class="eyebrow">'+p.ref+'</span><h3>'+p.name+'</h3><p>'+v.name+(p.demo||v.demo?' · Demonstração':'')+'</p><div class="cart-item-actions"><div class="quantity-control"><button data-cart-step="-1" data-index="'+index+'" aria-label="Diminuir quantidade de '+p.name+'">'+icon('minus')+'</button><output>'+item.qty+'</output><button data-cart-step="1" data-index="'+index+'" aria-label="Aumentar quantidade de '+p.name+'">'+icon('plus')+'</button></div><button class="remove-item" data-remove="'+index+'" aria-label="Remover '+p.name+'">Remover</button></div></div></article>';
 }).join('')+'</div><div class="cart-summary"><label for="cart-notes">Quer contar mais alguma coisa?</label><textarea id="cart-notes" maxlength="600" rows="2" placeholder="Ex.: gostaria de confirmar as medidas e a entrega.">'+esc(priorNotes)+'</textarea><div class="quote-total"><strong>'+cart.reduce((n,i)=>n+i.qty,0)+' itens selecionados</strong><span>Valores sob consulta</span></div><a id="send-whatsapp" class="button dark" target="_blank" rel="noopener" href="#">Pedir orçamento pelo WhatsApp '+icon('whatsapp')+'</a><details class="message-preview"><summary>Conferir mensagem antes de enviar</summary><pre id="message-preview"></pre></details><p class="cart-disclaimer">O WhatsApp abrirá com sua lista. Revise a mensagem e toque em enviar para iniciar o atendimento. Produtos demonstrativos serão identificados.</p><button class="text-link continue-shopping" data-close-cart>Continuar escolhendo '+icon('arrow')+'</button></div>':
 '<div class="empty-cart">'+icon('bag')+'<h3>Sua próxima escolha<br>começa por aqui.</h3><p>Explore o catálogo e adicione os produtos que mais combinam com você.</p><a href="#/catalogo" class="button dark" data-close-cart>Explorar produtos '+icon('arrow')+'</a></div>';
 updateMessage();
}
function updateMessage(){if(!cart.length)return;const message=buildMessage();$('#send-whatsapp').href=contact+'?text='+encodeURIComponent(message);$('#message-preview').textContent=message;}
document.addEventListener('click',event=>{
 const el=event.target.closest('button,a');if(!el)return;
 if(el.getAttribute('href')==='#main'){event.preventDefault();main.focus();main.scrollIntoView();return;}
 if(el.matches('a')&&el.getAttribute('href')?.startsWith('#/')&&el.getAttribute('href')===location.hash){event.preventDefault();route();}
 if(el.matches('.menu-toggle')){const open=el.getAttribute('aria-expanded')==='true';el.setAttribute('aria-expanded',String(!open));el.setAttribute('aria-label',open?'Abrir menu':'Fechar menu');$('#mobile-nav').hidden=open;}
 if(el.matches('[data-open-cart]'))openCart();
 if(el.matches('[data-close-cart]'))cartDialog.close();
 if(el.matches('[data-close-image]'))$('#image-dialog').close();
 if(el.matches('[data-hero-next]')){setHero(heroIndex+1);startHero();}
 if(el.matches('[data-hero-prev]')){setHero(heroIndex-1);startHero();}
 if(el.matches('[data-hero-pause]')){heroPaused=!heroPaused;setHeroPause();startHero();}
 if(el.matches('[data-category]')){catalogCategory=el.dataset.category;$$('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));renderResults();const isPromo=$('.catalog-layout').dataset.promos==='true';const params=new URLSearchParams();if(catalogCategory!=='todos')params.set('categoria',catalogCategory);if(catalogQuery)params.set('busca',catalogQuery);history.replaceState(null,'','#/'+(isPromo?'promocoes':'catalogo')+(params.size?'?'+params:''));}
 if(el.matches('[data-clear-filters]')){catalogCategory='todos';catalogQuery='';$('#catalog-search').value='';$$('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category==='todos')));renderResults();history.replaceState(null,'','#/'+($('.catalog-layout').dataset.promos==='true'?'promocoes':'catalogo'));}
 if(el.matches('[data-variant]'))chooseVariant(Number(el.dataset.variant));
 if(el.matches('[data-quantity]')){productQuantity=Math.max(1,Math.min(99,productQuantity+Number(el.dataset.quantity)));$('#product-quantity').textContent=productQuantity;}
 if(el.matches('[data-add-product]'))addProduct();
 if(el.matches('[data-zoom]')){const img=$('#product-main-image');$('#large-image').src=img.src;$('#large-image').alt=img.alt;$('#image-dialog').showModal();document.body.classList.add('dialog-open');}
 if(el.matches('[data-cart-step]')){const i=cart[Number(el.dataset.index)];if(i){i.qty=Math.max(1,Math.min(99,i.qty+Number(el.dataset.cartStep)));saveCart();renderCart();}}
 if(el.matches('[data-remove]')){cart.splice(Number(el.dataset.remove),1);saveCart();renderCart();}
 if(el.closest('#mobile-nav')&&el.matches('a'))closeMenu();
});
document.addEventListener('input',event=>{if(event.target.id==='catalog-search'){catalogQuery=event.target.value;renderResults();}if(event.target.id==='cart-notes')updateMessage();});
document.addEventListener('change',event=>{if(event.target.id==='catalog-sort'){catalogSort=event.target.value;renderResults();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
for(const d of [cartDialog,$('#image-dialog')]){
 d.addEventListener('close',()=>{document.body.classList.remove('dialog-open');if(d===cartDialog&&lastFocus?.isConnected)lastFocus.focus();});
 d.addEventListener('click',e=>{if(e.target!==d)return;const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();});
}
window.addEventListener('hashchange',route);$('#year').textContent=new Date().getFullYear();updateCartCount();route();
