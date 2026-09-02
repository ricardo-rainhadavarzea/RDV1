import { useEffect, useState } from 'react'
import PeriodoFiltro from '../indicadores/PeriodoFiltro'
import { calcularPeriodo, formatarISO } from '../indicadores/periodoUtils'
import { buscarMovimentacoes, cancelarMovimentacao, atualizarItemMovimentacao, excluirItemMovimentacao, TIPOS } from './lancamentoApi'

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
  const [ordenacao, setOrdenacao] = useState('data') // 'data' | 'valor_desc' | 'valor_asc'
  const [movimentacoes, setMovimentacoes] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const [expandidoId, setExpandidoId] = useState(null)
  const [cancelandoId, setCancelandoId] = useState(null)
  const [itemEditando, setItemEditando] = useState(null) // { itemId, quantidade, valor } | null
  const [salvandoItem, setSalvandoItem] = useState(false)
  const [excluindoItemId, setExcluindoItemId] = useState(null)

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

  const movimentacoesOrdenadas = [...movimentacoes].sort((a, b) => {
    if (ordenacao === 'valor_desc') return b.total_valor - a.total_valor
    if (ordenacao === 'valor_asc') return a.total_valor - b.total_valor
    return new Date(b.criado_em) - new Date(a.criado_em)
  })

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

  function iniciarEdicaoItem(item) {
    setItemEditando({ itemId: item.id, quantidade: String(item.quantidade), valor: String(item.valor) })
  }

  async function handleSalvarItem(mov, item) {
    const novaQuantidade = parseFloat(String(itemEditando.quantidade).replace(',', '.'))
    const novoValor = parseFloat(String(itemEditando.valor).replace(',', '.'))
    if (Number.isNaN(novaQuantidade) || Number.isNaN(novoValor)) {
      setErro('Quantidade ou valor inválido.')
      return
    }

    setSalvandoItem(true)
    setErro(null)
    try {
      const totais = await atualizarItemMovimentacao(item.id, mov.id, { quantidade: novaQuantidade, valor: novoValor })
      setMovimentacoes((prev) =>
        prev.map((m) =>
          m.id !== mov.id
            ? m
            : {
                ...m,
                total_itens: totais.total_itens,
                total_valor: totais.total_valor,
                movimentacao_itens: m.movimentacao_itens.map((it) =>
                  it.id === item.id ? { ...it, quantidade: novaQuantidade, valor: novoValor } : it
                ),
              }
        )
      )
      setItemEditando(null)
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvandoItem(false)
    }
  }

  async function handleExcluirItem(mov, item) {
    const confirmar = window.confirm(
      `Excluir só este item (mantém os outros do lançamento)?\n\n${item.nome} — ${Number(item.quantidade).toFixed(3)} ${item.unidade} — ${formatarReal(Number(item.valor))}\n\nEssa ação não pode ser desfeita.`
    )
    if (!confirmar) return

    setExcluindoItemId(item.id)
    setErro(null)
    try {
      const totais = await excluirItemMovimentacao(item.id, mov.id)
      if (totais === null) {
        // Era o único item do lançamento — o lançamento inteiro foi removido junto.
        setMovimentacoes((prev) => prev.filter((m) => m.id !== mov.id))
      } else {
        setMovimentacoes((prev) =>
          prev.map((m) =>
            m.id !== mov.id
              ? m
              : {
                  ...m,
                  total_itens: totais.total_itens,
                  total_valor: totais.total_valor,
                  movimentacao_itens: m.movimentacao_itens.filter((it) => it.id !== item.id),
                }
          )
        )
      }
    } catch (err) {
      setErro(err.message)
    } finally {
      setExcluindoItemId(null)
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

      <div className="campo">
        <label>Ordenar por</label>
        <div className="periodo-botoes">
          <button className={ordenacao === 'data' ? 'periodo-ativo' : ''} onClick={() => setOrdenacao('data')}>
            Mais recente
          </button>
          <button className={ordenacao === 'valor_desc' ? 'periodo-ativo' : ''} onClick={() => setOrdenacao('valor_desc')}>
            Maior valor
          </button>
          <button className={ordenacao === 'valor_asc' ? 'periodo-ativo' : ''} onClick={() => setOrdenacao('valor_asc')}>
            Menor valor
          </button>
        </div>
      </div>

      {erro && <p className="erro">{erro}</p>}
      {carregando && <p>Carregando...</p>}

      {!carregando && movimentacoes.length === 0 && <p className="carrinho-vazio">Nenhum lançamento nesse período.</p>}

      {!carregando &&
        movimentacoesOrdenadas.map((mov) => {
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
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mov.movimentacao_itens.map((item) => {
                      const editandoEsteItem = itemEditando?.itemId === item.id
                      return (
                        <tr key={item.id}>
                          <td>{item.nome}</td>
                          <td>
                            {editandoEsteItem ? (
                              <>
                                <input
                                  style={{ width: 80 }}
                                  value={itemEditando.quantidade}
                                  onChange={(e) => setItemEditando((ed) => ({ ...ed, quantidade: e.target.value }))}
                                  autoFocus
                                />{' '}
                                {item.unidade}
                              </>
                            ) : (
                              <>
                                {Number(item.quantidade).toFixed(3)} {item.unidade}
                              </>
                            )}
                          </td>
                          <td>
                            {editandoEsteItem ? (
                              <input
                                style={{ width: 80 }}
                                value={itemEditando.valor}
                                onChange={(e) => setItemEditando((ed) => ({ ...ed, valor: e.target.value }))}
                              />
                            ) : (
                              formatarReal(Number(item.valor))
                            )}
                          </td>
                          <td>{item.origem}</td>
                          <td>
                            {editandoEsteItem ? (
                              <>
                                <button onClick={() => handleSalvarItem(mov, item)} disabled={salvandoItem}>
                                  {salvandoItem ? 'Salvando...' : 'Salvar'}
                                </button>
                                <button onClick={() => setItemEditando(null)} disabled={salvandoItem}>
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => iniciarEdicaoItem(item)}>Editar</button>
                                <button onClick={() => handleExcluirItem(mov, item)} disabled={excluindoItemId === item.id}>
                                  {excluindoItemId === item.id ? 'Excluindo...' : 'Excluir'}
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
    </div>
  )
}
