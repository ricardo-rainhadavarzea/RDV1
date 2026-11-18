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
        <button className="tipo-botao tipo-botao-ruptura" onClick={() => onSelecionar('ruptura')}>
          Ruptura
        </button>
      </div>
    </div>
  )
}
