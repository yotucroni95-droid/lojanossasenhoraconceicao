// Dados oficiais da loja e chaves de funcionamento. Edite com cuidado.
// Modo: no endereço oficial (github.io) o site roda em "producao"; em qualquer outro endereço
// (prévia local, prévia da Órbita) roda em "teste", com preços e estoque fictícios identificados.
const host = typeof location !== 'undefined' ? location.hostname : '';
export const modo = host.endsWith('github.io') ? 'producao' : 'teste';

export const loja = {
  nome: 'Nossa Senhora da Conceição',
  // Decisão da loja (23/11/2026): o site não mostra preços; o cliente consulta pelo WhatsApp.
  exibirPrecos: false,
  // Link preservado por orientação do responsável. Confirmar o número completo antes de vendas reais.
  whatsapp: 'https://wa.me/558781715830',
  grupoVip: 'https://chat.whatsapp.com/Ft5fXalQAasKvRkS8qPTkF?s=cl&p=i&ilr=4&amv=0',
  instagram: 'https://www.instagram.com/lojanossasra.daconceicao/',
  enderecoLinhas: ['Rua do Progresso, Centro', 'Lagoa do Ouro — PE', 'CEP 55320-000'],
  mapa: 'https://share.google/IQlJpxaxf0zSdl4BJ',
  horarios: ['Segunda a sábado: 8h–12h e 14h–17h', 'Domingos: fechado'],
  canonico: 'https://yotucroni95-droid.github.io/lojanossasenhoraconceicao/'
};

// Entrega e retirada: "confirmada:false" mostra o texto como condição a confirmar com a equipe.
export const entrega = {
  retirada: { confirmada: false, frete: 0, texto: 'Retirada na loja, Rua do Progresso, Centro' },
  domicilio: { confirmada: false, tipo: 'cotacao', texto: 'Entrega no seu endereço: frete calculado pelo atendimento',
    // Frete grátis para cidades próximas: preencher SOMENTE após a loja confirmar a lista. Ex.: ['Lagoa do Ouro', 'Correntes']
    gratisPara: [] }
};

// Pagamento online. Sem conta comercial confirmada, fica ativo apenas no modo de teste.
export const pagamento = {
  ativoEmProducao: false,
  provedor: 'teste', // trocar pelo provedor real (ex.: mercadopago) quando houver conta e credenciais
  metodos: ['Pix', 'Cartão']
};

// Campanhas têm espaço e período próprios. Fora do período, somem da vitrine sem quebrar links.
// "ofertas" só recebe itens com preço confirmado pela loja: {produto, variante, preco, precoDe}.
export const campanhas = [
  {
    id: 'black-friday-2026',
    slug: 'black-friday',
    nome: 'Black Friday',
    chamada: 'Uma semana de boas escolhas para a sua casa.',
    anuncioDesde: '2026-11-20T00:00:00-03:00',
    inicio: '2026-11-27T00:00:00-03:00',
    fim: '2026-11-30T23:59:59-03:00',
    ofertas: []
  }
];
