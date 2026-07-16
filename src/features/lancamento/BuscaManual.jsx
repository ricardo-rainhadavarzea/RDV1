import { useEffect, useState } from 'react'
import { buscarProdutosPorNome } from './lancamentoApi'

/** Fallback sem código de barras: busca produto por nome, digita só o valor total em R$. */
export default function BuscaManual({ onAdicionar }) {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [valorDigitado, setValorDigitado] = useState('')
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!aberto || termo.trim() === '') {
      setResultados([])
      return
    }
    let ativo = true
    buscarProdutosPorNome(termo).then((data) => {
      if (ativo) setResultados(data)
    })
    return () => {
      ativo = false
    }
  }, [termo, aberto])

  function escolherProduto(produto) {
    setSelecionado(produto)
    setResultados([])
    setErro(null)
  }

  function confirmarValor() {
    const valor = parseFloat(valorDigitado.replace(',', '.'))
    if (Number.isNaN(valor) || valor <= 0) {
      setErro('Digite um valor válido.')
      return
    }
    if (!selecionado.preco_unitario || selecionado.preco_unitario <= 0) {
      setErro('Esse produto não tem preço cadastrado — não dá pra calcular a quantidade automaticamente. Cadastre um preço em Gestão > Produtos antes de lançar.')
      return
    }

    onAdicionar({
      codigo: selecionado.codigo,
      nome: selecionado.nome,
      unidade: selecionado.unidade,
      quantidade: valor / selecionado.preco_unitario,
      valor,
      origem: 'manual',
    })

    setAberto(false)
    setTermo('')
    setSelecionado(null)
    setValorDigitado('')
    setErro(null)
  }

  if (!aberto) {
    return (
      <button className="link-botao" onClick={() => setAberto(true)}>
        Não tem código de barras? Buscar produto manualmente
      </button>
    )
  }

  return (
    <div className="card busca-manual">
      <div className="busca-manual-header">
        <h3>Busca manual</h3>
        <button
          onClick={() => {
            setAberto(false)
            setSelecionado(null)
            setTermo('')
          }}
        >
          Fechar
        </button>
      </div>

      {!selecionado && (
        <>
          <input
            type="text"
            placeholder="Nome do produto..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoFocus
          />
          <ul className="lista-resultados">
            {resultados.map((p) => (
              <li key={p.codigo}>
                <button onClick={() => escolherProduto(p)}>
                  {p.nome} — {p.unidade} — R$ {p.preco_unitario.toFixed(2)}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {selecionado && (
        <div className="confirmacao-manual">
          <p>
            <strong>{selecionado.nome}</strong> ({selecionado.unidade}, R$ {selecionado.preco_unitario.toFixed(2)})
          </p>
          <label>Valor total em R$</label>
          <input
            type="text"
            inputMode="decimal"
            value={valorDigitado}
            onChange={(e) => setValorDigitado(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && confirmarValor()}
          />
          {erro && <p className="erro">{erro}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={confirmarValor}>Adicionar ao carrinho</button>
            <button onClick={() => setSelecionado(null)}>Voltar</button>
          </div>
        </div>
      )}
    </div>
  )
}
