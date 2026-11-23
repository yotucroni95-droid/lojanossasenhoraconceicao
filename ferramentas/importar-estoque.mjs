#!/usr/bin/env node
// Importa o arquivo de estoque da loja (CSV) e, opcionalmente, as referências extraídas dos catálogos.
// Uso:
//   node ferramentas/importar-estoque.mjs --estoque estoque.csv [--catalogos referencias.csv] [--estoque-completo] [--aplicar]
// Sem --aplicar, só mostra o relatório (simulação). Com --aplicar, regrava catalogo.js e salva o relatório em ferramentas/relatorios/.
// Regras:
//  - Estoque decide o que está à venda, variantes e preço. Catálogos completam medidas, materiais e fotos.
//  - Cruza por fabricante + código. Sem código: fabricante + modelo + variante + medidas, todos juntos.
//  - Conflito entre fontes (ex.: medidas diferentes) vira pendência: nada é atribuído por semelhança.
//  - IDs existentes nunca mudam; produtos novos sem foto ou categoria ficam "pendente" (fora da vitrine).
//  - Item que sumiu do arquivo só sai de venda com --estoque-completo (confirma que o arquivo é o estoque inteiro).
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join, dirname, basename} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOLERANCIA_CM = 2;

export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const slug = s => norm(s).replace(/ /g, '-').slice(0, 60) || 'item';
const num = s => { if (s == null || String(s).trim() === '') return null; const t = String(s).replace(/[R$\s]/g, ''); const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); return Number.isFinite(n) ? n : null; };

export function lerCsv(texto) {
  texto = texto.replace(/^﻿/, '');
  const primeira = texto.split(/\r?\n/, 1)[0];
  const sep = (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length ? ';' : ',';
  const linhas = []; let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) { if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c; continue; }
    if (c === '"') aspas = true; else if (c === sep) { linha.push(campo); campo = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = ''; } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const cab = linhas.shift().map(h => norm(h).replace(/ /g, '_'));
  return linhas.filter(l => l.some(x => x.trim())).map((l, i) => Object.fromEntries([...cab.map((h, j) => [h, (l[j] ?? '').trim()]), ['_linha', i + 2]]));
}
const pega = (r, ...nomes) => { for (const n of nomes) if (r[n] !== undefined && r[n] !== '') return r[n]; return null; };
function medidasDe(r) {
  const m = {largura: num(pega(r, 'largura', 'largura_cm', 'larg')), altura: num(pega(r, 'altura', 'altura_cm', 'alt')), profundidade: num(pega(r, 'profundidade', 'profundidade_cm', 'prof', 'comprimento'))};
  return Object.values(m).some(v => v != null) ? m : null;
}
const medidasIguais = (a, b) => ['largura', 'altura', 'profundidade'].every(k => a[k] == null || b[k] == null || Math.abs(a[k] - b[k]) <= TOLERANCIA_CM);
function linhaEstoque(r, arquivo) {
  const partes = [pega(r, 'variante'), pega(r, 'cor'), pega(r, 'tamanho'), pega(r, 'acabamento')].filter(Boolean);
  return {
    codigo: pega(r, 'codigo', 'cod', 'sku', 'referencia', 'ref'), fabricante: pega(r, 'fabricante', 'marca'), produto: pega(r, 'produto', 'descricao', 'nome', 'modelo'),
    categoria: pega(r, 'categoria', 'departamento'), variante: [...new Set(partes)].join(' / ') || 'Padrão',
    preco: num(pega(r, 'preco_vista', 'preco_a_vista', 'preco', 'valor')), parcelas: num(pega(r, 'parcelas', 'vezes')), parcela: num(pega(r, 'preco_parcelado', 'valor_parcela', 'parcela')),
    estoque: num(pega(r, 'estoque', 'quantidade', 'qtd', 'saldo')), medidas: medidasDe(r),
    atributos: Object.fromEntries([['tamanho', pega(r, 'tamanho')], ['densidade', pega(r, 'densidade')], ['lugares', pega(r, 'lugares')], ['voltagem', pega(r, 'voltagem')]].filter(([, v]) => v)),
    fonte: {arquivo, linha: r._linha}
  };
}

export function importar({products, categories, estoque, catalogos = [], estoqueCompleto = false, arquivoEstoque = 'estoque.csv', hoje = new Date().toISOString().slice(0, 10)}) {
  const produtos = structuredClone(products);
  const rel = {publicados: [], atualizados: [], pendentes: [], ausentes: [], semCodigo: [], erros: []};
  const vistos = new Set();
  const catId = nome => { const n = norm(nome); return categories.find(c => norm(c.id) === n || norm(c.name) === n)?.id || null; };
  const idsUsados = new Set(produtos.map(p => p.id));
  const novoId = base => { let id = slug(base), i = 2; while (idsUsados.has(id)) id = slug(base) + '-' + i++; idsUsados.add(id); return id; };
  const addFonte = (p, f) => { p.fontes = p.fontes || []; if (!p.fontes.some(x => JSON.stringify(x) === JSON.stringify(f))) p.fontes.push(f); };
  const addConflito = (p, c) => { p.conflitos = p.conflitos || []; if (!p.conflitos.some(x => x.campo === c.campo && x.variante === c.variante)) p.conflitos.push(c); };

  function acharPorCodigo(fab, cod) {
    for (const p of produtos) for (const v of p.variants) if (v.sku && norm(v.sku) === norm(cod) && norm(v.fabricante ?? p.fabricante) === norm(fab)) return {p, v};
    return null;
  }
  function acharSemCodigo(l) {
    for (const p of produtos) {
      if (!l.fabricante || !p.fabricante || norm(p.fabricante) !== norm(l.fabricante) || norm(p.modelo || p.name) !== norm(l.produto)) continue;
      const v = p.variants.find(v => norm(v.name) === norm(l.variante));
      if (v && (!v.medidas || !l.medidas || medidasIguais(v.medidas, l.medidas))) return {p, v};
    }
    return null;
  }

  // 1) Estoque
  for (const r of estoque) {
    const l = linhaEstoque(r, arquivoEstoque);
    if (!l.produto) { rel.erros.push('Linha ' + l.fonte.linha + ': sem nome do produto'); continue; }
    let achado = l.codigo && l.fabricante ? acharPorCodigo(l.fabricante, l.codigo) : null;
    if (!achado && !(l.codigo && l.fabricante)) achado = acharSemCodigo(l);
    if (!l.codigo) rel.semCodigo.push(l.produto + ' / ' + l.variante);
    if (achado) {
      const {p, v} = achado; const antes = JSON.stringify(v);
      if (l.preco != null) v.preco = l.preco;
      v.parcelado = l.parcelas && l.parcela ? {vezes: l.parcelas, valor: l.parcela} : v.parcelado ?? null;
      if (l.estoque != null) v.estoque = l.estoque;
      if (l.medidas) { if (!v.medidas) v.medidas = l.medidas; else if (!medidasIguais(v.medidas, l.medidas)) addConflito(p, {campo: 'medidas', variante: v.id, valores: [v.medidas, l.medidas], fontes: [l.fonte]}); }
      v.atributos = {...(v.atributos || {}), ...l.atributos};
      addFonte(p, {campo: 'estoque e preço', arquivo: l.fonte.arquivo, linha: l.fonte.linha, data: hoje});
      vistos.add(p.id + '/' + v.id);
      if (JSON.stringify(v) !== antes) rel.atualizados.push(p.id + '?cor=' + v.id);
      continue;
    }
    // Produto novo (agrupa variantes do mesmo fabricante + produto)
    let p = produtos.find(x => x._novo && norm(x.fabricante) === norm(l.fabricante) && norm(x.modelo) === norm(l.produto));
    if (!p) {
      p = {id: novoId(l.produto), ref: l.codigo || 'PEND-' + slug(l.produto).slice(0, 12), fabricante: l.fabricante, modelo: l.produto, name: l.produto, category: catId(l.categoria), status: 'pendente', _novo: true,
        description: '', details: [], images: [], variants: [], fontes: [], conflitos: []};
      produtos.push(p);
    }
    const vid = (() => { let id = slug(l.variante), i = 2; while (p.variants.some(v => v.id === id)) id = slug(l.variante) + '-' + i++; return id; })();
    p.variants.push({id: vid, name: l.variante, color: '#c9b79c', image: null, sku: l.codigo, preco: l.preco, parcelado: l.parcelas && l.parcela ? {vezes: l.parcelas, valor: l.parcela} : null, estoque: l.estoque, medidas: l.medidas, atributos: l.atributos});
    addFonte(p, {campo: 'estoque e preço', arquivo: l.fonte.arquivo, linha: l.fonte.linha, data: hoje});
    vistos.add(p.id + '/' + vid);
  }

  // 2) Catálogos: completam medidas, materiais e fotos, sem sobrescrever o estoque por semelhança
  for (const r of catalogos) {
    const ref = {codigo: pega(r, 'codigo', 'cod', 'sku', 'referencia'), fabricante: pega(r, 'fabricante', 'marca'), modelo: pega(r, 'modelo', 'produto', 'nome'), variante: pega(r, 'variante', 'cor', 'tamanho', 'acabamento'),
      medidas: medidasDe(r), material: pega(r, 'material'), acabamento: pega(r, 'acabamento'), foto: pega(r, 'foto', 'imagem'), arquivo: pega(r, 'arquivo', 'catalogo') || 'catálogo', pagina: pega(r, 'pagina', 'pag')};
    const fonte = {arquivo: ref.arquivo, ...(ref.pagina ? {pagina: ref.pagina} : {})};
    let achado = ref.codigo && ref.fabricante ? acharPorCodigo(ref.fabricante, ref.codigo) : null;
    let exato = !!achado;
    if (!achado && ref.fabricante && ref.modelo) {
      // Sem código: marca + modelo + variante + medidas precisam bater juntos.
      for (const p of produtos) {
        if (norm(p.fabricante) !== norm(ref.fabricante) || norm(p.modelo || p.name) !== norm(ref.modelo)) continue;
        const v = p.variants.find(v => !ref.variante || norm(v.name) === norm(ref.variante));
        if (!v) continue;
        if (v.medidas && ref.medidas && !medidasIguais(v.medidas, ref.medidas)) { addConflito(p, {campo: 'medidas/foto do catálogo', variante: v.id, valores: [v.medidas, ref.medidas], fontes: [fonte], nota: 'Modelo parecido com medidas diferentes: foto e medidas não atribuídas'}); achado = null; break; }
        if (v.medidas && ref.medidas) { achado = {p, v}; exato = true; }
        else addConflito(p, {campo: 'correspondência sem código', variante: v.id, fontes: [fonte], nota: 'Sem código e sem medidas para confirmar: conferir manualmente'});
        break;
      }
    }
    if (!achado || !exato) continue;
    const {p, v} = achado;
    if (ref.medidas) { if (!v.medidas) { v.medidas = ref.medidas; addFonte(p, {campo: 'medidas', ...fonte}); } else if (!medidasIguais(v.medidas, ref.medidas)) { addConflito(p, {campo: 'medidas', variante: v.id, valores: [v.medidas, ref.medidas], fontes: [fonte]}); continue; } }
    if (ref.material && !p.details.includes('Material: ' + ref.material)) { p.details.push('Material: ' + ref.material); addFonte(p, {campo: 'material', ...fonte}); }
    if (ref.acabamento && !p.details.includes('Acabamento: ' + ref.acabamento)) { p.details.push('Acabamento: ' + ref.acabamento); addFonte(p, {campo: 'acabamento', ...fonte}); }
    if (ref.foto) {
      if (!v.image) v.image = ref.foto, v.imageTipo = 'catalogo';
      else if (![v.image, ...(p.images || []).map(i => i.src)].includes(ref.foto)) p.images.push({src: ref.foto, tipo: 'catalogo', alt: p.name + ' — ' + v.name, variante: v.id});
      addFonte(p, {campo: 'foto', ...fonte});
    }
  }

  // 3) Status final e ausentes
  for (const p of produtos) {
    if (p._novo) {
      const motivos = [];
      if (!p.category) motivos.push('categoria não reconhecida');
      if (!p.variants.some(v => v.image)) motivos.push('sem foto autorizada');
      if (p.conflitos?.length) motivos.push('conflito entre fontes');
      p.variants.forEach(v => { if (!v.image) v.image = p.variants.find(x => x.image)?.image || null; });
      if (motivos.length) { p.status = 'pendente'; p.motivosPendencia = motivos; rel.pendentes.push(p.id + ' (' + motivos.join(', ') + ')'); }
      else { p.status = 'ativo'; delete p.motivosPendencia; rel.publicados.push(p.id); }
      delete p._novo;
    } else if (p.conflitos?.length) rel.pendentes.push(p.id + ' (conflito: ' + p.conflitos.map(c => c.campo).join(', ') + ')');
    for (const v of p.variants) {
      if (!v.sku || vistos.has(p.id + '/' + v.id)) continue;
      rel.ausentes.push(p.id + '?cor=' + v.id);
      if (estoqueCompleto) v.estoque = 0; // sai de venda, link continua funcionando
    }
    if (!p.conflitos?.length) delete p.conflitos;
  }
  return {produtos, relatorio: rel};
}

export function gerarCatalogoJs(categories, produtos) {
  return '// Catálogo publicado. Pode ser editado à mão ou atualizado por ferramentas/importar-estoque.mjs.\n' +
    '// Nunca altere "id" de produto ou variante: eles formam os links já divulgados (#/produto/<id>?cor=<variante>).\n' +
    '// Campos null = dado ainda não confirmado pela loja (aparece como pendente e "sob consulta").\n' +
    '// Medidas em centímetros: largura, altura, profundidade. Preços em reais.\n' +
    'export const categories = [\n' + categories.map(c => ' ' + JSON.stringify(c)).join(',\n') + '\n];\n\n' +
    'export const products = [\n' + produtos.map(p => ' ' + JSON.stringify(p)).join(',\n') + '\n];\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const arqEstoque = opt('--estoque');
  if (!arqEstoque) { console.error('Informe --estoque arquivo.csv'); process.exit(1); }
  const {products, categories} = await import(pathToFileURL(join(raiz, 'catalogo.js')).href + '?t=' + Date.now());
  const estoque = lerCsv(await readFile(arqEstoque, 'utf8'));
  const catalogos = opt('--catalogos') ? lerCsv(await readFile(opt('--catalogos'), 'utf8')) : [];
  const {produtos, relatorio} = importar({products, categories, estoque, catalogos, estoqueCompleto: args.includes('--estoque-completo'), arquivoEstoque: basename(arqEstoque)});
  const r = relatorio;
  console.log(`\nImportação ${args.includes('--aplicar') ? 'APLICADA' : '(simulação — use --aplicar para gravar)'}`);
  console.log(`Publicados (novos): ${r.publicados.length}\nAtualizados: ${r.atualizados.length}\nPendentes de conferência: ${r.pendentes.length}\nAusentes do arquivo: ${r.ausentes.length}${r.ausentes.length && !args.includes('--estoque-completo') ? ' (mantidos à venda; confirme se o arquivo é o estoque completo e use --estoque-completo)' : ''}`);
  for (const [k, lista] of Object.entries(r)) if (lista.length) console.log('\n' + k + ':\n  ' + lista.join('\n  '));
  if (args.includes('--aplicar')) {
    await writeFile(join(raiz, 'catalogo.js'), gerarCatalogoJs(categories, produtos));
    await mkdir(join(raiz, 'ferramentas', 'relatorios'), {recursive: true});
    const nome = join(raiz, 'ferramentas', 'relatorios', 'importacao-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    await writeFile(nome, JSON.stringify(r, null, 1));
    console.log('\ncatalogo.js atualizado. Relatório: ' + nome);
  }
}
