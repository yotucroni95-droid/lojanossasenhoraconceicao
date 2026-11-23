// Regras compartilhadas entre o site e o servidor de pagamento: preço vigente, campanha,
// estoque, frete e mensagens. O servidor recalcula tudo com este mesmo código antes de cobrar.
import {products, categories} from '../catalogo.js?v=3';
import {campanhas, entrega, loja} from '../config.js?v=3';
import {variantesTeste, ofertasTeste} from '../dados-teste.js?v=3';

export {categories, campanhas, loja, entrega};

export const reais = valor => new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(valor).replace(/ /g, ' ');
const centavos = v => Math.round(Number(v) * 100);
const deCentavos = c => c / 100;

export function faseCampanha(c, agora = new Date()) {
  const t = +new Date(agora);
  if (t < +new Date(c.anuncioDesde || c.inicio)) return null;
  if (t < +new Date(c.inicio)) return 'anuncio';
  if (t <= +new Date(c.fim)) return 'ativa';
  return 'encerrada';
}

// Monta o catálogo efetivo: base confirmada -> valores de teste (só no modo teste) -> oferta de campanha ativa -> ajustes de teste.
export function montarCatalogo({modo = 'producao', ajustes = {}, agora = new Date(), precos = loja.exibirPrecos !== false} = {}) {
  const teste = modo === 'teste';
  const ofertas = new Map();
  for (const c of campanhas) {
    if (!precos || faseCampanha(c, agora) !== 'ativa') continue;
    for (const o of [...(c.ofertas || []), ...(teste ? ofertasTeste[c.id] || [] : [])]) ofertas.set(o.produto + '/' + o.variante, {...o, campanha: c.id, nomeCampanha: c.nome});
  }
  return products.filter(p => p.status !== 'pendente').map(p => ({
    ...p,
    variants: p.variants.map(v => {
      const t = teste ? variantesTeste[p.id]?.[v.id] || {} : {};
      const r = {...v, ...t, atributos: {...(v.atributos || {}), ...(t.atributos || {})}, valoresTeste: Object.keys(t).length > 0};
      const o = ofertas.get(p.id + '/' + v.id);
      if (o) {
        r.precoDe = o.precoDe ?? r.preco;
        r.preco = o.preco;
        r.parcelado = o.parcelado || null;
        r.campanha = o.campanha;
        r.nomeCampanha = o.nomeCampanha;
      }
      const a = ajustes[p.id + '/' + v.id];
      if (a) {
        if (a.preco !== undefined) r.preco = a.preco;
        if (a.estoque !== undefined) r.estoque = a.estoque;
      }
      if (p.ativo === false) r.estoque = 0;
      if (!precos) { r.preco = null; r.parcelado = null; r.precoDe = null; }
      return r;
    })
  }));
}

export const acharProduto = (catalogo, id) => catalogo.find(p => p.id === id);
export const acharVariante = (p, id) => p?.variants.find(v => v.id === id);

export function disponibilidade(v) {
  if (v.estoque === null || v.estoque === undefined) return {codigo: 'consulta', texto: 'Disponibilidade sob consulta'};
  if (v.estoque <= 0) return {codigo: 'esgotado', texto: 'Esgotado no momento'};
  return {codigo: 'disponivel', texto: v.estoque === 1 ? 'Última unidade' : v.estoque === 2 ? 'Últimas 2 unidades' : 'Disponível'};
}

export function medidasTexto(m) {
  if (!m || [m.largura, m.altura, m.profundidade].some(x => x == null)) return null;
  return 'L ' + m.largura + ' × A ' + m.altura + ' × P ' + m.profundidade + ' cm';
}

export function pendencias(p, v) {
  const lista = [];
  if (v.preco == null && loja.exibirPrecos !== false) lista.push('preço');
  if (!medidasTexto(v.medidas)) lista.push('medidas');
  if (v.estoque == null) lista.push('disponibilidade');
  if (!v.sku) lista.push('código da loja');
  if (p.demo || v.demo) lista.push('produto/cor demonstrativo');
  for (const c of p.conflitos || []) if (!c.variante || c.variante === v.id) lista.push('conflito: ' + c.campo);
  return lista;
}

const rotuloFoto = {catalogo: 'Foto do catálogo do fabricante', ia: 'Ambientação ilustrativa criada com IA a partir do produto', real: 'Foto do produto na loja', detalhe: 'Detalhe — foto do produto na loja'};
export function galeria(p, v) {
  const fotos = [{src: v.image, tipo: v.imageTipo || 'ia', alt: p.name + ' — ' + v.name}];
  for (const img of [...(v.images || []), ...(p.images || [])]) if (!img.variante || img.variante === v.id) fotos.push(img);
  return fotos.map(f => ({...f, rotulo: rotuloFoto[f.tipo] || ''}));
}

// Recalcula um carrinho. itens: [{id, variant, qty, precoVisto?}]. entregaTipo: 'retirada' | 'domicilio'.
export function cotar(catalogo, itens, entregaTipo = 'retirada', cidade = '') {
  const problemas = [];
  const linhas = [];
  let subtotalC = 0, semPreco = 0;
  for (const item of itens) {
    const p = acharProduto(catalogo, item.id), v = acharVariante(p, item.variant);
    const qtd = Number(item.qty);
    if (!p || !v || !Number.isInteger(qtd) || qtd < 1 || qtd > 99) { problemas.push({tipo: 'invalido', item}); continue; }
    const unit = v.preco == null ? null : Number(v.preco);
    const total = unit == null ? null : deCentavos(centavos(unit) * qtd);
    if (unit == null) { semPreco++; problemas.push({tipo: 'sem-preco', id: p.id, variant: v.id, nome: p.name}); } else subtotalC += centavos(unit) * qtd;
    const disp = disponibilidade(v);
    if (disp.codigo === 'esgotado') problemas.push({tipo: 'esgotado', id: p.id, variant: v.id, nome: p.name});
    else if (disp.codigo === 'disponivel' && qtd > v.estoque) problemas.push({tipo: 'estoque-insuficiente', id: p.id, variant: v.id, nome: p.name, disponivel: v.estoque});
    else if (disp.codigo === 'consulta') problemas.push({tipo: 'estoque-sob-consulta', id: p.id, variant: v.id, nome: p.name});
    if (item.precoVisto !== undefined && unit != null && centavos(item.precoVisto) !== centavos(unit)) problemas.push({tipo: 'preco-mudou', id: p.id, variant: v.id, nome: p.name, antes: Number(item.precoVisto), agora: unit});
    linhas.push({p, v, qtd, unit, total});
  }
  const cfg = entregaTipo === 'domicilio' ? entrega.domicilio : entrega.retirada;
  const gratis = entregaTipo === 'domicilio' && cidade && (entrega.domicilio.gratisPara || []).some(c => c.toLowerCase() === String(cidade).toLowerCase());
  const freteValor = entregaTipo === 'domicilio' ? (gratis ? 0 : cfg.tipo === 'fixo' ? cfg.valor : null) : cfg.frete;
  const frete = {tipo: entregaTipo, valor: freteValor, texto: cfg.texto, confirmada: !!cfg.confirmada,
    cidade: gratis ? cidade : null, situacao: freteValor == null ? 'a calcular pelo atendimento' : freteValor === 0 ? (gratis ? 'grátis para ' + cidade : 'sem custo (retirada)') : reais(freteValor)};
  if (freteValor == null) problemas.push({tipo: 'frete-cotacao'});
  const subtotal = deCentavos(subtotalC);
  const total = semPreco || freteValor == null ? null : deCentavos(subtotalC + centavos(freteValor));
  return {linhas, subtotal, semPreco, frete, total, problemas, podePagar: linhas.length > 0 && problemas.length === 0};
}

export function linkProduto(p, v) {
  return loja.canonico + '#/produto/' + encodeURIComponent(p.id) + '?cor=' + encodeURIComponent(v.id);
}

export function mensagemProduto({p, v, qtd = 1, modo}) {
  const preco = v.preco == null ? 'sob consulta' : reais(v.preco) + ' à vista' + (v.parcelado ? ' ou ' + v.parcelado.vezes + 'x de ' + reais(v.parcelado.valor) : '');
  return 'Olá! Tenho interesse neste produto do site da ' + loja.nome + ':\n\n' +
    'Modelo: ' + p.name + '\n' +
    'Código: ' + (v.sku ? v.sku + ' (cód. loja)' : p.ref) + '\n' +
    'Variante: ' + v.name + (v.demo ? ' (cor demonstrativa)' : '') + '\n' +
    'Quantidade: ' + qtd + '\n' +
    (loja.exibirPrecos === false ? '' : 'Preço: ' + preco + (modo === 'teste' && v.valoresTeste ? ' [PREÇO DE TESTE]' : '') + '\n') +
    'Link: ' + linkProduto(p, v) + '\n\n' +
    (loja.exibirPrecos === false ? 'Pode me passar o preço, a disponibilidade e as condições de entrega?' : 'Pode me ajudar com disponibilidade, medidas e entrega?');
}

export function mensagemPedido({cotacao, modo, observacao = ''}) {
  let t = 'Olá! Quero fazer este pedido pelo site da ' + loja.nome + ':\n\n';
  cotacao.linhas.forEach((l, i) => {
    t += (i + 1) + '. ' + l.p.name + ' (cód. ' + (l.v.sku || l.p.ref) + ') · ' + l.v.name + ' · ' + l.qtd + (loja.exibirPrecos === false ? ' un.' : ' × ' +
      (l.unit == null ? 'preço sob consulta' : reais(l.unit) + ' = ' + reais(l.total))) + '\n   ' + linkProduto(l.p, l.v) + '\n';
  });
  if (loja.exibirPrecos !== false) t += '\nSubtotal: ' + reais(cotacao.subtotal) + (cotacao.semPreco ? ' (+ ' + cotacao.semPreco + ' item(ns) com preço a consultar)' : '') + '\n';
  else t += '\n';
  t += 'Entrega: ' + (cotacao.frete.tipo === 'domicilio' ? 'no meu endereço' + (cotacao.frete.cidade ? ' (' + cotacao.frete.cidade + ')' : '') : 'retirada na loja') + ' — frete ' + cotacao.frete.situacao + '\n';
  if (loja.exibirPrecos !== false) t += 'Total: ' + (cotacao.total == null ? 'a confirmar' : reais(cotacao.total)) + '\n';
  if (modo === 'teste') t += loja.exibirPrecos === false ? '[PEDIDO DE TESTE]\n' : '[PEDIDO DE TESTE — valores fictícios]\n';
  if (observacao.trim()) t += '\nObservação: ' + observacao.trim() + '\n';
  return t + (loja.exibirPrecos === false ? '\nPodem me passar os preços, a disponibilidade e as condições?' : '\nPodem confirmar disponibilidade e condições?');
}

export const linkWhatsapp = texto => loja.whatsapp + '?text=' + encodeURIComponent(texto);
