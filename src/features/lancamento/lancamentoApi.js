import { supabase } from '../../lib/supabaseClient'

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
