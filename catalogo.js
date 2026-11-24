// Catálogo publicado. Pode ser editado à mão ou atualizado por ferramentas/importar-estoque.mjs.
// Nunca altere "id" de produto ou variante: eles formam os links já divulgados (#/produto/<id>?cor=<variante>).
// Campos null = dado ainda não confirmado pela loja (aparece como pendente e "sob consulta").
// Medidas em centímetros: largura, altura, profundidade. Preços em reais.
import {produtosLoja} from './catalogo-loja.js?v=7';

export const categories = [
 {"id":"colchoes","name":"Colchões e camas box","image":"assets/catalogo/ti-realeza-amb.jpg","note":"Noites mais bem dormidas.","filtros":["tipo","tamanho","densidade"]},
 {"id":"estofados","name":"Estofados","image":"assets/sofa.jpg","note":"O seu novo lugar favorito.","filtros":["lugares","acabamento"]},
 {"id":"sala","name":"Sala de estar","image":"assets/painel.jpg","note":"Detalhes que acolhem.","filtros":["acabamento"]},
 {"id":"jantar","name":"Sala de jantar","image":"assets/jantar.jpg","note":"Mais espaço para encontros.","filtros":["lugares","acabamento"]},
 {"id":"quarto","name":"Quarto","image":"assets/quarto.jpg","note":"Seu momento de descanso.","filtros":["tamanho","densidade","acabamento"]},
 {"id":"cozinha","name":"Cozinha","image":"assets/catalogo/web-000468.jpg","note":"A vida acontece aqui.","filtros":["acabamento"]},
 {"id":"eletros","name":"Eletrodomésticos","image":"assets/eletros-ia.jpg","note":"Praticidade todos os dias.","filtros":["voltagem","acabamento"]},
 {"id":"complementos","name":"Complementos","image":"assets/home-ia.jpg","note":"Cristaleiras, mesas de centro e mais.","filtros":["acabamento"]}
];

export const products = [
 ...produtosLoja,
 {"id":"estofado-01","ref":"NSC-001","fabricante":null,"name":"Estofado com almofadas","category":"estofados","tag":"Conforto em destaque",
  "description":"Linhas acolhedoras, braços generosos e almofadas que convidam a ficar. Uma inspiração para transformar a sala no seu lugar favorito.",
  "details":["Encosto com almofadas","Braços acolchoados","Consulte medidas, tecido e configuração com a equipe"],
  "images":[{"src":"assets/galeria/estofado-caramelo-tecido.jpg","tipo":"detalhe","alt":"Detalhe do tecido e da costura das almofadas","variante":"caramelo"},
            {"src":"assets/galeria/estofado-caramelo-real.jpg","tipo":"real","alt":"Estofado caramelo fotografado na loja","variante":"caramelo"}],
  "variants":[
   {"id":"caramelo","name":"Caramelo","color":"#ad672e","image":"assets/sofa.jpg","sku":null,"preco":null,"parcelado":null,"estoque":null,"medidas":null,"atributos":{}},
   {"id":"areia","name":"Areia","color":"#d7c6a9","image":"assets/sofa-areia.jpg","demo":true,"sku":null,"preco":null,"parcelado":null,"estoque":null,"medidas":null,"atributos":{}}],
  "fontes":[{"campo":"fotos","arquivo":"originais/sofa-caramelo.png","nota":"Foto enviada pela loja; ambientação e detalhe derivados dela"},{"campo":"variante areia","arquivo":"assets/sofa-areia.jpg","nota":"Simulação de cor com IA, sem estoque confirmado"}]},
 {"id":"jantar-01","ref":"NSC-002","fabricante":null,"name":"Conjunto de jantar","category":"jantar","tag":"Para receber bem",
  "description":"Madeira em tom quente, tampo claro e cadeiras com detalhes que fazem do encontro à mesa um momento especial.",
  "details":["Conjunto apresentado com mesa e cadeiras","Tampo claro e acabamento amadeirado","Consulte composição, medidas e disponibilidade"],
  "images":[],
  "variants":[{"id":"amadeirado","name":"Amadeirado / claro","color":"#bb8b50","image":"assets/jantar.jpg","sku":null,"preco":null,"parcelado":null,"estoque":null,"medidas":null,"atributos":{}}],
  "fontes":[{"campo":"fotos","arquivo":"originais/sala-jantar-helena-arte.png","nota":"Arte promocional da loja (modelo Helena), tratada sem textos"}]},
 {"id":"painel-01","ref":"NSC-003","fabricante":null,"name":"Painel com bancada suspensa","category":"sala",
  "description":"Um ponto de destaque para a sua sala. A combinação de madeira e tons claros valoriza o ambiente e organiza a composição.",
  "details":["Painel amadeirado","Bancada suspensa com portas","TV e objetos decorativos não acompanham o móvel"],
  "images":[],
  "variants":[{"id":"madeira-claro","name":"Amadeirado / claro","color":"#b98953","image":"assets/painel.jpg","sku":null,"preco":null,"parcelado":null,"estoque":null,"medidas":null,"atributos":{}}],
  "fontes":[{"campo":"fotos","arquivo":"originais/painel-flavia-arte.png / painel-sevilha-arte.png","nota":"Arte promocional; confirmar qual modelo (Flávia ou Sevilha) corresponde à foto"}]},
 {"id":"cama-01","ref":"NSC-004","fabricante":null,"name":"Cama com base cinza","category":"quarto",
  "description":"Tons suaves para criar um quarto tranquilo. Conheça as opções de camas e colchões e encontre a composição para o seu descanso.",
  "details":["Base apresentada em cinza","Consulte medidas e composição do conjunto","Características do colchão sob consulta"],
  "images":[],
  "variants":[{"id":"cinza","name":"Cinza","color":"#858383","image":"assets/quarto.jpg","sku":null,"preco":null,"parcelado":null,"estoque":null,"medidas":null,"atributos":{}}],
  "fontes":[{"campo":"fotos","arquivo":"originais/cama-cinza-arte.png","nota":"Arte promocional da loja, tratada sem textos"}]},
 {"id":"roupeiro-01","ref":"NSC-005","fabricante":null,"name":"Guarda-roupa com espelho","category":"quarto",
  "description":"Portas claras, moldura amadeirada e um espelho central. Uma combinação para trazer organização e leveza ao quarto.",
  "details":["Portas e gavetas em acabamento claro","Espelho no nicho central","Consulte medidas e organização interna"],
  "images":[{"src":"assets/galeria/roupeiro-puxadores.jpg","tipo":"detalhe","alt":"Detalhe das gavetas e puxadores","variante":"branco-madeira"}],
  "variants":[{"id":"branco-madeira","name":"Branco / amadeirado","color":"#ede9df","image":"assets/roupeiro.jpg","sku":null,"preco":null,"parcelado":null,"estoque":null,"medidas":null,"atributos":{}}],
  "fontes":[{"campo":"fotos","arquivo":"originais/guarda-roupa.png","nota":"Foto enviada pela loja; detalhe recortado sem o reflexo do espelho"}]},
 {"id":"cozinha-01","ref":"DEMO-006","fabricante":null,"name":"Cozinha · modelo 01","category":"cozinha","demo":true,"status":"pendente","motivosPendencia":["modelo demonstrativo com imagem de IA, fora da vitrine"],"tag":"Modelo demonstrativo",
  "description":"Uma ideia de apresentação para a coleção de cozinhas. Este modelo é ilustrativo: a foto e as informações serão substituídas pelo produto escolhido pela loja.",
  "details":["Imagem ilustrativa gerada com IA","Modelo demonstrativo, sem estoque confirmado","Consulte a equipe para conhecer as cozinhas reais"],
  "images":[],
  "variants":[{"id":"claro-madeira","name":"Claro / amadeirado","color":"#dacbb6","image":"assets/cozinha-demo.jpg","demo":true,"sku":null,"preco":null,"parcelado":null,"estoque":null,"medidas":null,"atributos":{}}],
  "fontes":[{"campo":"fotos","arquivo":"assets/cozinha-demo.jpg","nota":"Imagem gerada com IA, sem produto real correspondente"}]},
 {"id":"air-fryer-01","ref":"NSC-007","fabricante":"Agratto","name":"Fritadeira elétrica Agratto","category":"eletros",
  "description":"Praticidade para acompanhar a rotina da cozinha. Consulte a equipe sobre este modelo e as opções de eletros disponíveis na loja.",
  "details":["Acabamento preto","Controles na parte superior","Capacidade, potência e voltagem sob consulta"],
  "images":[{"src":"assets/galeria/air-fryer-real.jpg","tipo":"real","alt":"Fritadeira Agratto fotografada na loja","variante":"preto"}],
  "variants":[{"id":"preto","name":"Preto","color":"#242321","image":"assets/eletros-ia.jpg","sku":null,"preco":null,"parcelado":null,"estoque":null,"medidas":null,"atributos":{}}],
  "fontes":[{"campo":"fotos","arquivo":"originais/air-fryer.png","nota":"Foto enviada pela loja; marca visível na foto"}]},
 {"id":"home-01","ref":"NSC-008","fabricante":null,"name":"Home com prateleiras","category":"sala",
  "description":"Um lugar para reunir o que você gosta. Nichos, prateleiras e uma combinação de madeira com branco compõem este home.",
  "details":["Prateleiras laterais e nichos inferiores","Porta branca e painel com textura linear","Consulte dimensões e compatibilidade com sua TV"],
  "images":[{"src":"assets/galeria/home-frontal-real.jpg","tipo":"real","alt":"Home amadeirado fotografado de frente na loja","variante":"madeira-branco"},
            {"src":"assets/galeria/home-detalhe-real.jpg","tipo":"detalhe","alt":"Detalhe do painel ripado e da porta branca","variante":"madeira-branco"}],
  "variants":[{"id":"madeira-branco","name":"Amadeirado / branco","color":"#b08048","image":"assets/home-ia.jpg","sku":null,"preco":null,"parcelado":null,"estoque":null,"medidas":null,"atributos":{}}],
  "fontes":[{"campo":"fotos","arquivo":"originais/home-madeira-frontal.png e home-madeira-detalhe.png","nota":"Fotos enviadas pela loja"}]}
];
