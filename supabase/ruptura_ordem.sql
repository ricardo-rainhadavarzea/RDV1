-- Ruptura: ordem dos produtos na checagem (rodar no SQL Editor do Supabase do RDV)
-- Rodar ANTES de publicar a versão nova do app. Compatível com a versão atual do app.
-- Pode ser rodada de novo sem perder dados.

alter table ruptura_produtos add column if not exists ordem int;

-- Seleção que já existe: mantém a ordem de hoje (seção A–Z, nome A–Z)
update ruptura_produtos r
set ordem = x.pos
from (
  select r2.codigo,
         row_number() over (order by coalesce(p.secao, ''), p.nome, r2.codigo) as pos
  from ruptura_produtos r2
  left join produtos p on p.codigo = r2.codigo
) x
where r.codigo = x.codigo and r.ordem is null;

-- A view ganha a coluna "ordem" (no fim, para não quebrar nada)
create or replace view ruptura_lista as
  select p.codigo, p.nome, coalesce(p.secao, '') as secao, r.ordem
  from ruptura_produtos r
  join produtos p on p.codigo = r.codigo;

grant select on ruptura_lista to anon;

-- Mesma assinatura de antes: agora a POSIÇÃO do código no array vira a ordem da checagem.
create or replace function ruptura_salvar_selecao(p_codigos text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare v_qtd integer;
begin
  delete from ruptura_produtos where true;
  insert into ruptura_produtos (codigo, ordem)
    select u.codigo, row_number() over (order by min(u.pos))
    from unnest(p_codigos) with ordinality as u(codigo, pos)
    join produtos p on p.codigo = u.codigo
    group by u.codigo;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end $$;

grant execute on function ruptura_salvar_selecao(text[]) to anon;
