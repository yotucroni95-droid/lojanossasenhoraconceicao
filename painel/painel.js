// Painel da loja (#/painel): a equipe entra com e-mail e senha e edita produtos, fotos, estoque e campanhas.
// Os dados vão para o banco (Supabase). As regras do banco só deixam e-mails da tabela "equipe" alterar algo.
import {banco} from '../config.js?v=11';
import {bancoAtivo} from '../loja/remoto.js?v=11';

const SUPABASE = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const slug = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item';
const num = v => v === '' || v == null ? null : Number(String(v).replace(',', '.'));
const TIPOS_FOTO = [['real', 'Foto tirada na loja'], ['catalogo', 'Foto oficial do fabricante'], ['ilustrativa', 'Imagem parecida (ilustrativa)']];

let sb, raiz, ctx, linhas = [], aba = 'produtos', busca = '', categoria = 'todas', email = '';
// siteAtual: qual site está sendo editado. A Órbita (site '*') pode trocar; o dono e os funcionários ficam no(s) seu(s).
let siteAtual = banco.site, orbita = false, minhas = [], sites = [];
const souDono = () => orbita || minhas.some(r => r.site === siteAtual && r.papel === 'dono');
const nomeSite = () => sites.find(s => s.id === siteAtual)?.nome || siteAtual;
const reaisTexto = v => v == null ? '' : Number(v).toFixed(2).replace('.', ',');
// Aceita "1299,90", "1.299,90", "1299.90" ou "R$ 1.299,90".
const lerReais = t => { t = String(t || '').replace(/[R$\s]/g, ''); if (!t) return null; if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const n = Number(t); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN; };

export async function abrirPainel(el, contexto) {
  raiz = el; ctx = contexto;
  if (!document.querySelector('link[data-painel]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'painel/painel.css?v=11'; l.dataset.painel = '1'; document.head.appendChild(l);
  }
  if (!bancoAtivo()) {
    raiz.innerHTML = '<div class="pn-caixa"><h1>Painel da loja</h1><p>O painel ainda não foi ativado. Falta ligar o site ao banco de dados (Supabase).</p><p>Siga o guia em <b>painel/ATIVAR.md</b> e preencha <code>banco</code> em <code>config.js</code>.</p></div>';
    return;
  }
  const {createClient} = await import(SUPABASE);
  sb = sb || createClient(banco.url, banco.chave, {auth: {persistSession: true, detectSessionInUrl: false, storageKey: 'conceicao-painel'}});
  const {data} = await sb.auth.getSession();
  if (data.session) await entrou(data.session); else telaLogin();
}

// ---------- login ----------
function telaLogin(msg = '') {
  raiz.innerHTML = '<form class="pn-caixa pn-login" data-login><img src="assets/simbolo.jpg" alt="" width="64" height="64"><h1>Painel da loja</h1><p>Entre com o e-mail e a senha da equipe.</p>' +
    (msg ? '<p class="pn-erro" role="alert">' + esc(msg) + '</p>' : '') +
    '<label>E-mail<input name="email" type="email" autocomplete="username" required></label>' +
    '<label>Senha<input name="senha" type="password" autocomplete="current-password" required></label>' +
    '<button class="pn-bt pn-principal" type="submit">Entrar</button><p class="pn-nota">Esqueceu a senha? Peça para o dono da loja criar uma nova na aba Equipe.</p></form>';
  raiz.querySelector('[data-login]').addEventListener('submit', async e => {
    e.preventDefault(); const f = new FormData(e.target); const bt = e.target.querySelector('button'); bt.disabled = true; bt.textContent = 'Entrando…';
    const {data, error} = await sb.auth.signInWithPassword({email: f.get('email').trim(), password: f.get('senha')});
    if (error) return telaLogin('E-mail ou senha incorretos.');
    await entrou(data.session);
  });
}

async function entrou(sessao) {
  email = sessao.user.email;
  const {data} = await sb.from('equipe').select('site,papel');
  minhas = data || []; orbita = minhas.some(r => r.site === '*');
  const q = sb.from('sites').select('id,nome').order('nome');
  sites = (await (orbita ? q : q.in('id', minhas.map(r => r.site)))).data || [];
  if (!sites.length) { await sb.auth.signOut(); return telaLogin('Este e-mail entrou, mas ainda não tem permissão para editar. Peça para o dono da loja liberar o seu acesso.'); }
  if (!sites.some(x => x.id === siteAtual)) siteAtual = sites[0].id;
  await carregar(); desenhar();
}

async function carregar() {
  const {data, error} = await sb.from('produtos').select('id,dados,ordem,atualizado_em,atualizado_por').eq('site', siteAtual).order('ordem');
  if (error) throw error;
  linhas = data || [];
}

// ---------- estrutura ----------
function desenhar() {
  const abas = [['produtos', 'Produtos'], ['loja', 'Preços e loja'], ['campanhas', 'Black Friday e campanhas'], ...(souDono() ? [['equipe', 'Equipe']] : []), ...(orbita ? [['sites', 'Sites (Órbita)']] : []), ['historico', 'Histórico'], ['conta', 'Minha senha']];
  if (!abas.some(([id]) => id === aba)) aba = 'produtos';
  const trocar = sites.length > 1 ? '<label class="pn-site">Site que você está editando<select data-site>' + sites.map(x => '<option value="' + esc(x.id) + '"' + (x.id === siteAtual ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') + '</select></label>' : '';
  raiz.innerHTML = '<header class="pn-topo"><div><p class="pn-sobre">PAINEL · ' + esc(nomeSite()).toUpperCase() + '</p><h1>Olá! O que vamos atualizar?</h1><p class="pn-nota">Entrou como ' + esc(email) + (orbita ? ' · acesso Órbita (todos os sites)' : souDono() ? ' · dono' : '') + '</p>' + trocar + '</div>' +
    '<div class="pn-acoes">' + (siteAtual === banco.site ? '<a class="pn-bt" href="#/" target="_blank" rel="noopener">Ver o site</a>' : '') + '<button class="pn-bt" data-sair>Sair</button></div></header>' +
    '<nav class="pn-abas" role="tablist">' + abas.map(([id, n]) => '<button role="tab" aria-selected="' + (aba === id) + '" data-aba="' + id + '">' + n + '</button>').join('') + '</nav><div class="pn-conteudo" id="pn-conteudo"></div>';
  raiz.querySelector('[data-sair]').onclick = async () => { await sb.auth.signOut(); telaLogin(); };
  raiz.querySelector('[data-site]')?.addEventListener('change', async e => { siteAtual = e.target.value; busca = ''; categoria = 'todas'; await carregar(); desenhar(); });
  raiz.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { aba = b.dataset.aba; desenhar(); });
  ({produtos: listaProdutos, loja: telaLoja, campanhas: telaCampanhas, equipe: telaEquipe, sites: telaSites, historico: telaHistorico, conta: telaConta})[aba]();
}
const conteudo = () => raiz.querySelector('#pn-conteudo');
function aviso(texto, tipo = 'ok') {
  let t = document.querySelector('.pn-aviso'); if (!t) { t = document.createElement('div'); t.className = 'pn-aviso'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = texto; t.dataset.tipo = tipo; t.classList.add('mostra'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('mostra'), 3500);
}

// ---------- lista de produtos ----------
const nomeCat = id => ctx.categorias.find(c => c.id === id)?.name || 'Sem categoria';
function resumoEstoque(p) {
  const qs = p.variants.map(v => v.estoque); if (qs.every(q => q == null)) return 'Estoque: sob consulta';
  const tot = qs.reduce((a, q) => a + (q > 0 ? q : 0), 0); return tot ? 'Em estoque: ' + tot : 'Esgotado';
}
function listaProdutos() {
  if (!linhas.length && siteAtual !== banco.site) {
    conteudo().innerHTML = '<div class="pn-caixa"><h2>Nenhum produto ainda</h2><p>Este site ainda não tem produtos no banco.</p><button class="pn-bt pn-principal" data-novo>+ Novo produto</button></div>';
    conteudo().querySelector('[data-novo]').onclick = () => editor(null); return;
  }
  if (!linhas.length) {
    conteudo().innerHTML = '<div class="pn-caixa"><h2>Primeiro passo: trazer o catálogo</h2><p>O banco está vazio. Clique abaixo para copiar os ' + ctx.produtosBase.length + ' produtos que já estão no site. Depois disso, tudo é editado por aqui.</p><button class="pn-bt pn-principal" data-importar>Importar o catálogo atual</button></div>';
    conteudo().querySelector('[data-importar]').onclick = importar; return;
  }
  const norm = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const lista = linhas.filter(r => (categoria === 'todas' || r.dados.category === categoria) &&
    (!busca || norm(r.dados.name + ' ' + r.dados.variants.map(v => v.name + ' ' + (v.sku || '')).join(' ')).includes(norm(busca))));
  conteudo().innerHTML = '<div class="pn-barra"><input type="search" placeholder="Buscar por nome ou código (ex.: 000675)" value="' + esc(busca) + '" data-busca aria-label="Buscar produto">' +
    '<select data-cat aria-label="Categoria"><option value="todas">Todas as categorias</option>' + ctx.categorias.map(c => '<option value="' + c.id + '"' + (c.id === categoria ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select>' +
    '<button class="pn-bt pn-principal" data-novo>+ Novo produto</button></div><p class="pn-nota">' + lista.length + ' de ' + linhas.length + ' produtos</p>' +
    '<ul class="pn-lista">' + lista.map(r => { const p = r.dados, v = p.variants[0]; const oculto = p.status === 'oculto' || p.vitrine === false;
      return '<li class="' + (oculto ? 'oculto' : '') + '"><img src="' + esc(v.image) + '" alt="" loading="lazy" width="72" height="72"><div><b>' + esc(p.name) + '</b><small>' + esc(nomeCat(p.category)) + ' · ' + p.variants.length + (p.variants.length > 1 ? ' opções' : ' opção') + ' · ' + resumoEstoque(p) + (oculto ? ' · <em>fora do site</em>' : '') + '</small></div><button class="pn-bt" data-editar="' + esc(p.id) + '">Editar</button></li>'; }).join('') + '</ul>';
  const b = conteudo().querySelector('[data-busca]'); b.oninput = () => { busca = b.value; const pos = b.selectionStart; listaProdutos(); const n = conteudo().querySelector('[data-busca]'); n.focus(); n.setSelectionRange(pos, pos); };
  conteudo().querySelector('[data-cat]').onchange = e => { categoria = e.target.value; listaProdutos(); };
  conteudo().querySelector('[data-novo]').onclick = () => editor(null);
  conteudo().querySelectorAll('[data-editar]').forEach(x => x.onclick = () => editor(linhas.find(r => r.id === x.dataset.editar)));
}

async function importar(e) {
  e.target.disabled = true; e.target.textContent = 'Importando…';
  const rows = ctx.produtosBase.map((p, i) => ({site: siteAtual, id: p.id, ordem: i, dados: {...p, vitrine: ctx.idsLoja.has(p.id)}}));
  for (let i = 0; i < rows.length; i += 50) {
    const {error} = await sb.from('produtos').upsert(rows.slice(i, i + 50), {onConflict: 'site,id'});
    if (error) { aviso('Não foi possível importar: ' + error.message, 'erro'); e.target.disabled = false; e.target.textContent = 'Tentar de novo'; return; }
  }
  await sb.from('ajustes').upsert({site: siteAtual, chave: 'campanhas', dados: ctx.campanhas}, {onConflict: 'site,chave'});
  await carregar(); aviso('Catálogo importado: ' + rows.length + ' produtos.'); listaProdutos();
}

// ---------- editor de produto ----------
function editor(linha) {
  const novo = !linha;
  const p = structuredClone(linha?.dados || {id: '', name: '', category: ctx.categorias[0].id, fabricante: '', description: '', details: [], images: [], vitrine: true,
    variants: [{id: 'padrao', name: 'Padrão', color: '#c8b8a2', image: 'assets/simbolo.jpg', imageTipo: 'real', sku: '', estoque: 1, medidas: {largura: null, altura: null, profundidade: null}, atributos: {}}]});
  const visivel = p.status !== 'oculto' && p.vitrine !== false;
  conteudo().innerHTML = '<form class="pn-editor" data-editor novalidate><div class="pn-editor-topo"><button type="button" class="pn-bt" data-voltar>← Voltar</button><h2>' + (novo ? 'Novo produto' : esc(p.name)) + '</h2>' +
    (novo ? '' : '<a class="pn-bt" href="#/produto/' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener">Ver no site</a>') + '</div>' +
    '<fieldset><legend>Sobre o produto</legend>' +
    '<label>Nome do produto<input name="name" required value="' + esc(p.name) + '" placeholder="Ex.: Guarda-roupa Light Plus 6 portas"></label>' +
    '<div class="pn-2"><label>Categoria<select name="category">' + ctx.categorias.map(c => '<option value="' + c.id + '"' + (c.id === p.category ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></label>' +
    '<label>Fabricante (opcional)<input name="fabricante" value="' + esc(p.fabricante) + '"></label></div>' +
    '<label>Descrição<textarea name="description" rows="4" placeholder="Conte o que o cliente precisa saber: material, conforto, diferenciais.">' + esc(p.description) + '</textarea></label>' +
    '<label>Detalhes (um por linha)<textarea name="details" rows="3" placeholder="Ex.: 6 portas e 2 gavetas">' + esc((p.details || []).join('\n')) + '</textarea></label>' +
    '<label class="pn-check"><input type="checkbox" name="visivel"' + (visivel ? ' checked' : '') + '> Mostrar este produto no site</label></fieldset>' +
    '<fieldset><legend>Opções (cor, tamanho) · estoque e foto de cada uma</legend><div data-variantes></div><button type="button" class="pn-bt" data-add-var>+ Adicionar opção</button></fieldset>' +
    '<div class="pn-rodape"><button class="pn-bt pn-principal" type="submit">Salvar</button>' + (novo ? '' : '<button type="button" class="pn-bt pn-perigo" data-apagar>Apagar produto</button>') + '</div></form>';
  const f = conteudo().querySelector('[data-editor]'), caixaVar = f.querySelector('[data-variantes]');
  const desenharVariantes = () => {
    caixaVar.innerHTML = p.variants.map((v, i) => '<div class="pn-var" data-i="' + i + '"><div class="pn-foto"><img src="' + esc(v.image) + '" alt="Foto da opção ' + esc(v.name) + '"><label class="pn-bt">Trocar foto<input type="file" accept="image/*" data-foto hidden></label>' +
      '<select data-campo="imageTipo" aria-label="Tipo de foto">' + TIPOS_FOTO.map(([t, n]) => '<option value="' + t + '"' + ((v.imageTipo || 'real') === t ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
      '<div class="pn-var-campos"><div class="pn-2"><label>Nome da opção<input data-campo="name" value="' + esc(v.name) + '" placeholder="Ex.: Cinamomo / Off White"></label><label>Código da loja<input data-campo="sku" value="' + esc(v.sku) + '" placeholder="Ex.: 000675" inputmode="numeric"></label></div>' +
      '<div class="pn-3"><label>Quantidade em estoque<input data-campo="estoque" type="number" min="0" step="1" value="' + (v.estoque ?? '') + '" placeholder="vazio = sob consulta"></label><label>Cor (bolinha)<input data-campo="color" type="color" value="' + esc(/^#[0-9a-f]{6}$/i.test(v.color) ? v.color : '#c8b8a2') + '"></label>' +
      '<div class="pn-estoque-rapido"><button type="button" data-zero>Esgotado</button><button type="button" data-mais>+1</button></div></div>' +
      '<div class="pn-3"><label>Preço à vista (R$)<input data-preco="preco" inputmode="decimal" value="' + reaisTexto(v.preco) + '" placeholder="vazio = sob consulta"></label><label>Preço antes (riscado, opcional)<input data-preco="precoDe" inputmode="decimal" value="' + reaisTexto(v.precoDe) + '"></label>' +
      '<div class="pn-2"><label>Parcelas<input data-parc="vezes" type="number" min="1" max="24" step="1" value="' + (v.parcelado?.vezes ?? '') + '" placeholder="ex.: 10"></label><label>Valor da parcela<input data-parc="valor" inputmode="decimal" value="' + reaisTexto(v.parcelado?.valor) + '" placeholder="calcula sozinho"></label></div></div>' +
      '<div class="pn-3"><label>Largura (cm)<input data-medida="largura" inputmode="decimal" value="' + (v.medidas?.largura ?? '') + '"></label><label>Altura (cm)<input data-medida="altura" inputmode="decimal" value="' + (v.medidas?.altura ?? '') + '"></label><label>Profundidade (cm)<input data-medida="profundidade" inputmode="decimal" value="' + (v.medidas?.profundidade ?? '') + '"></label></div>' +
      (p.variants.length > 1 ? '<button type="button" class="pn-link pn-perigo" data-remover>Remover esta opção</button>' : '') + '</div></div>').join('');
    caixaVar.querySelectorAll('.pn-var').forEach(el => {
      const v = p.variants[+el.dataset.i];
      el.querySelectorAll('[data-campo]').forEach(inp => inp.oninput = () => { v[inp.dataset.campo] = inp.dataset.campo === 'estoque' ? (inp.value === '' ? null : Math.max(0, parseInt(inp.value, 10) || 0)) : inp.value; });
      el.querySelectorAll('[data-preco]').forEach(inp => inp.oninput = () => { v[inp.dataset.preco] = lerReais(inp.value); });
      el.querySelectorAll('[data-parc]').forEach(inp => inp.oninput = () => { v._parc = {...(v._parc || {vezes: v.parcelado?.vezes ?? null, valor: v.parcelado?.valor ?? null}), [inp.dataset.parc]: inp.dataset.parc === 'vezes' ? (parseInt(inp.value, 10) || null) : lerReais(inp.value)}; });
      el.querySelectorAll('[data-medida]').forEach(inp => inp.oninput = () => { v.medidas = {...(v.medidas || {}), [inp.dataset.medida]: num(inp.value)}; });
      el.querySelector('[data-zero]').onclick = () => { v.estoque = 0; el.querySelector('[data-campo="estoque"]').value = 0; };
      el.querySelector('[data-mais]').onclick = () => { v.estoque = (v.estoque || 0) + 1; el.querySelector('[data-campo="estoque"]').value = v.estoque; };
      el.querySelector('[data-remover]')?.addEventListener('click', () => { if (confirm('Remover a opção "' + v.name + '"?')) { p.variants.splice(+el.dataset.i, 1); desenharVariantes(); } });
      el.querySelector('[data-foto]').onchange = async e => {
        const arq = e.target.files[0]; if (!arq) return; const img = el.querySelector('img'); img.style.opacity = .4; aviso('Enviando foto…');
        try { v.image = await enviarFoto(arq, p.id || slug(f.name.value)); img.src = v.image; aviso('Foto enviada. Clique em Salvar para publicar.'); }
        catch (err) { aviso('Não foi possível enviar a foto: ' + err.message, 'erro'); }
        img.style.opacity = 1;
      };
    });
  };
  desenharVariantes();
  f.querySelector('[data-add-var]').onclick = () => { const base = p.variants[p.variants.length - 1]; p.variants.push({...structuredClone(base), id: '', name: '', sku: '', estoque: 1}); desenharVariantes(); caixaVar.querySelector('.pn-var:last-child input').focus(); };
  f.querySelector('[data-voltar]').onclick = () => listaProdutos();
  f.querySelector('[data-apagar]')?.addEventListener('click', async () => {
    if (!confirm('Apagar "' + p.name + '"? O link dele deixa de funcionar. Se for só tirar do site por um tempo, desmarque "Mostrar este produto no site". (Dá para recuperar pelo Histórico.)')) return;
    const {error} = await sb.from('produtos').delete().eq('site', siteAtual).eq('id', p.id);
    if (error) return aviso('Não foi possível apagar: ' + error.message, 'erro');
    await carregar(); aviso('Produto apagado.'); listaProdutos();
  });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = new FormData(f), nome = d.get('name').trim();
    if (!nome) return aviso('Escreva o nome do produto.', 'erro');
    if (p.variants.some(v => !String(v.name).trim())) return aviso('Dê um nome para cada opção (ex.: a cor ou o tamanho).', 'erro');
    if (p.variants.some(v => Number.isNaN(v.preco) || Number.isNaN(v.precoDe) || Number.isNaN(v._parc?.valor))) return aviso('Confira os preços: use só números, como 1299,90.', 'erro');
    for (const v of p.variants) {
      if (v._parc) { const {vezes, valor} = v._parc; v.parcelado = vezes > 1 ? {vezes, valor: valor ?? (v.preco ? Math.round(v.preco / vezes * 100) / 100 : null)} : null; if (v.parcelado && v.parcelado.valor == null) v.parcelado = null; delete v._parc; }
      if (v.preco == null) v.precoDe = null;
      if (v.precoDe != null && v.precoDe <= v.preco) v.precoDe = null;
    }
    p.name = nome; p.category = d.get('category'); p.fabricante = d.get('fabricante').trim() || null; p.description = d.get('description').trim();
    p.details = d.get('details').split('\n').map(s => s.trim()).filter(Boolean);
    if (d.get('visivel')) { p.vitrine = true; if (p.status === 'oculto') delete p.status; } else p.status = 'oculto';
    if (novo) { let id = slug(nome), n = 2; while (linhas.some(r => r.id === id)) id = slug(nome) + '-' + n++; p.id = id; p.ref = p.ref || null; }
    const usados = new Set();
    p.variants.forEach(v => { if (!v.id) { let id = slug(v.name), n = 2; while (usados.has(id) || p.variants.some(o => o !== v && o.id === id)) id = slug(v.name) + '-' + n++; v.id = id; } usados.add(v.id); v.sku = String(v.sku || '').trim() || null; });
    const ordem = linha ? linha.ordem : Math.min(0, ...linhas.map(r => r.ordem)) - 1;
    const bt = f.querySelector('[type=submit]'); bt.disabled = true; bt.textContent = 'Salvando…';
    const {error} = await sb.from('produtos').upsert({site: siteAtual, id: p.id, ordem, dados: p}, {onConflict: 'site,id'});
    bt.disabled = false; bt.textContent = 'Salvar';
    if (error) return aviso('Não foi possível salvar: ' + error.message, 'erro');
    await carregar(); aviso('Salvo! Já aparece no site.'); listaProdutos();
  });
}

// Reduz a foto no próprio celular (até 1400 px, JPG) antes de enviar.
async function enviarFoto(arq, pasta) {
  const bmp = await createImageBitmap(arq);
  const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', .8));
  const caminho = siteAtual + '/' + slug(pasta) + '/' + Date.now() + '.jpg';
  const {error} = await sb.storage.from('fotos').upload(caminho, blob, {contentType: 'image/jpeg', cacheControl: '31536000'});
  if (error) throw error;
  return sb.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
}

// ---------- campanhas ----------
const paraCampo = iso => { if (!iso) return ''; const d = new Date(new Date(iso).getTime() - 3 * 3600e3); return d.toISOString().slice(0, 16); };
const deCampo = v => v ? v + ':00-03:00' : null;
async function telaCampanhas() {
  const {data} = await sb.from('ajustes').select('dados').eq('site', siteAtual).eq('chave', 'campanhas').maybeSingle();
  const lista = structuredClone(data?.dados || ctx.campanhas);
  conteudo().innerHTML = '<form class="pn-editor" data-camp><p class="pn-nota">Horário de Brasília. Fora do período, a campanha some sozinha do site.</p>' + lista.map((c, i) => '<fieldset data-i="' + i + '"><legend>' + esc(c.nome) + '</legend>' +
    '<div class="pn-2"><label>Nome<input data-c="nome" value="' + esc(c.nome) + '"></label><label>Frase de chamada<input data-c="chamada" value="' + esc(c.chamada) + '"></label></div>' +
    '<label class="pn-check"><input type="checkbox" data-c="todosOsProdutos"' + (c.todosOsProdutos ? ' checked' : '') + '> Vale para todos os produtos</label>' +
    '<div class="pn-3"><label>Anunciar a partir de<input type="datetime-local" data-c="anuncioDesde" value="' + paraCampo(c.anuncioDesde) + '"></label><label>Começa em<input type="datetime-local" data-c="inicio" value="' + paraCampo(c.inicio) + '"></label><label>Termina em<input type="datetime-local" data-c="fim" value="' + paraCampo(c.fim) + '"></label></div>' +
    '<button type="button" class="pn-link" data-encerrar>Encerrar agora</button></fieldset>').join('') + '<div class="pn-rodape"><button class="pn-bt pn-principal" type="submit">Salvar campanhas</button></div></form>';
  const f = conteudo().querySelector('[data-camp]');
  f.querySelectorAll('[data-encerrar]').forEach(b => b.onclick = () => { const agora = new Date(Date.now() - 3 * 3600e3 - 60000).toISOString().slice(0, 16); b.closest('fieldset').querySelector('[data-c="fim"]').value = agora; aviso('Clique em Salvar para confirmar.'); });
  f.onsubmit = async e => {
    e.preventDefault();
    f.querySelectorAll('fieldset').forEach(fs => { const c = lista[+fs.dataset.i]; fs.querySelectorAll('[data-c]').forEach(inp => { const k = inp.dataset.c; c[k] = inp.type === 'checkbox' ? inp.checked : inp.type === 'datetime-local' ? deCampo(inp.value) : inp.value.trim(); }); });
    if (lista.some(c => !c.inicio || !c.fim || new Date(c.fim) <= new Date(c.inicio))) return aviso('Confira as datas: o fim precisa ser depois do começo.', 'erro');
    const {error} = await sb.from('ajustes').upsert({site: siteAtual, chave: 'campanhas', dados: lista}, {onConflict: 'site,chave'});
    aviso(error ? 'Não foi possível salvar: ' + error.message : 'Campanhas salvas!', error ? 'erro' : 'ok');
  };
}

// ---------- preços e loja ----------
async function telaLoja() {
  const {data} = await sb.from('ajustes').select('dados').eq('site', siteAtual).eq('chave', 'loja').maybeSingle();
  const a = data?.dados || {};
  const mostra = a.exibirPrecos ?? (siteAtual === banco.site ? ctx.exibirPrecos !== false : true);
  const comPreco = linhas.filter(r => r.dados.variants.some(v => v.preco != null)).length;
  conteudo().innerHTML = '<form class="pn-editor" data-loja><fieldset><legend>Preços no site</legend>' +
    '<label class="pn-check"><input type="checkbox" name="exibirPrecos"' + (mostra ? ' checked' : '') + '> Mostrar os preços no site</label>' +
    '<p class="pn-nota">Desligado: o site não mostra nenhum preço e o cliente pede o valor pelo WhatsApp. Ligado: aparece o preço de cada opção que tiver preço preenchido (as outras ficam "sob consulta"). Hoje ' + comPreco + ' de ' + linhas.length + ' produtos têm preço.</p>' +
    '<p class="pn-nota">Para pôr ou mudar um preço: aba <b>Produtos</b> → <b>Editar</b> → campo <b>Preço à vista</b> de cada opção.</p></fieldset>' +
    '<div class="pn-rodape"><button class="pn-bt pn-principal" type="submit">Salvar</button></div></form>';
  conteudo().querySelector('[data-loja]').onsubmit = async e => {
    e.preventDefault();
    const {error} = await sb.from('ajustes').upsert({site: siteAtual, chave: 'loja', dados: {...a, exibirPrecos: e.target.exibirPrecos.checked}}, {onConflict: 'site,chave'});
    aviso(error ? 'Não foi possível salvar: ' + error.message : 'Salvo! Já vale no site.', error ? 'erro' : 'ok');
  };
}

// ---------- equipe (dono e Órbita) ----------
// Criar login e trocar senha precisa da chave secreta, então isso roda na função "equipe" do Supabase (servidor), nunca aqui.
async function chamarEquipe(corpo) {
  const {data, error} = await sb.functions.invoke('equipe', {body: {site: siteAtual, ...corpo}});
  if (!error) return data;
  let msg = 'Não foi possível falar com o banco.';
  try { msg = (await error.context.json()).erro || msg; } catch {}
  if (error.name === 'FunctionsFetchError' || error.context?.status === 404) msg = 'A função "equipe" ainda não foi instalada no Supabase (veja painel/ATIVAR.md).';
  throw new Error(msg);
}
async function telaEquipe() {
  conteudo().innerHTML = '<p class="pn-nota">Carregando a equipe…</p>';
  let lista;
  try { lista = (await chamarEquipe({acao: 'listar'})).equipe; } catch (e) { conteudo().innerHTML = '<div class="pn-caixa"><p class="pn-erro">' + esc(e.message) + '</p></div>'; return; }
  const nomePapel = {dono: 'Dono (edita tudo e cadastra a equipe)', funcionario: 'Funcionário (edita produtos, preços e campanhas)'};
  conteudo().innerHTML = '<ul class="pn-lista pn-hist">' + lista.map(r => '<li><div><b>' + esc(r.email) + '</b><small>' + esc(nomePapel[r.papel] || r.papel) + '</small></div><div class="pn-acoes">' +
      (r.email !== email.toLowerCase() ? '<button class="pn-bt" data-senha-de="' + esc(r.email) + '">Nova senha</button><button class="pn-bt pn-perigo" data-tirar="' + esc(r.email) + '">Tirar acesso</button>' : '<small>você</small>') + '</div></li>').join('') + '</ul>' +
    '<form class="pn-caixa" data-add-pessoa><h2>Cadastrar pessoa</h2><p class="pn-nota">Crie o login aqui e passe o e-mail e a senha para a pessoa. Ela entra neste mesmo endereço e pode trocar a senha depois.</p>' +
    '<label>E-mail da pessoa<input name="email" type="email" required autocomplete="off"></label><label>Senha inicial (mínimo 8 caracteres)<input name="senha" type="text" minlength="8" required autocomplete="off"></label>' +
    (orbita ? '<label>Função<select name="papel"><option value="funcionario">Funcionário</option><option value="dono">Dono</option></select></label>' : '') +
    '<button class="pn-bt pn-principal">Cadastrar</button></form>';
  conteudo().querySelector('[data-add-pessoa]').onsubmit = async e => {
    e.preventDefault(); const d = new FormData(e.target); const bt = e.target.querySelector('button'); bt.disabled = true;
    try { const r = await chamarEquipe({acao: 'adicionar', email: d.get('email'), senha: d.get('senha'), papel: d.get('papel') || 'funcionario'});
      aviso(r.jaTinhaLogin ? 'Acesso liberado. Essa pessoa já tinha login: ela entra com a senha que já usa.' : 'Pessoa cadastrada! Passe o e-mail e a senha para ela.'); telaEquipe(); }
    catch (err) { aviso(err.message, 'erro'); bt.disabled = false; }
  };
  conteudo().querySelectorAll('[data-tirar]').forEach(b => b.onclick = async () => {
    if (!confirm('Tirar o acesso de ' + b.dataset.tirar + ' a este site?')) return;
    try { await chamarEquipe({acao: 'remover', email: b.dataset.tirar}); aviso('Acesso retirado.'); telaEquipe(); } catch (err) { aviso(err.message, 'erro'); }
  });
  conteudo().querySelectorAll('[data-senha-de]').forEach(b => b.onclick = async () => {
    const senha = prompt('Nova senha para ' + b.dataset.senhaDe + ' (mínimo 8 caracteres):'); if (!senha) return;
    if (senha.length < 8) return aviso('A senha precisa ter pelo menos 8 caracteres.', 'erro');
    try { await chamarEquipe({acao: 'senha', email: b.dataset.senhaDe, senha}); aviso('Senha trocada. Passe a nova senha para a pessoa.'); } catch (err) { aviso(err.message, 'erro'); }
  });
}

// ---------- sites (só Órbita) ----------
function telaSites() {
  conteudo().innerHTML = '<ul class="pn-lista pn-hist">' + sites.map(x => '<li><div><b>' + esc(x.nome) + '</b><small>código: ' + esc(x.id) + '</small></div><button class="pn-bt" data-ir="' + esc(x.id) + '">Editar este site</button></li>').join('') + '</ul>' +
    '<form class="pn-caixa" data-novo-site><h2>Novo site de cliente</h2><label>Nome do cliente<input name="nome" required placeholder="Ex.: Padaria Bom Pão"></label>' +
    '<label>Código (vai no config.js do site dele)<input name="id" required pattern="[a-z0-9-]{2,40}" placeholder="ex.: padaria-bom-pao"></label><button class="pn-bt pn-principal">Criar site</button></form>';
  const f = conteudo().querySelector('[data-novo-site]');
  f.nome.oninput = () => { if (!f.id.dataset.mexeu) f.id.value = slug(f.nome.value).slice(0, 40); };
  f.id.oninput = () => { f.id.dataset.mexeu = '1'; };
  f.onsubmit = async e => {
    e.preventDefault(); const id = f.id.value.trim(), nome = f.nome.value.trim();
    if (!/^[a-z0-9-]{2,40}$/.test(id)) return aviso('O código usa só letras minúsculas, números e hífen.', 'erro');
    const {error} = await sb.from('sites').insert({id, nome});
    if (error) return aviso(/duplicate|unique/i.test(error.message) ? 'Já existe um site com esse código.' : 'Não foi possível criar: ' + error.message, 'erro');
    sites = [...sites, {id, nome}].sort((a, b) => a.nome.localeCompare(b.nome)); aviso('Site criado: ' + nome); telaSites();
  };
  conteudo().querySelectorAll('[data-ir]').forEach(b => b.onclick = async () => { siteAtual = b.dataset.ir; aba = 'produtos'; await carregar(); desenhar(); });
}

// ---------- histórico ----------
async function telaHistorico() {
  const {data, error} = await sb.from('historico').select('id,produto,dados,acao,quem,quando').eq('site', siteAtual).order('quando', {ascending: false}).limit(60);
  if (error) { conteudo().innerHTML = '<p>Não foi possível ler o histórico.</p>'; return; }
  const quando = t => new Date(t).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'});
  conteudo().innerHTML = '<p class="pn-nota">Últimas mudanças. "Voltar a esta versão" restaura o produto como ele estava antes da mudança.</p><ul class="pn-lista pn-hist">' + (data.length ? data.map(h => '<li><div><b>' + esc(h.dados?.name || h.produto) + '</b><small>' + (h.acao === 'apagado' ? 'Apagado' : 'Alterado') + ' por ' + esc(h.quem || '—') + ' em ' + quando(h.quando) + '</small></div><button class="pn-bt" data-voltar="' + h.id + '">Voltar a esta versão</button></li>').join('') : '<li>Nenhuma mudança ainda.</li>') + '</ul>';
  conteudo().querySelectorAll('[data-voltar]').forEach(b => b.onclick = async () => {
    const h = data.find(x => String(x.id) === b.dataset.voltar);
    if (!confirm('Voltar "' + (h.dados?.name || h.produto) + '" para a versão de ' + quando(h.quando) + '?')) return;
    const atual = linhas.find(r => r.id === h.produto);
    const {error} = await sb.from('produtos').upsert({site: siteAtual, id: h.produto, ordem: atual?.ordem ?? 0, dados: h.dados}, {onConflict: 'site,id'});
    if (error) return aviso('Não foi possível restaurar: ' + error.message, 'erro');
    await carregar(); aviso('Versão restaurada.'); telaHistorico();
  });
}

// ---------- senha ----------
function telaConta() {
  conteudo().innerHTML = '<form class="pn-caixa" data-senha><h2>Trocar minha senha</h2><label>Nova senha<input name="s1" type="password" minlength="8" autocomplete="new-password" required></label><label>Repita a nova senha<input name="s2" type="password" minlength="8" autocomplete="new-password" required></label><button class="pn-bt pn-principal">Salvar nova senha</button></form>';
  conteudo().querySelector('[data-senha]').onsubmit = async e => {
    e.preventDefault(); const d = new FormData(e.target);
    if (d.get('s1') !== d.get('s2')) return aviso('As duas senhas não são iguais.', 'erro');
    if (String(d.get('s1')).length < 8) return aviso('Use pelo menos 8 caracteres.', 'erro');
    const {error} = await sb.auth.updateUser({password: d.get('s1')});
    aviso(error ? 'Não foi possível trocar: ' + error.message : 'Senha trocada!', error ? 'erro' : 'ok'); if (!error) e.target.reset();
  };
}
