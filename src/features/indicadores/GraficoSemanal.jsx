import { useState } from 'react'

function formatarReal(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** "12 a 18", ou "29/11 a 05/12" quando a semana cruza o mês. */
function formatarIntervaloSemana(inicio) {
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 6)
  if (inicio.getMonth() === fim.getMonth()) {
    return `${inicio.getDate()} a ${fim.getDate()}`
  }
  const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return `${fmt(inicio)} a ${fmt(fim)}`
}

export default function GraficoSemanal({ semanas, onSelecionarSemana }) {
  const [hoverIndex, setHoverIndex] = useState(null)
  const max = Math.max(...semanas.map((s) => s.total), 1)
  const maxIndex = semanas.reduce((iMax, s, i) => (s.total > semanas[iMax].total ? i : iMax), 0)

  return (
    <div className="grafico-semanal">
      <h4>Desperdício por semana</h4>
      <div className="grafico-area">
        {semanas.map((s, i) => {
          const alturaPct = (s.total / max) * 100
          return (
            <div
              key={i}
              className="grafico-coluna grafico-coluna-clicavel"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              onClick={() => onSelecionarSemana?.(s.inicio)}
              title="Ver lançamentos dessa semana"
            >
              {hoverIndex === i && (
                <div className="grafico-tooltip">
                  {formatarIntervaloSemana(s.inicio)}: {formatarReal(s.total)}
                </div>
              )}
              {i === maxIndex && s.total > 0 && <div className="grafico-valor-topo">{formatarReal(s.total)}</div>}
              <div className="grafico-barra" style={{ height: `${alturaPct}%` }} />
              <div className="grafico-eixo-label">{formatarIntervaloSemana(s.inicio)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
