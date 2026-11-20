-- Ruptura: lembretes por notificação push (rodar no SQL Editor do Supabase do RDV)
-- Rodar DEPOIS de publicar a Edge Function "ruptura-lembretes" (veja supabase/functions/).
-- Só cria objetos novos. Pode ser rodada de novo sem perder dados.

-- ============================================================
-- Aparelhos que ativaram os lembretes (o app só registra/remove; ninguém lê pelo app)
-- ============================================================
create table if not exists ruptura_push_aparelhos (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);

-- Lembretes já enviados (um por data + turno): impede avisar duas vezes
create table if not exists ruptura_push_envios (
  data date not null,
  turno smallint not null check (turno between 1 and 3),
  enviado_em timestamptz not null default now(),
  primary key (data, turno)
);

-- Limita o botão "enviar teste" a um por minuto
create table if not exists ruptura_push_teste (
  id int primary key default 1 check (id = 1),
  ultimo timestamptz
);
insert into ruptura_push_teste (id) values (1) on conflict do nothing;

alter table ruptura_push_aparelhos enable row level security;
alter table ruptura_push_envios enable row level security;
alter table ruptura_push_teste enable row level security;
-- Sem nenhuma política: a chave anônima do app não lê nem escreve nada aqui diretamente.
revoke all on ruptura_push_aparelhos, ruptura_push_envios, ruptura_push_teste from anon, authenticated;

create or replace function ruptura_push_registrar(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_endpoint, '')) < 20 or length(coalesce(p_p256dh, '')) < 20 or length(coalesce(p_auth, '')) < 10 then
    raise exception 'dados_invalidos';
  end if;
  insert into ruptura_push_aparelhos (endpoint, p256dh, auth)
    values (p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

create or replace function ruptura_push_remover(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from ruptura_push_aparelhos where endpoint = p_endpoint;
$$;

grant execute on function ruptura_push_registrar(text, text, text) to anon;
grant execute on function ruptura_push_remover(text) to anon;

-- ============================================================
-- Agendador: chama a Edge Function a cada minuto.
-- A função compara com as horas dos turnos (ruptura_config) e só envia na hora certa.
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  perform cron.unschedule('ruptura-lembretes');
exception when others then null;
end $$;

select cron.schedule(
  'ruptura-lembretes',
  '* * * * *',
  $$ select net.http_post(
       url := 'https://prrpnsnrehgxvomfdqxy.supabase.co/functions/v1/ruptura-lembretes',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
