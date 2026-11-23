// Servidor da prévia: serve o site e a API de pedidos/pagamento.
// O GitHub Pages só hospeda arquivos estáticos; em produção este serviço precisa rodar em um backend
// (ex.: Render, Railway, Cloudflare Workers adaptado) com as credenciais do provedor em variáveis de ambiente.
// Uso: node servidor/servidor.mjs   (PORTA=8096, MODO=teste, SEGREDO_WEBHOOK=...)
import http from 'node:http';
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {extname, join, normalize, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {criarNucleo, assinar, ESTADOS} from '../loja/pedidos.js';
import {reais} from '../loja/regras.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = Number(process.env.PORTA || 8096);
const MODO = process.env.MODO === 'producao' ? 'producao' : 'teste';
const SEGREDO = process.env.SEGREDO_WEBHOOK || (MODO === 'teste' ? 'segredo-local-' + randomBytes(12).toString('hex') : '');
const arquivoDados = process.env.ARQUIVO_PEDIDOS || join(raiz, 'servidor', 'dados', 'pedidos-teste.json');
if (MODO === 'producao') { console.error('Modo produção exige um provedor real configurado. Este servidor só implementa o provedor de testes.'); process.exit(1); }

const armazenamento = {
  async ler() { try { return JSON.parse(await readFile(arquivoDados, 'utf8')); } catch { return null; } },
  async gravar(s) { await mkdir(dirname(arquivoDados), {recursive: true}); const tmp = arquivoDados + '.tmp'; await writeFile(tmp, JSON.stringify(s ?? {}, null, 1)); await rename(tmp, arquivoDados); }
};
// Provedor de testes: imita um checkout hospedado (Pix e cartão) que depois notifica o servidor.
const provedor = { async criarCobranca(p) { return {url: 'pagamento-teste/' + p.id, referencia: 'teste_' + p.id}; } };
const nucleo = criarNucleo({armazenamento, segredo: SEGREDO, modo: MODO, provedor});

const tipos = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/plain; charset=utf-8', '.webp': 'image/webp'};
const bloqueados = /^\/(servidor|ferramentas|testes|\.git|\.claude)(\/|$)/;
const json = (res, http, dados) => { res.writeHead(http, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}); res.end(JSON.stringify(dados)); };
async function corpo(req, limite = 100_000) {
  let t = '';
  for await (const parte of req) { t += parte; if (t.length > limite) throw new Error('corpo-grande'); }
  return t;
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

function paginaPagamento(p) {
  const finalizado = ['aprovado', 'recusado', 'cancelado'].includes(p.status);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pagamento de teste</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f3efe8;color:#2b241f}main{max-width:440px;margin:0 auto;padding:24px 16px}.aviso{background:#fff3cd;border:1px solid #e0c36a;padding:12px;border-radius:8px;font-size:13px}.caixa{background:#fff;border-radius:12px;padding:20px;margin-top:16px}h1{font-size:20px;margin:0 0 4px}.total{font-size:28px;font-weight:700;margin:8px 0}button{display:block;width:100%;min-height:48px;margin-top:10px;border:0;border-radius:8px;font:600 15px system-ui;cursor:pointer}.a{background:#1f7a3d;color:#fff}.p{background:#b9892f;color:#fff}.r{background:#8f2d22;color:#fff}.c{background:#e6e0d6;color:#2b241f}label{display:flex;gap:8px;align-items:center;margin-top:14px;font-size:13px}ul{padding-left:18px}</style></head>
<body><main><p class="aviso"><strong>Ambiente de testes.</strong> Nenhuma cobrança real é feita. Esta página simula o checkout hospedado do provedor (Pix e cartão).</p>
<div class="caixa"><h1>Pedido ${esc(p.id)}</h1><ul>${p.itens.map(i => `<li>${esc(i.qtd)} × ${esc(i.nome)} (${esc(i.variante)}) — ${esc(reais(i.total))}</li>`).join('')}</ul><div class="total">${esc(reais(p.total))}</div>
${finalizado ? `<p>Este pedido já está <strong>${esc(ESTADOS[p.status])}</strong>.</p><a href="../#/pedido/${esc(p.id)}">Voltar à loja</a>` : `<form method="post">
<button class="a" name="resultado" value="aprovado">Simular pagamento aprovado</button>
<button class="p" name="resultado" value="pendente">Simular Pix pendente</button>
<button class="r" name="resultado" value="recusado">Simular cartão recusado</button>
<button class="c" name="resultado" value="cancelado">Cancelar e voltar à loja</button>
<label><input type="checkbox" name="repetir" value="1"> Enviar a notificação duas vezes (teste de duplicidade)</label></form>`}
</div></main></body></html>`;
}

async function notificar(pedido, status, repetir) {
  const ev = JSON.stringify({id: 'evt_' + randomBytes(8).toString('hex'), pedido: pedido.id, status, valor: pedido.total});
  const enviar = async () => fetch(`http://127.0.0.1:${PORTA}/api/webhooks/pagamento`, {method: 'POST', headers: {'content-type': 'application/json', 'x-assinatura': await assinar(SEGREDO, ev)}, body: ev}).then(r => r.json());
  const resultados = [await enviar()];
  if (repetir) resultados.push(await enviar());
  return resultados;
}

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const caminho = decodeURIComponent(url.pathname);
    if (caminho === '/api/saude') return json(res, 200, {ok: true, modo: MODO, provedor: 'teste'});
    if (caminho === '/api/pedidos' && req.method === 'POST') {
      const r = await nucleo.criarPedido(JSON.parse(await corpo(req)));
      return json(res, r.ok ? 201 : 409, r);
    }
    let m = caminho.match(/^\/api\/pedidos\/([\w-]{1,40})$/);
    if (m && req.method === 'GET') { const p = await nucleo.consultar(m[1]); return p ? json(res, 200, {ok: true, pedido: p}) : json(res, 404, {ok: false}); }
    if (caminho === '/api/webhooks/pagamento' && req.method === 'POST') {
      const r = await nucleo.receberNotificacao(await corpo(req), req.headers['x-assinatura']);
      return json(res, r.http, r);
    }
    if (caminho === '/api/catalogo' && req.method === 'GET') return json(res, 200, {ok: true, produtos: await nucleo.catalogo(url.searchParams.get('data'))});
    if (caminho === '/api/teste/ajuste' && req.method === 'POST') return json(res, 200, await nucleo.ajustarTeste(JSON.parse(await corpo(req))));
    if (caminho === '/api/teste/limpar' && req.method === 'POST') return json(res, 200, await nucleo.limparTeste());
    m = caminho.match(/^\/pagamento-teste\/([\w-]{1,40})$/);
    if (m) {
      const p = await nucleo.consultar(m[1]);
      if (!p) { res.writeHead(404); return res.end('Pedido não encontrado'); }
      if (req.method === 'POST') {
        const form = new URLSearchParams(await corpo(req));
        const resultado = form.get('resultado');
        if (['aprovado', 'pendente', 'recusado', 'cancelado'].includes(resultado)) await notificar(p, resultado, form.get('repetir') === '1');
        res.writeHead(303, {location: '../#/pedido/' + p.id}); return res.end();
      }
      res.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'}); return res.end(paginaPagamento(p));
    }
    // Arquivos estáticos do site
    const rel = normalize(caminho === '/' ? '/index.html' : caminho);
    if (rel.includes('..') || bloqueados.test(rel)) { res.writeHead(404); return res.end(); }
    const dados = await readFile(join(raiz, rel));
    res.writeHead(200, {'content-type': tipos[extname(rel)] || 'application/octet-stream'}); res.end(dados);
  } catch (e) {
    if (e.code === 'ENOENT') { res.writeHead(404); return res.end('Não encontrado'); }
    console.error(e); json(res, 500, {ok: false, erro: 'interno'});
  }
});
servidor.listen(PORTA, () => console.log(`Prévia da loja em http://localhost:${PORTA}/ (modo ${MODO})`));
