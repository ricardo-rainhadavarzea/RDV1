import { OPCOES_PERIODO } from './periodoUtils'

export default function PeriodoFiltro({ filtro, onFiltroChange, personalizado, onPersonalizadoChange }) {
  return (
    <div className="periodo-filtro">
      <div className="periodo-botoes">
        {OPCOES_PERIODO.map((opcao) => (
          <button
            key={opcao.value}
            className={filtro === opcao.value ? 'periodo-ativo' : ''}
            onClick={() => onFiltroChange(opcao.value)}
          >
            {opcao.label}
          </button>
        ))}
      </div>

      {filtro === 'personalizado' && (
        <div className="periodo-personalizado">
          <label>
            De
            <input
              type="date"
              value={personalizado.inicio}
              onChange={(e) => onPersonalizadoChange({ ...personalizado, inicio: e.target.value })}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={personalizado.fim}
              onChange={(e) => onPersonalizadoChange({ ...personalizado, fim: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  )
}
