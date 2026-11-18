import { describe, expect, it } from 'vitest'
import {
  addDias,
  comparativo,
  curvaAPorSetor,
  formatPct,
  formatPP,
  indice,
  listarDatas,
  ordenarProdutos,
  periodoAnterior,
  porDia,
  porProduto,
  porSetor,
  porTurno,
  resumo,
  totalGeral,
} from './rupturaLib'

const L = (data, turno, codigo, produto, setor, disp) => ({ data, turno, codigo, produto, setor, disp })

describe('índice de ruptura', () => {
  it('1 indisponível em 10 checagens = 10,0%', () => {
    expect(indice({ checados: 10, indisp: 1 })).toBe(10)
    expect(formatPct(indice({ checados: 10, indisp: 1 }))).toBe('10,0%')
  })
  it('sem checagens não tem índice', () => {
    expect(indice({ checados: 0, indisp: 0 })).toBeNull()
    expect(formatPct(null)).toBe('—')
  })
  it('formata com vírgula e uma casa', () => {
    expect(formatPct(12.5)).toBe('12,5%')
    expect(formatPP(1.54)).toBe('+1,5 p.p.')
    expect(formatPP(-2)).toBe('-2,0 p.p.')
  })
})

describe('ordenação', () => {
  it('setor A–Z e produto A–Z, sem diferenciar acento/maiúscula', () => {
    const r = ordenarProdutos([
      { nome: 'pão', secao: 'PADARIA' },
      { nome: 'Água', secao: 'bebidas' },
      { nome: 'Açaí', secao: 'Bebidas' },
      { nome: 'Bolo', secao: 'CONFEITARIA' },
      { nome: 'Aveia', secao: 'PADARIA' },
    ])
    expect(r.map((p) => p.nome)).toEqual(['Açaí', 'Água', 'Bolo', 'Aveia', 'pão'])
  })
})

describe('datas', () => {
  it('lista dias e calcula o período anterior de mesma duração', () => {
    expect(listarDatas('2026-11-01', '2026-11-03')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
    expect(addDias('2026-11-01', -1)).toBe('2026-10-31')
    expect(periodoAnterior('2026-11-08', '2026-11-14')).toEqual({ ini: '2026-11-01', fim: '2026-11-07' })
    expect(periodoAnterior('2026-11-14', '2026-11-14')).toEqual({ ini: '2026-11-13', fim: '2026-11-13' })
  })
})

describe('relatórios', () => {
  const linhas = [
    L('2026-11-10', 1, '001', 'Pão', 'PADARIA', true),
    L('2026-11-10', 2, '001', 'Pão', 'PADARIA', false),
    L('2026-11-10', 1, '002', 'Bolo', 'CONFEITARIA', true),
    L('2026-11-11', 3, '001', 'Pão', 'PADARIA', true),
  ]
  it('total geral, por dia, turno, setor e produto', () => {
    expect(totalGeral(linhas)).toMatchObject({ checados: 4, indisp: 1, indice: 25 })
    expect(porDia(linhas).map((d) => [d.chave, d.indice])).toEqual([
      ['2026-11-10', (1 / 3) * 100],
      ['2026-11-11', 0],
    ])
    expect(porTurno(linhas, ['Manhã', 'Tarde', 'Noite']).map((t) => [t.chave, t.checados, t.indice])).toEqual([
      ['Manhã', 2, 0],
      ['Tarde', 1, 100],
      ['Noite', 1, 0],
    ])
    expect(porSetor(linhas).map((s) => s.chave)).toEqual(['CONFEITARIA', 'PADARIA'])
    expect(porProduto(linhas)[0]).toMatchObject({ codigo: '001', produto: 'Pão', setor: 'PADARIA', checados: 3, indisp: 1 })
  })
  it('por produto agrupa pelo código mesmo se o nome mudou, usando o nome mais recente', () => {
    const r = porProduto([
      L('2026-11-10', 1, '001', 'Pão Frances', 'PADARIA', true),
      L('2026-11-11', 1, '001', 'Pão Francês', 'PADARIA', false),
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ produto: 'Pão Francês', checados: 2, indisp: 1 })
  })
  it('comparativo traz a variação em pontos percentuais', () => {
    const anterior = [L('2026-11-03', 1, '001', 'Pão', 'PADARIA', false), L('2026-11-03', 2, '001', 'Pão', 'PADARIA', true)]
    const c = comparativo(linhas, anterior)
    expect(c[0].chave).toBe('Geral')
    expect(c[0].variacao).toBe(25 - 50)
    expect(c.find((x) => x.chave === 'CONFEITARIA').variacao).toBeNull() // sem checagens no período anterior
  })
  it('resumo: datas sem checagem ficam vazias e produto removido da seleção continua no histórico', () => {
    const r = resumo(linhas, '2026-11-10', '2026-11-12')
    expect(r.datas).toHaveLength(3)
    expect(r.grupos.map((g) => g.setor)).toEqual(['CONFEITARIA', 'PADARIA'])
    expect(r.celula('001', '2026-11-10', 2)).toBe(false)
    expect(r.celula('001', '2026-11-12', 1)).toBeUndefined()
  })
})

describe('Curva A por setor', () => {
  it('pega, em cada setor, os produtos que somam 80% do faturamento', () => {
    const vendas = [
      { codigo: 'a', secao: 'PADARIA', total: 500 },
      { codigo: 'b', secao: 'PADARIA', total: 300 },
      { codigo: 'c', secao: 'PADARIA', total: 150 },
      { codigo: 'd', secao: 'PADARIA', total: 50 },
      { codigo: 'x', secao: 'FRITURAS', total: 100 },
      { codigo: 'y', secao: 'FRITURAS', total: 0 }, // sem venda: nunca entra
    ]
    const r = curvaAPorSetor(vendas, 0.8)
    expect([...r].sort()).toEqual(['a', 'b', 'x'])
  })
})
