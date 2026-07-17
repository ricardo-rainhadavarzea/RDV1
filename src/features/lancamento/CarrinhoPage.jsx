import { useState } from 'react'
import TipoSelector from './TipoSelector'
import EntradaProduto from './EntradaProduto'
import CarrinhoList from './CarrinhoList'
import { decodeEtiqueta } from './decodeEtiqueta'
import { buscarProdutoPorCodigo, salvarMovimentacao, TIPOS } from './lancamentoApi'

export default function CarrinhoPage() {
  const [tipo, setTipo] = useState(null)
  const [itens, setItens] = useState([])
  const [mensagem, setMensagem] = useState(null)
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const tipoLabel = TIPOS.find((t) => t.value === tipo)?.label

  function adicionarItem(item) {
    setItens((prev) => [item, ...prev])
  }

  function removerItem(index) {
    setItens((prev) => prev.filter((_, i) => i !== index))
  }

  /**
   * Duas leituras possíveis pro mesmo scan de 13 dígitos:
   * 1. Etiqueta de balança (prefixo "20", valor embutido) — produto próprio,
   *    pesado ou contado, quantidade calculada a partir do valor.
   * 2. Código de barras padrão EAN-13 — produto terceirizado (comprado
   *    pronto), o código bipado É o código do produto, sempre 1 unidade.
   * Tenta o formato de balança primeiro; se não decodificar ou o produto não
   * bater, tenta como EAN-13 direto antes de desistir.
   */
  async function handleCodigoCompleto(digits) {
    setErro(null)
    setMensagem(null)

    const decodificado = decodeEtiqueta(digits)

    if (decodificado) {
      let produto
      try {
        produto = await buscarProdutoPorCodigo(decodificado.codigoProduto)
      } catch (err) {
        setErro(err.message)
        return
      }
      if (produto) {
        if (!produto.preco_unitario || produto.preco_unitario <= 0) {
          setErro(
            `"${produto.nome}" não tem preço cadastrado — não dá pra calcular a quantidade automaticamente. Cadastre um preço em Gestão > Produtos.`
          )
          return
        }
        const quantidade = decodificado.valor / produto.preco_unitario
        adicionarItem({
          codigo: produto.codigo,
          nome: produto.nome,
          unidade: produto.unidade,
          quantidade,
          valor: decodificado.valor,
          origem: 'bipagem',
        })
        setMensagem(`Adicionado: ${produto.nome} — ${quantidade.toFixed(3)} ${produto.unidade}`)
        return
      }
    }

    let produtoEan
    try {
      produtoEan = await buscarProdutoPorCodigo(digits)
    } catch (err) {
      setErro(err.message)
      return
    }
    if (produtoEan) {
      if (!produtoEan.preco_unitario || produtoEan.preco_unitario <= 0) {
        setErro(`"${produtoEan.nome}" não tem preço cadastrado. Cadastre um preço em Gestão > Produtos.`)
        return
      }
      adicionarItem({
        codigo: produtoEan.codigo,
        nome: produtoEan.nome,
        unidade: produtoEan.unidade,
        quantidade: 1,
        valor: produtoEan.preco_unitario,
        origem: 'bipagem',
      })
      setMensagem(`Adicionado: ${produtoEan.nome} — 1 ${produtoEan.unidade}`)
      return
    }

    setErro(`Produto não encontrado (código ${decodificado ? decodificado.codigoProduto : digits}).`)
  }

  function trocarTipo() {
    if (itens.length > 0) {
      const confirmar = window.confirm(
        'Você tem itens não confirmados nesse carrinho. Trocar de tipo vai descartar esses itens. Continuar?'
      )
      if (!confirmar) return
    }
    setTipo(null)
    setItens([])
    setErro(null)
    setMensagem(null)
  }

  async function confirmarLancamento() {
    if (itens.length === 0) return
    setSalvando(true)
    setErro(null)
    try {
      await salvarMovimentacao(tipo, itens)
      setItens([])
      setMensagem(`Lançamento confirmado (${tipoLabel}).`)
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  if (!tipo) {
    return <TipoSelector onSelecionar={setTipo} />
  }

  return (
    <div className="carrinho-page">
      <div className="card carrinho-header">
        <h2>{tipoLabel}</h2>
        <button onClick={trocarTipo}>Trocar tipo</button>
      </div>

      <div className="card">
        <EntradaProduto onCodigoCompleto={handleCodigoCompleto} onAdicionar={adicionarItem} desabilitado={salvando} />
        {mensagem && <p className="sucesso">{mensagem}</p>}
        {erro && <p className="erro">{erro}</p>}
      </div>

      <div className="card">
        <CarrinhoList itens={itens} onRemover={removerItem} />
        <button onClick={confirmarLancamento} disabled={itens.length === 0 || salvando}>
          {salvando ? 'Confirmando...' : 'Confirmar lançamento'}
        </button>
      </div>
    </div>
  )
}
