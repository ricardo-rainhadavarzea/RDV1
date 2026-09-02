import { supabase } from '../../lib/supabaseClient'
import { buscarTodasLinhas } from '../../lib/supabasePagination'

export const TIPOS = [
  { value: 'desperdicio', label: 'Desperdício' },
  { value: 'buffet_ida', label: 'Buffet Ida' },
  { value: 'buffet_volta', label: 'Buffet Volta' },
  { value: 'uso_interno', label: 'Uso Interno' },
]

export async function buscarProdutoPorCodigo(codigo) {
  const { data, error } = await supabase.from('produtos').select('*').eq('codigo', codigo).maybeSingle()
  if (error) throw error
  return data
}

export async function buscarProdutosPorNome(termo, limite = 15) {
  if (!termo.trim()) return []
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .ilike('nome', `%${termo.trim()}%`)
    .order('nome')
    .limit(limite)
  if (error) throw error
  return data
}

export async function salvarMovimentacao(tipo, itens) {
  const totalItens = itens.length
  const totalValor = itens.reduce((soma, item) => soma + item.valor, 0)

  const { data: movimentacao, error: movError } = await supabase
    .from('movimentacoes')
    .insert({ tipo, total_itens: totalItens, total_valor: totalValor })
    .select()
    .single()
  if (movError) throw movError

  const itensParaSalvar = itens.map((item) => ({
    movimentacao_id: movimentacao.id,
    codigo: item.codigo,
    nome: item.nome,
    unidade: item.unidade,
    quantidade: item.quantidade,
    valor: item.valor,
    origem: item.origem,
  }))

  const { error: itensError } = await supabase.from('movimentacao_itens').insert(itensParaSalvar)
  if (itensError) throw itensError

  return movimentacao
}

/** Lançamentos do período (+ filtro opcional de tipo), com os itens embutidos, mais recentes primeiro. */
export async function buscarMovimentacoes(inicio, fim, tipo) {
  return buscarTodasLinhas(() => {
    let query = supabase
      .from('movimentacoes')
      .select(
        'id, tipo, criado_em, total_itens, total_valor, movimentacao_itens(id, codigo, nome, unidade, quantidade, valor, origem)'
      )
      .gte('criado_em', inicio.toISOString())
      .lt('criado_em', fim.toISOString())
      .order('criado_em', { ascending: false })
    if (tipo) query = query.eq('tipo', tipo)
    return query
  })
}

/** Cancela (apaga) um lançamento — os itens somem junto via cascade no banco. */
export async function cancelarMovimentacao(id) {
  const { error } = await supabase.from('movimentacoes').delete().eq('id', id)
  if (error) throw error
}

/**
 * Recalcula total_itens/total_valor da movimentação a partir dos itens que
 * sobraram no banco. Se não sobrou nenhum item, apaga a movimentação inteira
 * em vez de deixar um lançamento "vazio" — chamado depois de editar/excluir
 * um item específico.
 */
async function recalcularTotaisMovimentacao(movimentacaoId) {
  const { data: itens, error } = await supabase.from('movimentacao_itens').select('valor').eq('movimentacao_id', movimentacaoId)
  if (error) throw error

  if (itens.length === 0) {
    await cancelarMovimentacao(movimentacaoId)
    return null
  }

  const totais = {
    total_itens: itens.length,
    total_valor: itens.reduce((soma, item) => soma + Number(item.valor), 0),
  }
  const { error: updError } = await supabase.from('movimentacoes').update(totais).eq('id', movimentacaoId)
  if (updError) throw updError
  return totais
}

/** Corrige quantidade/valor de UM item do lançamento (ex: erro de digitação), sem mexer nos outros itens. */
export async function atualizarItemMovimentacao(itemId, movimentacaoId, campos) {
  const { error } = await supabase.from('movimentacao_itens').update(campos).eq('id', itemId)
  if (error) throw error
  return recalcularTotaisMovimentacao(movimentacaoId)
}

/** Remove UM item do lançamento (ex: item duplicado/lançado por engano), mantendo os demais. */
export async function excluirItemMovimentacao(itemId, movimentacaoId) {
  const { error } = await supabase.from('movimentacao_itens').delete().eq('id', itemId)
  if (error) throw error
  return recalcularTotaisMovimentacao(movimentacaoId)
}
