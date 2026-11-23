// Rodar: node --test testes/loja.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {importar, lerCsv} from '../ferramentas/importar-estoque.mjs';
import {products, categories} from '../catalogo.js';
import {montarCatalogo, cotar, mensagemPedido} from '../loja/regras.js';
import {criarNucleo, assinar} from '../loja/pedidos.js';

const csv = t => lerCsv(t.trim());

test('importação: novos, atualização sem duplicar e links estáveis', () => {
  const estoque = csv(`codigo;fabricante;produto;categoria;tamanho;preco_vista;estoque;largura;altura;profundidade
C100;Ortobom;Colchão Light;Quarto;Casal;899,90;4;138;20;188
C101;Ortobom;Colchão Light;Quarto;Solteiro;599,90;2;88;20;188`);
  const catalogos = csv(`codigo,fabricante,modelo,variante,largura,altura,profundidade,material,foto,arquivo,pagina
C100,Ortobom,Colchão Light,Casal,138,20,188,Espuma D28,assets/cat/light-casal.jpg,ortobom-2026.pdf,12`);
  const r1 = importar({products, categories, estoque, catalogos});
  const novo = r1.produtos.find(p => p.modelo === 'Colchão Light');
  assert.equal(novo.variants.length, 2, 'casal e solteiro são variantes próprias');
  assert.equal(novo.variants[0].preco, 899.9);
  assert.equal(novo.variants[1].medidas.largura, 88);
  assert.equal(novo.status, 'ativo');
  assert.ok(novo.fontes.some(f => f.arquivo === 'ortobom-2026.pdf' && f.pagina === '12'));
  assert.equal(r1.relatorio.publicados.length, 1);
  // Reimportar com preço novo: atualiza, não duplica, mantém id
  const estoque2 = csv(`codigo;fabricante;produto;categoria;tamanho;preco_vista;estoque
C100;Ortobom;Colchão Light;Quarto;Casal;949,90;3`);
  const r2 = importar({products: r1.produtos, categories, estoque: estoque2});
  assert.equal(r2.produtos.filter(p => p.modelo === 'Colchão Light').length, 1);
  const mesmo = r2.produtos.find(p => p.id === novo.id);
  assert.equal(mesmo.variants[0].preco, 949.9);
  assert.equal(r2.relatorio.atualizados.length, 1);
  // Solteiro sumiu do arquivo: não sai de venda sem confirmação
  assert.deepEqual(r2.relatorio.ausentes.filter(a => a.startsWith(novo.id)), [novo.id + '?cor=solteiro']);
  assert.equal(mesmo.variants[1].estoque, 2);
  const r3 = importar({products: r1.produtos, categories, estoque: estoque2, estoqueCompleto: true});
  assert.equal(r3.produtos.find(p => p.id === novo.id).variants[1].estoque, 0);
  // Produtos antigos continuam com os mesmos ids
  for (const p of products) assert.ok(r3.produtos.some(x => x.id === p.id));
});

test('importação: conflito de medidas não atribui foto por semelhança', () => {
  const estoque = csv(`fabricante;produto;categoria;cor;preco_vista;estoque;largura;altura;profundidade
Moveis X;Sofá Lisboa;Estofados;Cinza;2100;1;210;90;95`);
  const catalogos = csv(`fabricante,modelo,variante,largura,altura,profundidade,foto,arquivo,pagina
Moveis X,Sofá Lisboa,Cinza,230,90,95,assets/cat/lisboa.jpg,moveisx.pdf,4`);
  const r = importar({products, categories, estoque, catalogos});
  const p = r.produtos.find(x => x.modelo === 'Sofá Lisboa');
  assert.equal(p.variants[0].image, null);
  assert.equal(p.variants[0].medidas.largura, 210);
  assert.equal(p.status, 'pendente');
  assert.ok(p.conflitos.length >= 1);
});

test('carrinho: total, frete por cotação e mensagem', () => {
  const cat = montarCatalogo({modo: 'teste', precos: true, agora: new Date('2026-11-23T12:00:00-03:00')});
  const c = cotar(cat, [{id: 'estofado-01', variant: 'caramelo', qty: 2}, {id: 'air-fryer-01', variant: 'preto', qty: 1}]);
  assert.equal(c.total, 4347);
  assert.ok(c.podePagar);
  const d = cotar(cat, [{id: 'estofado-01', variant: 'caramelo', qty: 1}], 'domicilio');
  assert.equal(d.total, null);
  assert.ok(d.problemas.some(p => p.tipo === 'frete-cotacao'));
  assert.match(mensagemPedido({cotacao: c, modo: 'teste'}), /cód\. NSC-001/);
  // Produção: nada de preço de teste
  const prod = montarCatalogo({modo: 'producao'});
  assert.ok(prod.every(p => p.variants.every(v => v.preco == null)));
});

test('campanha só vale no período', () => {
  const durante = montarCatalogo({modo: 'teste', precos: true, agora: new Date('2026-11-28T12:00:00-03:00')});
  const depois = montarCatalogo({modo: 'teste', precos: true, agora: new Date('2026-12-01T12:00:00-03:00')});
  assert.equal(durante.find(p => p.id === 'cama-01').variants[0].preco, 899);
  assert.equal(depois.find(p => p.id === 'cama-01').variants[0].preco, 999);
});

test('pagamento: idempotência, assinatura, duplicidade e estoque', async () => {
  let estado = null;
  const segredo = 'segredo-de-teste-123456';
  const n = criarNucleo({segredo, modo: 'teste', precos: true, armazenamento: {ler: async () => estado, gravar: async s => { estado = structuredClone(s); }}, provedor: {criarCobranca: async p => ({url: 'x/' + p.id})}});
  const itens = [{id: 'roupeiro-01', variant: 'branco-madeira', qty: 1, precoVisto: 1290}];
  const a = await n.criarPedido({itens, entregaTipo: 'retirada', chave: 'chave-0001'});
  const b = await n.criarPedido({itens, entregaTipo: 'retirada', chave: 'chave-0001'});
  assert.equal(a.pedido.id, b.pedido.id);
  const corpo = JSON.stringify({id: 'evt1', pedido: a.pedido.id, status: 'aprovado', valor: 1290});
  assert.equal((await n.receberNotificacao(corpo, 'errada')).http, 401);
  const sig = await assinar(segredo, corpo);
  assert.equal((await n.receberNotificacao(corpo, sig)).pedido.status, 'aprovado');
  assert.ok((await n.receberNotificacao(corpo, sig)).duplicado);
  assert.equal((await n.consultar(a.pedido.id)).historico.length, 2);
  // estoque 1 -> 0: novo pedido do mesmo item é recusado
  const c = await n.criarPedido({itens, entregaTipo: 'retirada', chave: 'chave-0002'});
  assert.equal(c.ok, false);
  assert.equal(c.problemas[0].tipo, 'esgotado');
  // preço mudou
  await n.ajustarTeste({id: 'painel-01', variant: 'madeira-claro', preco: 850});
  const d = await n.criarPedido({itens: [{id: 'painel-01', variant: 'madeira-claro', qty: 1, precoVisto: 790}], entregaTipo: 'retirada', chave: 'chave-0003'});
  assert.equal(d.problemas[0].tipo, 'preco-mudou');
  // valor divergente na notificação
  const e = await n.criarPedido({itens: [{id: 'painel-01', variant: 'madeira-claro', qty: 1, precoVisto: 850}], entregaTipo: 'retirada', chave: 'chave-0004'});
  const corpo2 = JSON.stringify({id: 'evt2', pedido: e.pedido.id, status: 'aprovado', valor: 1});
  assert.equal((await n.receberNotificacao(corpo2, await assinar(segredo, corpo2))).erro, 'valor-divergente');
});

test('catálogo da loja: sem preço publicado, código da loja e estoque do relatório', async () => {
  const {produtosLoja} = await import('../catalogo-loja.js');
  const cat = montarCatalogo({modo: 'producao'});
  assert.ok(cat.every(p => p.variants.every(v => v.preco == null)), 'nenhum preço aparece');
  const odin = cat.find(p => p.id === 'colchao-odin');
  assert.equal(odin.variants.find(v => v.id === 'king').sku, '000675');
  const ids = produtosLoja.flatMap(p => p.variants.map(v => p.id + '/' + v.id));
  assert.equal(new Set(ids).size, ids.length, 'ids únicos');
  const skus = produtosLoja.flatMap(p => p.variants.map(v => v.sku));
  assert.equal(new Set(skus).size, skus.length, 'cada código da loja aparece uma vez');
  assert.ok(produtosLoja.every(p => p.variants.every(v => v.estoque === null || v.estoque >= 0)));
});
