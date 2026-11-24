// Núcleo de pedidos e pagamento, independente de ambiente (servidor Node ou simulação no navegador).
// - Recalcula preço, estoque e frete a partir do catálogo confiável antes de criar a cobrança.
// - Pedido idempotente pela "chave" enviada pelo cliente (clique duplo não duplica o pedido).
// - Notificação do provedor só é aceita com assinatura HMAC válida; eventos repetidos são ignorados.
import {montarCatalogo, cotar, acharProduto, acharVariante} from './regras.js?v=12';

export const ESTADOS = {
  'aguardando-pagamento': 'Aguardando pagamento',
  pendente: 'Pagamento pendente',
  aprovado: 'Pagamento aprovado',
  recusado: 'Pagamento recusado',
  cancelado: 'Pagamento cancelado'
};
const FINAIS = new Set(['aprovado', 'recusado', 'cancelado']);
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

export async function assinar(segredo, texto) {
  const chave = await crypto.subtle.importKey('raw', enc.encode(segredo), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', chave, enc.encode(texto)));
}
function iguais(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const cents = v => Math.round(Number(v) * 100);

export function criarNucleo({armazenamento, segredo, modo = 'teste', provedor, agora = () => new Date(), precos}) {
  if (!segredo || segredo.length < 16) throw new Error('Segredo de notificação ausente ou curto demais.');
  let fila = Promise.resolve();
  const exclusivo = fn => { const r = fila.then(fn, fn); fila = r.catch(() => {}); return r; };
  const ler = async () => ({pedidos: {}, chaves: {}, eventos: {}, ajustes: {}, ...(await armazenamento.ler() || {})});
  const dataEfetiva = dataTeste => (modo === 'teste' && dataTeste && !isNaN(new Date(dataTeste))) ? new Date(dataTeste) : agora();

  return {
    async catalogo(dataTeste) { const s = await ler(); return montarCatalogo({modo, precos, ajustes: s.ajustes, agora: dataEfetiva(dataTeste)}); },

    criarPedido: ({itens, entregaTipo, cidade, chave, dataTeste}) => exclusivo(async () => {
      if (typeof chave !== 'string' || !/^[\w-]{8,64}$/.test(chave)) return {ok: false, erro: 'chave-invalida'};
      if (!Array.isArray(itens) || !itens.length || itens.length > 40) return {ok: false, erro: 'itens-invalidos'};
      const s = await ler();
      if (s.chaves[chave]) { const p = s.pedidos[s.chaves[chave]]; return {ok: true, repetido: true, pedido: p, checkoutUrl: p.checkoutUrl}; }
      const catalogo = montarCatalogo({modo, precos, ajustes: s.ajustes, agora: dataEfetiva(dataTeste)});
      const c = cotar(catalogo, itens.map(i => ({id: String(i.id), variant: String(i.variant), qty: Number(i.qty), precoVisto: i.precoVisto})), entregaTipo === 'domicilio' ? 'domicilio' : 'retirada', typeof cidade === 'string' ? cidade.slice(0, 60) : '');
      if (!c.podePagar) return {ok: false, erro: 'revisar', problemas: c.problemas};
      const d = agora();
      const id = 'NSC-' + d.toISOString().slice(0, 10).replace(/-/g, '') + '-' + hex(crypto.getRandomValues(new Uint8Array(3))).toUpperCase();
      const pedido = {
        id, chave, modo, status: 'aguardando-pagamento', criadoEm: d.toISOString(), entregaTipo: c.frete.tipo, cidade: c.frete.cidade,
        itens: c.linhas.map(l => ({id: l.p.id, variant: l.v.id, nome: l.p.name, ref: l.p.ref, variante: l.v.name, qtd: l.qtd, unit: l.unit, total: l.total})),
        subtotal: c.subtotal, frete: c.frete.valor, total: c.total, historico: [{status: 'aguardando-pagamento', em: d.toISOString()}]
      };
      const cobranca = await provedor.criarCobranca(pedido);
      pedido.checkoutUrl = cobranca.url;
      pedido.referenciaProvedor = cobranca.referencia || null;
      s.pedidos[id] = pedido;
      s.chaves[chave] = id;
      await armazenamento.gravar(s);
      return {ok: true, pedido, checkoutUrl: pedido.checkoutUrl};
    }),

    async consultar(id) { const s = await ler(); return s.pedidos[id] || null; },

    // corpo: texto JSON exatamente como recebido; assinatura: cabeçalho enviado pelo provedor.
    receberNotificacao: (corpo, assinatura) => exclusivo(async () => {
      if (!iguais(await assinar(segredo, corpo), String(assinatura || ''))) return {ok: false, http: 401, erro: 'assinatura-invalida'};
      let ev;
      try { ev = JSON.parse(corpo); } catch { return {ok: false, http: 400, erro: 'corpo-invalido'}; }
      if (!ev || typeof ev.id !== 'string' || !ESTADOS[ev.status] || ev.status === 'aguardando-pagamento') return {ok: false, http: 400, erro: 'evento-invalido'};
      const s = await ler();
      if (s.eventos[ev.id]) return {ok: true, http: 200, duplicado: true};
      const pedido = s.pedidos[ev.pedido];
      if (!pedido) return {ok: false, http: 404, erro: 'pedido-inexistente'};
      s.eventos[ev.id] = {pedido: pedido.id, status: ev.status, em: agora().toISOString()};
      if (FINAIS.has(pedido.status)) { await armazenamento.gravar(s); return {ok: true, http: 200, ignorado: 'pedido-finalizado', pedido}; }
      if (ev.status === 'aprovado' && cents(ev.valor) !== cents(pedido.total)) {
        pedido.alerta = 'Valor pago diferente do total do pedido: conferir manualmente.';
        await armazenamento.gravar(s);
        return {ok: false, http: 422, erro: 'valor-divergente'};
      }
      pedido.status = ev.status;
      pedido.historico.push({status: ev.status, em: agora().toISOString(), evento: ev.id});
      if (ev.status === 'aprovado') {
        const cat = montarCatalogo({modo, precos, ajustes: s.ajustes, agora: new Date(pedido.criadoEm)});
        for (const it of pedido.itens) {
          const v = acharVariante(acharProduto(cat, it.id), it.variant);
          if (v && typeof v.estoque === 'number') {
            const chaveAj = it.id + '/' + it.variant;
            if (v.estoque < it.qtd) pedido.alerta = 'Estoque insuficiente na aprovação: atendimento deve contatar o cliente.';
            s.ajustes[chaveAj] = {...(s.ajustes[chaveAj] || {}), estoque: Math.max(0, v.estoque - it.qtd)};
          }
        }
      }
      await armazenamento.gravar(s);
      return {ok: true, http: 200, pedido};
    }),

    // Apenas no modo teste: simula mudança de preço ou estoque antes do pagamento.
    ajustarTeste: ({id, variant, preco, estoque}) => exclusivo(async () => {
      if (modo !== 'teste') return {ok: false, erro: 'somente-teste'};
      const s = await ler();
      const k = id + '/' + variant;
      if (preco === null && estoque === null) delete s.ajustes[k];
      else s.ajustes[k] = {...(s.ajustes[k] || {}), ...(preco !== undefined ? {preco} : {}), ...(estoque !== undefined ? {estoque} : {})};
      await armazenamento.gravar(s);
      return {ok: true, ajuste: s.ajustes[k] || null};
    }),

    limparTeste: () => exclusivo(async () => { if (modo === 'teste') await armazenamento.gravar(null); return {ok: modo === 'teste'}; })
  };
}
