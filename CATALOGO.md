# Catálogo Nossa Senhora da Conceição

Site estático publicado pelo GitHub Pages, com rotas após #/. O endereço principal permanece o mesmo.

## Cadastrar produtos
Edite catalogo.js. Cada produto precisa de id e ref únicos, name, category, description, details e pelo menos uma entrada em variants (id, name, color e image). Coloque fotos em assets/ e use caminhos relativos. Preserve os IDs existentes para que links compartilhados continuem funcionando.

Para modelos ou cores ilustrativos, mantenha demo:true no produto ou na variação. A cozinha modelo 01 e o sofá areia são demonstrações. Imagens ambientadas com IA devem ser conferidas contra os produtos reais antes de uma oferta comercial.

## Promoções
As duas promoções atuais têm preços fictícios autorizados apenas para demonstração. A interface as identifica como sem validade comercial. Antes de ativar ofertas reais, confirme preços, validade, estoque e condições com Joanny e adapte a apresentação de promoções no app.js; não basta retirar demo:true dos dados.

## Atendimento
A lista guarda produto, acabamento e quantidade neste navegador e prepara a mensagem para o WhatsApp. Não há pagamento online, reserva ou confirmação de estoque. O cliente revisa e envia a mensagem no WhatsApp.
O link de atendimento preservado por orientação do responsável é https://wa.me/558781715830.

## Verificação local
Execute python3 -m http.server 8096 nesta pasta e abra http://localhost:8096/.
Verifique catálogo, busca, filtros, produto, variação, lista e mensagem, também em tela móvel.
