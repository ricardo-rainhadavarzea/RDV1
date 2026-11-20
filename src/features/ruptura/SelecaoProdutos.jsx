import { useEffect, useMemo, useState } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  buscarVendasRecentes,
  listarCodigosSelecionados,
  listarProdutosCandidatos,
  salvarSelecao,
} from './rupturaApi'
import { comparar, curvaAPorSetor, formatData, ordenarProdutos, SECOES_RUPTURA } from './rupturaLib'

function iguais(a, b) {
  return a.length === b.length && a.every((c, i) => c === b[i])
}

/** Linha da sequência: alça para arrastar, nome, setor e botões ▲ ▼ remover. */
function LinhaSequencia({ codigo, posicao, total, produto, onSubir, onDescer, onRemover }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: codigo })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <li ref={setNodeRef} style={style} className={'rup-linha-seq' + (isDragging ? ' rup-arrastando' : '')}>
      <button
        type="button"
        className="rup-alca"
        aria-label={`Arrastar ${produto?.nome ?? codigo}`}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <span className="rup-posicao">{posicao}</span>
      <span className="rup-seq-nome">
        {produto?.nome ?? codigo}
        <small>{produto?.secao ?? 'fora das seções da ruptura'}</small>
      </span>
      <span className="rup-seq-botoes">
        <button type="button" onClick={onSubir} disabled={posicao === 1} aria-label="Subir">
          ▲
        </button>
        <button type="button" onClick={onDescer} disabled={posicao === total} aria-label="Descer">
          ▼
        </button>
        <button type="button" onClick={onRemover} aria-label="Tirar da ruptura">
          ✕
        </button>
      </span>
    </li>
  )
}

/** Gestão > Ruptura > Produtos: escolhe os produtos e a sequência em que aparecem na checagem. */
export default function SelecaoProdutos() {
  const [candidatos, setCandidatos] = useState(null)
  const [sequencia, setSequencia] = useState([]) // códigos, na ordem da checagem
  const [salva, setSalva] = useState([])
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState(null)
  const [msg, setMsg] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [calculando, setCalculando] = useState(false)

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    Promise.all([listarProdutosCandidatos(), listarCodigosSelecionados()]).then(
      ([produtos, codigos]) => {
        setCandidatos(produtos)
        setSequencia(codigos)
        setSalva(codigos)
      },
      (e) => setErro(e.message)
    )
  }, [])

  const porCodigo = useMemo(() => new Map((candidatos ?? []).map((p) => [p.codigo, p])), [candidatos])
  const marcados = useMemo(() => new Set(sequencia), [sequencia])
  const alterado = !iguais(sequencia, salva)
  const buscando = busca.trim() !== ''

  // Blocos por setor: só os que ainda NÃO estão na sequência, em ordem alfabética.
  const grupos = useMemo(() => {
    if (!candidatos) return []
    const termo = busca.trim().toLowerCase()
    return SECOES_RUPTURA.map((secao) => {
      const todos = candidatos.filter((p) => p.secao === secao)
      return {
        secao,
        nMarcados: todos.filter((p) => marcados.has(p.codigo)).length,
        total: todos.length,
        disponiveis: todos
          .filter((p) => !marcados.has(p.codigo))
          .filter((p) => !termo || p.nome.toLowerCase().includes(termo) || p.codigo.includes(termo))
          .sort((a, b) => comparar(a.nome, b.nome)),
      }
    })
  }, [candidatos, busca, marcados])

  function mudar(novaSequencia) {
    setMsg(null)
    setSequencia(novaSequencia)
  }

  const marcar = (codigo) => mudar([...sequencia, codigo]) // entra no fim da sequência
  const desmarcar = (codigo) => mudar(sequencia.filter((c) => c !== codigo))
  const mover = (de, para) => mudar(arrayMove(sequencia, de, para))

  function marcarTodosDoSetor(grupo) {
    mudar([...sequencia, ...grupo.disponiveis.map((p) => p.codigo)])
  }

  function limparSetor(secao) {
    mudar(sequencia.filter((c) => porCodigo.get(c)?.secao !== secao))
  }

  function aoSoltar({ active, over }) {
    if (!over || active.id === over.id) return
    mover(sequencia.indexOf(active.id), sequencia.indexOf(over.id))
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
      const curvaA = curvaAPorSetor(vendas, 0.8)
      // Quem já estava na sequência e continua na Curva A mantém o lugar; os novos entram no fim (setor, A–Z).
      const mantidos = sequencia.filter((c) => curvaA.has(c))
      const jaTem = new Set(mantidos)
      const novos = ordenarProdutos(candidatos.filter((p) => curvaA.has(p.codigo) && !jaTem.has(p.codigo))).map(
        (p) => p.codigo
      )
      mudar([...mantidos, ...novos])
      const maisAntigo = inicios[inicios.length - 1]
      setMsg(
        `Pré-marcado: ${curvaA.size} produtos que somam 80% do faturamento de cada setor (${inicios.length === 1 ? 'última semana importada' : `últimas ${inicios.length} semanas importadas`}, desde ${formatData(maisAntigo)}). Quem já estava na sequência manteve o lugar; os novos entraram no fim. Ajuste e clique em Salvar.`
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
      await salvarSelecao(sequencia)
      setSalva(sequencia)
      setMsg(`Seleção salva: ${sequencia.length} produtos, na ordem mostrada, vão aparecer na ruptura.`)
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
          Marque os produtos nos setores abaixo: eles sobem para a <strong>Ordem da checagem</strong>, onde você
          arrasta (ou usa ▲ ▼) para seguir o caminho da loja. A sequência vale para todos os turnos e para as
          próximas checagens. Produtos retirados continuam nos relatórios dos dias em que foram checados.
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
          <strong>{sequencia.length} selecionados</strong>
          <button className="rup-iniciar rup-salvar" onClick={salvar} disabled={!alterado || salvando}>
            {salvando ? 'Salvando…' : 'Salvar seleção'}
          </button>
        </div>
        {erro && <p className="erro">{erro}</p>}
        {msg && <p className="sucesso">{msg}</p>}
      </div>

      <div className="card">
        <h3>Ordem da checagem ({sequencia.length})</h3>
        {sequencia.length === 0 ? (
          <p className="campo-ajuda">Nenhum produto marcado ainda. Marque nos setores abaixo.</p>
        ) : (
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
            <SortableContext items={sequencia} strategy={verticalListSortingStrategy}>
              <ol className="rup-sequencia">
                {sequencia.map((codigo, i) => (
                  <LinhaSequencia
                    key={codigo}
                    codigo={codigo}
                    posicao={i + 1}
                    total={sequencia.length}
                    produto={porCodigo.get(codigo)}
                    onSubir={() => mover(i, i - 1)}
                    onDescer={() => mover(i, i + 1)}
                    onRemover={() => desmarcar(codigo)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {grupos.map((g) => (
        <details key={g.secao + (buscando ? ':busca' : '')} className="card rup-setor-bloco" open={buscando}>
          <summary>
            <strong>{g.secao}</strong> — {g.nMarcados} de {g.total} marcados
          </summary>
          <div className="rup-acoes-setor">
            <button onClick={() => marcarTodosDoSetor(g)} disabled={g.disponiveis.length === 0}>
              Marcar todos{buscando ? ' da busca' : ''}
            </button>
            <button onClick={() => limparSetor(g.secao)} disabled={g.nMarcados === 0}>
              Tirar todos do setor
            </button>
          </div>
          <ul className="rup-lista-produtos">
            {g.disponiveis.map((p) => (
              <li key={p.codigo}>
                <label>
                  <input type="checkbox" checked={false} onChange={() => marcar(p.codigo)} />
                  <span>{p.nome}</span>
                  <small>{p.codigo}</small>
                </label>
              </li>
            ))}
          </ul>
          {g.disponiveis.length === 0 && <p className="campo-ajuda">Nada para marcar aqui.</p>}
        </details>
      ))}
    </div>
  )
}
