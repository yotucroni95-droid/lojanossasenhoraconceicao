-- Banco do painel da loja Nossa Senhora da Conceição (Supabase).
-- Como usar: no Supabase, abra "SQL Editor", cole este arquivo inteiro e clique em "Run". Rode uma vez só.
-- Depois, no fim deste arquivo, troque o e-mail de exemplo pelo e-mail de quem pode editar e rode só aquela linha.

-- Produtos: cada linha guarda um produto completo (nome, descrição, variações, fotos, estoque).
create table if not exists public.produtos (
  id text primary key,
  dados jsonb not null,
  ordem integer not null default 0,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

-- Ajustes gerais (ex.: campanhas como a Black Friday).
create table if not exists public.ajustes (
  chave text primary key,
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

-- Quem pode editar: só e-mails desta lista, mesmo que outra pessoa consiga criar login.
create table if not exists public.equipe (
  email text primary key
);

-- Histórico: guarda a versão anterior de cada produto alterado ou apagado (para desfazer).
create table if not exists public.historico (
  id bigserial primary key,
  produto text not null,
  dados jsonb,
  acao text not null,
  quem text,
  quando timestamptz not null default now()
);

create or replace function public.eh_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipe where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create or replace function public.guardar_historico() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.atualizado_em := now();
    new.atualizado_por := auth.jwt() ->> 'email';
    insert into public.historico (produto, dados, acao, quem) values (old.id, old.dados, 'alterado', auth.jwt() ->> 'email');
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.historico (produto, dados, acao, quem) values (old.id, old.dados, 'apagado', auth.jwt() ->> 'email');
    return old;
  else
    new.atualizado_por := auth.jwt() ->> 'email';
    return new;
  end if;
end $$;

drop trigger if exists produtos_historico on public.produtos;
create trigger produtos_historico before insert or update or delete on public.produtos
  for each row execute function public.guardar_historico();

alter table public.produtos enable row level security;
alter table public.ajustes enable row level security;
alter table public.equipe enable row level security;
alter table public.historico enable row level security;

-- Qualquer visitante do site pode LER produtos e ajustes. Só a equipe pode mudar.
drop policy if exists "site le produtos" on public.produtos;
create policy "site le produtos" on public.produtos for select using (true);
drop policy if exists "equipe edita produtos" on public.produtos;
create policy "equipe edita produtos" on public.produtos for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());

drop policy if exists "site le ajustes" on public.ajustes;
create policy "site le ajustes" on public.ajustes for select using (true);
drop policy if exists "equipe edita ajustes" on public.ajustes;
create policy "equipe edita ajustes" on public.ajustes for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());

drop policy if exists "equipe ve equipe" on public.equipe;
create policy "equipe ve equipe" on public.equipe for select to authenticated using (public.eh_equipe());

drop policy if exists "equipe ve historico" on public.historico;
create policy "equipe ve historico" on public.historico for select to authenticated using (public.eh_equipe());

-- Fotos: pasta pública "fotos" (qualquer um vê; só a equipe envia ou apaga).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "equipe envia fotos" on storage.objects;
create policy "equipe envia fotos" on storage.objects for insert to authenticated with check (bucket_id = 'fotos' and public.eh_equipe());
drop policy if exists "equipe troca fotos" on storage.objects;
create policy "equipe troca fotos" on storage.objects for update to authenticated using (bucket_id = 'fotos' and public.eh_equipe());
drop policy if exists "equipe apaga fotos" on storage.objects;
create policy "equipe apaga fotos" on storage.objects for delete to authenticated using (bucket_id = 'fotos' and public.eh_equipe());

-- >>> Troque pelo e-mail de quem vai editar (uma linha por pessoa) e rode:
-- insert into public.equipe (email) values ('email.da.loja@exemplo.com');
