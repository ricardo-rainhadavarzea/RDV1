-- Schema inicial do sistema de indicadores da Panificadora Rainha da Várzea
-- Rodar isso no SQL Editor do painel do Supabase (Project > SQL Editor > New query)

create extension if not exists pgcrypto;

-- ============================================================
-- PRODUTOS
-- ============================================================
create table if not exists produtos (
  codigo text primary key,              -- 13 dígitos, zeros à esquerda (ex: 0000000000178)
  nome text not null,
  unidade text not null check (unidade in ('UN', 'KG', 'LT')),
  preco_unitario numeric(10,2) not null default 0,
  grupo text,
  secao text,                           -- "setor" nos indicadores
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_produtos_secao on produtos (secao);
create index if not exists idx_produtos_nome on produtos using gin (to_tsvector('portuguese', nome));

-- ============================================================
-- MOVIMENTACOES (carrinho confirmado = um lançamento)
-- ============================================================
create table if not exists movimentacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('desperdicio', 'buffet_ida', 'buffet_volta', 'uso_interno')),
  criado_em timestamptz not null default now(),
  total_itens int not null default 0,
  total_valor numeric(12,2) not null default 0
);

create index if not exists idx_movimentacoes_tipo_data on movimentacoes (tipo, criado_em);

-- ============================================================
-- ITENS de cada movimentação
-- ============================================================
create table if not exists movimentacao_itens (
  id uuid primary key default gen_random_uuid(),
  movimentacao_id uuid not null references movimentacoes(id) on delete cascade,
  codigo text references produtos(codigo),
  nome text not null,                   -- snapshot do nome no momento do lançamento
  unidade text not null,
  quantidade numeric(12,3) not null,
  valor numeric(12,2) not null,
  origem text not null check (origem in ('bipagem', 'manual'))
);

create index if not exists idx_itens_movimentacao on movimentacao_itens (movimentacao_id);
create index if not exists idx_itens_codigo on movimentacao_itens (codigo);

-- ============================================================
-- VENDAS POR PERIODO (importação semanal da Curva ABC / BM)
-- ============================================================
create table if not exists vendas_periodo (
  id uuid primary key default gen_random_uuid(),
  periodo_inicio date not null,         -- segunda-feira da semana
  periodo_fim date not null,            -- domingo da semana
  codigo text not null,
  nome text,
  quantidade numeric(12,3) not null default 0,
  preco_medio numeric(10,2),
  total numeric(12,2),
  percentual numeric(6,3),
  acumulado numeric(6,3),
  importado_em timestamptz not null default now(),
  unique (periodo_inicio, periodo_fim, codigo)
);

create index if not exists idx_vendas_codigo_periodo on vendas_periodo (codigo, periodo_inicio);

-- ============================================================
-- RLS (Row Level Security)
-- Por enquanto liberado para a chave anônima (app ainda não tem login real
-- de Gestão). Revisar quando a autenticação for implementada.
-- ============================================================
alter table produtos enable row level security;
alter table movimentacoes enable row level security;
alter table movimentacao_itens enable row level security;
alter table vendas_periodo enable row level security;

create policy "anon full access produtos" on produtos for all using (true) with check (true);
create policy "anon full access movimentacoes" on movimentacoes for all using (true) with check (true);
create policy "anon full access movimentacao_itens" on movimentacao_itens for all using (true) with check (true);
create policy "anon full access vendas_periodo" on vendas_periodo for all using (true) with check (true);
