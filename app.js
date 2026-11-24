import {modo, loja, entrega, pagamento, campanhas} from './config.js?v=10';
import {products as produtosBase} from './catalogo.js?v=10';
import {pendentesLoja, produtosLoja} from './catalogo-loja.js?v=10';
import {categories, montarCatalogo, acharProduto, acharVariante, disponibilidade, medidasTexto, pendencias, galeria, cotar, faseCampanha,
  mensagemProduto, mensagemPedido, linkWhatsapp, reais} from './loja/regras.js?v=10';
import {animarPagina} from './movimento.js?v=10';
import {carregarCatalogoRemoto} from './loja/remoto.js?v=10';
await carregarCatalogoRemoto();

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const icon = name => '<svg aria-hidden="true"><use href="#' + name + '"/></svg>';
const normal = value => String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const categoryName = id => categories.find(c => c.id === id)?.name || '';
const teste = modo === 'teste';
const comPreco = loja.exibirPrecos !== false;
const pagamentoAtivo = comPreco && (teste || pagamento.ativoEmProducao);
const categoriasVisiveis = categories.filter(c => !c.oculta);
const economia = matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData === true || /(^|-)2g$/.test(navigator.connection?.effectiveType || '');
const main = $('#main'), cartDialog = $('#cart-dialog'), waDialog = $('#wa-dialog');
const ls = {get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} }};

let catalogo = [], toastTimer, revealObserver, heroTimer, heroPaused = false, heroIndex = 0, selectedVariant = 0, productQuantity = 1, currentProduct = null, lastFocus, photoIndex = 0, pollTimer;
const agora = () => { const d = teste && ls.get('conceicao-data-teste', null); return d ? new Date(d) : new Date(); };
const recarregarCatalogo = () => { catalogo = montarCatalogo({modo, agora: agora()}); };
const productById = id => acharProduto(catalogo, id);
const blackGeral = () => { const c = campanhaVisivel(); return c?.fase === 'ativa' && c.todosOsProdutos ? c : null; };
const campanhaVisivel = () => campanhas.map(c => ({...c, fase: faseCampanha(c, agora())})).find(c => c.fase === 'anuncio' || c.fase === 'ativa');
recarregarCatalogo();

// ---------- carrinho ----------
let cart = [];
let entregaTipo = ls.get('conceicao-entrega', 'retirada') === 'domicilio' ? 'domicilio' : 'retirada';
let cidadeEntrega = ls.get('conceicao-cidade', '');
{
  const saved = ls.get('conceicao-orcamento-v1', []);
  if (Array.isArray(saved)) cart = saved.filter(i => i && acharVariante(productById(i.id), i.variant) && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 99).slice(0, 40);
}
function saveCart() { ls.set('conceicao-orcamento-v1', cart); updateCartCount(); }
function updateCartCount() { const total = cart.reduce((n, i) => n + i.qty, 0); $$('.cart-count').forEach(el => el.textContent = total); $('.cart-trigger').setAttribute('aria-label', 'Abrir carrinho, ' + total + (total === 1 ? ' item' : ' itens')); }
function toast(text) { const el = $('#toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200); }
function closeMenu() { $('#mobile-nav').hidden = true; $('.menu-toggle').setAttribute('aria-expanded', 'false'); $('.menu-toggle').setAttribute('aria-label', 'Abrir menu'); }

// ---------- peças de interface ----------
function precoHtml(v, compacto = false) {
  if (v.preco == null) return '<p class="price-consult">' + (blackGeral() ? (compacto ? 'Preço de Black Friday · consulte' : 'Preço de Black Friday: consulte pelo WhatsApp') : comPreco || compacto ? 'Preço sob consulta' : 'Consulte o preço pelo WhatsApp') + '</p>';
  return '<div class="price' + (compacto ? ' compact' : '') + '">' + (v.precoDe && v.precoDe > v.preco ? '<s>' + reais(v.precoDe) + '</s>' : '') +
    '<strong>' + reais(v.preco) + '</strong><span>à vista</span>' + (v.parcelado ? '<small>ou ' + v.parcelado.vezes + 'x de ' + reais(v.parcelado.valor) + '</small>' : '') +
    (teste && v.valoresTeste ? '<em class="test-flag">Valor de teste</em>' : '') + '</div>';
}
function card(p) {
  const v = p.variants.find(x => disponibilidade(x).codigo !== 'esgotado') || p.variants[0];
  const disp = disponibilidade(v);
  const badge = v.campanha ? '<span class="card-badge campaign">' + esc(v.nomeCampanha) + '</span>' : p.demo ? '<span class="card-badge demo">Demonstração</span>' : disp.codigo === 'esgotado' ? '<span class="card-badge">Esgotado</span>' : blackGeral() ? '<span class="card-badge campaign">' + esc(blackGeral().nome) + '</span>' : p.tag ? '<span class="card-badge">' + esc(p.tag) + '</span>' : '';
  return '<article class="product-card' + (economia ? '' : ' reveal') + '"><a class="product-cover" href="#/produto/' + p.id + '?cor=' + v.id + '">' +
    '<img' + ((v.imageTipo === 'catalogo' || v.imageTipo === 'ilustrativa') ? ' class="foto-catalogo"' : '') + ' src="' + v.image + '" alt="' + esc(p.name + ' — ' + v.name) + '" loading="lazy" decoding="async" width="1536" height="1024">' + badge + '</a>' +
    '<div class="product-meta"><span>' + categoryName(p.category) + '</span><small>' + esc(p.fabricante || p.ref) + '</small></div>' +
    '<a class="product-title" href="#/produto/' + p.id + '?cor=' + v.id + '">' + esc(p.name) + '</a>' + precoHtml(v, true) +
    '<div class="product-card-foot"><div class="color-dots" aria-label="' + p.variants.length + (p.variants.length === 1 ? ' opção' : ' opções') + '">' + p.variants.filter(x => x.color !== '#d9d2c5').map(x => '<span style="--swatch:' + x.color + '" title="' + esc(x.name + (x.demo ? ' — simulação' : '')) + '"></span>').join('') + '<small>' + p.variants.length + (p.variants.length === 1 ? ' opção' : ' opções') + '</small></div><a class="round-link" href="#/produto/' + p.id + '?cor=' + v.id + '" aria-label="Ver ' + esc(p.name) + '">' + icon('plus') + '</a></div></article>';
}
function categoryCard(c, n) { return '<a class="category-tile" href="#/catalogo?categoria=' + c.id + '"><img src="' + c.image + '" alt="" loading="lazy" decoding="async" width="640" height="800"><div><span>0' + (n + 1) + '</span><h3>' + c.name + '</h3><p>' + c.note + '</p></div><span class="category-arrow">' + icon('diagonal') + '</span>' + (c.demo ? '<small class="image-demo">Imagem ilustrativa</small>' : '') + '</a>'; }
const searchForm = (valor = '') => '<form class="quick-search" role="search" action="#/catalogo" data-search-form><label class="search-field">' + icon('search') + '<span class="sr-only">Buscar produtos</span><input name="busca" type="search" placeholder="Buscar sofá, cama, guarda-roupa…" enterkeyhint="search" value="' + esc(valor) + '" autocomplete="off"></label><button class="button dark" type="submit">Buscar</button></form>';
const dataCurta = iso => new Date(iso).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', timeZone: 'America/Recife'});
function campaignBanner(c) {
  if (!c) return '';
  const ofertas = catalogo.filter(p => p.variants.some(v => v.campanha === c.id)).length;
  return '<a class="campaign-banner" href="#/' + c.slug + '"><span class="campaign-tag">' + esc(c.nome) + '</span><strong>' + (c.fase === 'ativa' && c.todosOsProdutos ? 'Acontecendo agora · todos os produtos até ' + dataCurta(c.fim) : c.fase === 'ativa' ? (ofertas ? ofertas + (ofertas === 1 ? ' oferta vigente' : ' ofertas vigentes') + ' até ' + dataCurta(c.fim) : 'Ofertas sendo publicadas') : 'Começa em ' + dataCurta(c.inicio)) + '</strong><span>' + esc(c.chamada) + ' ' + icon('arrow') + '</span></a>';
}
function testBar() { return teste ? '<div class="test-bar" role="note"><strong>Prévia de testes</strong> · ' + (comPreco ? 'preços, estoque e pagamentos fictícios.' : 'estoque do relatório da loja de 23/11; pedidos simulados.') + ' <a href="#/manutencao">Manutenção</a></div>' : ''; }

// ---------- vitrine e busca ----------
// Vitrine = produtos do estoque real da loja. Os modelos de demonstração antigos continuam abrindo pelo link, mas saem das listas.
const idsLoja = new Set(produtosLoja.map(p => p.id));
const naVitrine = p => p.vitrine ?? idsLoja.has(p.id);
const SINONIMOS = {roupa: ['roupeiro', 'guarda-roupa'], guarda: ['roupeiro', 'guarda'], sofa: ['estofado', 'sofa'], estofado: ['estofado', 'sofa'],
  televisao: ['tv'], tv: ['tv'], cama: ['cama', 'box', 'colchao'], armario: ['armario', 'aereo', 'cozinha', 'multiuso', 'roupeiro'],
  mesa: ['mesa', 'conjunto'], cadeira: ['cadeira', 'poltrona'], bike: ['bicicleta'], geladeira: ['geladeira', 'refrigerador'],
  rack: ['rack', 'bancada', 'painel', 'home'], painel: ['painel', 'home', 'rack'], cabeceira: ['cabeceira'], tanquinho: ['tanquinho', 'lavadora', 'lavamax']};
const textoBusca = p => p._busca ??= normal([p.name, p.ref, p.fabricante, categoryName(p.category), p.description, ...(p.details || []), ...p.variants.flatMap(v => [v.name, v.sku])].join(' '));
const termos = busca => normal(busca).split(/[\s,.;/-]+/).filter(t => t.length > 1 || /\d/.test(t));
function bateBusca(p, busca) {
  const lista = termos(busca); if (!lista.length) return true;
  const t = textoBusca(p);
  return lista.every(k => /^\d{1,3}$/.test(k) ? new RegExp('(^|\\D)' + k + '(\\D|$)').test(t) // número curto ("6 bocas") só como número inteiro
    : [k, ...(SINONIMOS[k] || []), k.length > 3 && k.endsWith('s') ? k.slice(0, -1) : null].filter(Boolean).some(x => t.includes(x)));
}
const noNome = (p, busca) => termos(busca).every(k => normal(p.name).includes(k.length > 3 && k.endsWith('s') ? k.slice(0, -1) : k));
const pontos = p => (p.variants.some(v => disponibilidade(v).codigo === 'disponivel') ? 2 : 0) + (p.variants.some(v => v.imageTipo === 'catalogo') ? 1 : 0);
function buscar(lista, busca) { const r = lista.filter(p => bateBusca(p, busca)); return busca ? r.sort((a, b) => noNome(b, busca) - noNome(a, busca) || pontos(b) - pontos(a)) : r; }
function destaques(lista, n) {
  const porCat = categoriasVisiveis.map(c => lista.filter(p => p.category === c.id).sort((a, b) => pontos(b) - pontos(a))).filter(l => l.length);
  const out = []; for (let i = 0; out.length < n && porCat.some(l => l[i]); i++) for (const l of porCat) if (l[i] && out.length < n) out.push(l[i]);
  return out;
}
function sugestoes(input) {
  const form = input.closest('[data-search-form]'); let box = form.querySelector('.search-suggest');
  const busca = input.value.trim();
  if (termos(busca).length === 0) { box?.remove(); return; }
  if (!box) { box = document.createElement('div'); box.className = 'search-suggest'; box.id = 'search-suggest'; form.append(box); input.setAttribute('aria-controls', box.id); }
  const achados = buscar(catalogo.filter(naVitrine), busca);
  box.innerHTML = achados.length ? achados.slice(0, 6).map(p => { const v = p.variants[0]; return '<a href="#/produto/' + p.id + '?cor=' + v.id + '"><img src="' + v.image + '" alt="" width="56" height="56" loading="lazy"><span><b>' + esc(p.name) + '</b><small>' + categoryName(p.category) + (p.variants.length > 1 ? ' · ' + p.variants.length + ' opções' : '') + '</small></span></a>'; }).join('') +
    '<a class="suggest-all" href="#/catalogo?busca=' + encodeURIComponent(busca) + '">Ver ' + (achados.length === 1 ? 'o resultado' : 'os ' + achados.length + ' resultados') + ' para “' + esc(busca) + '” ' + icon('arrow') + '</a>'
    : '<p class="suggest-empty">Nada encontrado para “' + esc(busca) + '”.</p><button type="button" class="suggest-all" data-wa-text="' + esc('Olá! Procurei no site por "' + busca + '" e não encontrei. Vocês têm?') + '">Perguntar à loja pelo WhatsApp ' + icon('whatsapp') + '</button>';
}

// ---------- páginas ----------
function home() {
  const camp = campanhaVisivel();
  const ofertas = catalogo.filter(p => p.variants.some(v => v.precoDe && v.preco != null && v.precoDe > v.preco));
  const vitrine = catalogo.filter(naVitrine);
  const conta = id => vitrine.filter(p => p.category === id).length;
  main.innerHTML = '<section class="home-search orbita"><div class="orbita-selo" aria-hidden="true"><img src="assets/simbolo.jpg" alt="" width="256" height="256"></div><div class="orbita-conteudo"><p class="eyebrow">MÓVEIS & ELETROS EM LAGOA DO OURO – PE</p><h2 class="home-title"><span class="sr-only">O que você procura para a sua casa?</span><span aria-hidden="true">O que você procura<br>para a sua <em data-roda="casa?|sala?|cozinha?|quarto?|varanda?">casa?</em></span></h2>' + searchForm() +
  '<nav class="category-chips" aria-label="Categorias">' + categoriasVisiveis.map(c => '<a href="#/catalogo?categoria=' + c.id + '">' + c.name + ' <small>' + conta(c.id) + '</small></a>').join('') + '</nav>' +
  '<div class="orbita-numeros"><span><b data-conta="' + vitrine.length + '">' + vitrine.length + '</b> produtos no catálogo</span><span><b data-conta="' + categoriasVisiveis.length + '">' + categoriasVisiveis.length + '</b> ambientes</span><span><b>WhatsApp</b> preço, entrega e disponibilidade</span></div></div></section>' +
  '<div class="faixa" aria-hidden="true"><div class="faixa-trilho">' + [0, 1].map(() => '<span>' + categoriasVisiveis.map(c => c.name).concat(['Compra pelo WhatsApp', 'Lagoa do Ouro – PE', camp?.fase === 'ativa' ? esc(camp.nome) : 'Uma casa com a sua essência']).map(t => '<i>' + t + '</i>').join('<em>✦</em>') + '<em>✦</em></span>').join('') + '</div></div>' + campaignBanner(camp) +
  (ofertas.length ? '<section class="section offers"><div class="section-heading"><div><p class="eyebrow">' + (camp?.fase === 'ativa' ? esc(camp.nome).toUpperCase() + ' · ATÉ ' + dataCurta(camp.fim) : 'OFERTAS VIGENTES') + '</p><h2>Ofertas<br><em>de agora.</em></h2></div><a class="text-link" href="#/promocoes">Ver todas as ofertas ' + icon('arrow') + '</a></div><div class="product-grid home-grid">' + ofertas.slice(0, 4).map(card).join('') + '</div></section>' : '') +
  '<div class="banda-escura"><section class="section home-rooms"><div class="section-heading"><div><p class="eyebrow">NAVEGUE POR AMBIENTE</p><h2>Escolha o <em>ambiente.</em></h2></div><a class="text-link" href="#/catalogo">Ver todos os produtos ' + icon('arrow') + '</a></div><div class="room-grid">' +
  categoriasVisiveis.map(c => '<a class="room-tile" href="#/catalogo?categoria=' + c.id + '"><img src="' + c.image + '" alt="" loading="lazy" decoding="async" width="640" height="480"><span><b>' + c.name + '</b><small>' + conta(c.id) + ' produtos</small></span></a>').join('') + '</div></section></div>' +
  '<section class="section selection"><div class="section-heading"><div><p class="eyebrow">DESTAQUES DA LOJA</p><h2>Peças que fazem<br><em>a diferença.</em></h2></div><a class="text-link" href="#/catalogo">Ver catálogo completo ' + icon('arrow') + '</a></div><div class="product-grid home-grid">' + destaques(vitrine, 8).map(card).join('') + '</div><div class="home-more"><a class="button dark" href="#/catalogo">Ver os ' + vitrine.length + ' produtos ' + icon('arrow') + '</a></div></section>' +
  '<section class="editorial-hero"><div class="hero-slides">' +
  [{img: 'assets/jantar.jpg', title: 'Para reunir.<br>Para viver.<br><em>Para ser seu.</em>', label: 'ENCONTROS QUE VIRAM MEMÓRIAS', category: 'jantar', item: 'Sala de jantar'},
   {img: 'assets/sofa.jpg', title: 'O melhor lugar<br>do mundo?<br><em>A sua casa.</em>', label: 'CONFORTO EM CADA DETALHE', category: 'estofados', item: 'Estofados'},
   {img: 'assets/quarto.jpg', title: 'Desacelere.<br>Seu descanso<br><em>começa aqui.</em>', label: 'SEU REFÚGIO PARTICULAR', category: 'quarto', item: 'Quarto'}].map((s, i) => '<article class="hero-slide ' + (i === 0 ? 'active' : '') + '" aria-hidden="' + (i !== 0) + '"><img src="' + s.img + '" alt="' + s.item + ' (ambientação ilustrativa)" width="1536" height="1024" loading="lazy"><div class="hero-scrim"></div><div class="hero-copy"><p class="eyebrow">' + s.label + '</p><h1>' + s.title + '</h1><p>Móveis, eletros e escolhas que fazem<br>a casa ter a sua essência.</p><a class="button gold" href="#/catalogo?categoria=' + s.category + '" ' + (i ? 'tabindex="-1"' : '') + '>Ver ' + s.item.toLowerCase() + ' ' + icon('arrow') + '</a></div></article>').join('') +
  '</div><div class="hero-bottom"><span>CONCEIÇÃO · MÓVEIS & ELETROS</span><div class="hero-controls"><button data-hero-prev class="icon-button" aria-label="Ambiente anterior">' + icon('arrow') + '</button><span id="slide-number" aria-live="polite">01 / 03</span><button data-hero-next class="icon-button" aria-label="Próximo ambiente">' + icon('arrow') + '</button><button data-hero-pause aria-label="Pausar apresentação" class="pause-button">Pausar</button></div></div></section>' +
  '<section class="manifesto"><p class="eyebrow">A NOSSA LOJA</p><p class="manifesto-texto" data-manifesto>Uma casa com a sua essência começa por uma boa conversa. Aqui você vê de perto, escolhe a cor, confere a medida e leva para casa o móvel que combina com a sua família.</p></section>' +
  '<section class="process section"><div class="section-heading"><div><p class="eyebrow">DO PRIMEIRO OLHAR À SUA CASA</p><h2>Escolha com calma.<br><em>Compre do seu jeito.</em></h2></div></div><div class="process-grid"><article><span>01</span><h3>Encontre o produto</h3><p>Busque pelo nome ou navegue pelos ambientes. Veja fotos, cores e opções.</p></article><article><span>02</span><h3>Monte o seu pedido</h3><p>Escolha cor, tamanho e quantidade e adicione ao pedido.</p></article><article><span>03</span><h3>Finalize no WhatsApp</h3><p>A loja confirma preço, entrega e pagamento' + (pagamentoAtivo ? ', ou pague online com Pix ou cartão' : '') + '.</p></article></div><button class="button whatsapp-button process-wa" data-wa-text="Olá! Vim pelo site da loja e gostaria de atendimento.">' + icon('whatsapp') + ' Falar com a loja agora</button></section>' +
  '<section class="vip-banner"><div><p class="eyebrow">FIQUE POR DENTRO, EM PRIMEIRA MÃO</p><h2>Um lugar na nossa<br><em>lista de novidades.</em></h2><p>Entre no grupo VIP e acompanhe o que chega à loja.</p></div><a class="button gold" href="' + loja.grupoVip + '" target="_blank" rel="noopener">Entrar no grupo VIP ' + icon('whatsapp') + '</a><span class="vip-monogram" aria-hidden="true">C</span></section>' +
  '<section class="store-teaser section"><img src="assets/logo.jpg" width="1254" height="1254" alt="Logo oficial Nossa Senhora da Conceição" loading="lazy"><div><p class="eyebrow">DE LAGOA DO OURO, PARA A SUA CASA</p><h2>Prazer,<br><em>Conceição.</em></h2><p>Na nossa loja, sua escolha começa com uma boa conversa. Conheça os detalhes de perto e descubra possibilidades para o seu lar.</p><a class="text-link" href="#/loja">Conheça a loja e venha nos visitar ' + icon('arrow') + '</a></div></section>';
  heroIndex = 0; heroPaused = economia; setHeroPause(); startHero();
}
function setHero(index) {
  const slides = $$('.hero-slide'); if (!slides.length) return; heroIndex = (index + slides.length) % slides.length;
  slides.forEach((el, i) => { el.classList.toggle('active', i === heroIndex); el.setAttribute('aria-hidden', String(i !== heroIndex)); $$('a', el).forEach(a => a.tabIndex = i === heroIndex ? 0 : -1); });
  $('#slide-number').textContent = String(heroIndex + 1).padStart(2, '0') + ' / 03';
}
function startHero() { clearInterval(heroTimer); if (!heroPaused) heroTimer = setInterval(() => { if (!document.hidden && !$('.editorial-hero')?.contains(document.activeElement)) setHero(heroIndex + 1); }, 7000); }
function setHeroPause() { const btn = $('[data-hero-pause]'); if (btn) { btn.textContent = heroPaused ? 'Reproduzir' : 'Pausar'; btn.setAttribute('aria-label', heroPaused ? 'Reproduzir apresentação' : 'Pausar apresentação'); } }

// Catálogo e filtros
let filtro = {categoria: 'todos', busca: '', ordem: 'destaques', disponiveis: false, attrs: {}, lista: 'catalogo'};
const valorAttr = (v, chave) => v.atributos?.[chave];
const nomesFiltro = {acabamento: 'Cor / acabamento', tamanho: 'Tamanho', densidade: 'Densidade', lugares: 'Lugares', voltagem: 'Voltagem', tipo: 'Tipo', tecnologia: 'Tecnologia'};
function baseLista() { return filtro.lista === 'ofertas' ? catalogo.filter(p => p.variants.some(v => v.precoDe && v.preco != null && v.precoDe > v.preco)) : catalogo.filter(naVitrine); }
function catalog(params = new URLSearchParams(), lista = 'catalogo') {
  filtro = {categoria: categories.some(c => c.id === params.get('categoria')) ? params.get('categoria') : 'todos', busca: params.get('busca') || '', ordem: 'destaques', disponiveis: false, attrs: {}, lista};
  const ofertas = lista === 'ofertas', camp = campanhaVisivel();
  main.innerHTML = '<section class="catalog-heading"><div class="crumb"><a href="#/">Início</a><span>/</span><span>' + (ofertas ? 'Ofertas' : 'Catálogo') + '</span></div><div class="catalog-title"><div><p class="eyebrow">' + (ofertas ? 'OFERTAS VIGENTES' : 'ESCOLHAS PARA TODOS OS AMBIENTES') + '</p><h1>' + (ofertas ? 'Boas escolhas.<br><em>Bons preços.</em>' : 'Seu lar, <em>do seu jeito.</em>') + '</h1></div><p>' + (ofertas ? 'Somente ofertas confirmadas pela loja, com período definido.' : 'Explore os produtos, confira medidas e cores e compre pelo WhatsApp' + (pagamentoAtivo ? ' ou online' : '') + '.') + '</p></div></section>' + (ofertas ? campaignBanner(camp) : '') +
  '<section class="catalog-layout section"><aside class="catalog-sidebar"><span class="eyebrow">NAVEGUE POR AMBIENTE</span><div class="category-filters">' + ['todos', ...categoriasVisiveis.map(c => c.id)].map(id => '<button data-category="' + id + '" aria-pressed="' + (filtro.categoria === id) + '">' + (id === 'todos' ? 'Todos os produtos' : categoryName(id)) + '<span>' + baseLista().filter(p => id === 'todos' || p.category === id).length + '</span></button>').join('') + '</div><div class="sidebar-help"><p>Uma ajudinha<br>na escolha?</p><a href="' + loja.whatsapp + '" target="_blank" rel="noopener">Fale com a equipe ' + icon('diagonal') + '</a></div></aside>' +
  '<div class="catalog-results"><div class="catalog-toolbar"><label class="search-field">' + icon('search') + '<input id="catalog-search" type="search" placeholder="Nome, ambiente, cor ou código" aria-label="Buscar no catálogo" value="' + esc(filtro.busca) + '"></label><label class="sort-field"><span>Ordenar</span><select id="catalog-sort" aria-label="Ordenar produtos"><option value="destaques">Destaques</option>' + (comPreco ? '<option value="menor">Menor preço</option><option value="maior">Maior preço</option>' : '') + '<option value="az">Nome: A a Z</option></select></label></div><div id="facet-area"></div><div class="results-heading"><h2 id="category-title"></h2><span id="result-count" role="status" aria-live="polite"></span></div><div class="product-grid" id="catalog-grid"></div><p class="catalog-note">Fotos oficiais dos fabricantes conferidas modelo a modelo com o estoque da loja. Onde não há foto oficial, usamos uma imagem ilustrativa de produto parecido, sempre identificada: confirme detalhes, cor e medidas pelo WhatsApp.</p></div></section>';
  renderFacets(); renderResults();
  if (params.has('busca')) $('#catalog-search').focus({preventScroll: true});
}
function renderFacets() {
  const area = $('#facet-area'); if (!area) return;
  const cat = categories.find(c => c.id === filtro.categoria);
  const lista = baseLista().filter(p => filtro.categoria === 'todos' || p.category === filtro.categoria);
  const grupos = (cat?.filtros || []).map(chave => ({chave, valores: [...new Set(lista.flatMap(p => p.variants.map(v => valorAttr(v, chave))).filter(Boolean))]})).filter(g => g.valores.length > 1);
  const temEstoque = lista.some(p => p.variants.some(v => v.estoque != null));
  area.innerHTML = (grupos.length || temEstoque) ? '<div class="facets">' + (temEstoque ? '<label class="facet-check"><input type="checkbox" data-only-available ' + (filtro.disponiveis ? 'checked' : '') + '> Somente disponíveis</label>' : '') +
    grupos.map(g => '<fieldset class="facet"><legend>' + (nomesFiltro[g.chave] || g.chave) + '</legend>' + g.valores.map(val => '<button type="button" class="chip" data-facet="' + esc(g.chave) + '" data-value="' + esc(val) + '" aria-pressed="' + (filtro.attrs[g.chave] === val) + '">' + esc(val) + '</button>').join('') + '</fieldset>').join('') + '</div>' : '';
}
function renderResults() {
  let list = buscar(baseLista(), filtro.busca).filter(p => (filtro.categoria === 'todos' || p.category === filtro.categoria) &&
    p.variants.some(v => (!filtro.disponiveis || disponibilidade(v).codigo === 'disponivel') && Object.entries(filtro.attrs).every(([k, val]) => valorAttr(v, k) === val)));
  const precoMin = p => Math.min(...p.variants.map(v => v.preco ?? Infinity));
  if (filtro.ordem === 'destaques' && !filtro.busca) list.sort((a, b) => pontos(b) - pontos(a));
  if (filtro.ordem === 'az') list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (filtro.ordem === 'menor') list.sort((a, b) => precoMin(a) - precoMin(b));
  if (filtro.ordem === 'maior') list.sort((a, b) => (precoMin(b) === Infinity ? -1 : precoMin(b)) - (precoMin(a) === Infinity ? -1 : precoMin(a)));
  $('#category-title').textContent = filtro.categoria === 'todos' ? (filtro.lista === 'ofertas' ? 'Todas as ofertas' : 'Todos os produtos') : categoryName(filtro.categoria);
  $('#result-count').textContent = list.length + ' ' + (list.length === 1 ? 'produto' : 'produtos');
  $('#catalog-grid').innerHTML = list.length ? list.map(card).join('') : '<div class="empty-state">' + icon('search') + '<h3>' + (filtro.lista === 'ofertas' && !filtro.busca ? 'Nenhuma oferta vigente agora.' : 'Não encontramos essa combinação.') + '</h3><p>' + (filtro.lista === 'ofertas' ? 'Novas ofertas são publicadas com período definido. Entre no grupo VIP para saber primeiro.' : 'Experimente outra palavra ou explore todos os ambientes.') + '</p><button class="button dark" data-clear-filters>Ver todos os produtos ' + icon('arrow') + '</button><a class="text-link" href="' + loja.whatsapp + '" target="_blank" rel="noopener">Pedir ajuda à loja ' + icon('whatsapp') + '</a></div>';
  observeReveals();
}
function syncCatalogUrl() { const params = new URLSearchParams(); if (filtro.categoria !== 'todos') params.set('categoria', filtro.categoria); if (filtro.busca) params.set('busca', filtro.busca); history.replaceState(null, '', '#/' + (filtro.lista === 'ofertas' ? 'promocoes' : 'catalogo') + (params.size ? '?' + params : '')); }

function campaignPage(c) {
  const fase = faseCampanha(c, agora());
  const itens = c.todosOsProdutos ? catalogo.filter(naVitrine).sort((a, b) => pontos(b) - pontos(a)) : catalogo.filter(p => p.variants.some(v => v.campanha === c.id));
  main.innerHTML = '<section class="campaign-hero"><div class="crumb"><a href="#/">Início</a><span>/</span><span>' + esc(c.nome) + '</span></div><p class="eyebrow">' + (fase === 'ativa' ? 'DE ' + dataCurta(c.inicio) + ' A ' + dataCurta(c.fim) : fase === 'encerrada' ? 'CAMPANHA ENCERRADA' : 'COMEÇA EM ' + dataCurta(c.inicio)) + '</p><h1>' + esc(c.nome) + '<br><em>Conceição.</em></h1><p>' + esc(c.chamada) + '</p></section>' +
  '<section class="section">' + (fase === 'ativa' && itens.length ? '<div class="product-grid">' + itens.map(card).join('') + '</div><p class="catalog-note">' + (c.todosOsProdutos ? 'Todos os produtos com preço de Black Friday até ' + dataCurta(c.fim) + ' ou enquanto durar o estoque. Consulte o preço pelo WhatsApp.' : 'Preços válidos de ' + dataCurta(c.inicio) + ' a ' + dataCurta(c.fim) + ' ou enquanto durar o estoque.') + (teste ? ' Na prévia, as ofertas são fictícias.' : '') + '</p>' :
   '<div class="empty-state"><h3>' + (fase === 'encerrada' ? 'A ' + esc(c.nome) + ' terminou.' : fase === 'ativa' ? 'As ofertas estão sendo publicadas.' : 'Ofertas a partir de ' + dataCurta(c.inicio) + '.') + '</h3><p>' + (fase === 'encerrada' ? 'Obrigado por visitar! O catálogo continua disponível.' : 'Entre no grupo VIP para receber as ofertas em primeira mão.') + '</p><a class="button dark" href="#/catalogo">Ver catálogo ' + icon('arrow') + '</a><a class="text-link" href="' + loja.grupoVip + '" target="_blank" rel="noopener">Entrar no grupo VIP ' + icon('whatsapp') + '</a></div>') + '</section>';
  document.title = c.nome + ' | Nossa Senhora da Conceição';
}

// Página de produto
function productPage(id, params) {
  const p = productById(id); if (!p) { notFound(); return; }
  currentProduct = p; selectedVariant = Math.max(0, p.variants.findIndex(v => v.id === params.get('cor'))); productQuantity = 1; photoIndex = 0;
  main.innerHTML = '<div class="product-breadcrumb crumb"><a href="#/">Início</a><span>/</span><a href="#/catalogo?categoria=' + p.category + '">' + categoryName(p.category) + '</a><span>/</span><span>' + esc(p.name) + '</span></div>' +
  '<section class="product-detail"><div class="product-gallery" id="gallery"></div>' +
  '<div class="product-info"><p class="eyebrow">' + categoryName(p.category) + ' <span>' + (p.fabricante ? esc(p.fabricante) : 'CÓD. ' + esc(p.ref)) + '</span></p><h1>' + esc(p.name) + '</h1>' +
  '<div id="buy-zone"></div>' +
  '<div class="product-accordions"><details open><summary>Sobre esta peça ' + icon('plus') + '</summary><p class="product-description">' + esc(p.description) + '</p><ul>' + p.details.map(d => '<li>' + esc(d) + '</li>').join('') + '</ul></details><details><summary>Entrega, retirada e pagamento ' + icon('plus') + '</summary><ul><li>' + esc(entrega.retirada.texto) + (entrega.retirada.confirmada ? '' : ' — condições a confirmar com a equipe') + '.</li><li>' + esc(entrega.domicilio.texto) + '.</li><li>' + (pagamentoAtivo ? 'Pagamento online por ' + pagamento.metodos.join(' ou ') + (teste ? ' (ambiente de testes)' : '') + ', ou combine pelo WhatsApp.' : 'Formas de pagamento combinadas pelo WhatsApp ou na loja.') + '</li></ul></details></div><a class="text-link visit-product" href="#/loja">' + icon('pin') + ' Prefere ver de perto? Visite a loja ' + icon('arrow') + '</a></div></section>' +
  '<div class="sticky-buy" id="sticky-buy"></div>' +
  '<section class="section related"><div class="section-heading"><div><p class="eyebrow">CONTINUE A SUA ESCOLHA</p><h2>Outras possibilidades<br><em>para a sua casa.</em></h2></div><a class="text-link" href="#/catalogo">Voltar ao catálogo ' + icon('arrow') + '</a></div><div class="product-grid home-grid">' + catalogo.filter(x => x.id !== p.id && !x.demo).slice(0, 4).map(card).join('') + '</div></section>';
  renderVariant();
  document.title = p.name + ' | Nossa Senhora da Conceição';
}
function renderGallery() {
  const p = currentProduct, v = p.variants[selectedVariant], fotos = galeria(p, v);
  photoIndex = Math.min(photoIndex, fotos.length - 1);
  $('#gallery').innerHTML = '<div class="gallery-track" id="gallery-track" tabindex="-1">' + fotos.map((f, i) => '<button class="main-product-photo" data-zoom="' + i + '" aria-label="Ampliar foto ' + (i + 1) + ' de ' + fotos.length + ': ' + esc(f.alt) + '"><img' + ((f.tipo === 'catalogo' || f.tipo === 'ilustrativa') ? ' class="foto-catalogo"' : '') + ' src="' + f.src + '" alt="' + esc(f.alt) + '" width="1536" height="1024" ' + (i ? 'loading="lazy"' : 'fetchpriority="high"') + ' decoding="async"><span>' + icon('plus') + ' Ampliar</span><em class="photo-kind">' + esc(f.rotulo) + '</em></button>').join('') + '</div>' +
    (fotos.length > 1 ? '<div class="photo-options" role="group" aria-label="Fotos do produto">' + fotos.map((f, i) => '<button data-photo="' + i + '" class="photo-thumbnail ' + (i === photoIndex ? 'selected' : '') + '" aria-label="Ver foto ' + (i + 1) + ': ' + esc(f.alt) + '" aria-pressed="' + (i === photoIndex) + '"><img src="' + f.src + '" alt="" width="120" height="80" loading="lazy"></button>').join('') + '<span class="photo-count" id="photo-count">' + (photoIndex + 1) + ' / ' + fotos.length + '</span></div>' : '') +
    (v.modelo3d ? '<button class="button light view-3d" data-view-3d>' + icon('plus') + ' Ver em 3D</button><div id="viewer-3d"></div>' : '');
  const track = $('#gallery-track');
  track.addEventListener('scroll', () => { const i = Math.round(track.scrollLeft / track.clientWidth); if (i !== photoIndex) { photoIndex = i; markPhoto(); } }, {passive: true});
}
function markPhoto() { $$('[data-photo]').forEach(b => { const on = Number(b.dataset.photo) === photoIndex; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); }); const c = $('#photo-count'); if (c) c.textContent = (photoIndex + 1) + ' / ' + $$('[data-photo]').length; }
function goPhoto(i) { const track = $('#gallery-track'); photoIndex = i; track.scrollTo({left: track.clientWidth * i, behavior: economia ? 'auto' : 'smooth'}); markPhoto(); }
function renderVariant() {
  const p = currentProduct, v = p.variants[selectedVariant], disp = disponibilidade(v), med = medidasTexto(v.medidas);
  renderGallery();
  $('#buy-zone').innerHTML = '<div class="product-pricing">' + precoHtml(v) + '<p class="availability ' + disp.codigo + '">' + esc(disp.texto) + '</p>' + (v.sku ? '<p class="store-code">Cód. loja <strong>' + esc(v.sku) + '</strong></p>' : '') + (v.preco == null && comPreco ? '<p class="missing">Falta confirmar: preço' + (v.estoque == null ? ' e disponibilidade' : '') + '. Pergunte pelo WhatsApp que a equipe calcula para você.</p>' : '') + '</div>' +
  '<fieldset class="variant-field"><legend>' + (p.variants.some(x => x.color !== '#d9d2c5') ? (p.variants.length > 1 ? 'Escolha a cor' : 'Cor / acabamento') : (p.variants.length > 1 ? 'Escolha a opção' : 'Opção')) + ' <strong id="chosen-color">' + esc(v.name) + '</strong></legend><div class="swatches">' + p.variants.map((item, i) => '<button type="button" data-variant="' + i + '" style="--swatch:' + item.color + '" class="swatch ' + (i === selectedVariant ? 'selected' : '') + (item.color === '#d9d2c5' ? ' sem-cor' : '') + '" aria-label="' + esc(item.name) + (item.demo ? ' — simulação' : '') + (disponibilidade(item).codigo === 'esgotado' ? ' — esgotado' : '') + '" aria-pressed="' + (i === selectedVariant) + '"><span></span><small>' + esc(item.name) + '</small></button>').join('') + '</div>' + (v.demo ? '<p class="variant-notice">Cor simulada com IA. Disponibilidade não confirmada.</p>' : '') + '</fieldset>' +
  '<div class="product-buy"><div class="quantity-control"><button data-quantity="-1" aria-label="Diminuir quantidade">' + icon('minus') + '</button><output id="product-quantity" aria-live="polite">' + productQuantity + '</output><button data-quantity="1" aria-label="Aumentar quantidade">' + icon('plus') + '</button></div><button class="button dark add-product" data-add-product ' + (disp.codigo === 'esgotado' ? 'disabled' : '') + '>' + icon('bag') + (disp.codigo === 'esgotado' ? ' Esgotado' : v.preco == null ? ' Adicionar ao pedido' : ' Comprar') + '</button></div>' +
  '<button class="button whatsapp-button" data-ask-product>' + icon('whatsapp') + ' Perguntar sobre este produto</button>' +
  '<div class="measures"><h2>Medidas</h2>' + (med ? '<dl><div><dt>Largura</dt><dd>' + v.medidas.largura + ' cm</dd></div><div><dt>Altura</dt><dd>' + v.medidas.altura + ' cm</dd></div><div><dt>Profundidade</dt><dd>' + v.medidas.profundidade + ' cm</dd></div></dl>' + (teste && v.valoresTeste ? '<p class="test-flag">Medidas de teste</p>' : '') +
    '<details class="fit-check"><summary>Será que cabe no meu espaço?</summary><form data-fit><p>Meça o espaço livre onde o móvel vai ficar.</p><div class="fit-fields"><label>Largura livre (cm)<input name="largura" type="number" inputmode="numeric" min="1" max="2000" required></label><label>Profundidade livre (cm)<input name="profundidade" type="number" inputmode="numeric" min="1" max="2000" required></label><label>Altura livre (cm) <small>opcional</small><input name="altura" type="number" inputmode="numeric" min="1" max="2000"></label></div><button class="button dark" type="submit">Conferir</button><p id="fit-result" role="status" aria-live="polite"></p></form></details>'
    : '<p class="missing">Medidas (largura, altura e profundidade) ainda não confirmadas pela loja. Pergunte pelo WhatsApp antes de comprar.</p>') + '</div>';
  $('#sticky-buy').innerHTML = '<div><strong>' + (v.preco == null ? (blackGeral() ? 'Preço de Black' : 'Sob consulta') : reais(v.preco)) + '</strong><small>' + esc(v.name) + '</small></div><button class="icon-button" data-ask-product aria-label="Perguntar sobre este produto no WhatsApp">' + icon('whatsapp') + '</button><button class="button dark" data-add-product ' + (disp.codigo === 'esgotado' ? 'disabled' : '') + '>' + (disp.codigo === 'esgotado' ? 'Esgotado' : comPreco ? 'Comprar' : 'Adicionar') + '</button>';
}
function chooseVariant(index) {
  if (!currentProduct?.variants[index]) return; selectedVariant = index; photoIndex = 0;
  const active = document.activeElement?.dataset?.variant;
  renderVariant();
  history.replaceState(null, '', '#/produto/' + currentProduct.id + '?cor=' + currentProduct.variants[index].id);
  if (active !== undefined) $('[data-variant="' + index + '"]')?.focus();
}
function checkFit(form) {
  const v = currentProduct.variants[selectedVariant], m = v.medidas, f = new FormData(form);
  const L = Number(f.get('largura')), P = Number(f.get('profundidade')), A = Number(f.get('altura')) || null;
  const folga = 5, falta = [];
  if (L < m.largura + folga) falta.push('largura (precisa de ' + (m.largura + folga) + ' cm com folga, você tem ' + L + ' cm)');
  if (P < m.profundidade + folga) falta.push('profundidade (precisa de ' + (m.profundidade + folga) + ' cm, você tem ' + P + ' cm)');
  if (A && A < m.altura) falta.push('altura (precisa de ' + m.altura + ' cm, você tem ' + A + ' cm)');
  const r = $('#fit-result');
  r.className = falta.length ? 'fit-no' : 'fit-ok';
  r.textContent = falta.length ? 'Não cabe com folga: ' + falta.join('; ') + '.' : 'Cabe! Sobram ' + (L - m.largura) + ' cm de largura e ' + (P - m.profundidade) + ' cm de profundidade. Lembre de conferir portas e passagens até o cômodo.';
}
async function open3d() {
  const v = currentProduct.variants[selectedVariant];
  if (!customElements.get('model-viewer')) { const s = document.createElement('script'); s.type = 'module'; s.src = 'https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js'; document.head.append(s); }
  $('#viewer-3d').innerHTML = '<model-viewer src="' + esc(v.modelo3d) + '" camera-controls ar alt="Modelo 3D de ' + esc(currentProduct.name) + '" style="width:100%;height:360px;background:#eee8df"></model-viewer>';
}

function storePage() {
  main.innerHTML = '<section class="store-page section"><div class="crumb"><a href="#/">Início</a><span>/</span><span>Contato e loja</span></div><div class="store-intro"><div><p class="eyebrow">NOSSA SENHORA DA CONCEIÇÃO</p><h1>De perto,<br><em>é ainda melhor.</em></h1><p>Uma boa escolha tem conversa, cuidado e atenção aos detalhes. Visite nossa loja para conhecer móveis e eletros para cada canto da sua casa.</p><a class="button whatsapp-button" href="' + loja.whatsapp + '" target="_blank" rel="noopener">' + icon('whatsapp') + ' Conversar no WhatsApp</a><span class="signature">Paulo e Joanny <small>À FRENTE DA NOSSA LOJA</small></span></div><img src="assets/logo.jpg" alt="Logo oficial Nossa Senhora da Conceição" width="1254" height="1254"></div><div class="store-information"><article>' + icon('pin') + '<p class="eyebrow">ENDEREÇO</p><h2>' + loja.enderecoLinhas[0].replace(', ', ',<br>') + '</h2><p>' + loja.enderecoLinhas.slice(1).join('<br>') + '</p><a class="button dark" href="' + loja.mapa + '" target="_blank" rel="noopener">Abrir localização ' + icon('diagonal') + '</a></article><article>' + icon('clock') + '<p class="eyebrow">HORÁRIOS</p><h2>Segunda<br>a sábado</h2><p>' + loja.horarios.join('<br>') + '</p><a class="text-link" href="' + loja.whatsapp + '" target="_blank" rel="noopener">Conversar com a loja ' + icon('whatsapp') + '</a></article></div></section>' +
  '<section class="social-section section"><p class="eyebrow">NOS ENCONTRE TAMBÉM POR AQUI</p><h2>Inspiração que<br><em>acompanha você.</em></h2><div><a href="' + loja.instagram + '" target="_blank" rel="noopener">' + icon('instagram') + '<span><small>NO INSTAGRAM</small>@lojanossasra.daconceicao</span>' + icon('diagonal') + '</a><a href="' + loja.grupoVip + '" target="_blank" rel="noopener">' + icon('whatsapp') + '<span><small>NO WHATSAPP</small>Entre no grupo VIP</span>' + icon('diagonal') + '</a></div></section>';
}
function notFound() { main.innerHTML = '<section class="section empty-state"><h1>Vamos encontrar<br>uma nova inspiração?</h1><p>Este produto ou endereço não está no catálogo.</p><a class="button dark" href="#/catalogo">Explorar produtos ' + icon('arrow') + '</a></section>'; }

// ---------- WhatsApp: sempre revisável antes de abrir ----------
function openWhatsapp(texto, titulo) {
  lastFocus = document.activeElement;
  $('#wa-title').textContent = titulo;
  $('#wa-text').value = texto;
  $('#wa-open').href = linkWhatsapp(texto);
  waDialog.showModal(); document.body.classList.add('dialog-open');
}

// ---------- Carrinho ----------
function addProduct() {
  const v = currentProduct.variants[selectedVariant];
  if (disponibilidade(v).codigo === 'esgotado') return;
  const existing = cart.find(i => i.id === currentProduct.id && i.variant === v.id);
  if (existing) existing.qty = Math.min(99, existing.qty + productQuantity); else cart.push({id: currentProduct.id, variant: v.id, qty: productQuantity});
  const item = existing || cart[cart.length - 1];
  if (v.preco != null) { item.precoVisto = v.preco; item.aceito = false; }
  saveCart(); toast(currentProduct.name + ' (' + v.name + ') adicionado ao carrinho.'); openCart();
}
function cotacaoAtual() {
  // Preços aceitos após conferência com o servidor substituem o valor da vitrine para o cliente ver o que será cobrado.
  const aceitos = Object.fromEntries(cart.filter(i => i.aceito && i.precoVisto != null).map(i => [i.id + '/' + i.variant, {preco: i.precoVisto}]));
  const base = Object.keys(aceitos).length ? montarCatalogo({modo, agora: agora(), ajustes: aceitos}) : catalogo;
  return cotar(base, cart.map(i => ({id: i.id, variant: i.variant, qty: i.qty})), entregaTipo, cidadeEntrega);
}
function openCart() { lastFocus = document.activeElement; renderCart(); cartDialog.showModal(); document.body.classList.add('dialog-open'); }
const motivo = pr => ({'sem-preco': pr.nome + ': preço a consultar', esgotado: pr.nome + ': esgotado', 'estoque-insuficiente': pr.nome + ': só ' + pr.disponivel + ' em estoque', 'estoque-sob-consulta': pr.nome + ': disponibilidade a confirmar', 'frete-cotacao': 'Entrega no endereço: o frete precisa ser cotado pelo atendimento antes do pagamento', invalido: 'Item indisponível'}[pr.tipo]);
function renderCart() {
  const priorNotes = $('#cart-notes')?.value || '';
  if (!cart.length) { $('#cart-content').innerHTML = '<div class="empty-cart">' + icon('bag') + '<h3>Seu carrinho<br>está vazio.</h3><p>Explore o catálogo e adicione os produtos que mais combinam com você.</p><a href="#/catalogo" class="button dark" data-close-cart>Explorar produtos ' + icon('arrow') + '</a></div>'; return; }
  const c = cotacaoAtual();
  $('#cart-content').innerHTML = (teste && comPreco ? '<p class="cart-intro test-flag">Prévia de testes: valores fictícios.</p>' : '') + '<div class="cart-items">' + c.linhas.map((l, index) =>
    '<article class="cart-item"><img src="' + l.v.image + '" alt="" width="144" height="120"><div><span class="eyebrow">' + esc(l.p.ref) + '</span><h3>' + esc(l.p.name) + '</h3><p>' + esc(l.v.name) + (l.p.demo || l.v.demo ? ' · Demonstração' : '') + '</p><p class="cart-price">' + (l.unit == null ? 'Preço sob consulta' : l.qtd + ' × ' + reais(l.unit) + ' = <strong>' + reais(l.total) + '</strong>') + '</p><div class="cart-item-actions"><div class="quantity-control"><button data-cart-step="-1" data-index="' + index + '" aria-label="Diminuir quantidade de ' + esc(l.p.name) + '">' + icon('minus') + '</button><output aria-label="Quantidade">' + l.qtd + '</output><button data-cart-step="1" data-index="' + index + '" aria-label="Aumentar quantidade de ' + esc(l.p.name) + '">' + icon('plus') + '</button></div><button class="remove-item" data-remove="' + index + '" aria-label="Remover ' + esc(l.p.name) + '">Remover</button></div></div></article>').join('') + '</div>' +
  '<div class="cart-summary"><fieldset class="delivery-choice"><legend>Como prefere receber?</legend><label><input type="radio" name="entrega" value="retirada" ' + (entregaTipo === 'retirada' ? 'checked' : '') + '> Retirar na loja <small>' + (entrega.retirada.confirmada ? 'sem custo' : 'sem frete · a confirmar') + '</small></label><label><input type="radio" name="entrega" value="domicilio" ' + (entregaTipo === 'domicilio' ? 'checked' : '') + '> Entrega no meu endereço <small>' + ((entrega.domicilio.gratisPara || []).length ? 'grátis em cidades próximas' : 'frete a calcular') + '</small></label>' + (entregaTipo === 'domicilio' && (entrega.domicilio.gratisPara || []).length ? '<label class="city-select">Cidade <select name="cidade"><option value="">Outra cidade (frete a calcular)</option>' + entrega.domicilio.gratisPara.map(c => '<option ' + (c === cidadeEntrega ? 'selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></label>' : '') + '</fieldset>' +
  (!comPreco ? '<dl class="totals"><div><dt>Frete</dt><dd>' + esc(c.frete.situacao) + '</dd></div><div class="grand"><dt>Preços</dt><dd>enviados pela equipe</dd></div></dl>' : '') + (comPreco ? '<dl class="totals"><div><dt>Subtotal</dt><dd>' + reais(c.subtotal) + (c.semPreco ? ' <small>+ ' + c.semPreco + ' a consultar</small>' : '') + '</dd></div><div><dt>Frete</dt><dd>' + esc(c.frete.situacao) + '</dd></div><div class="grand"><dt>Total</dt><dd>' + (c.total == null ? 'a confirmar' : reais(c.total)) + '</dd></div></dl>' : '') +
  '<label for="cart-notes">Observação (opcional)</label><textarea id="cart-notes" maxlength="600" rows="2" placeholder="Ex.: bairro para entrega, melhor horário.">' + esc(priorNotes) + '</textarea>' +
  '<label for="cart-message" class="review-label">Revise a mensagem antes de enviar</label><textarea id="cart-message" rows="8" maxlength="3000"></textarea>' +
  '<a id="send-whatsapp" class="button whatsapp-button" target="_blank" rel="noopener" href="#">' + icon('whatsapp') + ' Enviar pedido pelo WhatsApp</a>' +
  (pagamentoAtivo ? (c.podePagar ? '<a class="button dark" href="#/checkout" data-close-cart>Pagar online · Pix ou cartão' + (teste ? ' (teste)' : '') + '</a>' : '<div class="pay-blocked"><strong>Pagamento online indisponível para este pedido:</strong><ul>' + c.problemas.map(motivo).filter(Boolean).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul><p>Envie pelo WhatsApp para a equipe confirmar.</p></div>') : '') +
  '<p class="cart-disclaimer">O WhatsApp abrirá com a mensagem acima. Nada é enviado até você tocar em enviar no WhatsApp.</p><button class="text-link continue-shopping" data-close-cart>Continuar comprando ' + icon('arrow') + '</button></div>';
  updateMessage();
}
function updateMessage() {
  if (!cart.length) return;
  const msg = mensagemPedido({cotacao: cotacaoAtual(), modo, observacao: $('#cart-notes')?.value || ''});
  $('#cart-message').value = msg; $('#send-whatsapp').href = linkWhatsapp(msg);
}

// ---------- Pagamento ----------
const api = {
  remoto: null, nucleoLocal: null,
  async detectar() {
    if (this.remoto !== null) return this.remoto;
    try { const r = await fetch('api/saude', {cache: 'no-store'}); this.remoto = r.ok && (await r.json()).ok === true; } catch { this.remoto = false; }
    return this.remoto;
  },
  async local() {
    if (this.nucleoLocal) return this.nucleoLocal;
    const {criarNucleo} = await import('./loja/pedidos.js?v=10');
    this.nucleoLocal = criarNucleo({modo: 'teste', segredo: 'simulacao-no-navegador-0001',
      armazenamento: {async ler() { return ls.get('conceicao-simulacao-pagamentos', null); }, async gravar(s) { ls.set('conceicao-simulacao-pagamentos', s); }},
      provedor: {async criarCobranca(p) { return {url: '#/pagamento-teste/' + p.id, referencia: 'simulado'}; }}});
    return this.nucleoLocal;
  },
  async criarPedido(dados) {
    if (await this.detectar()) { const r = await fetch('api/pedidos', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(dados)}); return r.json(); }
    return (await this.local()).criarPedido(dados);
  },
  async consultar(id) {
    if (await this.detectar()) { const r = await fetch('api/pedidos/' + encodeURIComponent(id), {cache: 'no-store'}); return r.ok ? (await r.json()).pedido : null; }
    return (await this.local()).consultar(id);
  },
  async ajustar(dados) {
    if (await this.detectar()) return (await fetch('api/teste/ajuste', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(dados)})).json();
    return (await this.local()).ajustarTeste(dados);
  }
};
function chavePedido() {
  const assinatura = JSON.stringify([cart, entregaTipo, cidadeEntrega]);
  let s = ls.get('conceicao-chave-pedido', null);
  if (!s || s.assinatura !== assinatura) { s = {assinatura, chave: 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)}; ls.set('conceicao-chave-pedido', s); }
  return s.chave;
}
function checkoutPage() {
  if (!pagamentoAtivo) { notFound(); return; }
  if (!cart.length) { main.innerHTML = '<section class="section empty-state"><h1>Seu carrinho está vazio.</h1><a class="button dark" href="#/catalogo">Explorar produtos ' + icon('arrow') + '</a></section>'; return; }
  const c = cotacaoAtual();
  main.innerHTML = '<section class="section checkout"><div class="crumb"><a href="#/">Início</a><span>/</span><span>Pagamento</span></div><h1>Revise e pague</h1>' + (teste ? '<p class="test-flag">Ambiente de testes: nenhuma cobrança real será feita.</p>' : '') +
  '<ul class="checkout-lines">' + c.linhas.map(l => '<li><span>' + l.qtd + ' × ' + esc(l.p.name) + ' · ' + esc(l.v.name) + '</span><strong>' + (l.total == null ? 'a consultar' : reais(l.total)) + '</strong></li>').join('') + '</ul>' +
  '<dl class="totals"><div><dt>Subtotal</dt><dd>' + reais(c.subtotal) + '</dd></div><div><dt>Frete (' + (c.frete.tipo === 'retirada' ? 'retirada na loja' : 'entrega') + ')</dt><dd>' + esc(c.frete.situacao) + '</dd></div><div class="grand"><dt>Total a pagar</dt><dd>' + (c.total == null ? 'a confirmar' : reais(c.total)) + '</dd></div></dl>' +
  '<div id="checkout-alert" role="alert"></div>' +
  (c.podePagar ? '<button class="button dark" data-start-payment>Ir para o pagamento seguro · ' + pagamento.metodos.join(' ou ') + '</button><p class="cart-disclaimer">Você será levado ao ambiente do provedor de pagamento. O valor é conferido novamente com o estoque e os preços da loja antes da cobrança.</p>' :
    '<div class="pay-blocked"><ul>' + c.problemas.map(motivo).filter(Boolean).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div><button class="button whatsapp-button" data-open-cart>' + icon('whatsapp') + ' Enviar pelo WhatsApp</button>') + '</section>';
  document.title = 'Pagamento | Nossa Senhora da Conceição';
}
async function startPayment(btn) {
  btn.disabled = true; btn.textContent = 'Conferindo preços e estoque…';
  const itens = cart.map(i => ({id: i.id, variant: i.variant, qty: i.qty, precoVisto: i.precoVisto ?? productById(i.id)?.variants.find(v => v.id === i.variant)?.preco}));
  let r;
  try { r = await api.criarPedido({itens, entregaTipo, cidade: cidadeEntrega, chave: chavePedido(), dataTeste: teste ? ls.get('conceicao-data-teste', null) : undefined}); }
  catch { r = {ok: false, erro: 'rede'}; }
  if (r.ok) { ls.set('conceicao-ultimo-pedido', r.pedido.id); location.assign(r.checkoutUrl.startsWith('#') ? r.checkoutUrl : new URL(r.checkoutUrl, location.href).href); return; }
  btn.disabled = false; btn.textContent = 'Tentar novamente';
  const alerta = $('#checkout-alert');
  btn.hidden = r.erro === 'revisar';
  if (r.erro !== 'revisar') { alerta.innerHTML = '<p class="fit-no">Não foi possível iniciar o pagamento agora. Tente de novo ou envie o pedido pelo WhatsApp.</p>'; return; }
  alerta.innerHTML = '<div class="pay-blocked"><strong>Algo mudou antes do pagamento:</strong><ul>' + r.problemas.map(pr => '<li>' + esc(pr.tipo === 'preco-mudou' ? pr.nome + ': o preço mudou de ' + reais(pr.antes) + ' para ' + reais(pr.agora) : motivo(pr) || pr.tipo) + '</li>').join('') + '</ul>' +
    (r.problemas.every(pr => pr.tipo === 'preco-mudou') ? '<button class="button dark" data-accept-prices=\'' + esc(JSON.stringify(r.problemas.map(pr => [pr.id, pr.variant, pr.agora]))) + '\'>Aceitar novos preços e continuar</button>' : '<button class="button dark" data-open-cart>Ajustar carrinho</button>') + '</div>';
}
function acceptPrices(lista) {
  for (const [id, variant, preco] of lista) { const i = cart.find(x => x.id === id && x.variant === variant); if (i) { i.precoVisto = preco; i.aceito = true; } }
  saveCart(); route();
}
const textosStatus = {
  'aguardando-pagamento': ['Aguardando o pagamento', 'Assim que o provedor confirmar, esta página é atualizada.'],
  pendente: ['Pagamento pendente', 'O provedor ainda está processando (ex.: Pix gerado e não compensado). Não pague de novo: esta página atualiza sozinha.'],
  aprovado: ['Pagamento aprovado!', 'Obrigado! A loja vai falar com você pelo WhatsApp para combinar a retirada ou a entrega.'],
  recusado: ['Pagamento recusado', 'Nada foi cobrado. Tente outro meio de pagamento ou finalize pelo WhatsApp.'],
  cancelado: ['Pagamento cancelado', 'Nada foi cobrado. Seu carrinho continua salvo.']
};
async function orderPage(id) {
  main.innerHTML = '<section class="section order-status"><p>Consultando pedido…</p></section>';
  const p = await api.consultar(id);
  if (!p) { notFound(); return; }
  const [titulo, texto] = textosStatus[p.status];
  if (p.status === 'aprovado' && ls.get('conceicao-ultimo-pedido', null) === p.id) { cart = []; saveCart(); ls.del('conceicao-ultimo-pedido'); }
  if (['recusado', 'cancelado', 'aprovado'].includes(p.status)) ls.del('conceicao-chave-pedido'); // nova tentativa gera novo pedido
  const msg = 'Olá! Meu pedido no site é ' + p.id + ' (' + textosStatus[p.status][0].toLowerCase() + '). Total: ' + reais(p.total) + '.' + (p.modo === 'teste' ? ' [TESTE]' : '');
  main.innerHTML = '<section class="section order-status status-' + p.status + '"><div class="crumb"><a href="#/">Início</a><span>/</span><span>Pedido ' + esc(p.id) + '</span></div><p class="eyebrow">PEDIDO ' + esc(p.id) + (p.modo === 'teste' ? ' · TESTE' : '') + '</p><h1>' + titulo + '</h1><p>' + texto + '</p>' + (p.alerta ? '<p class="fit-no">' + esc(p.alerta) + '</p>' : '') +
    '<ul class="checkout-lines">' + p.itens.map(i => '<li><span>' + i.qtd + ' × ' + esc(i.nome) + ' · ' + esc(i.variante) + '</span><strong>' + reais(i.total) + '</strong></li>').join('') + '<li class="grand"><span>Total</span><strong>' + reais(p.total) + '</strong></li></ul>' +
    '<div class="order-actions">' + (['recusado', 'cancelado'].includes(p.status) && cart.length ? '<a class="button dark" href="#/checkout">Tentar pagar novamente</a>' : '') + (p.status === 'aguardando-pagamento' ? '<a class="button dark" href="' + esc(p.checkoutUrl.startsWith('#') ? p.checkoutUrl : p.checkoutUrl) + '">Voltar ao pagamento</a>' : '') +
    '<button class="button whatsapp-button" data-wa-text="' + esc(msg) + '">' + icon('whatsapp') + ' Falar com a loja sobre o pedido</button></div></section>';
  document.title = titulo + ' | Nossa Senhora da Conceição';
  clearTimeout(pollTimer);
  if (['aguardando-pagamento', 'pendente'].includes(p.status) && location.hash.startsWith('#/pedido/')) pollTimer = setTimeout(() => { if (location.hash === '#/pedido/' + id) orderPage(id); }, 4000);
}
async function simulatedProviderPage(id) {
  const p = await api.consultar(id);
  if (!p || await api.detectar()) { notFound(); return; }
  const fim = ['aprovado', 'recusado', 'cancelado'].includes(p.status);
  main.innerHTML = '<section class="section checkout sim-provider"><p class="test-flag">Simulação do checkout do provedor (Pix e cartão). Nenhuma cobrança real.</p><h1>Pedido ' + esc(p.id) + '</h1><p class="sim-total">' + reais(p.total) + '</p>' +
  (fim ? '<p>Este pedido já está finalizado.</p><a class="button dark" href="#/pedido/' + esc(p.id) + '">Ver pedido</a>' :
  '<div class="sim-buttons"><button class="button dark" data-sim="aprovado">Simular pagamento aprovado</button><button class="button gold" data-sim="pendente">Simular Pix pendente</button><button class="button light" data-sim="recusado">Simular cartão recusado</button><button class="button light" data-sim="cancelado">Cancelar e voltar</button></div><label class="facet-check"><input type="checkbox" id="sim-repeat"> Enviar a notificação duas vezes (teste de duplicidade)</label>') + '</section>';
  main.dataset.order = p.id;
}
async function simulate(status) {
  const {assinar} = await import('./loja/pedidos.js?v=10');
  const n = await api.local(), p = await n.consultar(main.dataset.order);
  const corpo = JSON.stringify({id: 'evt_' + Math.random().toString(36).slice(2), pedido: p.id, status, valor: p.total});
  const sig = await assinar('simulacao-no-navegador-0001', corpo);
  await n.receberNotificacao(corpo, sig);
  if ($('#sim-repeat')?.checked) await n.receberNotificacao(corpo, sig);
  location.hash = '#/pedido/' + p.id;
}

// ---------- Manutenção ----------
function maintenancePage() {
  const linhas = catalogo.flatMap(p => p.variants.map(v => ({p, v, pend: pendencias(p, v)})));
  const comPend = linhas.filter(l => l.pend.length);
  const pendentesFora = produtosBase.filter(p => p.status === 'pendente');
  main.innerHTML = '<section class="section maintenance"><div class="crumb"><a href="#/">Início</a><span>/</span><span>Manutenção</span></div><h1>Área de manutenção</h1><p>Modo atual: <strong>' + (teste ? 'teste (prévia)' : 'produção') + '</strong>. ' + linhas.length + ' variantes publicadas, ' + comPend.length + ' com pendências. Instruções em MANUTENCAO.md.</p>' +
  (teste ? '<div class="maint-tools"><h2>Ferramentas de teste</h2><form data-test-date><label>Simular data <input type="date" name="data" value="' + esc((ls.get('conceicao-data-teste', '') || '').slice(0, 10)) + '"></label><button class="button dark" type="submit">Aplicar data</button><button class="button light" type="button" data-clear-date>Usar hoje</button></form>' +
   '<form data-test-adjust><label>Variante <select name="alvo">' + linhas.map(l => '<option value="' + l.p.id + '/' + l.v.id + '">' + esc(l.p.name + ' · ' + l.v.name) + '</option>').join('') + '</select></label><label>Novo preço <input name="preco" type="number" step="0.01" min="0"></label><label>Novo estoque <input name="estoque" type="number" min="0"></label><button class="button dark" type="submit">Aplicar no servidor de teste</button><p id="adjust-result" role="status"></p></form><p class="catalog-note">O ajuste muda o preço/estoque usado pelo pagamento, sem mudar a vitrine: serve para testar "preço mudou" e "item esgotou" antes de pagar.</p></div>' : '') +
  '<h2>Itens do relatório com foto encontrada, aguardando confirmação da loja (' + pendentesLoja.length + ')</h2><ul>' + pendentesLoja.map(x => '<li><strong>' + esc(x.codigo) + '</strong> ' + esc(x.descricaoLoja || '') + ' — ' + esc(x.motivo) + '</li>').join('') + '</ul>' +
  (pendentesFora.length ? '<h2>Fora da vitrine (pendentes da importação)</h2><ul>' + pendentesFora.map(p => '<li><strong>' + esc(p.name) + '</strong> · ' + esc(p.ref) + ' — ' + esc((p.motivosPendencia || []).join(', ')) + '</li>').join('') + '</ul>' : '') +
  '<h2>Produtos que precisam de conferência</h2><div class="table-wrap"><table><thead><tr><th>Produto · variante</th><th>Link</th><th>Preço</th><th>Estoque</th><th>Medidas (L×A×P)</th><th>Pendências</th><th>Origem das informações</th></tr></thead><tbody>' +
  linhas.map(l => '<tr><td>' + esc(l.p.name) + ' · ' + esc(l.v.name) + '<br><small>' + esc(l.p.ref) + (l.v.sku ? ' / ' + esc(l.v.sku) : '') + '</small></td><td><a href="#/produto/' + l.p.id + '?cor=' + l.v.id + '">#/produto/' + l.p.id + '?cor=' + l.v.id + '</a></td><td>' + (l.v.preco == null ? '—' : reais(l.v.preco)) + (l.v.valoresTeste ? ' <small>(teste)</small>' : '') + '</td><td>' + (l.v.estoque ?? '—') + '</td><td>' + (medidasTexto(l.v.medidas) || '—') + '</td><td>' + (l.pend.length ? esc(l.pend.join(', ')) : 'ok') + '</td><td>' + (l.p.fontes || []).map(f => esc(f.campo + ': ' + f.arquivo + (f.pagina ? ' p.' + f.pagina : '') + (f.nota ? ' — ' + f.nota : ''))).join('<br>') + '</td></tr>').join('') + '</tbody></table></div></section>';
  document.title = 'Manutenção | Nossa Senhora da Conceição';
}

// ---------- roteador ----------
function observeReveals() {
  revealObserver?.disconnect();
  const els = $$('.reveal', main);
  if (economia || !('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in-view')); return; }
  revealObserver = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); revealObserver.unobserve(e.target); } }), {threshold: .07});
  els.forEach(el => revealObserver.observe(el));
}
function route() {
  clearInterval(heroTimer); clearTimeout(pollTimer); currentProduct = null; closeMenu(); recarregarCatalogo();
  const raw = location.hash.slice(1) || '/'; const [path, query = ''] = raw.split('?'); const params = new URLSearchParams(query);
  const camp = campanhas.find(c => '/' + c.slug === path);
  document.title = 'Nossa Senhora da Conceição | Móveis para viver a casa';
  if (path === '/catalogo') { catalog(params); document.title = 'Catálogo | Nossa Senhora da Conceição'; }
  else if (path === '/promocoes') { catalog(params, 'ofertas'); document.title = 'Ofertas | Nossa Senhora da Conceição'; }
  else if (camp) campaignPage(camp);
  else if (path.startsWith('/produto/')) productPage(decodeURIComponent(path.split('/')[2] || ''), params);
  else if (path === '/loja' || path === '/contato') { storePage(); document.title = 'Contato e loja | Nossa Senhora da Conceição'; }
  else if (path === '/checkout') checkoutPage();
  else if (path.startsWith('/pedido/')) orderPage(decodeURIComponent(path.split('/')[2] || ''));
  else if (path.startsWith('/pagamento-teste/')) simulatedProviderPage(decodeURIComponent(path.split('/')[2] || ''));
  else if (path === '/manutencao') maintenancePage();
  else if (path === '/painel') { document.title = 'Painel da loja | Nossa Senhora da Conceição'; main.innerHTML = '<section class="painel" id="painel"><p>Carregando o painel…</p></section>'; import('./painel/painel.js?v=10').then(m => m.abrirPainel($("#painel"), {produtosBase, idsLoja, categorias: categories, campanhas})).catch(() => { main.innerHTML = '<section class="painel"><p>Não foi possível abrir o painel. Verifique a internet e tente de novo.</p></section>'; }); }
  else if (path === '/' || !path) home();
  else notFound();
  document.body.dataset.rota = path.split('/')[1] || 'inicio';
  const nav = path === '/catalogo' || path.startsWith('/produto/') ? 'catalog' : path === '/promocoes' || camp ? 'promos' : path === '/loja' || path === '/contato' ? 'store' : path === '/' ? 'home' : '';
  $$('[data-nav]').forEach(a => { if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const c = campanhaVisivel(); $$('[data-campaign-link]').forEach(a => { a.hidden = !c; if (c) { a.href = '#/' + c.slug; a.firstChild.textContent = c.nome + ' '; } });
  window.scrollTo({top: 0, behavior: 'instant'}); if (!params.has('busca')) main.focus({preventScroll: true}); observeReveals(); animarPagina(main);
}

document.addEventListener('click', event => {
  const el = event.target.closest('button,a'); if (!el) return;
  if (el.getAttribute('href') === '#main') { event.preventDefault(); main.focus(); main.scrollIntoView(); return; }
  if (el.matches('a') && el.getAttribute('href')?.startsWith('#/') && el.getAttribute('href') === location.hash) { event.preventDefault(); route(); }
  if (el.matches('.menu-toggle')) { const open = el.getAttribute('aria-expanded') === 'true'; el.setAttribute('aria-expanded', String(!open)); el.setAttribute('aria-label', open ? 'Abrir menu' : 'Fechar menu'); $('#mobile-nav').hidden = open; }
  if (el.matches('[data-open-cart]')) openCart();
  if (el.matches('[data-close-cart]')) cartDialog.close();
  if (el.matches('[data-close-image]')) $('#image-dialog').close();
  if (el.matches('[data-close-wa]')) waDialog.close();
  if (el.matches('#wa-open')) setTimeout(() => waDialog.close(), 300);
  if (el.matches('[data-hero-next]')) { setHero(heroIndex + 1); startHero(); }
  if (el.matches('[data-hero-prev]')) { setHero(heroIndex - 1); startHero(); }
  if (el.matches('[data-hero-pause]')) { heroPaused = !heroPaused; setHeroPause(); startHero(); }
  if (el.matches('[data-category]')) { filtro.categoria = el.dataset.category; filtro.attrs = {}; $$('[data-category]').forEach(b => b.setAttribute('aria-pressed', String(b === el))); renderFacets(); renderResults(); syncCatalogUrl(); }
  if (el.matches('[data-facet]')) { const k = el.dataset.facet; filtro.attrs[k] = filtro.attrs[k] === el.dataset.value ? undefined : el.dataset.value; if (!filtro.attrs[k]) delete filtro.attrs[k]; renderFacets(); renderResults(); $('[data-facet="' + k + '"][data-value="' + CSS.escape(el.dataset.value) + '"]')?.focus(); }
  if (el.matches('[data-clear-filters]')) { filtro = {...filtro, categoria: 'todos', busca: '', attrs: {}, disponiveis: false}; $('#catalog-search').value = ''; $$('[data-category]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.category === 'todos'))); renderFacets(); renderResults(); syncCatalogUrl(); }
  if (el.matches('[data-variant]')) chooseVariant(Number(el.dataset.variant));
  if (el.matches('[data-photo]')) goPhoto(Number(el.dataset.photo));
  if (el.matches('[data-quantity]')) { productQuantity = Math.max(1, Math.min(99, productQuantity + Number(el.dataset.quantity))); $('#product-quantity').textContent = productQuantity; }
  if (el.matches('[data-add-product]')) addProduct();
  if (el.matches('[data-ask-product]')) { const v = currentProduct.variants[selectedVariant]; openWhatsapp(mensagemProduto({p: currentProduct, v, qtd: productQuantity, modo}).replace('Pode me passar o preço', blackGeral() ? 'Vi que está na ' + blackGeral().nome + '. Pode me passar o preço' : 'Pode me passar o preço'), 'Perguntar sobre ' + currentProduct.name); }
  if (el.matches('[data-wa-text]')) openWhatsapp(el.dataset.waText, 'Falar com a loja');
  if (el.matches('[data-view-3d]')) open3d();
  if (el.matches('[data-zoom]')) { photoIndex = Number(el.dataset.zoom); showZoom(); }
  if (el.matches('[data-zoom-step]')) { const n = $$('[data-zoom]').length; photoIndex = (photoIndex + Number(el.dataset.zoomStep) + n) % n; showZoom(); goPhoto(photoIndex); }
  if (el.matches('[data-cart-step]')) { const i = cart[Number(el.dataset.index)]; if (i) { i.qty = Math.max(1, Math.min(99, i.qty + Number(el.dataset.cartStep))); saveCart(); renderCart(); $('[data-cart-step="' + el.dataset.cartStep + '"][data-index="' + el.dataset.index + '"]')?.focus(); } }
  if (el.matches('[data-remove]')) { cart.splice(Number(el.dataset.remove), 1); saveCart(); renderCart(); ($('[data-remove]') || $('[data-close-cart]'))?.focus(); }
  if (el.matches('[data-start-payment]')) startPayment(el);
  if (el.matches('[data-accept-prices]')) acceptPrices(JSON.parse(el.dataset.acceptPrices));
  if (el.matches('[data-sim]')) { $$('[data-sim]').forEach(b => b.disabled = true); simulate(el.dataset.sim); }
  if (el.matches('[data-clear-date]')) { ls.del('conceicao-data-teste'); toast('Data de teste removida.'); route(); }
  if (el.closest('#mobile-nav') && el.matches('a')) closeMenu();
});
function showZoom() { const img = $$('[data-zoom] img')[photoIndex]; if (!img) return; $('#large-image').src = img.src; $('#large-image').alt = img.alt; const d = $('#image-dialog'); d.querySelectorAll('[data-zoom-step]').forEach(b => b.hidden = $$('[data-zoom]').length < 2); if (!d.open) { d.showModal(); document.body.classList.add('dialog-open'); } }
document.addEventListener('submit', async event => {
  const f = event.target;
  if (f.matches('[data-search-form]')) { event.preventDefault(); location.hash = '#/catalogo?busca=' + encodeURIComponent(new FormData(f).get('busca') || ''); }
  if (f.matches('[data-fit]')) { event.preventDefault(); checkFit(f); }
  if (f.matches('[data-test-date]')) { event.preventDefault(); const d = new FormData(f).get('data'); if (d) { ls.set('conceicao-data-teste', d + 'T12:00:00-03:00'); toast('Data simulada: ' + d.split('-').reverse().join('/')); route(); } }
  if (f.matches('[data-test-adjust]')) {
    event.preventDefault(); const fd = new FormData(f); const [id, variant] = fd.get('alvo').split('/');
    const dados = {id, variant}; if (fd.get('preco') !== '') dados.preco = Number(fd.get('preco')); if (fd.get('estoque') !== '') dados.estoque = Number(fd.get('estoque'));
    const r = await api.ajustar(dados); $('#adjust-result').textContent = r.ok ? 'Ajuste aplicado: ' + JSON.stringify(r.ajuste) : 'Não aplicado (' + r.erro + ')';
  }
});
document.addEventListener('input', event => {
  const t = event.target;
  if (t.id === 'catalog-search') { filtro.busca = t.value; renderResults(); syncCatalogUrl(); }
  if (t.matches('[data-search-form] input[name="busca"]')) sugestoes(t);
  if (t.id === 'cart-notes') updateMessage();
  if (t.id === 'cart-message') $('#send-whatsapp').href = linkWhatsapp(t.value);
  if (t.id === 'wa-text') $('#wa-open').href = linkWhatsapp(t.value);
});
document.addEventListener('change', event => {
  const t = event.target;
  if (t.id === 'catalog-sort') { filtro.ordem = t.value; renderResults(); }
  if (t.matches('[data-only-available]')) { filtro.disponiveis = t.checked; renderResults(); }
  if (t.name === 'cidade') { cidadeEntrega = t.value; ls.set('conceicao-cidade', cidadeEntrega); renderCart(); }
  if (t.name === 'entrega') { entregaTipo = t.value; ls.set('conceicao-entrega', entregaTipo); renderCart(); $('input[name="entrega"][value="' + entregaTipo + '"]')?.focus(); }
});
document.addEventListener('focusout', e => { const f = e.target.closest?.('[data-search-form]'); if (f) setTimeout(() => { if (!f.contains(document.activeElement)) f.querySelector('.search-suggest')?.remove(); }, 150); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); $$('.search-suggest').forEach(b => b.remove()); } if ($('#image-dialog').open && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) $('[data-zoom-step="' + (e.key === 'ArrowRight' ? 1 : -1) + '"]')?.click(); });
for (const d of [cartDialog, $('#image-dialog'), waDialog]) {
  d.addEventListener('close', () => { document.body.classList.remove('dialog-open'); if (lastFocus?.isConnected) lastFocus.focus(); });
  d.addEventListener('click', e => { if (e.target !== d) return; const b = d.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) d.close(); });
}
if (teste) $('.skip').insertAdjacentHTML('afterend', testBar());
window.addEventListener('hashchange', route); $('#year').textContent = new Date().getFullYear(); updateCartCount(); route();
