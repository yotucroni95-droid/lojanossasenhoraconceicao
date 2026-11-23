# Manutenção da loja

Site estático publicado no GitHub Pages (branch `main`). Rotas após `#/`. Links de produto: `#/produto/<id>?cor=<variante>`. **Nunca mude ids**: são os links já divulgados.

## Ver a prévia antes de publicar
```
node servidor/servidor.mjs
```
Abra http://localhost:8096/. Fora do endereço oficial, o site roda em **modo teste**: preços, estoque e pagamentos fictícios, com aviso no topo. A área `#/manutencao` mostra pendências, a origem de cada informação e ferramentas de teste (simular data, mudar preço/estoque).

Testes automáticos: `node --test testes/loja.test.mjs`

## Atualizar estoque e preços (arquivo da loja)
1. Salve a planilha da loja como CSV (modelo em `ferramentas/modelos/estoque-modelo.csv`; nomes de coluna comuns são reconhecidos).
2. Simule: `node ferramentas/importar-estoque.mjs --estoque estoque.csv --catalogos referencias.csv`
3. Leia o relatório: publicados, atualizados, pendentes, ausentes.
4. Aplique: acrescente `--aplicar`. Só use `--estoque-completo` se o arquivo for o estoque inteiro: aí os itens ausentes ficam “esgotados” (o link continua funcionando).

Regras do cruzamento: fabricante + código primeiro; sem código, fabricante + modelo + variante + medidas juntos. Medidas divergentes (> 2 cm) entre estoque e catálogo viram **conflito**: nada é atribuído por semelhança. Produto novo sem foto autorizada ou sem categoria fica fora da vitrine até conferência.

## Catálogo da loja (relatório de estoque + catálogos dos fabricantes)

- Preços **não** aparecem no site (`exibirPrecos: false` em `config.js`). O cliente pede o preço pelo WhatsApp; a mensagem leva o **código interno da loja** (ex.: 000675) para dar baixa no sistema.
- Os produtos reais estão em `catalogo-loja.js`, gerado por `python3 ferramentas/gerar-catalogo-loja.py` a partir de `dados-loja/estoque-relatorio-AAAA-MM-DD.tsv`. Para novo relatório: gerar o TSV com `ferramentas/ler-relatorio.py`, trocar o caminho no script e rodar de novo. Ids não mudam.
- Para incluir um produto: ele só entra com foto que bata em modelo, medida e cor. Recorte a foto do PDF com `swift ferramentas/recorte/recortar.swift ferramentas/recorte/spec.txt dados-loja/catalogos <pasta-saida>` (uma linha por foto: nome|pdf|página|x0,y0,x1,y1|foto ou recorte) ou use foto da loja, salve em `assets/catalogo/` e acrescente o item na lista `PRODUTOS` do script.
- Fotos da internet: só da página oficial do produto (fabricante ou loja grande), com modelo, cor e medida iguais ao relatório. Salve como `assets/catalogo/web-<código>.jpg` (até 1000 px, JPG 65%) e acrescente o produto na lista `WEB` do script, com a URL da página em cada variante; ela aparece em `fontes`.
- Sem foto oficial: o item entra com **imagem ilustrativa** (produto parecido, mesma categoria e cor quando possível), sempre identificada no site. Dados em `ferramentas/catalogo_ilustrativo.py` (produtos e variantes) e `ferramentas/fotos-web.tsv` (código, E = foto do mesmo modelo / I = ilustrativa, página de origem). Não repita a mesma foto em dois códigos. Quando achar a foto oficial, troque o arquivo e mude o tipo para E.
- Itens com dúvida ficam em `PENDENTES` (aparecem em `#/manutencao`). Lista completa do que foi publicado, do que está pendente e do que não tem foto: `dados-loja/catalogacao-2026-11-23.md`.
- Testes: `node --test testes/loja.test.mjs`.

## Fotos
- Coloque em `assets/` (até ~1000 px de largura, JPG ~60–70% de qualidade).
- Tipos exibidos ao cliente: `real` (foto na loja), `detalhe`, `catalogo` (catálogo do fabricante) e ambientação com IA (`ia`, sempre identificada).
- Foto de catálogo só entra quando o par for confirmado (código/fabricante ou modelo+variante+medidas). As demais ficam pendentes em `#/manutencao`.
- 3D: preencha `modelo3d` na variante com um arquivo .glb confiável; ele só carrega quando o cliente toca em “Ver em 3D”.

## Campanhas (ex.: Black Friday)
Em `config.js` → `campanhas`: datas `anuncioDesde`, `inicio`, `fim` e `ofertas` com `{produto, variante, preco, precoDe}` **confirmados pela loja**. Fora do período a campanha some sozinha da vitrine e a página mostra “campanha encerrada”.

## Entrega
`config.js` → `entrega`. Frete grátis por cidade: preencha `gratisPara` com as cidades confirmadas. Sem isso, entrega fica “frete a calcular pelo atendimento” e o pagamento online só vale para retirada.

## Pagamento online
Hoje: provedor de **teste** (`servidor/servidor.mjs`), com notificação assinada (HMAC), pedido idempotente e eventos repetidos ignorados. Para vendas reais é preciso: conta comercial no provedor escolhido, credenciais (em variável de ambiente no backend, nunca no site), um serviço de backend hospedado (o GitHub Pages não executa código) e implementar o adaptador real no lugar de `provedor` em `servidor/servidor.mjs`. Até lá, em produção só o WhatsApp fica ativo (`pagamento.ativoEmProducao = false`).
