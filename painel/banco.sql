-- Banco "Órbita Sites" (Supabase): um banco só para vários sites de clientes.
-- Cada produto, ajuste e foto pertence a um site (ex.: 'conceicao'). Cada pessoa da equipe só edita o(s) site(s) liberado(s) para ela.
-- Como usar: no Supabase, abra "SQL Editor", cole este arquivo inteiro e clique em "Run". Pode rodar de novo sem perder dados.

-- Sites cadastrados (o "id" é o mesmo que vai em config.js → banco.site).
create table if not exists public.sites (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  nome text not null
);

-- Produtos: cada linha guarda um produto completo (nome, descrição, variações, fotos, estoque).
create table if not exists public.produtos (
  site text not null references public.sites(id) on delete cascade,
  id text not null,
  dados jsonb not null,
  ordem integer not null default 0,
  atualizado_em timestamptz not null default now(),
  atualizado_por text,
  primary key (site, id)
);

-- Ajustes gerais de cada site (ex.: campanhas como a Black Friday).
create table if not exists public.ajustes (
  site text not null references public.sites(id) on delete cascade,
  chave text not null,
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por text,
  primary key (site, chave)
);

-- Quem pode editar cada site. site = '*' libera todos (use só para a Órbita).
create table if not exists public.equipe (
  email text not null,
  site text not null,
  primary key (email, site)
);
-- Função de cada pessoa: 'dono' (cadastra a equipe da loja) ou 'funcionario'.
alter table public.equipe add column if not exists papel text not null default 'funcionario';
alter table public.equipe drop constraint if exists equipe_papel_ok;
alter table public.equipe add constraint equipe_papel_ok check (papel in ('dono', 'funcionario'));
update public.equipe set papel = 'dono' where site = '*';
update public.equipe set email = lower(trim(email)) where email <> lower(trim(email));
alter table public.equipe drop constraint if exists equipe_email_minusculo;
alter table public.equipe add constraint equipe_email_minusculo check (email = lower(email));

-- Histórico: versão anterior de cada produto alterado ou apagado (para desfazer).
create table if not exists public.historico (
  id bigserial primary key,
  site text not null,
  produto text not null,
  dados jsonb,
  acao text not null,
  quem text,
  quando timestamptz not null default now()
);
create index if not exists historico_site_quando on public.historico (site, quando desc);

create or replace function public.eh_equipe(s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipe
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and (site = s or site = '*'));
$$;

create or replace function public.guardar_historico() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.atualizado_em := now();
    new.atualizado_por := auth.jwt() ->> 'email';
    insert into public.historico (site, produto, dados, acao, quem) values (old.site, old.id, old.dados, 'alterado', auth.jwt() ->> 'email');
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.historico (site, produto, dados, acao, quem) values (old.site, old.id, old.dados, 'apagado', auth.jwt() ->> 'email');
    return old;
  else
    new.atualizado_por := auth.jwt() ->> 'email';
    return new;
  end if;
end $$;

drop trigger if exists produtos_historico on public.produtos;
create trigger produtos_historico before insert or update or delete on public.produtos
  for each row execute function public.guardar_historico();

alter table public.sites enable row level security;
alter table public.produtos enable row level security;
alter table public.ajustes enable row level security;
alter table public.equipe enable row level security;
alter table public.historico enable row level security;

-- Qualquer visitante pode LER produtos e ajustes (o site público precisa). Só a equipe do site pode mudar.
drop policy if exists "todos leem sites" on public.sites;
create policy "todos leem sites" on public.sites for select using (true);
drop policy if exists "orbita cria sites" on public.sites;
create policy "orbita cria sites" on public.sites for insert to authenticated with check (public.eh_equipe('*'));
drop policy if exists "orbita edita sites" on public.sites;
create policy "orbita edita sites" on public.sites for update to authenticated using (public.eh_equipe('*')) with check (public.eh_equipe('*'));

drop policy if exists "site le produtos" on public.produtos;
create policy "site le produtos" on public.produtos for select using (true);
drop policy if exists "equipe edita produtos" on public.produtos;
create policy "equipe edita produtos" on public.produtos for all to authenticated using (public.eh_equipe(site)) with check (public.eh_equipe(site));

drop policy if exists "site le ajustes" on public.ajustes;
create policy "site le ajustes" on public.ajustes for select using (true);
drop policy if exists "equipe edita ajustes" on public.ajustes;
create policy "equipe edita ajustes" on public.ajustes for all to authenticated using (public.eh_equipe(site)) with check (public.eh_equipe(site));

-- Cada pessoa vê só as próprias liberações.
drop policy if exists "pessoa ve suas liberacoes" on public.equipe;
create policy "pessoa ve suas liberacoes" on public.equipe for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "equipe ve historico" on public.historico;
create policy "equipe ve historico" on public.historico for select to authenticated using (public.eh_equipe(site));

-- Fotos: pasta pública "fotos"; cada site usa a subpasta com o seu id (ex.: fotos/conceicao/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "equipe envia fotos" on storage.objects;
create policy "equipe envia fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.eh_equipe((storage.foldername(name))[1]));
drop policy if exists "equipe troca fotos" on storage.objects;
create policy "equipe troca fotos" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.eh_equipe((storage.foldername(name))[1]));
drop policy if exists "equipe apaga fotos" on storage.objects;
create policy "equipe apaga fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.eh_equipe((storage.foldername(name))[1]));

-- Primeiro site:
insert into public.sites (id, nome) values ('conceicao', 'Loja Nossa Senhora da Conceição') on conflict (id) do nothing;

-- >>> Para liberar uma pessoa, troque o e-mail e rode (uma linha por pessoa):
-- (Depois de instalar a função "equipe", o dono cadastra a equipe pelo próprio painel, aba Equipe.)
-- insert into public.equipe (email, site, papel) values ('dono.da.loja@gmail.com', 'conceicao', 'dono');
-- Você (Órbita), com acesso a todos os sites:
-- insert into public.equipe (email, site, papel) values ('seu.email@gmail.com', '*', 'dono');
-- >>> Novo cliente: insert into public.sites (id, nome) values ('nome-do-cliente', 'Nome do Cliente');
