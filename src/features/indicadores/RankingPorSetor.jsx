import { useRef, useState } from 'react'
import { buscarHistoricoProduto } from './indicadoresApi'

function formatarReal(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarSemana(inicio) {
  return inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const LARGURA_GRAFICO = 200
const ALTURA_GRAFICO = 64
const PADDING_X = 24 // margem lateral, dá espaço pro texto do valor não cortar nas pontas
const PADDING_Y = 6
const ESPACO_VALOR = 12 // espaço reservado no topo pro texto do valor de cada ponto
const ESPACO_DATA = 14 // espaço reservado embaixo pro texto da data de cada ponto

/**
 * Gráfico de linha simples (SVG puro, sem lib) pro histórico de 4 semanas no
 * hover. `pontos` já vem em ordem cronológica (mais antiga primeiro). Semana
 * sem valor (ex: % sem dado de venda) vira um buraco na linha, não um 0.
 */
function GraficoHistorico({ pontos, formatarValor }) {
  const valores = pontos.map((p) => p.valor).filter((v) => v != null)
  const max = Math.max(...valores, 0)
  const min = Math.min(...valores, 0)
  const amplitude = max - min || 1

  const x = (i) => PADDING_X + (i / (pontos.length - 1)) * (LARGURA_GRAFICO - PADDING_X * 2)
  const y = (v) =>
    ESPACO_VALOR + ALTURA_GRAFICO - PADDING_Y - ((v - min) / amplitude) * (ALTURA_GRAFICO - PADDING_Y * 2)

  let path = ''
  let emTraco = false
  pontos.forEach((p, i) => {
    if (p.valor == null) {
      emTraco = false
      return
    }
    path += `${emTraco ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)} `
    emTraco = true
  })

  return (
    <svg
      width={LARGURA_GRAFICO}
      height={ESPACO_VALOR + ALTURA_GRAFICO + ESPACO_DATA}
      viewBox={`0 0 ${LARGURA_GRAFICO} ${ESPACO_VALOR + ALTURA_GRAFICO + ESPACO_DATA}`}
    >
      <path d={path} fill="none" stroke="#fff" strokeWidth="1.5" />
      {pontos.map(
        (p, i) =>
          p.valor != null && (
            <circle key={i} cx={x(i)} cy={y(p.valor)} r="2.5" fill="#fff">
              <title>
                {formatarSemana(p.inicio)}: {formatarValor(p.valor)}
              </title>
            </circle>
          )
      )}
      {pontos.map(
        (p, i) =>
          p.valor != null && (
            <text key={i} x={x(i)} y={y(p.valor) - 5} fontSize="9" fill="#fff" textAnchor="middle">
              {formatarValor(p.valor)}
            </text>
          )
      )}
      {pontos.map((p, i) => (
        <text key={i} x={x(i)} y={ESPACO_VALOR + ALTURA_GRAFICO + 12} fontSize="9" fill="#b5b5ad" textAnchor="middle">
          {formatarSemana(p.inicio)}
        </text>
      ))}
    </svg>
  )
}

const FORMATADORES_CAMPO = {
  quantidade: (v) => v.toFixed(3),
  valor: formatarReal,
  percentual: (v) => `${v.toFixed(1)}%`,
}

export default function RankingPorSetor({ resultado }) {
  const [hover, setHover] = useState(null) // { codigo, campo } | null
  const [historico, setHistorico] = useState(null) // array | null (do código em hover)
  const cacheRef = useRef(new Map())

  function handleHover(codigo, campo) {
    setHover({ codigo, campo })
    if (cacheRef.current.has(codigo)) {
      setHistorico(cacheRef.current.get(codigo))
      return
    }
    setHistorico(null)
    buscarHistoricoProduto(codigo).then((dados) => {
      cacheRef.current.set(codigo, dados)
      setHover((atual) => {
        if (atual?.codigo === codigo) setHistorico(dados)
        return atual
      })
    })
  }

  function renderTooltip(campo) {
    const pontos = historico
      ? historico
          .slice()
          .reverse() // buscarHistoricoProduto devolve mais recente primeiro; o gráfico lê da esquerda (mais antiga) pra direita
          .map((s) => ({ inicio: s.inicio, valor: s[campo] }))
      : []

    return (
      <div className="historico-tooltip">
        {historico === null ? (
          'Carregando...'
        ) : (
          <GraficoHistorico pontos={pontos} formatarValor={FORMATADORES_CAMPO[campo]} />
        )}
      </div>
    )
  }

  return (
    <div className="card ranking-desperdicio">
      <h4>Ranking de desperdício por setor</h4>

      {!resultado.temVendasDoPeriodo && (
        <p className="erro">
          Sem dados de venda importados pra esse período exato — a % de desperdício não pôde ser calculada. Mostrando
          só quantidade e valor.
        </p>
      )}

      {resultado.setores.length === 0 ? (
        <p className="carrinho-vazio">Sem lançamentos de desperdício nesse período.</p>
      ) : (
        resultado.setores.map((setor) => (
          <div key={setor.secao} className="setor-bloco">
            <h5>
              {setor.secao} — {formatarReal(setor.totalValor)} ·{' '}
              {setor.percentual == null ? 'sem dados de venda' : `${setor.percentual.toFixed(1)}% desperdício`}
            </h5>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Quantidade</th>
                  <th>Valor</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {setor.produtos.map((p) => (
                  <tr key={p.codigo}>
                    <td>{p.nome}</td>
                    <td
                      className="celula-com-historico"
                      onMouseEnter={() => handleHover(p.codigo, 'quantidade')}
                      onMouseLeave={() => setHover(null)}
                    >
                      {p.quantidade.toFixed(3)} {p.unidade}
                      {hover?.codigo === p.codigo && hover.campo === 'quantidade' && renderTooltip('quantidade')}
                    </td>
                    <td
                      className="celula-com-historico"
                      onMouseEnter={() => handleHover(p.codigo, 'valor')}
                      onMouseLeave={() => setHover(null)}
                    >
                      {formatarReal(p.valor)}
                      {hover?.codigo === p.codigo && hover.campo === 'valor' && renderTooltip('valor')}
                    </td>
                    <td
                      className="celula-com-historico"
                      onMouseEnter={() => handleHover(p.codigo, 'percentual')}
                      onMouseLeave={() => setHover(null)}
                    >
                      {p.percentual == null ? 'sem dados de venda' : `${p.percentual.toFixed(1)}%`}
                      {hover?.codigo === p.codigo && hover.campo === 'percentual' && renderTooltip('percentual')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  )
}
