-- Ruptura dentro do RDV — migração (rodar inteira no SQL Editor do Supabase do RDV)
-- Só cria objetos NOVOS (prefixo ruptura_). Não altera nenhuma tabela existente.
-- Pode ser rodada de novo sem perder dados.

-- ============================================================
-- Produtos que entram na checagem (só o código; nome e seção vêm do cadastro "produtos")
-- ============================================================
create table if not exists ruptura_produtos (
  codigo text primary key
);

-- ============================================================
-- Nomes/horas dos três turnos (linha única)
-- ============================================================
create table if not exists ruptura_config (
  id int primary key default 1 check (id = 1),
  nome1 text not null default 'Manhã',
  nome2 text not null default 'Tarde',
  nome3 text not null default 'Noite',
  hora1 text,
  hora2 text,
  hora3 text
);
insert into ruptura_config (id) values (1) on conflict do nothing;

-- ============================================================
-- Checagens (uma por data + turno) e respostas
-- "turno" guarda 1, 2 ou 3; o nome exibido vem de ruptura_config.
-- Respostas guardam código, nome e seção do momento: o histórico não depende do cadastro atual.
-- ============================================================
create table if not exists ruptura_checagens (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  turno smallint not null check (turno between 1 and 3),
  operador text not null,
  client_id uuid not null,
  enviada_em timestamptz not null default now(),
  unique (data, turno)
);
create index if not exists idx_ruptura_checagens_data on ruptura_checagens (data);

create table if not exists ruptura_respostas (
  id bigserial primary key,
  checagem_id uuid not null references ruptura_checagens(id),
  codigo text not null,
  nome text not null,
  secao text not null,
  disponivel boolean not null
);
create index if not exists idx_ruptura_respostas_checagem on ruptura_respostas (checagem_id);
create index if not exists idx_ruptura_respostas_codigo on ruptura_respostas (codigo);

-- Lista pronta para a tela de checagem (junta o código escolhido com nome/seção do cadastro)
create or replace view ruptura_lista as
  select p.codigo, p.nome, coalesce(p.secao, '') as secao
  from ruptura_produtos r
  join produtos p on p.codigo = r.codigo;

-- ============================================================
-- Segurança: o app só LÊ essas tabelas. Toda escrita passa pelas funções abaixo,
-- então uma checagem enviada não pode ser editada nem apagada pelo app.
-- ============================================================
alter table ruptura_produtos enable row level security;
alter table ruptura_config enable row level security;
alter table ruptura_checagens enable row level security;
alter table ruptura_respostas enable row level security;

drop policy if exists "leitura ruptura_produtos" on ruptura_produtos;
drop policy if exists "leitura ruptura_config" on ruptura_config;
drop policy if exists "leitura ruptura_checagens" on ruptura_checagens;
drop policy if exists "leitura ruptura_respostas" on ruptura_respostas;
create policy "leitura ruptura_produtos" on ruptura_produtos for select to anon using (true);
create policy "leitura ruptura_config" on ruptura_config for select to anon using (true);
create policy "leitura ruptura_checagens" on ruptura_checagens for select to anon using (true);
create policy "leitura ruptura_respostas" on ruptura_respostas for select to anon using (true);

revoke all on ruptura_produtos, ruptura_config, ruptura_checagens, ruptura_respostas from anon, authenticated;
revoke all on ruptura_lista from anon, authenticated;
grant select on ruptura_produtos, ruptura_config, ruptura_checagens, ruptura_respostas, ruptura_lista to anon;

-- ============================================================
-- Funções
-- ============================================================

-- Troca a seleção de produtos inteira, tudo ou nada. Ignora códigos que não existem no cadastro.
create or replace function ruptura_salvar_selecao(p_codigos text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare v_qtd integer;
begin
  delete from ruptura_produtos where true;
  insert into ruptura_produtos (codigo)
    select distinct p.codigo from produtos p where p.codigo = any (p_codigos);
  get diagnostics v_qtd = row_count;
  return v_qtd;
end $$;

-- Nomes/horas dos três turnos (arrays com 3 itens; hora vazia = sem hora)
create or replace function ruptura_salvar_config(p_nomes text[], p_horas text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if array_length(p_nomes, 1) <> 3 or array_length(p_horas, 1) <> 3 then
    raise exception 'dados_invalidos';
  end if;
  update ruptura_config set
    nome1 = trim(p_nomes[1]), nome2 = trim(p_nomes[2]), nome3 = trim(p_nomes[3]),
    hora1 = nullif(p_horas[1], ''), hora2 = nullif(p_horas[2], ''), hora3 = nullif(p_horas[3], '')
  where id = 1;
end $$;

-- Envia uma checagem completa numa única operação (tudo ou nada).
-- Retorna 'ok' ou 'ja_concluida' (o mesmo aparelho reenviou depois de perder a confirmação).
-- Se outra checagem diferente já existe para data+turno, dá erro 'duplicada'.
-- p_respostas: [{"codigo": "...", "nome": "...", "secao": "...", "disponivel": true}, ...]
create or replace function ruptura_enviar_checagem(
  p_data date, p_turno smallint, p_operador text, p_client_id uuid, p_respostas jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_cid uuid;
begin
  if p_turno not between 1 and 3 or length(trim(p_operador)) = 0
     or jsonb_array_length(p_respostas) = 0 then
    raise exception 'dados_invalidos';
  end if;

  insert into ruptura_checagens (data, turno, operador, client_id)
    values (p_data, p_turno, trim(p_operador), p_client_id)
    on conflict (data, turno) do nothing
    returning id into v_id;

  if v_id is null then
    select client_id into v_cid from ruptura_checagens where data = p_data and turno = p_turno;
    if v_cid = p_client_id then return 'ja_concluida'; end if;
    raise exception 'duplicada';
  end if;

  insert into ruptura_respostas (checagem_id, codigo, nome, secao, disponivel)
    select v_id, x.codigo, x.nome, x.secao, x.disponivel
    from jsonb_to_recordset(p_respostas) as x(codigo text, nome text, secao text, disponivel boolean);
  return 'ok';
end $$;

grant execute on function ruptura_salvar_selecao(text[]) to anon;
grant execute on function ruptura_salvar_config(text[], text[]) to anon;
grant execute on function ruptura_enviar_checagem(date, smallint, text, uuid, jsonb) to anon;
