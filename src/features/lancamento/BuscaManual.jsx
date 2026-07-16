import { useEffect, useRef, useState } from 'react'
import { buscarProdutoPorCodigo, buscarProdutosPorNome } from './lancamentoApi'
import { padCodigo } from '../../lib/csvUtils'
import { useDebounce } from '../../lib/useDebounce'

/**
 * Lançamento manual, pra quando não tem código de barras (mais comum do que
 * o esperado, segundo a equipe de loja). Fluxo: operador digita o código
 * (que geralmente já sabe de cabeça) e informa a quantidade — não o valor,
 * já que aqui não tem etiqueta de balança pra decodificar. Quando não sabe
 * o código, tem uma busca por nome (igual a da BM) que preenche o código
 * automaticamente.
 */
export default function BuscaManual({ onAdicionar }) {
  const [codigo, setCodigo] = useState('')
  const codigoBuscado = useDebounce(codigo, 250)
  const [produto, setProduto] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [quantidade, setQuantidade] = useState('')
  const [erro, setErro] = useState(null)

  const [modalAberto, setModalAberto] = useState(false)
  const [termoNome, setTermoNome] = useState('')
  const termoNomeBuscado = useDebounce(termoNome, 300)
  const [resultadosNome, setResultadosNome] = useState([])
  const [indiceSelecionado, setIndiceSelecionado] = useState(0)

  const inputCodigoRef = useRef(null)

  useEffect(() => {
    if (codigoBuscado.trim() === '') {
      setProduto(null)
      setNaoEncontrado(false)
      return
    }
    let ativo = true
    setBuscando(true)
    buscarProdutoPorCodigo(padCodigo(codigoBuscado.trim()))
      .then((p) => {
        if (!ativo) return
        setProduto(p)
        setNaoEncontrado(!p)
      })
      .finally(() => ativo && setBuscando(false))
    return () => {
      ativo = false
    }
  }, [codigoBuscado])

  useEffect(() => {
    if (!modalAberto || termoNomeBuscado.trim() === '') {
      setResultadosNome([])
      return
    }
    let ativo = true
    buscarProdutosPorNome(termoNomeBuscado).then((data) => {
      if (!ativo) return
      setResultadosNome(data)
      setIndiceSelecionado(0)
    })
    return () => {
      ativo = false
    }
  }, [termoNomeBuscado, modalAberto])

  function abrirModal() {
    setModalAberto(true)
    setTermoNome('')
    setResultadosNome([])
    setIndiceSelecionado(0)
  }

  // Atalho F3 abre a busca por nome, de qualquer lugar da tela — igual ao
  // costume da equipe com a BM.
  useEffect(() => {
    function handleAtalhoGlobal(e) {
      if (e.key === 'F3') {
        e.preventDefault()
        setModalAberto(true)
        setTermoNome('')
        setResultadosNome([])
        setIndiceSelecionado(0)
      }
    }
    window.addEventListener('keydown', handleAtalhoGlobal)
    return () => window.removeEventListener('keydown', handleAtalhoGlobal)
  }, [])

  function selecionarResultado(p) {
    setCodigo(p.codigo)
    setModalAberto(false)
  }

  function handleTecladoModal(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndiceSelecionado((i) => Math.min(i + 1, resultadosNome.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndiceSelecionado((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (resultadosNome[indiceSelecionado]) selecionarResultado(resultadosNome[indiceSelecionado])
    } else if (e.key === 'Escape') {
      setModalAberto(false)
    }
  }

  function confirmarAdicao() {
    const qtd = parseFloat(quantidade.replace(',', '.'))
    if (Number.isNaN(qtd) || qtd <= 0) {
      setErro('Digite uma quantidade válida.')
      return
    }
    if (!produto.preco_unitario || produto.preco_unitario <= 0) {
      setErro('Esse produto não tem preço cadastrado — não dá pra calcular o valor. Cadastre um preço em Gestão > Produtos.')
      return
    }

    onAdicionar({
      codigo: produto.codigo,
      nome: produto.nome,
      unidade: produto.unidade,
      quantidade: qtd,
      valor: Math.round(qtd * produto.preco_unitario * 100) / 100,
      origem: 'manual',
    })

    setCodigo('')
    setProduto(null)
    setQuantidade('')
    setErro(null)
    inputCodigoRef.current?.focus()
  }

  return (
    <div className="card busca-manual">
      <h3>Lançamento manual (sem código de barras)</h3>

      <div className="campo">
        <label>Código do produto</label>
        <div className="linha-codigo-manual">
          <input
            ref={inputCodigoRef}
            type="text"
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value)
              setErro(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && produto) {
                e.preventDefault()
                document.getElementById('campo-quantidade-manual')?.focus()
              }
            }}
            placeholder="Digite o código..."
          />
          <button type="button" onClick={abrirModal}>
            Buscar por nome (F3)
          </button>
        </div>
      </div>

      {buscando && <p>Buscando...</p>}
      {naoEncontrado && !buscando && <p className="erro">Produto não encontrado.</p>}

      {produto && (
        <div className="confirmacao-manual">
          <p>
            <strong>{produto.nome}</strong> ({produto.unidade}, R$ {produto.preco_unitario.toFixed(2)})
          </p>
          <label htmlFor="campo-quantidade-manual">Quantidade ({produto.unidade})</label>
          <input
            id="campo-quantidade-manual"
            type="text"
            inputMode="decimal"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmarAdicao()}
            autoFocus
          />
          {erro && <p className="erro">{erro}</p>}
          <button onClick={confirmarAdicao}>Adicionar ao carrinho</button>
        </div>
      )}

      {modalAberto && (
        <div className="modal-overlay" onClick={() => setModalAberto(false)}>
          <div className="modal-busca-nome" onClick={(e) => e.stopPropagation()}>
            <label>Buscar produto por nome</label>
            <input
              type="text"
              placeholder="Nome ou parte do nome..."
              value={termoNome}
              onChange={(e) => setTermoNome(e.target.value)}
              onKeyDown={handleTecladoModal}
              autoFocus
            />
            <ul className="lista-resultados">
              {resultadosNome.map((p, i) => (
                <li key={p.codigo}>
                  <button
                    className={i === indiceSelecionado ? 'resultado-selecionado' : ''}
                    onClick={() => selecionarResultado(p)}
                  >
                    {p.nome} — {p.unidade} — R$ {p.preco_unitario.toFixed(2)}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setModalAberto(false)}>
              Fechar (Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
