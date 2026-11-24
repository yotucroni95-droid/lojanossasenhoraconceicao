// Catálogo editável pelo painel da loja (#/painel). Os dados ficam no banco (Supabase).
// Se o banco não estiver configurado ou não responder, o site usa o catálogo fixo dos arquivos.
import {products} from '../catalogo.js?v=13';
import {campanhas, banco, loja} from '../config.js?v=13';

const CACHE = 'conceicao-catalogo-remoto';
export const bancoAtivo = () => Boolean(banco?.url && banco?.chave && banco?.site);
export let origemCatalogo = 'arquivos';

// Só aceita fotos do próprio site ou do armazenamento do banco.
const fotoOk = src => typeof src === 'string' && (/^assets\/[\w./-]+$/.test(src) || (bancoAtivo() && src.startsWith(banco.url + '/storage/v1/object/public/') && /^[\w:./%-]+$/.test(src)));
// ids e cores entram em links e estilos: só aceita formatos seguros.
const idOk = id => typeof id === 'string' && /^[\w-]{1,80}$/.test(id);
const cor = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#d9d2c5';
function limpar(p) {
  const fotos = lista => (Array.isArray(lista) ? lista : []).filter(f => fotoOk(f?.src));
  return {...p, category: idOk(p.category) ? p.category : "outros", images: fotos(p.images), variants: (p.variants || []).filter(v => idOk(v?.id)).map(v => ({...v, color: cor(v.color), image: fotoOk(v.image) ? v.image : 'assets/simbolo.jpg', images: fotos(v.images)}))};
}

function aplicar(dados) {
  const lista = (dados.produtos || []).filter(r => idOk(r?.dados?.id) && Array.isArray(r.dados.variants))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map(r => limpar(r.dados)).filter(p => p.variants.length);
  if (!lista.length) return false;
  products.splice(0, products.length, ...lista);
  const camp = dados.ajustes?.find(a => a.chave === 'campanhas')?.dados;
  if (Array.isArray(camp) && camp.length) campanhas.splice(0, campanhas.length, ...camp);
  const aj = dados.ajustes?.find(a => a.chave === 'loja')?.dados;
  if (typeof aj?.exibirPrecos === 'boolean') loja.exibirPrecos = aj.exibirPrecos;
  origemCatalogo = 'banco';
  return true;
}

async function buscar(tabela, campos, ordem) {
  const r = await fetch(banco.url + '/rest/v1/' + tabela + '?select=' + campos + '&site=eq.' + encodeURIComponent(banco.site) + (ordem ? '&order=' + ordem : ''), {headers: {apikey: banco.chave, Authorization: 'Bearer ' + banco.chave}});
  if (!r.ok) throw new Error('banco ' + r.status);
  return r.json();
}

// Espera o banco por até 3 s; sem resposta, usa a última cópia salva no aparelho ou os arquivos.
export async function carregarCatalogoRemoto() {
  if (!bancoAtivo()) return;
  const busca = Promise.all([buscar('produtos', 'id,dados,ordem', 'ordem'), buscar('ajustes', 'chave,dados')])
    .then(([produtos, ajustes]) => { const d = {produtos, ajustes}; try { localStorage.setItem(CACHE, JSON.stringify(d)); } catch {} return d; });
  const prazo = new Promise(ok => setTimeout(() => ok(null), 3000));
  try {
    const d = await Promise.race([busca, prazo]);
    if (d && aplicar(d)) return;
  } catch {}
  try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (c) aplicar(c); } catch {}
}
