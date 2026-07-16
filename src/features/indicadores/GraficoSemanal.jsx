import { useState } from 'react'
import { formatarDataBR } from './periodoUtils'

function formatarReal(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function GraficoSemanal({ semanas }) {
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
              className="grafico-coluna"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              {hoverIndex === i && (
                <div className="grafico-tooltip">
                  {formatarDataBR(s.inicio)}: {formatarReal(s.total)}
                </div>
              )}
              {i === maxIndex && s.total > 0 && <div className="grafico-valor-topo">{formatarReal(s.total)}</div>}
              <div className="grafico-barra" style={{ height: `${alturaPct}%` }} />
              <div className="grafico-eixo-label">
                {s.inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
