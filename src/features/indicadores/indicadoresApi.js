import { supabase } from '../../lib/supabaseClient'
import { segundaFeiraDe, formatarISO } from './periodoUtils'

const TIPOS_VAZIOS = { desperdicio: 0, buffet_ida: 0, buffet_volta: 0, uso_interno: 0 }
const TAMANHO_PAGINA_SUPABASE = 1000

/**
 * O Supabase/PostgREST limita cada resposta a 1000 linhas por padrão — sem
 * paginação explícita, uma consulta com mais de 1000 linhas (ex: vendas de
 * uma semana cheia, ou o cadastro de produtos inteiro) vem silenciosamente
 * truncada, sem erro. `construirQuery` deve retornar um builder NOVO do
 * Supabase a cada chamada (não reaproveitar o mesmo, já que uma query já
 * executada não pode ser reexecutada com `.range()` diferente).
 */
async function buscarTodasLinhas(construirQuery) {
  let todas = []
  let pagina = 0
  while (true) {
    const inicio = pagina * TAMANHO_PAGINA_SUPABASE
    const { data, error } = await construirQuery().range(inicio, inicio + TAMANHO_PAGINA_SUPABASE - 1)
    if (error) throw error
    todas = todas.concat(data)
    if (data.length < TAMANHO_PAGINA_SUPABASE) break
    pagina++
  }
  return todas
}

export async function buscarTotaisPeriodo(inicio, fim) {
  const data = await buscarTodasLinhas(() =>
    supabase
      .from('movimentacoes')
      .select('tipo, total_valor')
      .gte('criado_em', inicio.toISOString())
      .lt('criado_em', fim.toISOString())
  )

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

  const data = await buscarTodasLinhas(() =>
    supabase
      .from('movimentacoes')
      .select('total_valor, criado_em')
      .eq('tipo', 'desperdicio')
      .gte('criado_em', inicioJanela.toISOString())
  )

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
 * Agrupa itens de movimentação por produto, somando quantidade e valor. O
 * nome exibido é sempre o nome ATUAL do cadastro de produtos (não a "foto"
 * gravada no lançamento) — assim, corrigir um nome no cadastro reflete em
 * todo o histórico de relatórios. Só cai no nome gravado no lançamento se o
 * produto tiver sido excluído do cadastro depois.
 */
function agruparItensPorProduto(itens) {
  const porProduto = new Map()
  for (const item of itens) {
    const atual = porProduto.get(item.codigo) ?? {
      codigo: item.codigo,
      nome: item.produtos?.nome?.trim() || item.nome,
      unidade: item.unidade,
      secao: item.produtos?.secao?.trim() || 'Sem seção',
      quantidade: 0,
      valor: 0,
    }
    atual.quantidade += Number(item.quantidade)
    atual.valor += Number(item.valor)
    porProduto.set(item.codigo, atual)
  }
  return [...porProduto.values()]
}

/** Agrupa itens de buffet (ida/volta) por produto, pra saldo líquido (ida − volta) em qtd e R$. */
function agruparBuffetLiquidoPorProduto(itens) {
  const porProduto = new Map()
  for (const item of itens) {
    const atual = porProduto.get(item.codigo) ?? {
      secao: item.produtos?.secao?.trim() || 'Sem seção',
      qtdIda: 0,
      qtdVolta: 0,
      valorIda: 0,
      valorVolta: 0,
    }
    if (item.movimentacoes.tipo === 'buffet_ida') {
      atual.qtdIda += Number(item.quantidade)
      atual.valorIda += Number(item.valor)
    } else {
      atual.qtdVolta += Number(item.quantidade)
      atual.valorVolta += Number(item.valor)
    }
    porProduto.set(item.codigo, atual)
  }
  const liquidoPorCodigo = new Map()
  for (const [codigo, v] of porProduto) {
    liquidoPorCodigo.set(codigo, {
      secao: v.secao,
      qtd: Math.max(0, v.qtdIda - v.qtdVolta),
      valor: Math.max(0, v.valorIda - v.valorVolta),
    })
  }
  return liquidoPorCodigo
}

/**
 * Ranking de desperdício agrupado por setor, pro período escolhido no filtro
 * principal. A % de desperdício só é calculada quando o período bater
 * exatamente com uma semana de vendas importada (mesmo periodo_inicio e
 * periodo_fim) — fora disso, ou pra produto sem registro de venda naquela
 * semana, percentual fica null e a UI mostra "sem dados de venda" em vez de
 * inventar um número.
 *
 * A fórmula por produto é quantidade desperdiçada / "total produzido", onde
 * produzido = desperdiçada + vendida + consumida no buffet (ida − volta,
 * nunca negativo) — trata essa soma como o total produzido estimado, pra
 * nunca passar de 100% mesmo quando desperdiçou mais do que vendeu.
 *
 * As % agregadas por setor (`setor.percentual`) e da padaria toda
 * (`percentualGeral`) são valor desperdiçado do setor / (faturamento TOTAL
 * do setor no período + buffet líquido consumido do setor) — usa o
 * faturamento de TODOS os produtos do setor, não só dos que tiveram
 * desperdício, senão a % fica artificialmente inflada (ex: setor que só
 * desperdiçou um produto de R$ 93 apareceria dividindo por R$ 93 + venda
 * daquele produto só, ignorando o resto do faturamento do setor). Fica
 * `null` quando não há vendas importadas pro período (mesmo gate de
 * `temVendasDoPeriodo`).
 */
export async function buscarRankingPorSetor(inicio, fim, tipo = 'desperdicio') {
  const itens = await buscarTodasLinhas(() =>
    supabase
      .from('movimentacao_itens')
      .select('codigo, nome, unidade, quantidade, valor, movimentacoes!inner(tipo, criado_em), produtos(secao, nome)')
      .eq('movimentacoes.tipo', tipo)
      .gte('movimentacoes.criado_em', inicio.toISOString())
      .lt('movimentacoes.criado_em', fim.toISOString())
  )

  const itensBuffet = await buscarTodasLinhas(() =>
    supabase
      .from('movimentacao_itens')
      .select('codigo, quantidade, valor, movimentacoes!inner(tipo, criado_em), produtos(secao)')
      .in('movimentacoes.tipo', ['buffet_ida', 'buffet_volta'])
      .gte('movimentacoes.criado_em', inicio.toISOString())
      .lt('movimentacoes.criado_em', fim.toISOString())
  )
  const buffetLiquidoMap = agruparBuffetLiquidoPorProduto(itensBuffet)

  // `fim` é exclusivo (início do dia seguinte ao último dia do período) —
  // o último dia do período em si é um dia antes disso.
  const ultimoDia = new Date(fim)
  ultimoDia.setDate(ultimoDia.getDate() - 1)
  const periodoInicioISO = formatarISO(inicio)
  const periodoFimISO = formatarISO(ultimoDia)

  const vendas = await buscarTodasLinhas(() =>
    supabase
      .from('vendas_periodo')
      .select('codigo, quantidade, preco_medio, total')
      .eq('periodo_inicio', periodoInicioISO)
      .eq('periodo_fim', periodoFimISO)
  )

  // `vendas_periodo.codigo` não tem FK formal pra `produtos` no banco, então
  // o Supabase não faz join automático (`produtos(secao)`) nessa tabela como
  // faz com `movimentacao_itens`. Resolve buscando o setor de cada produto à
  // parte, pra poder somar o faturamento total por setor (não só dos
  // produtos com desperdício).
  const todosProdutos = await buscarTodasLinhas(() => supabase.from('produtos').select('codigo, secao'))
  const secaoPorCodigo = new Map(todosProdutos.map((p) => [p.codigo, p.secao?.trim() || 'Sem seção']))

  const vendasMap = new Map(vendas.map((v) => [v.codigo, v]))
  const temVendasDoPeriodo = vendas.length > 0

  const produtos = agruparItensPorProduto(itens).map((p) => {
    const venda = vendasMap.get(p.codigo)
    const qtdVendida = venda ? Number(venda.quantidade) : undefined
    const buffetLiquido = buffetLiquidoMap.get(p.codigo) ?? { qtd: 0, valor: 0 }

    const totalProduzidoQtd = p.quantidade + (qtdVendida ?? 0) + buffetLiquido.qtd
    const percentual = vendasMap.has(p.codigo) && totalProduzidoQtd > 0 ? (p.quantidade / totalProduzidoQtd) * 100 : null

    let valorProduzido = null
    if (venda) {
      const valorVenda = venda.total != null ? Number(venda.total) : Number(venda.preco_medio ?? 0) * qtdVendida
      valorProduzido = p.valor + valorVenda + buffetLiquido.valor
    }

    return { ...p, percentual, valorProduzido }
  })

  const porSetor = new Map()
  for (const p of produtos) {
    if (!porSetor.has(p.secao)) porSetor.set(p.secao, [])
    porSetor.get(p.secao).push(p)
  }
  for (const lista of porSetor.values()) {
    lista.sort((a, b) => b.valor - a.valor)
  }

  // Faturamento e buffet líquido de TODOS os produtos do período, agrupados
  // por setor — não só dos produtos que tiveram desperdício, senão a %
  // agregada fica distorcida (ver docstring da função).
  const faturamentoPorSetor = new Map()
  for (const v of vendas) {
    const secao = secaoPorCodigo.get(v.codigo) ?? 'Sem seção'
    const valorVenda = v.total != null ? Number(v.total) : Number(v.preco_medio ?? 0) * Number(v.quantidade)
    faturamentoPorSetor.set(secao, (faturamentoPorSetor.get(secao) ?? 0) + valorVenda)
  }
  const buffetLiquidoPorSetor = new Map()
  for (const b of buffetLiquidoMap.values()) {
    buffetLiquidoPorSetor.set(b.secao, (buffetLiquidoPorSetor.get(b.secao) ?? 0) + b.valor)
  }

  /** % = desperdício do setor / (faturamento total do setor + buffet líquido do setor). */
  function percentualDoSetor(secao, valorDesperdicioSetor) {
    if (!temVendasDoPeriodo) return null
    const produzido = (faturamentoPorSetor.get(secao) ?? 0) + (buffetLiquidoPorSetor.get(secao) ?? 0)
    return produzido > 0 ? (valorDesperdicioSetor / produzido) * 100 : null
  }

  const setores = [...porSetor.entries()]
    .map(([secao, produtosDoSetor]) => {
      const totalValor = produtosDoSetor.reduce((s, p) => s + p.valor, 0)
      return {
        secao,
        produtos: produtosDoSetor,
        totalValor,
        percentual: percentualDoSetor(secao, totalValor),
      }
    })
    .sort((a, b) => b.totalValor - a.totalValor)

  const totalDesperdicioGeral = produtos.reduce((s, p) => s + p.valor, 0)
  const faturamentoGeral = [...faturamentoPorSetor.values()].reduce((s, v) => s + v, 0)
  const buffetLiquidoGeral = [...buffetLiquidoPorSetor.values()].reduce((s, v) => s + v, 0)
  const produzidoGeral = faturamentoGeral + buffetLiquidoGeral
  const percentualGeral = temVendasDoPeriodo && produzidoGeral > 0 ? (totalDesperdicioGeral / produzidoGeral) * 100 : null

  return { temVendasDoPeriodo, setores, percentualGeral }
}

/**
 * Saldo do buffet (ida − volta) por produto, agrupado por setor, pro
 * período escolhido. Ex: foi 10kg de bolo, voltaram 8kg -> saldo 2kg
 * consumidos no buffet. Não depende de vendas_periodo — é só a diferença
 * entre os lançamentos de ida e volta dentro do período.
 */
export async function buscarSaldoBuffetPorSetor(inicio, fim) {
  const itens = await buscarTodasLinhas(() =>
    supabase
      .from('movimentacao_itens')
      .select('codigo, nome, unidade, quantidade, valor, movimentacoes!inner(tipo, criado_em), produtos(secao, nome)')
      .in('movimentacoes.tipo', ['buffet_ida', 'buffet_volta'])
      .gte('movimentacoes.criado_em', inicio.toISOString())
      .lt('movimentacoes.criado_em', fim.toISOString())
  )

  const porProduto = new Map()
  for (const item of itens) {
    const atual = porProduto.get(item.codigo) ?? {
      codigo: item.codigo,
      nome: item.produtos?.nome?.trim() || item.nome,
      unidade: item.unidade,
      secao: item.produtos?.secao?.trim() || 'Sem seção',
      qtdIda: 0,
      qtdVolta: 0,
      valorIda: 0,
      valorVolta: 0,
    }
    if (item.movimentacoes.tipo === 'buffet_ida') {
      atual.qtdIda += Number(item.quantidade)
      atual.valorIda += Number(item.valor)
    } else {
      atual.qtdVolta += Number(item.quantidade)
      atual.valorVolta += Number(item.valor)
    }
    porProduto.set(item.codigo, atual)
  }

  const produtos = [...porProduto.values()].map((p) => ({
    ...p,
    saldoQuantidade: p.qtdIda - p.qtdVolta,
    saldoValor: p.valorIda - p.valorVolta,
  }))

  const porSetor = new Map()
  for (const p of produtos) {
    if (!porSetor.has(p.secao)) porSetor.set(p.secao, [])
    porSetor.get(p.secao).push(p)
  }
  for (const lista of porSetor.values()) {
    lista.sort((a, b) => b.saldoValor - a.saldoValor)
  }

  const setores = [...porSetor.entries()]
    .map(([secao, produtosDoSetor]) => ({
      secao,
      produtos: produtosDoSetor,
      totalSaldoValor: produtosDoSetor.reduce((s, p) => s + p.saldoValor, 0),
    }))
    .sort((a, b) => b.totalSaldoValor - a.totalSaldoValor)

  return { setores }
}

/**
 * Ranking de uso interno por setor — soma simples de quantidade e valor por
 * produto. Sem comparação com vendas (não se aplica a uso interno).
 */
export async function buscarUsoInternoPorSetor(inicio, fim) {
  const itens = await buscarTodasLinhas(() =>
    supabase
      .from('movimentacao_itens')
      .select('codigo, nome, unidade, quantidade, valor, movimentacoes!inner(tipo, criado_em), produtos(secao, nome)')
      .eq('movimentacoes.tipo', 'uso_interno')
      .gte('movimentacoes.criado_em', inicio.toISOString())
      .lt('movimentacoes.criado_em', fim.toISOString())
  )

  const produtos = agruparItensPorProduto(itens)

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

  return { setores }
}

export { formatarISO }
