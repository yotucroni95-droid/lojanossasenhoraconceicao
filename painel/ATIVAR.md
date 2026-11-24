# Ativar o painel da loja (uma vez só, ~15 minutos)

O painel fica em `…/lojanossasenhoraconceicao/#/painel`. Lá a equipe entra com e-mail e senha e muda produtos, descrições, fotos, estoque e a Black Friday, sem mexer em código. Os dados ficam num banco gratuito (Supabase).

## 1. Criar o banco
1. Entre em https://supabase.com, crie uma conta e clique em **New project** (plano Free). Região: **South America (São Paulo)**. Guarde a senha do banco num lugar seguro (não é a senha do painel).
2. No menu da esquerda, abra **SQL Editor** → **New query**, cole todo o arquivo `painel/banco.sql` e clique **Run**.

## 2. Criar o login da equipe
1. **Authentication → Sign In / Providers**: desligue **Allow new users to sign up** (ninguém de fora cria conta).
2. **Authentication → Users → Add user → Create new user**: e-mail e senha de cada pessoa da loja (marque *Auto Confirm User*).
3. Volte ao **SQL Editor** e rode, uma linha por pessoa:
   `insert into public.equipe (email) values ('email.da.pessoa@gmail.com');`
   Só quem está nessa lista consegue editar, mesmo tendo login.

## 3. Ligar o site ao banco
Em **Project Settings → API** (ou **Data API / API Keys**), copie:
- **Project URL** (ex.: `https://abcd1234.supabase.co`)
- a chave **anon public** / **publishable**

Coloque as duas em `config.js` → `export const banco = {url: '...', chave: '...'};`

**Nunca** use a chave `service_role` / `secret` no site: ela abre o banco inteiro.

## 4. Primeiro acesso
Abra `#/painel`, entre com um login da equipe e clique **Importar o catálogo atual**. A partir daí o site mostra o que está no banco.

## Como funciona
- Mudanças salvas aparecem no site na hora (o cliente vê na próxima vez que abrir a página).
- Se o banco ficar fora do ar, o site mostra a última cópia guardada no aparelho ou o catálogo dos arquivos.
- Toda alteração ou exclusão fica no **Histórico** do painel, com botão para voltar à versão anterior.
- Esqueceu a senha: o responsável troca em **Authentication → Users**. Cada pessoa também pode trocar a própria senha na aba **Minha senha**.
- Os links dos produtos nunca mudam ao editar. Para tirar um produto do site por um tempo, desmarque **Mostrar este produto no site** (melhor que apagar).
- O plano gratuito do Supabase pausa o projeto após 7 dias sem nenhum acesso; basta entrar no painel do Supabase e clicar **Restore** se isso acontecer. Com o site recebendo visitas, isso não acontece.
