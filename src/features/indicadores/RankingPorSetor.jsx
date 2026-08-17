import { useRef, useState } from 'react'
import { buscarHistoricoProduto } from './indicadoresApi'

function formatarReal(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarSemana(inicio) {
  return inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
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

  function renderTooltip(codigo) {
    return (
      <div className="historico-tooltip">
        {historico === null ? (
          'Carregando...'
        ) : (
          <table>
            <thead>
              <tr>
                <th>Semana</th>
                <th>Qtd</th>
                <th>Valor</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((s, i) => (
                <tr key={i}>
                  <td>{formatarSemana(s.inicio)}</td>
                  <td>{s.quantidade.toFixed(3)}</td>
                  <td>{formatarReal(s.valor)}</td>
                  <td>{s.percentual == null ? '—' : `${s.percentual.toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                      {hover?.codigo === p.codigo && hover.campo === 'quantidade' && renderTooltip(p.codigo)}
                    </td>
                    <td
                      className="celula-com-historico"
                      onMouseEnter={() => handleHover(p.codigo, 'valor')}
                      onMouseLeave={() => setHover(null)}
                    >
                      {formatarReal(p.valor)}
                      {hover?.codigo === p.codigo && hover.campo === 'valor' && renderTooltip(p.codigo)}
                    </td>
                    <td
                      className="celula-com-historico"
                      onMouseEnter={() => handleHover(p.codigo, 'percentual')}
                      onMouseLeave={() => setHover(null)}
                    >
                      {p.percentual == null ? 'sem dados de venda' : `${p.percentual.toFixed(1)}%`}
                      {hover?.codigo === p.codigo && hover.campo === 'percentual' && renderTooltip(p.codigo)}
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
