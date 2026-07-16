import { TIPOS } from './lancamentoApi'

export default function TipoSelector({ onSelecionar }) {
  return (
    <div className="card tipo-selector">
      <h2>O que você vai lançar?</h2>
      <div className="tipo-botoes">
        {TIPOS.map((tipo) => (
          <button key={tipo.value} className="tipo-botao" onClick={() => onSelecionar(tipo.value)}>
            {tipo.label}
          </button>
        ))}
      </div>
    </div>
  )
}
