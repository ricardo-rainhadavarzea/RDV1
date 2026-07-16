import { supabase } from '../../lib/supabaseClient'

const CHUNK_SIZE = 500

/** Normaliza texto pra comparar cabeçalhos de CSV sem acento/maiúsculas. */
function normalizeHeader(h) {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

const HEADER_ALIASES = {
  codigo: ['codigo', 'código', 'cod', 'cod. produto', 'codigo produto', 'codigo de barras'],
  nome: ['nome', 'descricao', 'descrição', 'produto', 'nome do produto'],
  unidade: ['unidade', 'un', 'und', 'unidade de medida'],
  preco_unitario: ['preco_unitario', 'preco unitario', 'preço unitário', 'preco', 'preço', 'valor unitario', 'valor unitário'],
  grupo: ['grupo'],
  secao: ['secao', 'seção', 'setor'],
}

/** Dado o array de cabeçalhos do CSV, monta um mapa { campoInterno: cabecalhoOriginal } */
export function mapHeaders(rawHeaders) {
  const normalized = rawHeaders.map((h) => ({ raw: h, norm: normalizeHeader(h) }))
  const map = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const found = normalized.find((h) => aliases.includes(h.norm))
    if (found) map[field] = found.raw
  }
  return map
}

/** Preenche o código com zeros à esquerda até 13 dígitos. */
export function padCodigo(codigo) {
  const digits = String(codigo).replace(/\D/g, '')
  return digits.padStart(13, '0')
}

function parseBRNumber(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'number') return value
  const cleaned = String(value).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const n = parseFloat(cleaned)
  return Number.isNaN(n) ? 0 : n
}

/** Converte linhas cruas do CSV (com cabeçalhos mapeados) em objetos prontos pra inserir. */
export function rowsToProdutos(rows, headerMap) {
  return rows
    .filter((row) => row[headerMap.codigo] != null && String(row[headerMap.codigo]).trim() !== '')
    .map((row) => ({
      codigo: padCodigo(row[headerMap.codigo]),
      nome: String(row[headerMap.nome] ?? '').trim(),
      unidade: String(row[headerMap.unidade] ?? 'UN').trim().toUpperCase(),
      preco_unitario: parseBRNumber(row[headerMap.preco_unitario]),
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
