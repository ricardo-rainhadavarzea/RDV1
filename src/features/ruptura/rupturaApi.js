import { supabase } from '../../lib/supabaseClient'
import { buscarTodasLinhas } from '../../lib/supabasePagination'
import { SECOES_RUPTURA } from './rupturaLib'

/** Erro especial: já existe checagem concluída para essa data + turno. */
export class ErroDuplicada extends Error {
  constructor() {
    super('Já existe uma checagem concluída para esta data e turno.')
  }
}

const CONFIG_PADRAO = { nomes: ['Manhã', 'Tarde', 'Noite'], horas: ['', '', ''] }

export async function buscarConfig() {
  const { data, error } = await supabase.from('ruptura_config').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  if (!data) return CONFIG_PADRAO
  return {
    nomes: [data.nome1, data.nome2, data.nome3],
    horas: [data.hora1 ?? '', data.hora2 ?? '', data.hora3 ?? ''],
  }
}

export async function salvarConfig({ nomes, horas }) {
  const { error } = await supabase.rpc('ruptura_salvar_config', { p_nomes: nomes, p_horas: horas })
  if (error) throw error
}

/** Números dos turnos (1–3) já concluídos na data. */
export async function turnosConcluidos(data) {
  const { data: rows, error } = await supabase.from('ruptura_checagens').select('turno').eq('data', data)
  if (error) throw error
  return rows.map((r) => r.turno)
}

/** Produtos selecionados para a checagem, com nome e seção do cadastro. */
export async function listarProdutosDaRuptura() {
  return buscarTodasLinhas(() => supabase.from('ruptura_lista').select('codigo,nome,secao,ordem').order('codigo'))
}

/** Códigos hoje selecionados, na sequência da checagem (inclui códigos que sumiram do cadastro). */
export async function listarCodigosSelecionados() {
  const rows = await buscarTodasLinhas(() =>
    supabase.from('ruptura_produtos').select('codigo,ordem').order('ordem', { nullsFirst: false }).order('codigo')
  )
  return rows.map((r) => r.codigo)
}

/** Produtos das seções de produção própria, para a tela de seleção. */
export async function listarProdutosCandidatos() {
  return buscarTodasLinhas(() =>
    supabase.from('produtos').select('codigo,nome,secao').in('secao', SECOES_RUPTURA).order('codigo')
  )
}

/** Salva a seleção; a posição de cada código no array é a ordem da checagem. */
export async function salvarSelecao(codigos) {
  const { error } = await supabase.rpc('ruptura_salvar_selecao', { p_codigos: codigos })
  if (error) throw error
}

/**
 * Vendas das últimas `semanas` semanas importadas, somadas por produto, já com a seção do cadastro.
 * Base da pré-seleção "Curva A por setor".
 */
export async function buscarVendasRecentes(semanas = 4) {
  const { data: periodos, error } = await supabase
    .from('vendas_periodo')
    .select('periodo_inicio')
    .order('periodo_inicio', { ascending: false })
    .limit(5000)
  if (error) throw error
  const inicios = [...new Set(periodos.map((p) => p.periodo_inicio))].slice(0, semanas)
  if (inicios.length === 0) return { vendas: [], inicios }

  const linhas = await buscarTodasLinhas(() =>
    supabase.from('vendas_periodo').select('id,codigo,total').in('periodo_inicio', inicios).order('id')
  )
  const total = new Map()
  for (const l of linhas) total.set(l.codigo, (total.get(l.codigo) ?? 0) + Number(l.total ?? 0))

  const candidatos = await listarProdutosCandidatos()
  const vendas = candidatos.map((p) => ({ codigo: p.codigo, secao: p.secao, total: total.get(p.codigo) ?? 0 }))
  return { vendas, inicios }
}

/** Envia a checagem completa numa única operação. 'ok' ou 'ja_concluida' contam como sucesso. */
export async function enviarChecagem({ data, turno, operador, clientId, itens, respostas }) {
  const { data: resultado, error } = await supabase.rpc('ruptura_enviar_checagem', {
    p_data: data,
    p_turno: turno,
    p_operador: operador,
    p_client_id: clientId,
    p_respostas: itens.map((it, i) => ({
      codigo: it.codigo,
      nome: it.nome,
      secao: it.secao,
      disponivel: respostas[i] === true,
    })),
  })
  if (error) {
    if (String(error.message).includes('duplicada')) throw new ErroDuplicada()
    throw error
  }
  return resultado === 'ja_concluida' ? 'ja_concluida' : 'ok'
}

/** Todas as respostas do intervalo (datas aaaa-mm-dd, inclusive), no formato "Linha". */
export async function buscarLinhas(ini, fim) {
  const rows = await buscarTodasLinhas(() =>
    supabase
      .from('ruptura_respostas')
      .select('id,codigo,nome,secao,disponivel,ruptura_checagens!inner(data,turno)')
      .gte('ruptura_checagens.data', ini)
      .lte('ruptura_checagens.data', fim)
      .order('id')
  )
  return rows.map((r) => ({
    data: r.ruptura_checagens.data,
    turno: r.ruptura_checagens.turno,
    codigo: r.codigo,
    produto: r.nome,
    setor: r.secao,
    disp: r.disponivel,
  }))
}
