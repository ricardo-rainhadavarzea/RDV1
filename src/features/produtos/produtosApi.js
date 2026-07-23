import { supabase } from '../../lib/supabaseClient'
import { mapHeaders as mapHeadersShared, parseNumeroBR, padCodigo } from '../../lib/csvUtils'

const CHUNK_SIZE = 500

const HEADER_ALIASES = {
  codigo: ['codigo', 'cod', 'codproduto', 'codigoproduto', 'codigodebarras'],
  nome: ['nome', 'descricao', 'produto', 'nomedoproduto'],
  unidade: ['unidade', 'un', 'und', 'unidadedemedida'],
  preco_unitario: ['precounitario', 'preco', 'valorunitario', 'preco unitario', 'precovenda', 'preco venda'],
  preco_compra: ['precocompra', 'preco compra', 'custo', 'precocusto'],
  grupo: ['grupo'],
  secao: ['secao', 'setor'],
}

/** Dado o array de cabeçalhos do CSV, monta um mapa { campoInterno: cabecalhoOriginal } */
export function mapHeaders(rawHeaders) {
  return mapHeadersShared(rawHeaders, HEADER_ALIASES)
}

export { padCodigo }

/** Converte linhas cruas do CSV (com cabeçalhos mapeados) em objetos prontos pra inserir. */
export function rowsToProdutos(rows, headerMap) {
  return rows
    .filter((row) => row[headerMap.codigo] != null && String(row[headerMap.codigo]).trim() !== '')
    .map((row) => ({
      codigo: padCodigo(row[headerMap.codigo]),
      nome: String(row[headerMap.nome] ?? '').trim(),
      unidade: String(row[headerMap.unidade] ?? 'UN').trim().toUpperCase(),
      preco_unitario: parseNumeroBR(row[headerMap.preco_unitario]),
      preco_compra: headerMap.preco_compra ? parseNumeroBR(row[headerMap.preco_compra]) : null,
      grupo: headerMap.grupo ? String(row[headerMap.grupo] ?? '').trim() : null,
      secao: headerMap.secao ? String(row[headerMap.secao] ?? '').trim() : null,
    }))
}

/**
 * Importa produtos em lote.
 * modo 'incremental' -> upsert (atualiza existentes, insere novos, não mexe no resto)
 * modo 'massa' -> apaga tudo antes e insere a lista completa
 */
export async function importarProdutos(produtos, modo, onProgress) {
  if (modo === 'massa') {
    const { error: deleteError } = await supabase.from('produtos').delete().neq('codigo', '')
    if (deleteError) throw deleteError
  }

  let processados = 0
  for (let i = 0; i < produtos.length; i += CHUNK_SIZE) {
    const chunk = produtos.slice(i, i + CHUNK_SIZE)
    const { error } = await supabase
      .from('produtos')
      .upsert(chunk, { onConflict: 'codigo' })
    if (error) throw error
    processados += chunk.length
    onProgress?.(processados, produtos.length)
  }

  return processados
}

export async function buscarProdutos({ termo = '', pagina = 0, tamanhoPagina = 50 } = {}) {
  let query = supabase
    .from('produtos')
    .select('*', { count: 'exact' })
    .order('nome', { ascending: true })
    .range(pagina * tamanhoPagina, pagina * tamanhoPagina + tamanhoPagina - 1)

  if (termo.trim() !== '') {
    const termoLimpo = termo.trim()
    query = query.or(`nome.ilike.%${termoLimpo}%,codigo.ilike.%${termoLimpo}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export async function atualizarProduto(codigo, campos) {
  const { error } = await supabase
    .from('produtos')
    .update({ ...campos, atualizado_em: new Date().toISOString() })
    .eq('codigo', codigo)
  if (error) throw error
}

export async function criarProduto(produto) {
  const payload = {
    ...produto,
    codigo: padCodigo(produto.codigo),
  }
  const { error } = await supabase.from('produtos').insert(payload)
  if (error) throw error
}

export async function contarProdutos() {
  const { count, error } = await supabase
    .from('produtos')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count
}
