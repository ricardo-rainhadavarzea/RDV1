import { useEffect, useRef, useState } from 'react'
import { buscarProdutoPorCodigo, buscarProdutosPorNome } from './lancamentoApi'
import { padCodigo } from '../../lib/csvUtils'

/** Um leitor USB despeja 13 dígitos em poucos milissegundos — bem mais
 * rápido do que qualquer pessoa digitando. Se o campo acumular 13 dígitos
 * dentro desse intervalo, é bipagem; senão, é digitação manual. */
const LIMIAR_BIPAGEM_MS = 500

/**
 * Campo único pra lançar produto: aceita bipagem (etiqueta de balança
 * própria OU código de barras EAN-13 de terceiros) e digitação manual do
 * código, usando a velocidade da digitação pra diferenciar uma coisa da
 * outra. Quando bipado, processa na hora (mesma lógica de sempre). Quando
 * digitado, só confirma com Enter — daí pede a quantidade (não tem valor
 * embutido pra decodificar, como tem na etiqueta da balança). Se não sabe o
 * código, a busca por nome (F3) preenche esse mesmo campo.
 */
export default function EntradaProduto({ onCodigoCompleto, onAdicionar, desabilitado }) {
  const [valor, setValor] = useState('')
  const [produto, setProduto] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [quantidade, setQuantidade] = useState('')
  const [erroManual, setErroManual] = useState(null)

  const [modalAberto, setModalAberto] = useState(false)
  const [termoNome, setTermoNome] = useState('')
  const [resultadosNome, setResultadosNome] = useState([])
  const [buscaNomeExecutada, setBuscaNomeExecutada] = useState(false)
  const [buscandoNome, setBuscandoNome] = useState(false)
  const [indiceSelecionado, setIndiceSelecionado] = useState(0)

  const inputRef = useRef(null)
  const primeiroCaractereEm = useRef(null)

  useEffect(() => {
    if (!desabilitado) inputRef.current?.focus()
  }, [desabilitado])

  useEffect(() => {
    if (produto) document.getElementById('campo-quantidade-manual')?.focus()
  }, [produto])

  function limparEstadoProduto() {
    setProduto(null)
    setNaoEncontrado(false)
    setErroManual(null)
  }

  function handleChange(e) {
    const novoValor = e.target.value

    if (valor === '' && novoValor !== '') {
      primeiroCaractereEm.current = Date.now()
    }

    const digitos = novoValor.replace(/\D/g, '')
    if (digitos.length >= 13) {
      const decorrido = Date.now() - (primeiroCaractereEm.current ?? Date.now())
      if (decorrido < LIMIAR_BIPAGEM_MS) {
        primeiroCaractereEm.current = null
        setValor('')
        limparEstadoProduto()
        onCodigoCompleto(digitos.slice(0, 13))
        return
      }
    }

    setValor(novoValor)
    limparEstadoProduto()
  }

  async function confirmarCodigoManual() {
    const termo = valor.trim()
    if (termo === '') return
    setBuscando(true)
    try {
      const p = await buscarProdutoPorCodigo(padCodigo(termo))
      setProduto(p)
      setNaoEncontrado(!p)
    } finally {
      setBuscando(false)
    }
  }

  function resetarBuscaNome() {
    setTermoNome('')
    setResultadosNome([])
    setBuscaNomeExecutada(false)
    setIndiceSelecionado(0)
  }

  function abrirModal() {
    setModalAberto(true)
    resetarBuscaNome()
  }

  // Atalho F3 abre a busca por nome, de qualquer lugar da tela — igual ao
  // costume da equipe com a BM.
  useEffect(() => {
    function handleAtalhoGlobal(e) {
      if (e.key === 'F3') {
        e.preventDefault()
        setModalAberto(true)
        resetarBuscaNome()
      }
    }
    window.addEventListener('keydown', handleAtalhoGlobal)
    return () => window.removeEventListener('keydown', handleAtalhoGlobal)
  }, [])

  function selecionarResultado(p) {
    setValor(p.codigo)
    setProduto(p)
    setNaoEncontrado(false)
    setModalAberto(false)
  }

  async function executarBuscaNome() {
    if (termoNome.trim() === '') return
    setBuscandoNome(true)
    try {
      const data = await buscarProdutosPorNome(termoNome)
      setResultadosNome(data)
      setBuscaNomeExecutada(true)
      setIndiceSelecionado(0)
    } finally {
      setBuscandoNome(false)
    }
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
      if (buscaNomeExecutada && resultadosNome[indiceSelecionado]) {
        selecionarResultado(resultadosNome[indiceSelecionado])
      } else {
        executarBuscaNome()
      }
    } else if (e.key === 'Escape') {
      setModalAberto(false)
    }
  }

  function confirmarAdicao() {
    const qtd = parseFloat(quantidade.replace(',', '.'))
    if (Number.isNaN(qtd) || qtd <= 0) {
      setErroManual('Digite uma quantidade válida.')
      return
    }
    if (!produto.preco_unitario || produto.preco_unitario <= 0) {
      setErroManual('Esse produto não tem preço cadastrado — não dá pra calcular o valor. Cadastre um preço em Gestão > Produtos.')
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

    setValor('')
    setQuantidade('')
    limparEstadoProduto()
    inputRef.current?.focus()
  }

  return (
    <div className="entrada-produto">
      <label>Código do produto (bipar ou digitar)</label>
      <div className="linha-codigo-manual">
        <input
          ref={inputRef}
          type="text"
          value={valor}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              confirmarCodigoManual()
            }
          }}
          disabled={desabilitado}
          placeholder="Bipe a etiqueta ou digite o código..."
        />
        <button type="button" onClick={abrirModal}>
          Buscar por nome (F3)
        </button>
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
          {erroManual && <p className="erro">{erroManual}</p>}
          <button onClick={confirmarAdicao}>Adicionar ao carrinho</button>
        </div>
      )}

      {modalAberto && (
        <div className="modal-overlay" onClick={() => setModalAberto(false)}>
          <div className="modal-busca-nome" onClick={(e) => e.stopPropagation()}>
            <label>Buscar produto por nome (Enter busca, setas navegam)</label>
            <input
              type="text"
              placeholder="Nome ou parte do nome..."
              value={termoNome}
              onChange={(e) => {
                setTermoNome(e.target.value)
                setResultadosNome([])
                setBuscaNomeExecutada(false)
              }}
              onKeyDown={handleTecladoModal}
              autoFocus
            />
            {buscandoNome && <p>Buscando...</p>}
            {buscaNomeExecutada && !buscandoNome && resultadosNome.length === 0 && (
              <p className="erro">Nenhum produto encontrado.</p>
            )}
            {resultadosNome.length > 0 && (
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
            )}
            <button type="button" onClick={() => setModalAberto(false)}>
              Fechar (Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
