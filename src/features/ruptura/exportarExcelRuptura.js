import {
  comparativo,
  formatData,
  formatDataCurta,
  periodoAnterior,
  porDia,
  porProduto,
  porSetor,
  porTurno,
  resumo,
} from './rupturaLib'

const NEGRITO = { bold: true }
const CINZA = 'FFE5E7EB'
const DIA_A = 'FFDCEBF7'
const DIA_B = 'FFFCE9D9'
const VERDE = 'FFC6EFCE'
const VERMELHO = 'FFFFC7CE'
const FMT_PCT = '0.0%'

const preencher = (cor) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: cor } })

function cabecalho(ws, titulos, larguras) {
  const linha = ws.addRow(titulos)
  linha.font = NEGRITO
  linha.fill = preencher(CINZA)
  linha.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  larguras.forEach((w, i) => (ws.getColumn(i + 1).width = w))
}

function abaIndice(ws, titulo, linhas, formatar) {
  cabecalho(ws, [titulo, 'Itens checados', 'Itens indisponíveis', 'Índice de ruptura'], [28, 16, 20, 18])
  for (const l of linhas) {
    const r = ws.addRow([formatar ? formatar(l.chave) : l.chave, l.checados, l.indisp, l.indice === null ? null : l.indice / 100])
    r.getCell(4).numFmt = FMT_PCT
  }
}

/** Gera e baixa ruptura_AAAA-MM-DD_a_AAAA-MM-DD.xlsx, uma aba por bloco do relatório. */
export async function exportarExcel({ ini, fim, config, atual, anterior }) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()

  // --- Resumo (matriz produto x data x turno) ---
  const ws = wb.addWorksheet('Resumo')
  const r = resumo(atual, ini, fim)
  ws.getColumn(1).width = 34
  const linhaData = ws.addRow(['Produto', ...r.datas.flatMap((d) => [formatDataCurta(d), '', ''])])
  const linhaTurno = ws.addRow(['', ...r.datas.flatMap(() => config.nomes)])
  ws.mergeCells(1, 1, 2, 1)
  r.datas.forEach((_, i) => {
    const c0 = 2 + i * 3
    ws.mergeCells(1, c0, 1, c0 + 2)
    for (let k = 0; k < 3; k++) {
      ws.getColumn(c0 + k).width = 9
      for (const linha of [linhaData, linhaTurno]) linha.getCell(c0 + k).fill = preencher(i % 2 ? DIA_B : DIA_A)
    }
  })
  for (const linha of [linhaData, linhaTurno]) {
    linha.font = NEGRITO
    linha.alignment = { horizontal: 'center', vertical: 'middle' }
  }
  linhaData.getCell(1).fill = preencher(CINZA)
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }]
  for (const g of r.grupos) {
    const t = ws.addRow([g.setor])
    ws.mergeCells(t.number, 1, t.number, 1 + r.datas.length * 3)
    t.font = NEGRITO
    t.fill = preencher(CINZA)
    for (const p of g.produtos) {
      const linha = ws.addRow([p.nome])
      r.datas.forEach((d, i) => {
        for (let turno = 1; turno <= 3; turno++) {
          const v = r.celula(p.codigo, d, turno)
          const cel = linha.getCell(2 + i * 3 + turno - 1)
          cel.alignment = { horizontal: 'center' }
          if (v === undefined) cel.fill = preencher(i % 2 ? 'FFFEF6EE' : 'FFF1F7FC')
          else {
            cel.value = v ? 'Sim' : 'Não'
            cel.fill = preencher(v ? VERDE : VERMELHO)
          }
        }
      })
    }
  }

  // --- Por dia / turno / setor / produto ---
  abaIndice(wb.addWorksheet('Por dia'), 'Data', porDia(atual), formatData)
  abaIndice(wb.addWorksheet('Por turno'), 'Turno', porTurno(atual, config.nomes))
  abaIndice(wb.addWorksheet('Por setor'), 'Setor', porSetor(atual))

  const wp = wb.addWorksheet('Por produto')
  cabecalho(wp, ['Código', 'Produto', 'Setor', 'Itens checados', 'Itens indisponíveis', 'Índice de ruptura'], [18, 34, 22, 16, 20, 18])
  for (const p of porProduto(atual)) {
    const linha = wp.addRow([p.codigo, p.produto, p.setor, p.checados, p.indisp, p.indice === null ? null : p.indice / 100])
    linha.getCell(6).numFmt = FMT_PCT
  }

  // --- Comparativo ---
  const ant = periodoAnterior(ini, fim)
  const wc = wb.addWorksheet('Comparativo')
  cabecalho(
    wc,
    [
      '',
      `Checados (${formatData(ini)} a ${formatData(fim)})`,
      'Indisponíveis',
      'Índice atual',
      `Checados (${formatData(ant.ini)} a ${formatData(ant.fim)})`,
      'Indisponíveis',
      'Índice anterior',
      'Variação (p.p.)',
    ],
    [26, 24, 15, 14, 24, 15, 16, 16]
  )
  wc.getRow(1).height = 45
  for (const i of comparativo(atual, anterior)) {
    const linha = wc.addRow([
      i.chave,
      i.atual.checados,
      i.atual.indisp,
      i.atual.indice === null ? null : i.atual.indice / 100,
      i.anterior.checados,
      i.anterior.indisp,
      i.anterior.indice === null ? null : i.anterior.indice / 100,
      i.variacao,
    ])
    linha.getCell(4).numFmt = FMT_PCT
    linha.getCell(7).numFmt = FMT_PCT
    linha.getCell(8).numFmt = '+0.0;-0.0;0.0'
    if (i.chave === 'Geral') linha.font = NEGRITO
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ruptura_${ini}_a_${fim}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
