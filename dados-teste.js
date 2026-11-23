// SOMENTE PARA TESTES. Valores fictícios usados na prévia (modo "teste") para exercitar
// carrinho, mensagem do WhatsApp, campanha e pagamento. Nunca aparecem no endereço oficial.
export const variantesTeste = {
  'estofado-01': {
    caramelo: { preco: 1999, parcelado: { vezes: 10, valor: 219.9 }, estoque: 3, medidas: { largura: 210, altura: 95, profundidade: 100 }, atributos: { lugares: '3 lugares' } },
    areia: { preco: 1999, parcelado: { vezes: 10, valor: 219.9 }, estoque: 0, medidas: { largura: 210, altura: 95, profundidade: 100 }, atributos: { lugares: '3 lugares' } }
  },
  'jantar-01': { amadeirado: { preco: 1490, parcelado: { vezes: 10, valor: 163.9 }, estoque: 2, medidas: { largura: 120, altura: 78, profundidade: 80 }, atributos: { lugares: '4 lugares' } } },
  'painel-01': { 'madeira-claro': { preco: 790, parcelado: { vezes: 6, valor: 144.9 }, estoque: 4, medidas: { largura: 180, altura: 150, profundidade: 38 } } },
  'cama-01': { cinza: { preco: 999, parcelado: { vezes: 10, valor: 109.9 }, estoque: 2, medidas: { largura: 138, altura: 45, profundidade: 188 }, atributos: { tamanho: 'Casal' } } },
  'roupeiro-01': { 'branco-madeira': { preco: 1290, parcelado: { vezes: 10, valor: 141.9 }, estoque: 1, medidas: { largura: 160, altura: 200, profundidade: 50 } } },
  'air-fryer-01': { preto: { preco: 349, parcelado: { vezes: 3, valor: 116.33 }, estoque: 6, medidas: { largura: 28, altura: 32, profundidade: 33 }, atributos: { voltagem: '127 V' } } },
  'home-01': { 'madeira-branco': { preco: 890, parcelado: { vezes: 6, valor: 162.9 }, estoque: 2, medidas: { largura: 180, altura: 175, profundidade: 40 } } }
};

export const ofertasTeste = {
  'black-friday-2026': [
    { produto: 'estofado-01', variante: 'caramelo', preco: 1799, precoDe: 1999 },
    { produto: 'cama-01', variante: 'cinza', preco: 899, precoDe: 999 },
    { produto: 'air-fryer-01', variante: 'preto', preco: 299, precoDe: 349 }
  ]
};
