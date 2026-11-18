import { useEffect, useMemo, useState } from 'react'
import {
  buscarVendasRecentes,
  listarCodigosSelecionados,
  listarProdutosCandidatos,
  salvarSelecao,
} from './rupturaApi'
import { comparar, curvaAPorSetor, formatData, SECOES_RUPTURA } from './rupturaLib'

/** Gestão > Ruptura > Produtos: escolhe quais produtos entram na checagem, por setor. */
export default function SelecaoProdutos() {
  const [candidatos, setCandidatos] = useState(null)
  const [marcados, setMarcados] = useState(new Set())
  const [salvos, setSalvos] = useState(new Set())
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState(null)
  const [msg, setMsg] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [calculando, setCalculando] = useState(false)

  useEffect(() => {
    Promise.all([listarProdutosCandidatos(), listarCodigosSelecionados()]).then(
      ([produtos, codigos]) => {
        setCandidatos(produtos)
        setMarcados(new Set(codigos))
        setSalvos(new Set(codigos))
      },
      (e) => setErro(e.message)
    )
  }, [])

  const grupos = useMemo(() => {
    if (!candidatos) return []
    const termo = busca.trim().toLowerCase()
    return SECOES_RUPTURA.map((secao) => ({
      secao,
      todos: candidatos.filter((p) => p.secao === secao),
      visiveis: candidatos
        .filter((p) => p.secao === secao)
        .filter((p) => !termo || p.nome.toLowerCase().includes(termo) || p.codigo.includes(termo))
        .sort((a, b) => comparar(a.nome, b.nome)),
    }))
  }, [candidatos, busca])

  const alterado = marcados.size !== salvos.size || [...marcados].some((c) => !salvos.has(c))

  function alternar(codigo) {
    setMsg(null)
    setMarcados((prev) => {
      const novo = new Set(prev)
      if (novo.has(codigo)) novo.delete(codigo)
      else novo.add(codigo)
      return novo
    })
  }

  function marcarGrupo(grupo, valor) {
    setMsg(null)
    setMarcados((prev) => {
      const novo = new Set(prev)
      for (const p of grupo.visiveis) {
        if (valor) novo.add(p.codigo)
        else novo.delete(p.codigo)
      }
      return novo
    })
  }

  async function preMarcarCurvaA() {
    setErro(null)
    setMsg(null)
    setCalculando(true)
    try {
      const { vendas, inicios } = await buscarVendasRecentes(4)
      if (vendas.length === 0) {
        setErro('Não há vendas importadas. Importe a Curva ABC em Gestão > Vendas Semanais primeiro.')
        return
      }
      const codigos = curvaAPorSetor(vendas, 0.8)
      setMarcados(codigos)
      const maisAntigo = inicios[inicios.length - 1]
      setMsg(
        `Pré-marcado: ${codigos.size} produtos que somam 80% do faturamento de cada setor (${inicios.length === 1 ? 'última semana importada' : `últimas ${inicios.length} semanas importadas`}, desde ${formatData(maisAntigo)}). Ajuste à vontade e clique em Salvar.`
      )
    } catch (e) {
      setErro(e.message)
    } finally {
      setCalculando(false)
    }
  }

  async function salvar() {
    setErro(null)
    setMsg(null)
    setSalvando(true)
    try {
      await salvarSelecao([...marcados])
      setSalvos(new Set(marcados))
      setMsg(`Seleção salva: ${marcados.size} produtos vão aparecer na ruptura.`)
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  if (!candidatos) return <div className="card">{erro ? <p className="erro">{erro}</p> : 'Carregando…'}</div>

  return (
    <div>
      <div className="card">
        <h3>Produtos que aparecem na ruptura</h3>
        <p className="campo-ajuda">
          Só setores de produção própria. Os produtos marcados aparecem na checagem de todos os turnos. Produtos
          desmarcados continuam nos relatórios dos dias em que foram checados.
        </p>
        <div className="rup-barra-selecao">
          <button onClick={preMarcarCurvaA} disabled={calculando}>
            {calculando ? 'Calculando…' : 'Pré-marcar Curva A por setor'}
          </button>
          <input
            type="search"
            placeholder="Buscar por nome ou código"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <strong>{marcados.size} selecionados</strong>
          <button className="rup-iniciar rup-salvar" onClick={salvar} disabled={!alterado || salvando}>
            {salvando ? 'Salvando…' : 'Salvar seleção'}
          </button>
        </div>
        {erro && <p className="erro">{erro}</p>}
        {msg && <p className="sucesso">{msg}</p>}
      </div>

      {grupos.map((g) => {
        const nMarcados = g.todos.filter((p) => marcados.has(p.codigo)).length
        return (
          <details key={g.secao} className="card rup-setor-bloco" open={nMarcados > 0 || busca.trim() !== ''}>
            <summary>
              <strong>{g.secao}</strong> — {nMarcados} de {g.todos.length} marcados
            </summary>
            <div className="rup-acoes-setor">
              <button onClick={() => marcarGrupo(g, true)}>Marcar todos{busca.trim() ? ' da busca' : ''}</button>
              <button onClick={() => marcarGrupo(g, false)}>Limpar{busca.trim() ? ' da busca' : ''}</button>
            </div>
            <ul className="rup-lista-produtos">
              {g.visiveis.map((p) => (
                <li key={p.codigo}>
                  <label>
                    <input type="checkbox" checked={marcados.has(p.codigo)} onChange={() => alternar(p.codigo)} />
                    <span>{p.nome}</span>
                    <small>{p.codigo}</small>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        )
      })}
    </div>
  )
}
