// Regras de cálculo da ruptura (sem acesso a banco, fáceis de testar).
//
// Índice de ruptura = itens indisponíveis ÷ itens checados × 100, em qualquer agrupamento.
// "Linha" = uma resposta ligada à sua checagem: { data, turno, codigo, produto, setor, disp }
// (setor = seção do cadastro; a BM chama de seção, no dia a dia chamamos de setor).

// Seções de produção própria: as únicas que entram na seleção de produtos da ruptura.
export const SECOES_RUPTURA = ['PADARIA', 'CONFEITARIA', 'CONFEITARIA FINA', 'PASTELARIA', 'PASTELARIA 2', 'FRITURAS']

// ---------- ordenação e índice ----------

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' })

/** Compara em português, sem diferenciar acentos nem maiúsculas. */
export function comparar(a, b) {
  return collator.compare(a, b)
}

/** Setor A–Z e, dentro do setor, produto A–Z. Itens: { nome, secao }. */
export function ordenarProdutos(lista) {
  return [...lista].sort((a, b) => comparar(a.secao, b.secao) || comparar(a.nome, b.nome))
}

/**
 * Sequência da checagem definida na Gestão: por `ordem` (1, 2, 3…). Itens sem ordem
 * (não deveria ocorrer) vão para o fim, em setor/nome A–Z.
 */
export function ordenarPorSequencia(lista) {
  return [...lista].sort((a, b) => {
    const oa = a.ordem ?? Infinity
    const ob = b.ordem ?? Infinity
    if (oa !== ob) return oa < ob ? -1 : 1
    return comparar(a.secao, b.secao) || comparar(a.nome, b.nome)
  })
}

export function indice({ checados, indisp }) {
  return checados === 0 ? null : (indisp / checados) * 100
}

// ---------- datas e formatação ----------

/** Data de hoje (aaaa-mm-dd) no fuso de Recife. */
export function hojeRecife() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife' }).format(new Date())
}

export function formatData(iso) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export function formatDataCurta(iso) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function formatPct(v) {
  if (v === null || v === undefined) return '—'
  return v.toFixed(1).replace('.', ',') + '%'
}

/** Variação em pontos percentuais, com sinal: +1,5 p.p. */
export function formatPP(v) {
  if (v === null || v === undefined) return '—'
  const s = v.toFixed(1).replace('.', ',')
  return (v > 0 ? '+' : '') + s + ' p.p.'
}

export function addDias(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Quantidade de dias do intervalo, contando as duas pontas. */
export function diasNoIntervalo(ini, fim) {
  const ms = new Date(fim + 'T00:00:00Z').getTime() - new Date(ini + 'T00:00:00Z').getTime()
  return Math.round(ms / 86400000) + 1
}

export function listarDatas(ini, fim) {
  const n = diasNoIntervalo(ini, fim)
  return Array.from({ length: Math.max(n, 0) }, (_, i) => addDias(ini, i))
}

// ---------- relatórios ----------

function agrupar(linhas, chave) {
  const mapa = new Map()
  for (const l of linhas) {
    const k = chave(l)
    const t = mapa.get(k) ?? { checados: 0, indisp: 0 }
    t.checados++
    if (!l.disp) t.indisp++
    mapa.set(k, t)
  }
  return mapa
}

function paraLista(mapa) {
  return [...mapa].map(([chave, t]) => ({ chave, ...t, indice: indice(t) }))
}

export function totalGeral(linhas) {
  const t = { checados: linhas.length, indisp: linhas.filter((l) => !l.disp).length }
  return { chave: 'Geral', ...t, indice: indice(t) }
}

export function porDia(linhas) {
  return paraLista(agrupar(linhas, (l) => l.data)).sort((a, b) => a.chave.localeCompare(b.chave))
}

/** Sempre devolve os três turnos, na ordem, com o nome atual. */
export function porTurno(linhas, nomes) {
  const mapa = agrupar(linhas, (l) => String(l.turno))
  return [1, 2, 3].map((turno) => {
    const t = mapa.get(String(turno)) ?? { checados: 0, indisp: 0 }
    return { chave: nomes[turno - 1], ...t, indice: indice(t) }
  })
}

export function porSetor(linhas) {
  return paraLista(agrupar(linhas, (l) => l.setor)).sort((a, b) => comparar(a.chave, b.chave))
}

/** Do maior índice para o menor (empate: nome A–Z). Cada item traz código, nome e setor. */
export function porProduto(linhas) {
  const nomes = new Map() // último nome/setor visto de cada código (linhas vêm em ordem de data)
  for (const l of [...linhas].sort((a, b) => a.data.localeCompare(b.data))) {
    nomes.set(l.codigo, { produto: l.produto, setor: l.setor })
  }
  return paraLista(agrupar(linhas, (l) => l.codigo))
    .map((x) => ({ ...x, codigo: x.chave, ...nomes.get(x.chave) }))
    .sort((a, b) => (b.indice ?? -1) - (a.indice ?? -1) || comparar(a.produto, b.produto))
}

/** Intervalo imediatamente anterior, de mesma duração. */
export function periodoAnterior(ini, fim) {
  const dias = diasNoIntervalo(ini, fim)
  const fimAnt = addDias(ini, -1)
  return { ini: addDias(fimAnt, -(dias - 1)), fim: fimAnt }
}

function itemComparativo(chave, atual, anterior) {
  const variacao = atual.indice === null || anterior.indice === null ? null : atual.indice - anterior.indice
  return { chave, atual, anterior, variacao }
}

/** Primeiro item = geral; depois um por setor (A–Z), com a união dos setores dos dois períodos. */
export function comparativo(atual, anterior) {
  const a = new Map(porSetor(atual).map((x) => [x.chave, x]))
  const b = new Map(porSetor(anterior).map((x) => [x.chave, x]))
  const vazio = (chave) => ({ chave, checados: 0, indisp: 0, indice: null })
  const setores = [...new Set([...a.keys(), ...b.keys()])].sort(comparar)
  return [
    itemComparativo('Geral', totalGeral(atual), totalGeral(anterior)),
    ...setores.map((s) => itemComparativo(s, a.get(s) ?? vazio(s), b.get(s) ?? vazio(s))),
  ]
}

/**
 * Matriz do Resumo: setores A–Z, produtos A–Z dentro de cada setor, uma coluna por data x turno.
 * `celula(codigo, data, turno)` → true (disponível), false (indisponível) ou undefined (sem checagem).
 */
export function resumo(linhas, ini, fim) {
  const valores = new Map()
  const porSetorMapa = new Map() // setor -> Map(codigo -> nome mais recente)
  for (const l of [...linhas].sort((a, b) => a.data.localeCompare(b.data))) {
    valores.set(`${l.codigo}|${l.data}|${l.turno}`, l.disp)
    if (!porSetorMapa.has(l.setor)) porSetorMapa.set(l.setor, new Map())
    porSetorMapa.get(l.setor).set(l.codigo, l.produto)
  }
  const grupos = [...porSetorMapa.keys()].sort(comparar).map((setor) => ({
    setor,
    produtos: [...porSetorMapa.get(setor)]
      .map(([codigo, nome]) => ({ codigo, nome }))
      .sort((a, b) => comparar(a.nome, b.nome)),
  }))
  return {
    datas: listarDatas(ini, fim),
    grupos,
    celula: (codigo, data, turno) => valores.get(`${codigo}|${data}|${turno}`),
  }
}

// ---------- pré-seleção da Curva A ----------

/**
 * Curva A por setor: dentro de cada setor, os produtos que somam `limite` (80%) do faturamento.
 * `vendas`: [{ codigo, secao, total }] (já somado no período). Devolve um Set de códigos.
 */
export function curvaAPorSetor(vendas, limite = 0.8) {
  const porSetorMapa = new Map()
  for (const v of vendas) {
    if (!(v.total > 0)) continue
    if (!porSetorMapa.has(v.secao)) porSetorMapa.set(v.secao, [])
    porSetorMapa.get(v.secao).push(v)
  }
  const codigos = new Set()
  for (const lista of porSetorMapa.values()) {
    const totalSetor = lista.reduce((s, v) => s + v.total, 0)
    let acumulado = 0
    for (const v of lista.sort((a, b) => b.total - a.total)) {
      if (acumulado >= totalSetor * limite) break
      codigos.add(v.codigo)
      acumulado += v.total
    }
  }
  return codigos
}
