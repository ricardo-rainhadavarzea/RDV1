import { supabase } from '../../lib/supabaseClient'
import { segundaFeiraDe, formatarISO } from './periodoUtils'

const TIPOS_VAZIOS = { desperdicio: 0, buffet_ida: 0, buffet_volta: 0, uso_interno: 0 }

export async function buscarTotaisPeriodo(inicio, fim) {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('tipo, total_valor')
    .gte('criado_em', inicio.toISOString())
    .lt('criado_em', fim.toISOString())
  if (error) throw error

  const totais = { ...TIPOS_VAZIOS }
  for (const row of data) {
    totais[row.tipo] = (totais[row.tipo] ?? 0) + Number(row.total_valor)
  }

  return {
    desperdicio: totais.desperdicio,
    buffetIda: totais.buffet_ida,
    buffetVolta: totais.buffet_volta,
    saldoBuffet: totais.buffet_ida - totais.buffet_volta,
    usoInterno: totais.uso_interno,
  }
}

/** Total de desperdício (R$) por semana, das últimas `numSemanas` semanas (incluindo a atual). */
export async function buscarDesperdicioPorSemana(numSemanas = 8) {
  const inicioJanela = segundaFeiraDe(new Date())
  inicioJanela.setDate(inicioJanela.getDate() - 7 * (numSemanas - 1))

  const { data, error } = await supabase
    .from('movimentacoes')
    .select('total_valor, criado_em')
    .eq('tipo', 'desperdicio')
    .gte('criado_em', inicioJanela.toISOString())
  if (error) throw error

  const semanas = []
  for (let i = 0; i < numSemanas; i++) {
    const inicioSemana = new Date(inicioJanela)
    inicioSemana.setDate(inicioSemana.getDate() + 7 * i)
    const fimSemana = new Date(inicioSemana)
    fimSemana.setDate(fimSemana.getDate() + 7)

    const total = data
      .filter((m) => {
        const d = new Date(m.criado_em)
        return d >= inicioSemana && d < fimSemana
      })
      .reduce((soma, m) => soma + Number(m.total_valor), 0)

    semanas.push({ inicio: inicioSemana, total })
  }
  return semanas
}

/**
 * Ranking de desperdício agrupado por setor, pro período escolhido no filtro
 * principal. A % de desperdício/vendido só é calculada quando o período
 * bater exatamente com uma semana de vendas importada (mesmo periodo_inicio
 * e periodo_fim) — fora disso, ou pra produto sem registro de venda naquela
 * semana, percentual fica null e a UI mostra "sem dados de venda" em vez de
 * inventar um número.
 */
export async function buscarRankingPorSetor(inicio, fim, tipo = 'desperdicio') {
  const { data: itens, error } = await supabase
    .from('movimentacao_itens')
    .select('codigo, nome, unidade, quantidade, valor, movimentacoes!inner(tipo, criado_em), produtos(secao)')
    .eq('movimentacoes.tipo', tipo)
    .gte('movimentacoes.criado_em', inicio.toISOString())
    .lt('movimentacoes.criado_em', fim.toISOString())
  if (error) throw error

  // `fim` é exclusivo (início do dia seguinte ao último dia do período) —
  // o último dia do período em si é um dia antes disso.
  const ultimoDia = new Date(fim)
  ultimoDia.setDate(ultimoDia.getDate() - 1)
  const periodoInicioISO = formatarISO(inicio)
  const periodoFimISO = formatarISO(ultimoDia)

  const { data: vendas, error: erroVendas } = await supabase
    .from('vendas_periodo')
    .select('codigo, quantidade')
    .eq('periodo_inicio', periodoInicioISO)
    .eq('periodo_fim', periodoFimISO)
  if (erroVendas) throw erroVendas

  const vendasMap = new Map(vendas.map((v) => [v.codigo, Number(v.quantidade)]))
  const temVendasDoPeriodo = vendas.length > 0

  const porProduto = new Map()
  for (const item of itens) {
    const atual = porProduto.get(item.codigo) ?? {
      codigo: item.codigo,
      nome: item.nome,
      unidade: item.unidade,
      secao: item.produtos?.secao?.trim() || 'Sem seção',
      quantidade: 0,
      valor: 0,
    }
    atual.quantidade += Number(item.quantidade)
    atual.valor += Number(item.valor)
    porProduto.set(item.codigo, atual)
  }

  const produtos = [...porProduto.values()].map((p) => {
    const qtdVendida = vendasMap.get(p.codigo)
    const percentual = vendasMap.has(p.codigo) && qtdVendida > 0 ? (p.quantidade / qtdVendida) * 100 : null
    return { ...p, percentual }
  })

  const porSetor = new Map()
  for (const p of produtos) {
    if (!porSetor.has(p.secao)) porSetor.set(p.secao, [])
    porSetor.get(p.secao).push(p)
  }
  for (const lista of porSetor.values()) {
    lista.sort((a, b) => b.valor - a.valor)
  }

  const setores = [...porSetor.entries()]
    .map(([secao, produtosDoSetor]) => ({
      secao,
      produtos: produtosDoSetor,
      totalValor: produtosDoSetor.reduce((s, p) => s + p.valor, 0),
    }))
    .sort((a, b) => b.totalValor - a.totalValor)

  return { temVendasDoPeriodo, setores }
}

export { formatarISO }
