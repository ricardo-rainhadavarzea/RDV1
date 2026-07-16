import Papa from 'papaparse'
import { supabase } from '../../lib/supabaseClient'
import { mapHeaders, parseNumeroBR, padCodigo } from '../../lib/csvUtils'

const CHUNK_SIZE = 500

const HEADER_ALIASES = {
  codigo: ['codigo', 'cod'],
  nome: ['produto', 'nome', 'descricao'],
  quantidade: ['quantidade', 'qtd'],
  preco_medio: ['precomedioreal', 'precomedio'],
  total: ['totalreal', 'total'],
  percentual: ['pct', 'percent', 'percentual'],
  acumulado: ['acum', 'acumulado'],
}

function ddmmyyyyToISO(str) {
  const [dia, mes, ano] = str.split('/')
  return `${ano}-${mes}-${dia}`
}

/**
 * O relatório da Curva ABC da BM tem metadados no topo (entre eles a linha
 * "PERÍODO: dd/mm/aaaa a dd/mm/aaaa") antes da tabela de verdade
 * (Código;Produto;Quantidade;Preço Médio R$;Total R$;%;Acum), números em
 * formato brasileiro (1.234,56).
 */
export function parseRelatorioVendas(texto) {
  const linhas = texto.split(/\r\n|\n/)

  const linhaPeriodo = linhas.find((l) => /per[ií]odo/i.test(l))
  if (!linhaPeriodo) {
    throw new Error('Não encontrei a linha de período (ex: "PERÍODO: 01/07/2026 a 07/07/2026") no arquivo.')
  }
  const matchPeriodo = linhaPeriodo.match(/(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/i)
  if (!matchPeriodo) {
    throw new Error(`Não consegui interpretar as datas na linha de período: "${linhaPeriodo}"`)
  }
  const periodoInicio = ddmmyyyyToISO(matchPeriodo[1])
  const periodoFim = ddmmyyyyToISO(matchPeriodo[2])

  const indiceHeader = linhas.findIndex((l) => /c[oó]digo/i.test(l) && /produto/i.test(l))
  if (indiceHeader === -1) {
    throw new Error('Não encontrei a linha de cabeçalho da tabela (Código;Produto;Quantidade;...).')
  }

  // O relatório termina com uma linha de resumo tipo "Registros: 517;;Total
  // Quant: 3290,94;;..." que não é um produto — precisa parar antes dela,
  // senão vira uma linha de venda fantasma.
  let indiceFim = linhas.findIndex((l, i) => i > indiceHeader && /^registros\s*:/i.test(l.trim()))
  if (indiceFim === -1) indiceFim = linhas.length

  const csvTabela = linhas.slice(indiceHeader, indiceFim).join('\n')
  const parsed = Papa.parse(csvTabela, { header: true, skipEmptyLines: true })
  const headerMap = mapHeaders(parsed.meta.fields ?? [], HEADER_ALIASES)

  const faltando = ['codigo', 'nome', 'quantidade'].filter((c) => !headerMap[c])
  if (faltando.length > 0) {
    throw new Error(
      `Não consegui identificar as colunas: ${faltando.join(', ')}. Cabeçalhos encontrados: ${(parsed.meta.fields ?? []).join(', ')}`
    )
  }

  const linhasVenda = parsed.data
    .filter((row) => row[headerMap.codigo] != null && String(row[headerMap.codigo]).trim() !== '')
    .map((row) => ({
      codigo: padCodigo(row[headerMap.codigo]),
      nome: String(row[headerMap.nome] ?? '').trim(),
      quantidade: parseNumeroBR(row[headerMap.quantidade]),
      preco_medio: headerMap.preco_medio ? parseNumeroBR(row[headerMap.preco_medio]) : null,
      total: headerMap.total ? parseNumeroBR(row[headerMap.total]) : null,
      percentual: headerMap.percentual ? parseNumeroBR(row[headerMap.percentual]) : null,
      acumulado: headerMap.acumulado ? parseNumeroBR(row[headerMap.acumulado]) : null,
    }))

  return { periodoInicio, periodoFim, linhas: linhasVenda }
}

export async function importarVendas(periodoInicio, periodoFim, linhas, onProgress) {
  const registros = linhas.map((l) => ({
    periodo_inicio: periodoInicio,
    periodo_fim: periodoFim,
    codigo: l.codigo,
    nome: l.nome,
    quantidade: l.quantidade,
    preco_medio: l.preco_medio,
    total: l.total,
    percentual: l.percentual,
    acumulado: l.acumulado,
  }))

  let processados = 0
  for (let i = 0; i < registros.length; i += CHUNK_SIZE) {
    const chunk = registros.slice(i, i + CHUNK_SIZE)
    const { error } = await supabase
      .from('vendas_periodo')
      .upsert(chunk, { onConflict: 'periodo_inicio,periodo_fim,codigo' })
    if (error) throw error
    processados += chunk.length
    onProgress?.(processados, registros.length)
  }

  return processados
}

export async function listarPeriodosImportados() {
  const { data, error } = await supabase
    .from('vendas_periodo')
    .select('periodo_inicio, periodo_fim')
    .order('periodo_inicio', { ascending: false })
  if (error) throw error

  const vistos = new Set()
  const periodos = []
  for (const row of data) {
    const chave = `${row.periodo_inicio}_${row.periodo_fim}`
    if (!vistos.has(chave)) {
      vistos.add(chave)
      periodos.push({ periodoInicio: row.periodo_inicio, periodoFim: row.periodo_fim })
    }
  }
  return periodos
}
