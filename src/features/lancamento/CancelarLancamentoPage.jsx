import { useEffect, useState } from 'react'
import PeriodoFiltro from '../indicadores/PeriodoFiltro'
import { calcularPeriodo, formatarISO } from '../indicadores/periodoUtils'
import { buscarMovimentacoes, cancelarMovimentacao, TIPOS } from './lancamentoApi'

function formatarReal(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR')
}

export default function CancelarLancamentoPage() {
  const [filtro, setFiltro] = useState('hoje')
  const [personalizado, setPersonalizado] = useState({
    inicio: formatarISO(new Date()),
    fim: formatarISO(new Date()),
  })
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [movimentacoes, setMovimentacoes] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const [expandidoId, setExpandidoId] = useState(null)
  const [cancelandoId, setCancelandoId] = useState(null)

  function carregar() {
    const { inicio, fim } = calcularPeriodo(filtro, personalizado)
    setCarregando(true)
    setErro(null)
    buscarMovimentacoes(inicio, fim, tipoFiltro || undefined)
      .then(setMovimentacoes)
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false))
  }

  useEffect(carregar, [filtro, personalizado, tipoFiltro])

  async function handleCancelar(mov) {
    const tipoLabel = TIPOS.find((t) => t.value === mov.tipo)?.label ?? mov.tipo
    const confirmar = window.confirm(
      `Cancelar este lançamento?\n\n${tipoLabel} — ${formatarDataHora(mov.criado_em)}\n${mov.total_itens} ${mov.total_itens === 1 ? 'item' : 'itens'} — ${formatarReal(mov.total_valor)}\n\nEssa ação não pode ser desfeita.`
    )
    if (!confirmar) return

    setCancelandoId(mov.id)
    setErro(null)
    try {
      await cancelarMovimentacao(mov.id)
      setMovimentacoes((prev) => prev.filter((m) => m.id !== mov.id))
    } catch (err) {
      setErro(err.message)
    } finally {
      setCancelandoId(null)
    }
  }

  return (
    <div className="card">
      <h3>Cancelar um lançamento</h3>
      <p className="campo-ajuda">Encontre o lançamento errado e cancele. Isso apaga o lançamento e seus itens — não dá pra desfazer.</p>

      <PeriodoFiltro
        filtro={filtro}
        onFiltroChange={setFiltro}
        personalizado={personalizado}
        onPersonalizadoChange={setPersonalizado}
      />

      <div className="campo">
        <label>Tipo</label>
        <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}>
          <option value="">Todos</option>
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {erro && <p className="erro">{erro}</p>}
      {carregando && <p>Carregando...</p>}

      {!carregando && movimentacoes.length === 0 && <p className="carrinho-vazio">Nenhum lançamento nesse período.</p>}

      {!carregando &&
        movimentacoes.map((mov) => {
          const tipoLabel = TIPOS.find((t) => t.value === mov.tipo)?.label ?? mov.tipo
          const expandido = expandidoId === mov.id
          return (
            <div key={mov.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>{tipoLabel}</strong> — {formatarDataHora(mov.criado_em)}
                  <br />
                  {mov.total_itens} {mov.total_itens === 1 ? 'item' : 'itens'} — {formatarReal(mov.total_valor)}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setExpandidoId(expandido ? null : mov.id)}>
                    {expandido ? 'Ocultar itens' : 'Ver itens'}
                  </button>
                  <button onClick={() => handleCancelar(mov)} disabled={cancelandoId === mov.id}>
                    {cancelandoId === mov.id ? 'Cancelando...' : 'Cancelar lançamento'}
                  </button>
                </div>
              </div>

              {expandido && (
                <table style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Quantidade</th>
                      <th>Valor</th>
                      <th>Origem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mov.movimentacao_itens.map((item, i) => (
                      <tr key={i}>
                        <td>{item.nome}</td>
                        <td>
                          {Number(item.quantidade).toFixed(3)} {item.unidade}
                        </td>
                        <td>{formatarReal(Number(item.valor))}</td>
                        <td>{item.origem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
    </div>
  )
}
