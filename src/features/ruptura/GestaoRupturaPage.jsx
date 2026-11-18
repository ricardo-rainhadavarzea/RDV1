import { useState } from 'react'
import RelatoriosRuptura from './RelatoriosRuptura'
import SelecaoProdutos from './SelecaoProdutos'
import HorariosRuptura from './HorariosRuptura'

const SUBABAS = [
  { value: 'relatorios', label: 'Relatórios' },
  { value: 'produtos', label: 'Produtos da ruptura' },
  { value: 'horarios', label: 'Turnos' },
]

/** Aba "Ruptura" da Gestão. */
export default function GestaoRupturaPage() {
  const [aba, setAba] = useState('relatorios')

  return (
    <div>
      <nav className="abas-gestao">
        {SUBABAS.map((a) => (
          <button key={a.value} className={aba === a.value ? 'aba-ativa' : ''} onClick={() => setAba(a.value)}>
            {a.label}
          </button>
        ))}
      </nav>
      {aba === 'relatorios' && <RelatoriosRuptura />}
      {aba === 'produtos' && <SelecaoProdutos />}
      {aba === 'horarios' && <HorariosRuptura />}
    </div>
  )
}
